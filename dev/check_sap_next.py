#!/usr/bin/env python3
"""Validate SAP autonomous-systems chapters (12-15): HTML structure, anchors,
data-src tokens against the authoritative corpus, nav links (bidirectional chain),
fragment ids, inline JS syntax, widget hosts, and section/plate/quiz counts."""
import html.parser
import re
import subprocess
import sys
import tempfile
from pathlib import Path

SAP = Path("/home/ybc/hosted/unibo-lessons/sap")
CORPUS = Path("/home/ybc/content/unibo-course-slides/71477-Software Architecture and Platforms")
CHAPTERS = [
    "cap-12-autonomous-systems-and-agents.html",
    "cap-13-agent-programs-and-architectures.html",
    "cap-14-knowledge-level-and-bdi.html",
    "cap-15-agent-oriented-and-multi-agent-programming.html",
]

# Expected navigation chain (bidirectional): each file's prev/next neighbours.
CHAIN = {
    "cap-12-autonomous-systems-and-agents.html": {
        "prev": "cap-11-architectures-for-reactive-systems.html",
        "next": "cap-13-agent-programs-and-architectures.html",
    },
    "cap-13-agent-programs-and-architectures.html": {
        "prev": "cap-12-autonomous-systems-and-agents.html",
        "next": "cap-14-knowledge-level-and-bdi.html",
    },
    "cap-14-knowledge-level-and-bdi.html": {
        "prev": "cap-13-agent-programs-and-architectures.html",
        "next": "cap-15-agent-oriented-and-multi-agent-programming.html",
    },
    "cap-15-agent-oriented-and-multi-agent-programming.html": {
        "prev": "cap-14-knowledge-level-and-bdi.html",
        "next": None,  # end of segment; index.html deferred by design
    },
}


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
        names = [t for t, _ in self.stack]
        if tag in names:
            while self.stack and self.stack[-1][0] != tag:
                bad, pos = self.stack.pop()
                self.errors.append(f"unclosed <{bad}> opened at {pos}, closed by </{tag}> at {self.getpos()}")
            self.stack.pop()
        else:
            self.errors.append(f"unmatched </{tag}> at {self.getpos()}")


def corpus_files():
    """Map data-src tokens to actual corpus .txt files (tokens use .pdf suffix)."""
    out = {}
    if not CORPUS.exists():
        return out
    for p in CORPUS.glob("*.txt"):
        name = p.name[:-4]  # drop .txt
        out[name] = str(p)
    return out


def main():
    problems = []
    existing = set(p.name for p in SAP.glob("*.html"))
    sources = corpus_files()

    for name in CHAPTERS:
        path = SAP / name
        if not path.exists():
            problems.append(f"MISSING FILE: {name}")
            continue
        html = path.read_text(encoding="utf-8")

        # 1. tag balance
        b = Balance()
        b.feed(html)
        for e in b.errors:
            problems.append(f"{name}: {e}")
        for tag, pos in b.stack:
            problems.append(f"{name}: unclosed <{tag}> at end of file (opened {pos})")

        # 2. internal anchors + fragment ids
        ids = set(re.findall(r'id="([^"]+)"', html))
        for anchor in re.findall(r'href="#([^"]+)"', html):
            if anchor not in ids:
                problems.append(f"{name}: broken anchor #{anchor}")
        # TOC must point to real sections
        sec_ids = set(re.findall(r'<section id="([^"]+)"', html))
        for anchor in re.findall(r'href="#([^"]+)"', html):
            if anchor not in sec_ids:
                problems.append(f"{name}: anchor #{anchor} is not a section id")

        # 3. data-src on every section, tokens resolvable against the corpus
        sections = re.findall(r"<section[^>]*>", html)
        no_src = [s for s in sections if "data-src" not in s]
        if no_src:
            problems.append(f"{name}: {len(no_src)} section(s) without data-src")
        for attr in re.findall(r'data-src="([^"]+)"', html):
            for tok in attr.split(","):
                tok = tok.strip()
                if not tok:
                    continue
                # token is the corpus file name with .pdf suffix; locate the .txt
                stem = tok[:-4] if tok.endswith(".pdf") else tok
                if stem in sources:
                    continue
                # slides tokens drop the "Slides Folder - " prefix
                if f"Slides Folder - {stem}" in sources:
                    continue
                problems.append(f"{name}: data-src token not in corpus: {tok}")

        # 4. nav links resolve; index.html deferred by design
        for href in re.findall(r'href="([^"#][^"]*)"', html):
            if href.startswith(("http", "mailto:", "tel:", "//")):
                continue
            if href.endswith("index.html"):
                continue
            target = (path.parent / href).resolve()
            if href.endswith(".html") and target.name not in existing:
                problems.append(f"{name}: link to missing file {href}")

        # 5. bidirectional chain integrity
        chain = CHAIN.get(name)
        if chain:
            for direction, href in (("prev", chain["prev"]), ("next", chain["next"])):
                if href is None:
                    if f'href="{href}"' in html:
                        pass  # no next expected
                    continue
                count = html.count(f'href="{href}"')
                if count < 2:
                    problems.append(f"{name}: {direction} link to {href} appears {count}x (expected >= 2: top nav + footer)")
            # the neighbour must link back
            if chain["prev"]:
                prev_html = (SAP / chain["prev"]).read_text(encoding="utf-8")
                if f'href="{name}"' not in prev_html:
                    problems.append(f"{chain['prev']}: missing forward link to {name}")

        # 6. inline scripts parse with node --check
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

        # 7. widget hosts present
        hosts = len(re.findall(r'id="(?:w|se|ac)-[a-z0-9-]+"', html))
        if hosts == 0:
            problems.append(f"{name}: no widget hosts")

    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  " + p)
        sys.exit(1)

    print(f"OK: {len(CHAPTERS)} chapters, all structural checks passed")
    for name in CHAPTERS:
        html = (SAP / name).read_text(encoding="utf-8")
        figs = len(re.findall(r"<figure class=\"lk-fig\"", html))
        quizes = len(re.findall(r"<details>", html))
        secs = len(re.findall(r"<section id=", html))
        widgets = len(re.findall(r"LessonKit\.(?:stateExplorer|stepper|annotatedCode)\(", html)) + len(re.findall(r"id=\"w-[a-z0-9-]+\"", html))
        toks = sorted({t.strip() for attr in re.findall(r'data-src="([^"]+)"', html) for t in attr.split(",") if t.strip()})
        print(f"  {name}: {secs} sections, {figs} plates, {quizes} quiz items, {widgets} widget inits/hosts, {len(toks)} source tokens")
        for t in toks:
            print(f"      src: {t}")


if __name__ == "__main__":
    main()
