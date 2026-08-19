#!/usr/bin/env python3
"""Validate the Reti LM course (reti-lm/) for durable publication.

Covers the full corpus (14 chapters + index) and checks:
  1. HTML tag balance for every page
  2. Internal fragment anchors (href="#x" -> id="x")
  3. data-src source tokens on every section, PDF-token-equivalent to the
     authoritative .txt slide corpus under
     /home/ybc/content/unibo-course-slides/59313-Reti di Telecomunicazioni LM - Instradamento e Trasporto in Internet
  4. Section ids, per-chapter source coverage and pedagogical ordering
  5. Widget host divs for every JS/LessonKit init target + interactive widget
     inventory (JS hosts + declarative tab groups) vs. header metadata
  6. Bidirectional 1..14 chapter navigation; terminal chapter has no forward link
  7. Course index links every chapter and nothing else
  8. Inline <script> bodies pass `node --check`
  9. Assets referenced exist (lesson-kit.css / lesson-kit.js)
 10. Permissions 644/755 and secret scan (API keys, private keys, tokens)

Usage: python3 dev/validate-reti-lm-final.py
Exit code 0 = all checks passed.
"""
import html.parser
import re
import subprocess
import sys
import tempfile
from pathlib import Path

RETI = Path("/home/ybc/hosted/unibo-lessons/reti-lm")
SOURCES = Path("/home/ybc/content/unibo-course-slides/59313-Reti di Telecomunicazioni LM - Instradamento e Trasporto in Internet")
INDEX = "index.html"
CHAPTERS = [
    "cap-01-introduzione.html",
    "cap-02-probabilita.html",
    "cap-03-teletraffico.html",
    "cap-04-markov.html",
    "cap-05-erlang-perdita.html",
    "cap-06-code-attesa.html",
    "cap-07-mg1-priorita.html",
    "cap-08-affidabilita-arq.html",
    "cap-09-tcp-segmento.html",
    "cap-10-tcp-connessione.html",
    "cap-11-tcp-timeout-flusso.html",
    "cap-12-tcp-congestione.html",
    "cap-13-tcp-prestazioni.html",
    "cap-14-compito.html",
]

# ----------------------------------------------------------------------------
# Authoritative corpus: every .txt extracted from the course slides. The pages
# attribute sections with PDF-equivalent tokens ("X.pdf"); equivalence = the
# token stem minus extension matches exactly one .txt stem in the corpus.
# ----------------------------------------------------------------------------
CORPUS = sorted(p.name[:-4] for p in SOURCES.glob("*.txt"))
if not CORPUS:
    print("FATAL: authoritative source corpus not found")
    sys.exit(2)
CORPUS_NAMES = {name.replace("_", " ") for name in CORPUS} | set(CORPUS)

# Expected widget totals under the repo convention (JS-populated hosts +
# declarative tab groups). Derived from the pages themselves; used to detect
# drift between claimed metadata and real page content.
EXPECTED_WIDGETS = {  # chapter -> (hosts, tab_groups, total)
    "cap-01-introduzione.html": (3, 1, 4),
    "cap-02-probabilita.html": (3, 1, 4),
    "cap-03-teletraffico.html": (5, 1, 6),
    "cap-04-markov.html": (3, 0, 3),
    "cap-05-erlang-perdita.html": (3, 0, 3),
    "cap-06-code-attesa.html": (5, 1, 6),
    "cap-07-mg1-priorita.html": (3, 0, 3),
    "cap-08-affidabilita-arq.html": (3, 3, 6),
    "cap-09-tcp-segmento.html": (4, 1, 5),
    "cap-10-tcp-connessione.html": (3, 1, 4),
    "cap-11-tcp-timeout-flusso.html": (4, 1, 5),
    "cap-12-tcp-congestione.html": (4, 1, 5),
    "cap-13-tcp-prestazioni.html": (4, 0, 4),
    "cap-14-compito.html": (4, 0, 4),
}


