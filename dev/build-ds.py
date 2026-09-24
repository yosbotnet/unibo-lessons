#!/usr/bin/env python3
"""Build the Distributed Systems course index and glossary from its chapter files.

Usage: python3 dev/build-ds.py [course_dir]   (default: ds)

Reads ch-0N-*.html: title (h1), kicker, the .ds-spine question, the .ds-sources chips,
the .lk-meta read time; harvests <dfn id="term-..."> terms and .defn blocks for the glossary
(adding stable ids to .defn blocks that lack one). Writes index.html and glossary.html.
Standard library only.
"""
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COURSE = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "ds")

PARTS = [
    ("I", "Foundations", "What a distributed system is, and the two contexts it lives in: time and space.", [1, 2, 3]),
    ("II", "Failure, replication, agreement", "Surviving faults, keeping copies consistent, and agreeing despite both.", [4, 5, 6, 7]),
    ("III", "Models and machinery", "Describing distributed systems precisely, and running them for real.", [8, 9]),
]
# course map: node positions and dependency edges (from, to, why)
POS = {1: (20, 58), 2: (20, 168), 3: (20, 278), 4: (262, 30), 5: (262, 118), 6: (262, 206), 7: (262, 294), 8: (504, 90), 9: (504, 230)}
SHORT = {1: "What makes a system distributed", 2: "Time, order, causality", 3: "Space and mobility", 4: "Failure and recovery",
         5: "Replication, consistency, CAP", 6: "Consensus", 7: "Distributed ledgers", 8: "Architectures and process algebra", 9: "Kubernetes in production"}
EDGES = [
    (1, 2, "the temporal context T"), (1, 3, "the spatial context S"), (2, 4, "consistent cuts need happens-before"),
    (2, 5, "causal consistency"), (4, 5, "replicate to survive faults"), (5, 6, "replicas must agree on one order"),
    (6, 7, "consensus among strangers"), (1, 8, "architectures of the definitions"), (4, 9, "self-healing = detect + replace"),
    (5, 9, "ReplicaSets and Services"), (3, 9, "containers move computation"),
]


