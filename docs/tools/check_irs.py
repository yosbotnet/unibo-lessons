#!/usr/bin/env python3
"""Lightweight internal link/completeness check for the IRS course.

Usage: python3 docs/tools/check_irs.py

Checks:
  1. INDEX: index.html links every cap-*.html; no orphan chapters; every
     index link targets an existing file; index lists chapters in order.
  2. LINKS: every internal .html href between pages targets an existing file;
     fragment links (#...) are checked against ids in the target.
  3. NAV: every chapter's lk-chnav links to index.html and to the correct
     previous/next chapter; the sequence covers exactly chapters 1..16.
  4. META: each chapter header declares widget/plate counts that match the
     actual markup (widgets = .irs-w blocks + data-kit tab groups,
     plates = figure.lk-fig).
  5. SHELL: each chapter has lk-toc, lk-header, #quiz, lk-foot, data-src
     coverage, and a meaningful <title>; local assets referenced exist.
  6. STRAY: no leftover temp/backup files in the course directory.

Exit 0 = clean.
"""
import re
import sys
from pathlib import Path

IRS = Path(__file__).resolve().parents[2] / "irs"
problems = []

chapters = sorted(IRS.glob("cap-*.html"))
files = {p.name for p in IRS.glob("*.html")}
ids_cache = {}


def ids_of(name):
    if name not in ids_cache:
        ids_cache[name] = set(re.findall(r'id="([^"]+)"', (IRS / name).read_text(encoding="utf-8")))
    return ids_cache[name]


def numbers(name):
    m = re.match(r"cap-(\d\d)-", name)
    return int(m.group(1)) if m else None


# 1: index completeness
idx = IRS / "index.html"
if not idx.exists():
    problems.append("index.html missing")
else:
    idx_html = idx.read_text(encoding="utf-8")
    linked = set(re.findall(r'href="([^"#:]+\.html)', idx_html))
    seq = [numbers(n) for n in re.findall(r'href="(cap-\d\d-[^"#:]+\.html)', idx_html)]
    for p in chapters:
        if p.name not in linked:
            problems.append(f"ORPHAN: {p.name} not linked from index.html")
    if seq != list(range(1, 17)):
        problems.append(f"INDEX ORDER: chapters listed as {seq}, expected 1..16")

# 2: inter-page links + fragments
for page in sorted(files):
    html = (IRS / page).read_text(encoding="utf-8")
    for href, frag in re.findall(r'href="([^"#:]+\.html)(#[^"]*)?"', html):
        target, f = href, frag.lstrip("#") if frag else ""
        if "/" in target:
            continue
        if target not in files:
            problems.append(f"{page}: broken link to {target}")
        elif f and f not in ids_of(target):
            problems.append(f"{page}: broken fragment {target}#{f}")

# 3: chapter navigation
for i, p in enumerate(chapters):
    html = p.read_text(encoding="utf-8")
    nav = re.search(r'<nav class="lk-chnav"[^>]*>(.*?)</nav>', html, re.S)
    if not nav:
        problems.append(f"{p.name}: no lk-chnav nav")
        continue
    hrefs = re.findall(r'href="([^"]+)"', nav.group(1))
    targets = {h.split("#")[0] for h in hrefs}
    if "index.html" not in targets:
        problems.append(f"{p.name}: chnav does not link the course index")
    n = numbers(p.name)
    if n is None:
        problems.append(f"{p.name}: cannot derive chapter number")
        continue
    expect = set()
    if n > 1:
        expect.add(chapters[i - 1].name)
    if n < 16:
        expect.add(chapters[i + 1].name)
    missing = expect - targets
    extra = targets - expect - {"index.html"}
    if missing:
        problems.append(f"{p.name}: chnav missing neighbour(s) {sorted(missing)}")
    if extra:
        problems.append(f"{p.name}: chnav links unexpected page(s) {sorted(extra)}")

# 4: header meta vs actual markup
for p in chapters:
    html = p.read_text(encoding="utf-8")
    meta = re.search(r'<div class="lk-meta">(.*?)</div>', html, re.S)
    if not meta:
        problems.append(f"{p.name}: no lk-meta header line")
        continue
    mw = re.search(r"(\d+)\s+interactive widget", meta.group(1))
    mp = re.search(r"(\d+)\s+plates?", meta.group(1))
    declared_w = int(mw.group(1)) if mw else None
    declared_p = int(mp.group(1)) if mp else None
    actual_w = len(re.findall(r'class="irs-w', html)) + len(re.findall(r'data-kit="[a-z]+"', html))
    actual_p = len(re.findall(r'<figure class="lk-fig"', html))
    if declared_w != actual_w:
        problems.append(f"{p.name}: declares {declared_w} widgets, markup has {actual_w}")
    if declared_p != actual_p:
        problems.append(f"{p.name}: declares {declared_p} plates, markup has {actual_p}")

# 5: chapter shell essentials
for p in chapters:
    html = p.read_text(encoding="utf-8")
    for marker, label in [("class=\"lk-toc\"", "lk-toc"), ('id="quiz"', "#quiz"),
                          ("class=\"lk-foot\"", "lk-foot"), ("class=\"lk-header\"", "lk-header")]:
        if marker not in html:
            problems.append(f"{p.name}: missing {label}")
    if 'data-src="' not in html:
        problems.append(f"{p.name}: no data-src source mapping")
    t = re.search(r"<title>([^<]*)</title>", html)
    if not t or not t.group(1).strip():
        problems.append(f"{p.name}: empty or missing <title>")
    for asset in ("assets/lesson-kit.css", "assets/lesson-kit.js"):
        if f'href="{asset}"' in html or f'src="{asset}"' in html:
            if not (IRS / asset).exists():
                problems.append(f"{p.name}: missing {asset}")

# 6: stray files
allowed = {p.name for p in chapters} | {"index.html"}
for p in IRS.glob("*"):
    if p.is_file() and p.name not in allowed:
        problems.append(f"STRAY file: {p.name}")

if problems:
    print(f"{len(problems)} problem(s):")
    for p in problems:
        print("  " + p)
    sys.exit(1)
print(f"OK: {len(chapters)} chapters, index complete, links/fragments clean, "
      f"nav consistent, metas match markup")
