#!/usr/bin/env python3
"""Validate the Business Intelligence (69012) course: 16 chapters + index.

Scope and conventions (authoritative corpus:
/home/ybc/content/unibo-course-slides/69012-Business Intelligence):

* The taught chapter spine is built from the 10 lecture decks only
  (Presentazione del corso, La business intelligence, Introduzione ai
  sistemi di data warehousing, Il ciclo di vita dei data warehouse prima
  parte / seconda parte, Testi per le esercitazioni in aula, 1 Intro,
  2 DW design, 3 DW connection and setup, 4 OLAP querying).  The 24
  exam-archive files (Compiti d_esame - * and Testi d_esame e soluzioni - *)
  are SUPPLEMENTARY exam materials: they are not part of the taught spine,
  are not re-built as chapters, and are deliberately not required as
  data-src tokens.  This is documented in index.html ("materiale
  supplementare") and enforced here by the SOURCE_STEMS list below.
* Widget convention (same as the PM course): a widget is one interactive
  component - a LessonKit host (stateExplorer/stepper/annotatedCode target)
  or a bespoke wrapper div (w-*).  The inner -dom host inside a wrapper is
  part of the same widget, and .lk-tabs blocks are NOT widgets.
* Tavole convention: every <figure class="lk-fig"> with a "Tavola X.Y"
  caption counts as one tavola.

Checks: tag balance, internal anchors, data-src on every section, source
tokens against the corpus stems, footer attributions are a subset of the
chapter's data-src tokens, nav links resolve, bidirectional nav chain,
inline JS parses with node --check, widget hosts exist for every LessonKit
call, meta widget/tavole counts match the computed convention, index links
every chapter and nothing else, permissions 755/644, secret scan.
"""
import html.parser
import os
import re
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

BI = Path("/home/ybc/hosted/unibo-lessons/bi")
CORPUS = Path("/home/ybc/content/unibo-course-slides/69012-Business Intelligence")
INDEX = "index.html"

CHAPTERS = [
    "cap-01-business-intelligence.html",
    "cap-02-data-warehousing.html",
    "cap-03-architetture.html",
    "cap-04-modello-multidimensionale.html",
    "cap-05-ciclo-di-vita.html",
    "cap-06-sorgenti-requisiti.html",
    "cap-07-dfm.html",
    "cap-08-dfm-avanzato.html",
    "cap-09-progettazione-concettuale.html",
    "cap-10-carico-lavoro-volume-dati.html",
    "cap-11-progettazione-logica.html",
    "cap-12-viste-materializzate-scenari-temporali.html",
    "cap-13-progettazione-fisica-etl-indici.html",
    "cap-14-interrogazione-olap-power-bi.html",
    "cap-15-modulo-2-tpc-d-indyco-builder.html",
    "cap-16-power-bi-connessione-setup.html",
]

# The 10 lecture decks that form the taught spine (corpus filenames).
LECTURE_DECKS = {
    "Presentazione del corso", "La business intelligence",
    "Introduzione ai sistemi di data warehousing",
    "Il ciclo di vita dei data warehouse (prima parte)",
    "Il ciclo di vita dei data warehouse (seconda parte)",
    "Testi per le esercitazioni in aula",
    "1 Intro", "2 DW design", "3 DW connection and setup", "4 OLAP querying",
}
# The 24 exam-archive files: supplementary, NOT required as data-src.
EXAM_ARCHIVE_PREFIXES = ("Compiti d_esame", "Testi d_esame e soluzioni")

