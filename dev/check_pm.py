#!/usr/bin/env python3
"""Validate PM lesson chapters: HTML structure, anchors, data-src, nav links, inline JS syntax.

Covers the full corpus (19 chapters) plus the course index (index.html), which
links every chapter and exhausts all 11 sources + case study + exercises.
"""
import html.parser
import re
import subprocess
import sys
import tempfile
from pathlib import Path

PM = Path("/home/ybc/hosted/unibo-lessons/pm")
CHAPTERS = [
    "cap-01-corso-e-brooks.html", "cap-02-team-e-agile.html", "cap-03-definizione-di-progetto.html",
    "cap-04-pmlc-e-approcci.html", "cap-05-processi-e-aree.html", "cap-06-scoping-requisiti.html",
    "cap-07-analisi-e-pos.html", "cap-08-planning-jpps.html", "cap-09-wbs-e-stime.html",
    "cap-10-risorse-e-costi.html", "cap-11-network-e-approvazione.html",
    "cap-12-team-e-kickoff.html", "cap-13-regole-operative.html",
    "cap-14-riunioni-e-scope.html", "cap-15-comunicazioni-e-work-package.html",
    "cap-16-monitoring-e-controllo.html", "cap-17-closing-e-chiusura.html",
    "cap-18-kanban-e-devops.html", "cap-19-caso-pdq-ed-esercitazioni.html",
]
INDEX = "index.html"
# The authoritative corpus: 11 numbered decks + case study (two identical copies) +
# esercitazione + gruppi + linee guida. Data-src tokens must match one of these stems.
SOURCE_STEMS = [f"{n} - " for n in range(1, 12)] + ["Case Study", "Esercitazione", "Gruppi", "Progetto"]


class Balance(html.parser.HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr", "circle", "line", "path", "rect", "text", "marker", "polygon", "stop", "use"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        if tag not in self.VOID:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        if not self.stack:
            self.errors.append(f"stray </{tag}> at {self.getpos()}")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        # look for a matching open tag
        names = [t for t, _ in self.stack]
        if tag in names:
            while self.stack and self.stack[-1][0] != tag:
                bad, pos = self.stack.pop()
                self.errors.append(f"unclosed <{bad}> opened at {pos}, closed by </{tag}> at {self.getpos()}")
            self.stack.pop()
        else:
            self.errors.append(f"unmatched </{tag}> at {self.getpos()}")


def check_balance(name, text, problems):
    b = Balance()
    b.feed(text)
    for e in b.errors:
        problems.append(f"{name}: {e}")
    for tag, pos in b.stack:
        problems.append(f"{name}: unclosed <{tag}> at end of file (opened {pos})")


def main():
    problems = []
    existing = set(p.name for p in PM.glob("*.html"))
    for name in CHAPTERS:
        path = PM / name
        if not path.exists():
            problems.append(f"MISSING FILE: {name}")
            continue
        html = path.read_text(encoding="utf-8")

        # 1. tag balance
        check_balance(name, html, problems)

        # 2. internal anchors
        ids = set(re.findall(r'id="([^"]+)"', html))
        for anchor in re.findall(r'href="#([^"]+)"', html):
            if anchor not in ids:
                problems.append(f"{name}: broken anchor #{anchor}")

        # 3. data-src on every section, tokens match the authoritative corpus stems
        sections = re.findall(r"<section[^>]*>", html)
        no_src = [s for s in sections if 'data-src' not in s]
        if no_src:
            problems.append(f"{name}: {len(no_src)} section(s) without data-src")
        srcs = set()
        for attr in re.findall(r'data-src="([^"]+)"', html):
            for t in attr.split(","):
                t = t.strip()
                if not t.startswith(tuple(SOURCE_STEMS)):
                    problems.append(f"{name}: suspicious data-src token: {t}")
                srcs.add(t)
        if not srcs:
            problems.append(f"{name}: no data-src tokens at all")

        # 4. nav links resolve (file: relative); index.html is validated separately
        for href in re.findall(r'href="([^"#][^"]*)"', html):
            if href.startswith(("http", "mailto:", "tel:", "//")):
                continue
            if href.endswith("index.html"):
                continue  # course index validated as its own file
            target = (path.parent / href).resolve()
            if href.endswith(".html") and target.name not in existing:
                problems.append(f"{name}: link to missing file {href}")

        # 5. inline scripts parse with node --check
        for i, body in enumerate(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)):
            if not body.strip():
                continue
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
                f.write(body)
                fname = f.name
            r = subprocess.run(["node", "--check", fname], capture_output=True, text=True)
            if r.returncode != 0:
                err = (r.stderr or r.stdout).strip().splitlines()
                problems.append(f"{name}: inline script #{i + 1} fails: {err[-1] if err else 'unknown'}")
            Path(fname).unlink(missing_ok=True)

        # 6. widget count sanity (host divs vs init calls)
        hosts = len(re.findall(r'id="w-[a-z0-9-]+"', html))
        calls = len(re.findall(r'LessonKit\.(?:stateExplorer|stepper|annotatedCode)\(', html))
        if hosts == 0 and "board-host" not in html and "rows" not in html:
            problems.append(f"{name}: no widget hosts")
        interactive = hosts + len(re.findall(r'id="[a-z]+-rows"', html)) + len(re.findall(r'id="board-host"', html))
        if interactive == 0:
            problems.append(f"{name}: no interactive widgets at all")

    # ---- course index ----
    idx = PM / INDEX
    if not idx.exists():
        problems.append(f"MISSING FILE: {INDEX}")
    else:
        text = idx.read_text(encoding="utf-8")
        check_balance(INDEX, text, problems)
        linked = set()
        for href in re.findall(r'href="([^"#][^"]*)"', text):
            if href.startswith(("http", "mailto:", "tel:", "//")):
                continue
            if not href.endswith(".html"):
                continue
            target = (idx.parent / href).resolve()
            if target.name not in existing:
                problems.append(f"{INDEX}: link to missing file {href}")
            linked.add(target.name)
        for name in CHAPTERS:
            if name not in linked:
                problems.append(f"{INDEX}: chapter {name} not linked from the index")
        for name in linked:
            if name not in CHAPTERS and name != INDEX:
                problems.append(f"{INDEX}: unexpected link to {name}")
        if len(re.findall(r"<li>", text)) < len(CHAPTERS):
            problems.append(f"{INDEX}: fewer list rows than chapters")

    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  " + p)
        sys.exit(1)
    print(f"OK: {len(CHAPTERS)} chapters + {INDEX}, all structural checks passed")
    for name in CHAPTERS + [INDEX]:
        if name == INDEX:
            continue
        html = (PM / name).read_text(encoding="utf-8")
        figs = len(re.findall(r"<figure class=\"lk-fig\"", html))
        quizes = len(re.findall(r"<details>", html))
        secs = len(re.findall(r"<section id=", html))
        print(f"  {name}: {secs} sections, {figs} plates, {quizes} quiz items")


if __name__ == "__main__":
    main()