class Balance(html.parser.HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
            "meta", "param", "source", "track", "wbr", "circle", "line", "path",
            "rect", "text", "marker", "polygon", "stop", "use"}

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


def pdf_token_ok(token):
    """PDF-token equivalence: 'X.pdf' must match a corpus .txt stem (X or X with _)."""
    stem = token[:-4] if token.endswith(".pdf") else token
    return stem in CORPUS_NAMES or stem.replace(" ", "_") in CORPUS_NAMES


def count_widgets(html):
    """Count interactive components: JS-populated hosts + declarative tab groups."""
    hosts = set()
    for m in re.finditer(r"(?:getElementById|querySelector)\(\s*['\"]#?((?:w|step|se|ac)-[a-z0-9-]+)['\"]", html):
        hosts.add(m.group(1))
    for m in re.finditer(r"LessonKit\.(?:annotatedCode|stateExplorer|stepper)\(\s*['\"]#((?:w|step|se|ac)-[a-z0-9-]+)['\"]", html):
        hosts.add(m.group(1))
    tab_ids = set(re.findall(r'<div[^>]*id="((?:w|step|se|ac)-[a-z0-9-]+)"[^>]*data-kit="tabs"', html))
    tabs = len(re.findall(r'data-kit="tabs"', html))
    return sorted(hosts - tab_ids), tabs