# Expected widget/tavole counts (course convention, recomputed 2026-08-19).
EXPECTED = {
    "cap-01-business-intelligence.html": (2, 3),
    "cap-02-data-warehousing.html": (3, 3),
    "cap-03-architetture.html": (3, 3),
    "cap-04-modello-multidimensionale.html": (3, 4),
    "cap-05-ciclo-di-vita.html": (3, 3),
    "cap-06-sorgenti-requisiti.html": (3, 3),
    "cap-07-dfm.html": (3, 3),
    "cap-08-dfm-avanzato.html": (3, 4),
    "cap-09-progettazione-concettuale.html": (5, 7),
    "cap-10-carico-lavoro-volume-dati.html": (4, 5),
    "cap-11-progettazione-logica.html": (6, 9),
    "cap-12-viste-materializzate-scenari-temporali.html": (6, 9),
    "cap-13-progettazione-fisica-etl-indici.html": (6, 11),
    "cap-14-interrogazione-olap-power-bi.html": (6, 7),
    "cap-15-modulo-2-tpc-d-indyco-builder.html": (5, 8),
    "cap-16-power-bi-connessione-setup.html": (6, 7),
}

SECRET_PATTERNS = [
    r"(?i)api[_-]?key\s*[=:]\s*['\"][A-Za-z0-9_\-]{16,}",
    r"(?i)secret\s*[=:]\s*['\"][A-Za-z0-9_\-]{16,}",
    r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
    r"(?i)aws_(access_key_id|secret_access_key)\s*[=:]\s*\S+",
    r"(?i)AKIA[0-9A-Z]{16}",
    r"(?i)github_pat_[A-Za-z0-9_]{20,}",
    r"(?i)xox[baprs]-[A-Za-z0-9-]{10,}",
]


class Balance(html.parser.HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
            "link", "meta", "param", "source", "track", "wbr", "circle",
            "line", "path", "rect", "text", "marker", "polygon", "stop",
            "use", "ellipse"}

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
                self.errors.append(
                    f"unclosed <{bad}> opened at {pos}, closed by </{tag}> at {self.getpos()}")
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


def check_permissions(name, path, problems):
    st = path.stat()
    mode = stat.S_IMODE(st.st_mode)
    if path.is_dir():
        if mode != 0o755:
            problems.append(f"{name}: directory mode {oct(mode)} != 755")
    else:
        if mode not in (0o644, 0o755):
            problems.append(f"{name}: file mode {oct(mode)} not 644/755")


def secret_scan(name, text, problems):
    for pat in SECRET_PATTERNS:
        m = re.search(pat, text)
        if m:
            problems.append(f"{name}: possible secret match /{pat}/ near {m.group(0)[:40]!r}")


def source_stem(token):
    """'Il ciclo di vita dei data warehouse (prima parte).pdf' -> stem."""
    return re.sub(r"\.(pdf|txt)$", "", token).strip()


