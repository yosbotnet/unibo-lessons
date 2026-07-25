#!/usr/bin/env python3
"""Validate one merged chapter/prep page against pcd/coverage-matrix.json.

Usage: python3 docs/tools/check_chapter.py pcd/cap-05-semafori.html

Checks:
  1. Every matrix row with dest == this file appears in exactly one data-src token.
  2. No data-src token references a section not assigned to this file.
  3. Every internal #anchor link targets an existing id in the file.
  4. No link points to a date page (PCD-2026-*.html) — those get deleted.
  5. Inline <script> bodies parse (node --check), if node is available.

Exit 0 = clean, 1 = problems (listed on stdout).
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

path = Path(sys.argv[1])
repo = path.resolve()
while repo.name != "unibo-lessons" and repo.parent != repo:
    repo = repo.parent
matrix = json.loads((repo / "pcd" / "coverage-matrix.json").read_text(encoding="utf-8"))
html = path.read_text(encoding="utf-8")
problems = []

# 1+2: coverage
assigned = {f"{r['source_page']}#{r['source_id']}" for r in matrix if r["dest"] == path.name}
found = []
for attr in re.findall(r'data-src="([^"]+)"', html):
    found.extend(t.strip() for t in attr.split(","))
dupes = {t for t in found if found.count(t) > 1}
missing = assigned - set(found)
extra = set(found) - assigned
for t in sorted(missing):
    problems.append(f"MISSING coverage: {t} assigned to this file but not in any data-src")
for t in sorted(extra):
    problems.append(f"EXTRA data-src: {t} is not assigned to this file in the matrix")
for t in sorted(dupes):
    problems.append(f"DUPLICATE data-src: {t} appears more than once")

# 3: internal anchors
ids = set(re.findall(r'id="([^"]+)"', html))
for anchor in re.findall(r'href="#([^"]+)"', html):
    if anchor not in ids:
        problems.append(f"BROKEN anchor: href=#{anchor} has no matching id")

# 4: links to date pages
for link in re.findall(r'href="(PCD-2026[^"]*)"', html):
    problems.append(f"STALE link to date page: {link}")

# 5: inline scripts parse
node = shutil.which("node")
if node:
    for i, body in enumerate(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)):
        if not body.strip():
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
            f.write(body)
        r = subprocess.run([node, "--check", f.name], capture_output=True, text=True)
        if r.returncode != 0:
            problems.append(f"SCRIPT #{i+1} fails node --check: {r.stderr.strip().splitlines()[-1] if r.stderr else 'unknown'}")
else:
    print("note: node not found, skipping script syntax check")

if problems:
    print(f"{path.name}: {len(problems)} problem(s)")
    for p in problems:
        print("  " + p)
    sys.exit(1)
print(f"{path.name}: OK ({len(assigned)} sections covered, {len(ids)} ids, scripts checked)")