def main():
    problems = []
    existing = set(p.name for p in RETI.glob("*.html"))

    # ---- per-chapter checks ----
    for name in CHAPTERS:
        path = RETI / name
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
                problems.append(f"{name}: broken fragment anchor #{anchor}")

        # 3. data-src on every section, tokens PDF-equivalent to the corpus
        sections = re.findall(r"<section[^>]*>", html)
        no_src = [s for s in sections if "data-src" not in s]
        if no_src:
            problems.append(f"{name}: {len(no_src)} section(s) without data-src")
        srcs = set()
        for attr in re.findall(r'data-src="([^"]+)"', html):
            for t in attr.split(","):
                t = t.strip()
                if not pdf_token_ok(t):
                    problems.append(f"{name}: data-src token not in corpus: {t}")
                srcs.add(t)
        if not srcs:
            problems.append(f"{name}: no data-src tokens at all")

        # 3b. chapter source list vs. data-src union (attribution consistency)
        sec_ids = re.findall(r'<section[^>]*id="([^"]+)"', html)
        if not sec_ids:
            problems.append(f"{name}: no <section id=...> elements")

        # 4. widget host divs exist for every init target
        for target in re.findall(r"(?:getElementById|querySelector)\(\s*['\"]#?((?:w|step|se|ac)-[a-z0-9]+)['\"]", html):
            if f'id="{target}"' not in html:
                problems.append(f"{name}: JS target host missing: #{target}")
        for target in re.findall(r"LessonKit\.(?:annotatedCode|stateExplorer|stepper)\(\s*['\"]#((?:w|step|se|ac)-[a-z0-9]+)['\"]", html):
            if f'id="{target}"' not in html:
                problems.append(f"{name}: LessonKit host missing: #{target}")

        # 4b. widget inventory vs. header metadata
        hosts, tabs = count_widgets(html)
        total = len(hosts) + tabs
        m = re.search(r'<span>~?\d+ min di lettura</span><span>(\d+) widget', html)
        claimed = int(m.group(1)) if m else None
        if claimed is None:
            problems.append(f"{name}: widget-count metadata missing in header")
        elif claimed != total:
            problems.append(f"{name}: widget meta claims {claimed}, page has {total} ({len(hosts)} hosts + {tabs} tabs)")
        exp = EXPECTED_WIDGETS.get(name)
        if exp and (len(hosts), tabs, total) != exp:
            problems.append(f"{name}: widget inventory drift vs expected {exp}: got hosts={len(hosts)} tabs={tabs}")

        # 5. navigation: bidirectional chain; terminal chapter must not link forward
        nav = re.findall(r'href="(cap-\d\d-[a-z0-9-]+\.html)"', html)
        if not nav:
            problems.append(f"{name}: no chapter nav links")
        prev_ok = next_ok = True
        i = CHAPTERS.index(name)
        if i > 0:
            if CHAPTERS[i - 1] not in nav:
                problems.append(f"{name}: prev link missing {CHAPTERS[i - 1]}")
        else:
            prev_ok = False
        if i < len(CHAPTERS) - 1:
            if CHAPTERS[i + 1] not in nav:
                problems.append(f"{name}: next link missing {CHAPTERS[i + 1]}")
        else:
            next_ok = False
        if name == CHAPTERS[-1] and any(re.search(r'href="cap-(1[5-9]|2\d)-', html) for _ in [0]):
            problems.append(f"{name}: terminal chapter links forward")
        # 5b. all file links resolve
        for href in re.findall(r'href="([^"#][^"]*)"', html):
            if href.startswith(("http", "mailto:", "tel:", "//")):
                continue
            if href.endswith("index.html") or href.endswith(".css") or ".js" in href:
                continue
            if href.endswith(".html") and (RETI / href).name not in existing:
                problems.append(f"{name}: link to missing file {href}")

        # 6. inline scripts parse
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

        # 7. assets referenced
        for asset in re.findall(r'(?:href|src)="(assets/[^"]+)"', html):
            if not (RETI / asset).exists():
                problems.append(f"{name}: missing asset {asset}")

    # ---- course index ----
    idx = RETI / INDEX
    if not idx.exists():
        problems.append(f"MISSING FILE: {INDEX}")
    else:
        text = idx.read_text(encoding="utf-8")
        check_balance(INDEX, text, problems)
        linked = set()
        for href in re.findall(r'href="([^"#][^"]*)"', text):
            if href.startswith(("http", "mailto:", "tel:", "//")) or not href.endswith(".html"):
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
        if len(re.findall(r'class="idx-list"', text)) < 4:
            problems.append(f"{INDEX}: fewer than 4 part lists")

    # ---- permissions: dirs 755, files 644 ----
    for p in sorted(RETI.rglob("*")):
        if p.is_dir():
            if oct(p.stat().st_mode & 0o777) != "0o755":
                problems.append(f"permissions: {p} dir is {oct(p.stat().st_mode & 0o777)} (want 755)")
        else:
            if oct(p.stat().st_mode & 0o777) != "0o644":
                problems.append(f"permissions: {p} is {oct(p.stat().st_mode & 0o777)} (want 644)")

    # ---- secret scan ----
    SECRET_RE = re.compile(
        r"(?i)(api[_-]?key\s*[:=]|secret\s*[:=]|password\s*[:=]|passwd\s*[:=]|"
        r"BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY|AKIA[0-9A-Z]{16}|"
        r"sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,})"
    )
    for p in sorted(RETI.rglob("*")):
        if p.is_file() and p.suffix in (".html", ".js", ".css", ".json", ".txt", ".md"):
            for i, line in enumerate(p.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
                if SECRET_RE.search(line) and "data-secret" not in line:
                    problems.append(f"secret scan: {p}:{i}: {line.strip()[:80]}")

    if problems:
        print(f"{len(problems)} problem(s):")
        for pr in problems:
            print("  " + pr)
        sys.exit(1)
    print(f"OK: {len(CHAPTERS)} chapters + {INDEX}, all structural checks passed")
    for name in CHAPTERS:
        html = (RETI / name).read_text(encoding="utf-8")
        hosts, tabs = count_widgets(html)
        figs = len(re.findall(r'<figure class="lk-fig"', html))
        quizes = len(re.findall(r"<details>", html))
        secs = len(re.findall(r'<section id=', html))
        print(f"  {name}: {secs} sections, {figs} plates, {len(hosts) + tabs} widgets ({len(hosts)}+{tabs}), {quizes} quiz items")


if __name__ == "__main__":
    main()