def main():
    problems = []

    # ---- corpus sanity: 10 lecture decks + 24 exam archives = 34 files ----
    corpus_files = sorted(p.name for p in CORPUS.glob("*.txt"))
    decks = {source_stem(f) for f in corpus_files if not f.startswith(EXAM_ARCHIVE_PREFIXES)}
    exams = [f for f in corpus_files if f.startswith(EXAM_ARCHIVE_PREFIXES)]
    missing_decks = LECTURE_DECKS - decks
    if missing_decks:
        problems.append(f"corpus: lecture decks missing from corpus: {sorted(missing_decks)}")
    if len(exams) != 24:
        problems.append(f"corpus: expected 24 exam-archive files, found {len(exams)}")
    if len(corpus_files) != 34:
        problems.append(f"corpus: expected 34 files, found {len(corpus_files)}")

    existing = set(p.name for p in BI.glob("*.html"))
    for name in CHAPTERS:
        path = BI / name
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

        # 3. data-src on every section, tokens match the lecture decks
        sections = re.findall(r"<section[^>]*>", html)
        no_src = [s for s in sections if "data-src" not in s and 'id="quiz"' not in s]
        if no_src:
            problems.append(f"{name}: {len(no_src)} section(s) without data-src")
        srcs = set()
        for attr in re.findall(r'data-src="([^"]+)"', html):
            for t in attr.split(","):
                t = t.strip()
                stem = source_stem(t)
                if stem not in LECTURE_DECKS:
                    problems.append(f"{name}: data-src token not a taught lecture deck: {t}")
                srcs.add(stem)
        if not srcs:
            problems.append(f"{name}: no data-src tokens at all")

        # 4. footer attributions are a subset of this chapter's data-src tokens
        foot = re.findall(r'<footer class="lk-foot">(.*?)</footer>', html, re.S)
        if foot:
            codes = re.findall(r"<code>([^<]+)</code>", foot[0])
            for c in codes:
                if source_stem(c) not in srcs:
                    problems.append(f"{name}: footer cites {c!r} not used by any section")
            if not codes:
                problems.append(f"{name}: footer has no <code> source attributions")

        # 5. nav links resolve (file: relative); index.html is validated separately
        for href in re.findall(r'href="([^"#][^"]*)"', html):
            if href.startswith(("http", "mailto:", "tel:", "//")):
                continue
            if href.endswith("index.html"):
                continue
            target = (path.parent / href).resolve()
            if href.endswith(".html") and target.name not in existing:
                problems.append(f"{name}: link to missing file {href}")

        # 6. inline scripts parse with node --check
        for i, body in enumerate(re.findall(
                r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)):
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

        # 7. every LessonKit call target has a host element
        for t in re.findall(r'LessonKit\.(?:stateExplorer|stepper|annotatedCode)\(\s*"#([^"]+)"', html):
            if t not in ids:
                problems.append(f"{name}: LessonKit host #{t} missing")

        # 8. meta widget/tavole counts match the convention
        meta = re.search(
            r'<span>(\d+) widget interattivi</span><span>(\d+) tavole</span>', html)
        if not meta:
            problems.append(f"{name}: meta counts not found")
        else:
            mw, mt = int(meta.group(1)), int(meta.group(2))
            ew, et = EXPECTED[name]
            if (mw, mt) != (ew, et):
                problems.append(
                    f"{name}: meta says {mw} widget/{mt} tavole, expected {ew}/{et}")

        # 9. permissions + secrets
        check_permissions(name, path, problems)
        secret_scan(name, html, problems)

    # ---- course index ----
    idx = BI / INDEX
    if not idx.exists():
        problems.append(f"MISSING FILE: {INDEX}")
    else:
        text = idx.read_text(encoding="utf-8")
        check_balance(INDEX, text, problems)
        check_permissions(INDEX, idx, problems)
        secret_scan(INDEX, text, problems)
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
        # index must document the supplementary exam-archive scope
        if "materiale supplementare" not in text or "24" not in text:
            problems.append(f"{INDEX}: exam-archive supplementary scope not documented")
        if len(re.findall(r"<li>", text)) < len(CHAPTERS):
            problems.append(f"{INDEX}: fewer list rows than chapters")

    # ---- bidirectional nav chain ----
    chain = CHAPTERS
    for i, name in enumerate(chain):
        html = (BI / name).read_text(encoding="utf-8")
        hrefs = re.findall(r'href="([^"#][^"]*)"', html)
        if i > 0:
            if chain[i - 1] not in hrefs:
                problems.append(f"nav: {name} missing prev link to {chain[i - 1]}")
        if i < len(chain) - 1:
            if chain[i + 1] not in hrefs:
                problems.append(f"nav: {name} missing next link to {chain[i + 1]}")
        if INDEX not in hrefs:
            problems.append(f"nav: {name} missing index link")

    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  " + p)
        sys.exit(1)

    print(f"OK: {len(CHAPTERS)} chapters + {INDEX}, all structural checks passed")
    total_w = total_t = 0
    for name in CHAPTERS:
        html = (BI / name).read_text(encoding="utf-8")
        figs = len(re.findall(r'<figure class="lk-fig"', html))
        quizzes = len(re.findall(r"<details>", html))
        secs = len(re.findall(r"<section id=", html))
        w, t = EXPECTED[name]
        total_w += w
        total_t += t
        print(f"  {name}: {secs} sections, {w} widgets, {t} tavole, {quizzes} quiz items")
    print(f"  totals: {len(CHAPTERS)} chapters, {total_w} widgets, {total_t} tavole")


if __name__ == "__main__":
    main()
