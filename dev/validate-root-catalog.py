#!/usr/bin/env python3
"""Validate the 23-card root course catalog in /home/ybc/hosted/unibo-lessons/index.html.

Checks:
1. Tag balance of index.html.
2. Every card href resolves to an existing local file or directory.
3. Exactly 23 cards, no duplicates.
4. Every course index.html exists at the card target (or the dir has index.html).
5. Each course's stated lesson count matches the count of non-index .html chapters
   in that directory (and its own index links to them).
6. Podcast card points at a directory containing index.html and audio files.
"""
import html.parser
import os
import re
import sys
from pathlib import Path

ROOT = Path("/home/ybc/hosted/unibo-lessons")
INDEX = ROOT / "index.html"


class Balance(html.parser.HTMLParser):
    VOID = {"meta", "link", "br", "img", "hr", "input", "source", "area", "base", "col", "embed", "track", "wbr"}

    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        if tag not in self.VOID:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        if not self.stack:
            self.errors.append(f"unexpected </{tag}> at {self.getpos()}")
            return
        open_tag, pos = self.stack.pop()
        if open_tag != tag:
            self.errors.append(f"mismatch: <{open_tag}> opened at {pos}, closed by </{tag}> at {self.getpos()}")


def main():
    problems = []
    html = INDEX.read_text(encoding="utf-8")

    # 1. tag balance
    b = Balance()
    b.feed(html)
    for e in b.errors:
        problems.append(f"HTML: {e}")
    if b.stack:
        problems.append(f"HTML: unclosed tags: {[(t, p) for t, p in b.stack]}")

    # 2-3. cards
    cards = re.findall(r'<a class="card" href="([^"]+)">\s*<h2>(.*?)</h2>\s*<p>(.*?)</p>\s*</a>', html, re.S)
    if len(cards) != 23:
        problems.append(f"EXPECTED 23 cards, found {len(cards)}")
    hrefs = [c[0] for c in cards]
    dupes = {h for h in hrefs if hrefs.count(h) > 1}
    if dupes:
        problems.append(f"duplicate card hrefs: {dupes}")

    for href, title, desc in cards:
        target = (ROOT / href).resolve()
        if href.endswith("/"):
            # directory resource root
            if not target.is_dir():
                problems.append(f"card '{title}' -> {href}: NOT a directory")
                continue
            idx = target / "index.html"
            if not idx.exists():
                problems.append(f"card '{title}' -> {href}: directory has no index.html")
            mp3s = list(target.glob("*.mp3"))
            if not mp3s:
                problems.append(f"card '{title}' -> {href}: directory has no audio files")
            print(f"OK  {href:42s} {title} — {desc} (dir root, {len(mp3s)} audio files)")
        else:
            if not target.exists():
                problems.append(f"card '{title}' -> {href}: MISSING")
                continue
            if not target.is_file():
                problems.append(f"card '{title}' -> {href}: target is not a file")
                continue
            # 4. index must exist at target
            course_dir = target.parent
            idx = course_dir / "index.html"
            if target != idx:
                problems.append(f"card '{title}' -> {href}: target is not <course>/index.html")
                continue

            # 5. count chapters: non-index .html files directly in course dir
            chapters = sorted(p for p in course_dir.glob("*.html") if p.name != "index.html")
            n = len(chapters)
            # stated number from the card description + explicit extras in the copy
            m = re.match(r"(\d+)\s+(?:interactive\s+)?lessons?", desc)
            stated = int(m.group(1)) if m else None
            extras = 0
            if "mock exam" in desc.lower():
                extras += 1
            if "written test" in desc.lower():
                extras += 1
            mprep = re.search(r"(\d+)\s+exam-prep pages", desc)
            if mprep:
                extras += int(mprep.group(1))
            if stated is not None and stated + extras != n:
                problems.append(
                    f"card '{title}' states {stated} lessons (+{extras} extras) but dir has {n} chapter files: {href}"
                )
            # course's own index must link every chapter file
            if idx.exists():
                idx_text = idx.read_text(encoding="utf-8", errors="replace")
                for ch in chapters:
                    if ch.name not in idx_text:
                        problems.append(f"{course_dir.name}: index.html does not link {ch.name}")
            print(f"OK  {href:42s} {title} — {desc} (found {n} chapter files)")

    # 6. cross-check: every course dir with index.html has a card
    for d in sorted(p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith(".")):
        if d.name in ("dev", "docs", "node_modules"):
            continue
        if (d / "index.html").exists() and d.name + "/index.html" not in hrefs and d.name + "/" not in hrefs:
            problems.append(f"DIR {d.name} has index.html but NO card in catalog")

    print("\n" + ("ALL CHECKS PASSED" if not problems else "PROBLEMS:"))
    for p in problems:
        print(" -", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
