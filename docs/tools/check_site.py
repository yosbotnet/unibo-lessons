#!/usr/bin/env python3
"""Site-wide verification for the reorganized PCD notes.

Usage: python3 docs/tools/check_site.py [--final]

Checks:
  1. GLOBAL COVERAGE: every coverage-matrix row appears in exactly one data-src
     token across all cap-*.html / prep-*.html files (and matches its dest file).
  2. LINKS: every internal href between pages targets an existing file
     (fragments checked against target ids).
  3. INDEX: index.html links every chapter and prep page; no orphan cap/prep files.
  4. --final only: no PCD-2026-*.html date pages remain, and no page links one.

Exit 0 = clean.
"""
import json
import re
import sys
from pathlib import Path

PCD = Path(__file__).resolve().parents[2] / "pcd"
final = "--final" in sys.argv
matrix = json.loads((PCD / "coverage-matrix.json").read_text(encoding="utf-8"))
pages = sorted(PCD.glob("cap-*.html")) + sorted(PCD.glob("prep-*.html"))
problems = []

# 1: global coverage
seen = {}
for page in pages:
    html = page.read_text(encoding="utf-8")
    for attr in re.findall(r'data-src="([^"]+)"', html):
        for tok in (t.strip() for t in attr.split(",")):
            seen.setdefault(tok, []).append(page.name)
for r in matrix:
    key = f"{r['source_page']}#{r['source_id']}"
    locs = seen.get(key, [])
    if not locs:
        problems.append(f"UNCOVERED: {key} (assigned to {r['dest']}) appears nowhere")
    elif len(locs) > 1:
        problems.append(f"DUPLICATED: {key} appears in {locs}")
    elif locs[0] != r["dest"]:
        problems.append(f"MISPLACED: {key} assigned to {r['dest']} but found in {locs[0]}")
assigned_keys = {f"{r['source_page']}#{r['source_id']}" for r in matrix}
for key, locs in seen.items():
    if key not in assigned_keys:
        problems.append(f"UNKNOWN data-src: {key} in {locs} is not a matrix row")

# 2: inter-page links (+ index)
all_files = {p.name for p in PCD.glob("*.html")}
ids_cache = {}
def ids_of(name):
    if name not in ids_cache:
        ids_cache[name] = set(re.findall(r'id="([^"]+)"', (PCD / name).read_text(encoding="utf-8")))
    return ids_cache[name]

for page in pages + ([PCD / "index.html"] if (PCD / "index.html").exists() else []):
    html = page.read_text(encoding="utf-8")
    for href in re.findall(r'href="([^"#:]+\.html)(#[^"]*)?"', html):
        target, frag = href[0], href[1].lstrip("#")
        if "/" in target:
            continue
        if target not in all_files:
            problems.append(f"{page.name}: broken link to {target}")
        elif frag and frag not in ids_of(target):
            problems.append(f"{page.name}: broken fragment {target}#{frag}")

# 3: index completeness / orphans
idx = PCD / "index.html"
if idx.exists():
    idx_html = idx.read_text(encoding="utf-8")
    linked = set(re.findall(r'href="([^"#:]+\.html)', idx_html))
    for p in pages:
        if p.name not in linked:
            problems.append(f"ORPHAN: {p.name} not linked from index.html")
else:
    problems.append("index.html missing")

# 4: date pages gone (final)
if final:
    for p in sorted(PCD.glob("PCD-2026-*.html")):
        problems.append(f"DATE PAGE still present: {p.name}")
    for page in pages + [idx]:
        for link in re.findall(r'href="(PCD-2026[^"]*)"', page.read_text(encoding="utf-8")):
            problems.append(f"{page.name}: STALE link {link}")

if problems:
    print(f"{len(problems)} problem(s):")
    for p in problems:
        print("  " + p)
    sys.exit(1)
print(f"OK: {len(matrix)} matrix rows covered once each across {len(pages)} pages; links, index, orphans clean" + (" (final mode)" if final else ""))
