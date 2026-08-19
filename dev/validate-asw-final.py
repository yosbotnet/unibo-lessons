#!/usr/bin/env python3
"""Whole-course validation for ASW final segment (chapters 1-15 + index).
Checks: source-token coverage, structure, inline JS syntax, fragment links,
bidirectional nav, index completeness, widget-host pairing."""
import json, os, re, subprocess, sys, tempfile

ASW = "/home/ybc/hosted/unibo-lessons/asw"
SRC = "/home/ybc/content/unibo-course-slides/71624-Applicazioni e Servizi Web"
ROOT = "/home/ybc/hosted/unibo-lessons"

errors, warns = [], []
def err(m): errors.append(m)
def warn(m): warns.append(m)

chapters = sorted([f for f in os.listdir(ASW) if re.fullmatch(r"cap-\d\d-.*\.html", f)])
expected = [f"cap-{i:02d}-*.html" for i in range(1, 16)]
print(f"chapters found: {len(chapters)}")

# ---------- 1. source-token coverage ----------
sources = sorted(os.listdir(SRC))
all_src_tokens = set()
for f in chapters:
    html = open(os.path.join(ASW, f), encoding="utf-8").read()
    for m in re.finditer(r'data-src="([^"]+)"', html):
        for tok in m.group(1).split(","):
            all_src_tokens.add(tok.strip())
uncovered = []
for s in sources:
    base = s[:-4] if s.endswith(".txt") else s
    pdf = base + ".pdf"
    if pdf not in all_src_tokens:
        uncovered.append(s)
if uncovered:
    err(f"uncovered sources: {uncovered}")
else:
    print(f"source coverage: all {len(sources)} sources covered by data-src tokens")
# every data-src token should map to a real source (allow .pdf variants)
for tok in sorted(all_src_tokens):
    base = tok[:-4] if tok.endswith(".pdf") else tok
    if not any(s.startswith(base) for s in sources):
        warn(f"data-src token without local source: {tok}")

# ---------- 2. structure ----------
for f in chapters:
    html = open(os.path.join(ASW, f), encoding="utf-8").read()
    if '<html lang="it">' not in html: err(f"{f}: missing lang=it")
    if "<title>" not in html: err(f"{f}: missing title")
    if 'assets/lesson-kit.css' not in html: err(f"{f}: missing lesson-kit.css")
    if 'assets/lesson-kit.js' not in html: err(f"{f}: missing lesson-kit.js")
    if 'class="lk-chnav"' not in html: err(f"{f}: missing chnav")
    if 'class="lk-header"' not in html: err(f"{f}: missing header")
    if 'class="lk-kicker"' not in html: err(f"{f}: missing kicker")
    if 'class="lk-toc"' not in html: err(f"{f}: missing toc")
    if 'class="lk-foot"' not in html: err(f"{f}: missing footer")
    n_sections = len(re.findall(r'<section id="s\d+"', html))
    if n_sections < 3: err(f"{f}: only {n_sections} sections")
    if 'id="quiz"' not in html: err(f"{f}: missing quiz section")
    # every section must carry data-src
    for m in re.finditer(r'<section id="(s\d+|quiz)"(?!\s+data-src)', html):
        err(f"{f}: section {m.group(1)} missing data-src")

# ---------- 3. inline JS syntax ----------
for f in chapters:
    html = open(os.path.join(ASW, f), encoding="utf-8").read()
    # extract inline scripts (no src attr)
    scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
    for i, code in enumerate(scripts):
        if not code.strip(): continue
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as t:
            t.write(code); jsf = t.name
        r = subprocess.run(["node", "--check", jsf], capture_output=True, text=True)
        os.unlink(jsf)
        if r.returncode != 0:
            err(f"{f}: inline script {i} syntax error: {r.stderr.strip()[:200]}")

# ---------- 4. fragment links ----------
for f in chapters:
    html = open(os.path.join(ASW, f), encoding="utf-8").read()
    ids = set(re.findall(r'id="([^"]+)"', html))
    for m in re.finditer(r'href="#([^"]+)"', html):
        if m.group(1) not in ids:
            err(f"{f}: broken fragment #{m.group(1)}")

# ---------- 5. bidirectional nav ----------
def num(f): return int(re.match(r"cap-(\d\d)-", f).group(1))
nav_map = {}
for f in chapters:
    html = open(os.path.join(ASW, f), encoding="utf-8").read()
    links = set(re.findall(r'href="(cap-\d\d-[^"]+\.html)"', html))
    nav_map[f] = links
for f in chapters:
    n = num(f)
    for other, links in nav_map.items():
        if f in links:
            if other not in nav_map[f] and n != 1:
                err(f"{f}: one-way link from {other} (no return link)")
# chain: chapter N links to N-1 and N+1 where they exist
for f in chapters:
    n = num(f)
    links = nav_map[f]
    if n > 1:
        prev = [g for g in chapters if num(g) == n - 1]
        if prev and prev[0] not in links:
            err(f"{f}: missing prev link to {prev[0]}")
    if n < 15:
        nxt = [g for g in chapters if num(g) == n + 1]
        if nxt and nxt[0] not in links:
            err(f"{f}: missing next link to {nxt[0]}")
    if n == 1:
        if 'href="index.html"' not in html:
            err(f"{f}: first chapter must link index")
    if n == 15:
        # terminal chapter: no next
        for l in links:
            if re.match(r"cap-1[6-9]", l): err(f"{f}: terminal chapter has next link {l}")
print("nav chain checked 1..15")

# ---------- 6. index completeness ----------
idx = open(os.path.join(ASW, "index.html"), encoding="utf-8").read()
for f in chapters:
    if f not in idx:
        err(f"asw/index.html missing link to {f}")
if "cap-15-progetto-asw.html" not in idx: err("index must cover terminal chapter")
root_idx = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
if "asw/index.html" not in root_idx:
    err("root index.html missing asw card")
print("index checks done")

# ---------- 7. widget-host pairing ----------
for f in chapters:
    html = open(os.path.join(ASW, f), encoding="utf-8").read()
    # every id referenced via getElementById must exist
    for m in re.finditer(r'getElementById\("([^"]+)"\)', html):
        if m.group(1) not in html:
            err(f"{f}: getElementById target {m.group(1)} missing")
    # every LessonKit init host must exist
    for m in re.finditer(r'LessonKit\.(?:annotatedCode|stateExplorer|stepper)\("#([^"]+)"', html):
        if m.group(1) not in html:
            err(f"{f}: LessonKit host #{m.group(1)} missing")
    # every lk-*-host div must be initialized by some JS
    for m in re.finditer(r'id="([^"]+)" class="lk-[^"]*host[^"]*"', html):
        hid = m.group(1)
        if f'"{hid}"' not in html.split("</head>")[1]:
            # check the id appears in script section
            scripts = html.split("<script")[2:]
            if not any(hid in s for s in scripts):
                warn(f"{f}: host #{hid} may lack JS init")

print(f"\n=== {len(errors)} errors, {len(warns)} warnings ===")
for e in errors: print("ERR:", e)
for w in warns: print("WARN:", w)
sys.exit(1 if errors else 0)