def strip(s):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def slug(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def read_chapters():
    chapters = []
    for f in sorted(COURSE.glob("ch-0*.html")):
        s = f.read_text(encoding="utf-8")
        n = int(re.match(r"ch-0(\d)", f.name).group(1))
        title = strip(re.search(r"<h1[^>]*>(.*?)</h1>", s, re.S).group(1))
        spine = re.search(r'class="ds-spine".*?<p>(.*?)</p>', s, re.S)
        sources = re.findall(r"<span><b>(\w+)</b>\s*(.*?)</span>", re.search(r'class="ds-sources".*?</div>', s, re.S).group(0)) if 'class="ds-sources"' in s else []
        meta = re.search(r'class="lk-meta">(.*?)</div>', s, re.S)
        spans = re.findall(r"<span>(.*?)</span>", meta.group(1)) if meta else []
        chapters.append({
            "n": n, "file": f.name, "title": title,
            "spine": strip(spine.group(1)) if spine else "",
            "sources": [(a, strip(b)) for a, b in sources],
            "time": strip(spans[0]) if spans else "",
            "inst": strip(spans[1]) if len(spans) > 1 else "",
        })
    return chapters


def course_map(chs):
    by = {c["n"]: c for c in chs}
    W, H, bw, bh = 700, 360, 176, 50
    out = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Course map: chapters and the concepts that connect them" style="width:{W}px">']
    out.append('<defs><marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--lk-cobalt)"/></marker></defs>')
    for i, (roman, name, _, _) in enumerate(PARTS):
        x = [20, 262, 504][i]
        short = {"I": "FOUNDATIONS", "II": "FAILURE · REPLICATION · AGREEMENT", "III": "MODELS · MACHINERY"}[roman]
        out.append(f'<text x="{x}" y="16" font-family="var(--lk-mono)" font-size="9.5" fill="var(--lk-vermilion)">{roman} · {short}</text>')
    for a, b, why in EDGES:
        if a not in POS or b not in POS:
            continue
        (x1, y1), (x2, y2) = POS[a], POS[b]
        if x1 == x2:  # same column: go down the left edge
            sx, sy, ex, ey = x1 + 14, y1 + bh, x2 + 14, y2
            d = f"M{sx} {sy} L{ex} {ey - 2}"
        else:
            sx, sy, ex, ey = x1 + bw, y1 + bh / 2, x2, y2 + bh / 2
            mx = (sx + ex) / 2
            d = f"M{sx} {sy} C{mx} {sy} {mx} {ey} {ex - 2} {ey}"
        out.append(f'<path d="{d}" fill="none" stroke="var(--lk-cobalt)" stroke-width="1.3" opacity=".75" marker-end="url(#map-arrow)"><title>{html.escape(why)}</title></path>')
    for n, (x, y) in POS.items():
        c = by.get(n)
        if not c:
            continue
        t = SHORT.get(n, c["title"])
        words, lines, cur = t.split(), [], ""
        for w in words:
            if len(cur) + len(w) + 1 > 18:
                lines.append(cur)
                cur = w
            else:
                cur = (cur + " " + w).strip()
        lines.append(cur)
        out.append(f'<a href="{c["file"]}"><rect x="{x}" y="{y}" width="{bw}" height="{bh}" rx="2" fill="var(--lk-paper-light)" stroke="var(--lk-rule)"/>')
        out.append(f'<text x="{x + 10}" y="{y + 31}" font-family="var(--lk-display)" font-size="22" font-weight="700" fill="var(--lk-vermilion)">{n}</text>')
        for k, ln in enumerate(lines[:2]):
            yy = y + (21 if len(lines) > 1 else 29) + k * 15
            out.append(f'<text x="{x + 32}" y="{yy}" font-family="var(--lk-utility)" font-size="12" font-weight="600" fill="var(--lk-cobalt-dark)">{html.escape(ln)}</text>')
        out.append("</a>")
    out.append("</svg>")
    return "\n".join(out)


def build_index(chs):
    by = {c["n"]: c for c in chs}
    parts_html = []
    for roman, name, blurb, ns in PARTS:
        items = []
        for n in ns:
            c = by.get(n)
            if not c:
                continue
            chips = "".join(f"<span><b>{a}</b> {html.escape(b)}</span>" for a, b in c["sources"])
            meta = " · ".join(x for x in (c["time"], c["inst"]) if x)
            items.append(f'''<li class="ix-ch"><span class="ix-n">{n}</span><div>
<a class="ix-title" href="{c["file"]}">{html.escape(c["title"])}</a>
<p class="ix-spine">{html.escape(c["spine"])}</p>
<div class="ds-sources">{chips}<span class="ix-meta">{html.escape(meta)}</span></div></div></li>''')
        parts_html.append(f'''<section class="ix-part" id="part-{roman.lower()}">
<h2><span class="ix-roman">{roman}</span> {html.escape(name)}</h2>
<p class="ix-blurb">{html.escape(blurb)}</p>
<ol class="ix-list">{"".join(items)}</ol></section>''')
    total_min = sum(int(re.search(r"\d+", c["time"]).group()) for c in chs if re.search(r"\d+", c["time"]))
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Distributed Systems — Course index</title>
<meta name="description" content="Distributed Systems (UniBo, Prof. Omicini): nine concept-first chapters with interactive instruments, a project companion and a glossary.">
<link rel="stylesheet" href="assets/lesson-kit.css">
<link rel="stylesheet" href="assets/ds.css">
<style>
.ix-hero{{margin:1.4rem 0 1rem}}
.ix-hero img{{width:100%;max-width:420px;height:auto;display:block;margin:0 auto;border:1px solid var(--lk-rule-soft)}}
.ix-how{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7rem;margin:1.4rem 0 2rem;padding:0;list-style:none}}
.ix-how li{{border-top:2px solid var(--lk-vermilion);padding:.5rem 0 0;font-size:.95rem!important;line-height:1.5}}
.ix-how b{{display:block;font-family:var(--lk-utility);font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;color:var(--lk-cobalt);margin-bottom:.2rem}}
.ix-part h2{{display:flex;align-items:baseline;gap:.7rem}}
.ix-part h2::before{{display:none}}
.ix-roman{{font-family:var(--lk-display);color:var(--lk-vermilion);font-size:2rem;line-height:1}}
.ix-blurb{{color:var(--lk-ink-soft);margin-top:-.2rem}}
.ix-list{{list-style:none;padding:0;margin:1rem 0 0}}
.ix-ch{{display:grid;grid-template-columns:2.4rem 1fr;gap:.6rem;padding:.9rem 0;border-bottom:1px solid var(--lk-rule-soft);margin:0}}
.ix-n{{font-family:var(--lk-display);font-weight:700;font-size:1.7rem;line-height:1.05;color:var(--lk-vermilion);text-align:right}}
.ix-title{{font-family:var(--lk-display);font-weight:700;text-transform:uppercase;font-size:1.2rem;text-decoration:none;color:var(--lk-cobalt)}}
.ix-title:hover{{text-decoration:underline}}
.ix-spine{{margin:.2rem 0 .1rem;font-style:italic;font-size:1rem!important}}
.ix-meta{{border:0!important;background:none!important}}
.ix-extra{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.8rem;margin:1.2rem 0}}
.ix-extra a{{display:block;border:1px solid var(--lk-rule);border-radius:3px;padding:.8rem 1rem;text-decoration:none;background:var(--lk-paper-light)}}
.ix-extra a:hover{{border-color:var(--lk-cobalt);background:var(--lk-hl)}}
.ix-extra b{{display:block;font-family:var(--lk-display);text-transform:uppercase;font-size:1.05rem;color:var(--lk-cobalt)}}
.ix-extra span{{color:var(--lk-ink-soft);font-size:.92rem}}
.ix-map a:hover rect{{stroke:var(--lk-cobalt);fill:var(--lk-hl)}}
.ix-map a:focus-visible rect{{stroke:var(--lk-cobalt);stroke-width:2.5}}
</style>
</head>
<body class="lk">
<header class="lk-header">
  <div class="lk-kicker">University of Bologna · ISI LM · Prof. Andrea Omicini · A.Y. 2025/26</div>
  <h1>Distributed Systems</h1>
  <div class="lk-meta"><span>{len(chs)} chapters</span><span>~{total_min // 60} h {total_min % 60:02d} min reading</span><span>interactive instruments</span></div>
</header>

<div class="ds-spine"><span class="ds-label">The course in one question</span>
<p>How do independent machines, with no shared clock, no shared memory and no guarantee of staying up, behave as one system?</p></div>

<figure class="ix-hero"><img src="assets/img/ds-plate-distributed-systems.webp" width="1200" height="800" alt="Three clocks exchanging messages: local clocks, shared messages."></figure>

<ul class="ix-how">
<li><b>Concept-first</b>Nine chapters, each built around one question. A chapter merges the slide decks that answer it; the chips under each title show which ones.</li>
<li><b>Built for the oral</b>The exam is a discussion of your project. Every chapter ends with discussion prompts and a project lens; the project companion collects them.</li>
<li><b>Instruments</b>Small simulators: build a run and read its clocks, draw a cut, crash a process, partition two replicas. Use them to test yourself.</li>
<li><b>Nothing lost</b>Each chapter ends with a slide-coverage table mapping every slide section to where it is explained.</li>
</ul>

<h2>Course map</h2>
<figure class="lk-fig ix-map"><div class="figure-diagram" tabindex="0" role="region" aria-label="Scrollable course map">
{course_map(chs)}
</div><figcaption><b>Map</b> — Arrows read “is needed by”. Hover an arrow for the concept that connects two chapters; click a box to open it.</figcaption></figure>

{"".join(parts_html)}

<h2>Companions</h2>
<div class="ix-extra">
<a href="project.html"><b>Project companion</b><span>The course, seen through the Thunk project: which concepts it uses, how to show them in the artefacts, and the questions to prepare for.</span></a>
<a href="glossary.html"><b>Glossary</b><span>Every term the chapters define, with its definition and a link to where it is explained.</span></a>
</div>

<footer class="lk-foot">Distributed Systems · University of Bologna · built from the slides of Andrea Omicini (DISI), A.Y. 2025/26, including the Kubernetes lecture by Mattia Matteini. Personal study notes, not an official source; the slides remain the reference.</footer>
<script src="assets/lesson-kit.js"></script>
</body>
</html>
'''


def build_glossary(chs):
    entries = {}
    by_file = {c["file"]: c for c in chs}
    for c in chs:
        f = COURSE / c["file"]
        s = f.read_text(encoding="utf-8")
        changed = False
        # .defn blocks: give each a stable id and harvest term + first paragraph
        def add_id(m):
            nonlocal changed
            block_open = m.group(0)
            if " id=" in block_open:
                return block_open
            changed = True
            return block_open  # id added below with the title
        for m in re.finditer(r'<div class="defn"( id="([^"]+)")?>\s*<div class="defn-term"><b>(.*?)</b>(?:<cite>(.*?)</cite>)?</div>(.*?)</div>\s*(?=<|$)', s, re.S):
            term = strip(m.group(3))
            did = m.group(2) or "def-" + slug(term)
            text = strip(m.group(5))
            if len(text) > 420:
                cut = text.rfind(" ", 0, 400)
                text = text[:cut].rstrip(",;:") + " …"
            cite = strip(m.group(4) or "")
            entries.setdefault(term.lower(), {"term": term, "text": text, "cite": cite, "href": f'{c["file"]}#{did}', "ch": c["n"]})
        s2 = re.sub(r'<div class="defn">(\s*<div class="defn-term"><b>(.*?)</b>)',
                    lambda m: f'<div class="defn" id="def-{slug(strip(m.group(2)))}">{m.group(1)}', s)
        if s2 != s:
            f.write_text(s2, encoding="utf-8")
            s = s2
        # dfn terms: sentence context
        text_only = re.sub(r"<(script|style|svg)\b.*?</\1>", "", s, flags=re.S)
        for m in re.finditer(r'<dfn id="(term-[^"]+)">(.*?)</dfn>', text_only, re.S):
            term = strip(m.group(2))
            key = term.lower()
            if key in entries:
                continue
            # sentence around the dfn: previous sentence boundary to next one
            para_start = text_only.rfind("<p", 0, m.start())
            li_start = text_only.rfind("<li", 0, m.start())
            start = max(para_start, li_start)
            end_p = min([x for x in (text_only.find("</p>", m.end()), text_only.find("</li>", m.end())) if x != -1] or [m.end() + 400])
            chunk = strip(text_only[start:end_p])
            chunk = re.sub(r"^[^>]*>", "", chunk).strip()
            if re.search(r"(:|\bif)$", chunk):  # the definition continues in the list that follows
                lst = re.match(r"\s*(?:</p>)?\s*<(ol|ul)\b.*?</\1>", text_only[end_p:], re.S)
                if lst:
                    chunk += " " + strip(lst.group(0))
            if len(chunk) > 320:
                pos = chunk.find(term)
                dot = chunk.rfind(". ", 0, max(pos, 0))
                a = dot + 2 if dot != -1 else 0
                b = chunk.find(". ", pos + len(term))
                chunk = chunk[a:(b + 1 if b != -1 else a + 300)]
            entries[key] = {"term": term, "text": chunk, "cite": "", "href": f'{c["file"]}#{m.group(1)}', "ch": c["n"]}
    items = sorted(entries.values(), key=lambda e: e["term"].lower())
    letters = sorted({e["term"][0].upper() for e in items if e["term"]})
    rows = []
    cur = None
    for e in items:
        L = e["term"][0].upper()
        if L != cur:
            if cur is not None:
                rows.append("</dl>")
            rows.append(f'<h2 id="g-{L}">{L}</h2><dl class="gl">')
            cur = L
        cite = f' <cite>{html.escape(e["cite"])}</cite>' if e["cite"] else ""
        rows.append(f'<dt>{html.escape(e["term"])}{cite}</dt><dd>{html.escape(e["text"])} <a class="xref" href="{e["href"]}">Ch. {e["ch"]}</a></dd>')
    if cur is not None:
        rows.append("</dl>")
    jump = " ".join(f'<a href="#g-{L}">{L}</a>' for L in letters)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Glossary — Distributed Systems</title>
<link rel="stylesheet" href="assets/lesson-kit.css">
<link rel="stylesheet" href="assets/ds.css">
<style>
.gl dt{{font-weight:700;margin-top:.9rem}}
.gl dt cite{{font:.74rem var(--lk-mono);font-style:normal;color:var(--lk-ink-soft);font-weight:400;margin-left:.4rem}}
.gl dd{{margin:.2rem 0 0 0;padding-left:.9rem;border-left:2px solid var(--lk-rule-soft)}}
.gl-jump{{font-family:var(--lk-mono);font-size:.9rem;display:flex;flex-wrap:wrap;gap:.2rem .7rem;margin:1rem 0}}
#gl-filter{{font:1rem var(--lk-utility);padding:.45rem .6rem;border:1px solid var(--lk-rule);border-radius:3px;width:100%;max-width:24rem;background:var(--lk-paper-light)}}
</style>
</head>
<body class="lk">
<nav class="lk-chnav" aria-label="Navigation"><a href="index.html">&larr; Course index</a><a href="project.html">Project companion &rarr;</a></nav>
<header class="lk-header"><div class="lk-kicker">Distributed Systems · Companion</div><h1>Glossary</h1>
<div class="lk-meta"><span>{len(items)} terms</span><span>generated from the chapters</span></div></header>
<p><label for="gl-filter" class="ds-muted" style="font:.85rem var(--lk-utility)">Filter terms </label><br><input id="gl-filter" type="search" placeholder="e.g. clock, consistency, fault"></p>
<nav class="gl-jump" aria-label="Letters">{jump}</nav>
{"".join(rows)}
<footer class="lk-foot">Generated from the chapters' definitions. Each entry links to the place where the term is explained.</footer>
<script>
(function(){{var f=document.getElementById('gl-filter');f.addEventListener('input',function(){{var q=f.value.toLowerCase();
document.querySelectorAll('.gl dt').forEach(function(dt){{var dd=dt.nextElementSibling;var hit=!q||(dt.textContent+' '+dd.textContent).toLowerCase().indexOf(q)>=0;dt.hidden=dd.hidden=!hit;}});
document.querySelectorAll('.gl').forEach(function(dl){{var any=[].some.call(dl.querySelectorAll('dt'),function(d){{return !d.hidden;}});dl.hidden=!any;dl.previousElementSibling.hidden=!any;}});}});}})();
</script>
</body>
</html>
'''


def main():
    chs = read_chapters()
    (COURSE / "index.html").write_text(build_index(chs), encoding="utf-8")
    g = build_glossary(chs)
    (COURSE / "glossary.html").write_text(g, encoding="utf-8")
    print(f"{len(chs)} chapters; index.html and glossary.html written in {COURSE}")


if __name__ == "__main__":
    main()
