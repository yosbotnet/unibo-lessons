#!/usr/bin/env python3
"""Validate the complete Software Architecture and Platforms (71477) course:
18 chapters + index.

Scope and conventions (authoritative corpus:
/home/ybc/content/unibo-course-slides/71477-Software Architecture and Platforms):

* The taught spine is the 28 corpus files referenced by data-src tokens across
  the 18 chapters: 9 module decks, 6 lab-note decks, 12 cited research
  papers, and the Software-Fundamentals textbook chapter.  The corpus holds
  34 files total.  The 6 remaining files are: "Slides Folder - Intro" (used
  ONLY for the index overview, never as a chapter source) and 5 genuinely
  supplementary cloud/ISO/textbook files (multi-tenant-cloud-architectures,
  BS ISO-IEC 22123-1-2023, BS ISO-IEC 22123-2-2023, BS ISO-IEC 19086-1-2016,
  Dan C. Marinescu - Cloud Computing) which are NOT taught chapter sources,
  are NOT rebuilt as chapters, and are documented honestly in index.html as a
  supplementary reference library.  This is enforced below by exact set
  equality: corpus == taught ∪ {INTRO} ∪ SUPPLEMENTARY.
* data-src tokens carry the .pdf suffix even though the corpus files are
  .txt; slides/lab-note tokens drop the "Slides Folder - " prefix
  ("_module-1.1_ ... .pdf" -> "Slides Folder - _module-1.1_ ...").
* Widget convention (same as the BI/PM courses): a widget is one interactive
  component - a LessonKit host (stateExplorer/stepper/annotatedCode target)
  or a bespoke wrapper div (w-*).  The chapter meta count equals the number
  of UNIQUE ids among (LessonKit call targets ∪ id="w-*" hosts); a stepper
  hosted at #w-x counts once even though it appears in both sets.
* Plates convention: every <figure class="lk-fig"> containing an inline SVG
  counts as one technical plate; illustrative raster scenes do not. The meta
  "plates" number must match.
* Navigation: every chapter links prev/next (>=2 occurrences each: top nav +
  footer) and index.html (>=2); chapter 1 has no prev, chapter 18 is
  terminal (no forward links).

Checks: tag balance, internal anchors, TOC-to-section fragments, data-src on
every section, source-token resolution against the corpus, footer
attributions as subset of the chapter's data-src, nav links resolve,
bidirectional nav chain, inline JS parses with node --check, widget hosts
exist for every LessonKit call, meta widget/plate counts match the
convention, index links every chapter and nothing else, index documents the
supplementary classification, permissions 755/644, secret scan.
"""
import html.parser
import os
import re
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

SAP = Path("/home/ybc/hosted/unibo-lessons/sap")
CORPUS = Path("/home/ybc/content/unibo-course-slides/71477-Software Architecture and Platforms")
INDEX = "index.html"

CHAPTERS = [
    "cap-01-software-engineering.html",
    "cap-02-software-architecture.html",
    "cap-03-architectural-styles.html",
    "cap-04-clean-architecture.html",
    "cap-05-quanta-governance.html",
    "cap-06-domain-driven-design.html",
    "cap-07-tactical-design.html",
    "cap-08-eventstorming.html",
    "cap-09-from-ddd-to-microservices.html",
    "cap-10-microservices-patterns.html",
    "cap-11-architectures-for-reactive-systems.html",
    "cap-12-autonomous-systems-and-agents.html",
    "cap-13-agent-programs-and-architectures.html",
    "cap-14-knowledge-level-and-bdi.html",
    "cap-15-agent-oriented-and-multi-agent-programming.html",
    "cap-16-designing-event-driven-microservices.html",
    "cap-17-production-ready-and-deploying-microservices.html",
    "cap-18-testing-microservices.html",
]

# The four lab-note decks that close the course (cap-16..cap-18 sources).
LAB_NOTES = {
    "_Lab Notes_ Designing Event-driven Microservices",
    "_Lab Notes_ Developing Production-Ready Microservices",
    "_Lab Notes_ Deploying Microservices",
    "_Lab Notes_ Testing Microservices",
}

# The corpus files that are NOT taught chapter sources and NOT the Intro.
# They are documented in index.html as the supplementary reference library.
INTRO = "Slides Folder - Intro"
SUPPLEMENTARY = {
    "Slides Folder - multi-tenant-cloud-architectures",
    "Materials Folder - BS ISO-IEC 22123-1-2023--_2024-11-29--06-13-42 PM_",
    "Materials Folder - BS ISO-IEC 22123-2-2023--_2024-11-29--06-10-36 PM_",
    "Materials Folder - BS ISO-IEC 19086-1-2016--_2024-12-01--05-43-49 PM_",
    "Materials Folder - Dan C. Marinescu - Cloud Computing_ Theory and Practice-Morgan Kaufmann (2022)",
}

# Expected widget/plate counts (course convention, recomputed 2026-08-19).
EXPECTED = {
    "cap-01-software-engineering.html": (4, 3),
    "cap-02-software-architecture.html": (4, 4),
    "cap-03-architectural-styles.html": (4, 5),
    "cap-04-clean-architecture.html": (5, 4),
    "cap-05-quanta-governance.html": (6, 4),
    "cap-06-domain-driven-design.html": (4, 3),
    "cap-07-tactical-design.html": (5, 3),
    "cap-08-eventstorming.html": (3, 3),
    "cap-09-from-ddd-to-microservices.html": (4, 5),
    "cap-10-microservices-patterns.html": (4, 4),
    "cap-11-architectures-for-reactive-systems.html": (4, 5),
    "cap-12-autonomous-systems-and-agents.html": (4, 7),
    "cap-13-agent-programs-and-architectures.html": (5, 9),
    "cap-14-knowledge-level-and-bdi.html": (4, 6),
    "cap-15-agent-oriented-and-multi-agent-programming.html": (7, 8),
    "cap-16-designing-event-driven-microservices.html": (6, 6),
    "cap-17-production-ready-and-deploying-microservices.html": (5, 8),
    "cap-18-testing-microservices.html": (5, 7),
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
    """'_module-1.1_ Background - About Software Engineering.pdf' -> stem."""
    return re.sub(r"\.(pdf|txt)$", "", token).strip()


def norm_token(token):
    """Normalize a source label for fuzzy matching (entities, case, punctuation)."""
    return re.sub(r"[^a-z0-9]+", "", html.unescape(token).lower())


def token_words(token):
    """Significant lowercase words of a label, for overlap matching."""
    return {w for w in re.findall(r"[a-z0-9]{2,}", html.unescape(token).lower())
            if not w.isdigit()}


def resolve_token(token, sources):
    """Resolve a data-src token to a corpus stem, or return None."""
    stem = source_stem(token)
    if stem in sources:
        return stem
    if f"Slides Folder - {stem}" in sources:
        return f"Slides Folder - {stem}"
    return None


def main():
    problems = []

    # ---- corpus sanity ----
    corpus_files = sorted(p.name[:-4] for p in CORPUS.glob("*.txt"))
    sources = set(corpus_files)
    if len(sources) != 34:
        problems.append(f"corpus: expected 34 files, found {len(sources)}")

    existing = set(p.name for p in SAP.glob("*.html"))
    taught = set()

    for name in CHAPTERS:
        path = SAP / name
        if not path.exists():
            problems.append(f"MISSING FILE: {name}")
            continue
        html = path.read_text(encoding="utf-8")

        # 1. tag balance
        check_balance(name, html, problems)

        # 2. internal anchors + TOC-to-section fragments
        ids = set(re.findall(r'id="([^"]+)"', html))
        for anchor in re.findall(r'href="#([^"]+)"', html):
            if anchor not in ids:
                problems.append(f"{name}: broken anchor #{anchor}")
        sec_ids = set(re.findall(r'<section id="([^"]+)"', html))
        for anchor in re.findall(r'href="#([^"]+)"', html):
            if anchor not in sec_ids:
                problems.append(f"{name}: anchor #{anchor} is not a section id")

        # 3. data-src on every section (including quiz), tokens resolve
        sections = re.findall(r"<section[^>]*>", html)
        no_src = [s for s in sections if "data-src" not in s]
        if no_src:
            problems.append(f"{name}: {len(no_src)} section(s) without data-src")
        srcs = set()
        for attr in re.findall(r'data-src="([^"]+)"', html):
            for t in attr.split(","):
                t = t.strip()
                if not t:
                    continue
                stem = resolve_token(t, sources)
                if stem is None:
                    problems.append(f"{name}: data-src token not in corpus: {t}")
                else:
                    srcs.add(stem)
        if not srcs:
            problems.append(f"{name}: no data-src tokens at all")
        taught |= srcs

        # 4. footer attributions are (normalized) substrings of this chapter's data-src stems
        foot = re.findall(r'<footer class="lk-foot">(.*?)</footer>', html, re.S)
        if foot:
            codes = re.findall(r"<code>([^<]+)</code>", foot[0])
            src_norms = [norm_token(s) for s in srcs]
            src_words = [token_words(s) for s in srcs]
            for c in codes:
                cn = norm_token(c)
                if len(cn) < 10:
                    problems.append(f"{name}: footer attribution too short to verify: {c!r}")
                    continue
                cw = token_words(c)
                ok = any(cn in sn or sn in cn for sn in src_norms) or \
                     any(len(cw & sw) >= 3 for sw in src_words)
                if not ok:
                    problems.append(f"{name}: footer cites {c!r} not used by any section")
            if not codes:
                problems.append(f"{name}: footer has no <code> source attributions")

        # 5. nav links resolve (relative html); index.html handled separately
        for href in re.findall(r'href="([^"#][^"]*)"', html):
            if href.startswith(("http", "mailto:", "tel:", "//")):
                continue
            if href.endswith("index.html"):
                continue
            target = (path.parent / href).resolve()
            if href.endswith(".html") and target.name not in existing:
                problems.append(f"{name}: link to missing file {href}")

        # 6. bidirectional chain: prev/next/index each >= 2 occurrences
        i = CHAPTERS.index(name)
        for direction, other in (("prev", CHAPTERS[i - 1] if i > 0 else None),
                                 ("next", CHAPTERS[i + 1] if i < len(CHAPTERS) - 1 else None)):
            if other is None:
                # terminal / first chapter: must NOT link outside the chain
                if i == 0 and direction == "prev":
                    for h in re.findall(r'href="cap-[^"]+"', html):
                        pass  # any cap-* href before cap-01 would be caught below
                continue
            count = html.count(f'href="{other}"')
            if count < 2:
                problems.append(f"{name}: {direction} link to {other} appears {count}x (expected >= 2)")
        if html.count('href="index.html"') < 2:
            problems.append(f"{name}: index link appears < 2 times (top nav + footer)")
        # chapter 18 is terminal: no forward chapter links
        if name == CHAPTERS[-1]:
            fwd = [h for h in re.findall(r'href="(cap-\d+[^"]*)"', html)
                   if h != CHAPTERS[-2]]
            if fwd:
                problems.append(f"{name}: terminal chapter still links forward: {fwd}")
        # chapter 1 has no previous chapter link
        if name == CHAPTERS[0]:
            prev = [h for h in re.findall(r'href="(cap-\d+[^"]*)"', html)
                    if h != CHAPTERS[1]]
            if prev:
                problems.append(f"{name}: first chapter links back: {prev}")

        # 7. inline scripts parse with node --check
        for j, body in enumerate(re.findall(
                r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)):
            if not body.strip():
                continue
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
                f.write(body)
                fname = f.name
            r = subprocess.run(["node", "--check", fname], capture_output=True, text=True)
            if r.returncode != 0:
                err = (r.stderr or r.stdout).strip().splitlines()
                problems.append(f"{name}: inline script #{j + 1} fails: {err[-1] if err else 'unknown'}")
            Path(fname).unlink(missing_ok=True)

        # 8. every LessonKit call target has a host element
        for t in re.findall(r'LessonKit\.(?:stateExplorer|stepper|annotatedCode)\(\s*[\'"]#([^\'"]+)[\'"]', html):
            if t not in ids:
                problems.append(f"{name}: LessonKit host #{t} missing")

        # 9. meta widget/plate counts match the convention
        meta = re.search(
            r'<span>(\d+) interactive widgets</span><span>(\d+) plates</span>', html)
        if not meta:
            problems.append(f"{name}: meta counts not found")
        else:
            mw, mt = int(meta.group(1)), int(meta.group(2))
            lk_targets = set(re.findall(
                r'LessonKit\.(?:stateExplorer|stepper|annotatedCode)\(\s*[\'"]#([^\'"]+)[\'"]', html))
            w_hosts = set(re.findall(r'id="(w-[a-z0-9-]+)"', html))
            unique_widgets = lk_targets | w_hosts
            plates = len(re.findall(r'<figure class="lk-fig"[^>]*>.*?<svg\b', html, re.S))
            if mw != len(unique_widgets):
                problems.append(f"{name}: meta says {mw} widgets, computed {len(unique_widgets)} "
                                f"(unique LessonKit targets {sorted(lk_targets)} + w-* hosts {sorted(w_hosts)})")
            if mt != plates:
                problems.append(f"{name}: meta says {mt} plates, computed {plates}")
            ew, et = EXPECTED[name]
            if (mw, mt) != (ew, et):
                problems.append(f"{name}: meta {mw}/{mt} != expected {ew}/{et}")

        # 10. permissions + secrets
        check_permissions(name, path, problems)
        secret_scan(name, html, problems)

    # ---- taught-set invariants ----
    missing_notes = LAB_NOTES - {s.replace("Slides Folder - ", "") for s in taught}
    if missing_notes:
        problems.append(f"taught set: lab-note decks not used by any chapter: {sorted(missing_notes)}")
    leftover = sources - taught - {INTRO} - SUPPLEMENTARY
    if leftover:
        problems.append(f"corpus: files neither taught, nor Intro, nor supplementary: {sorted(leftover)}")
    missing_supp = SUPPLEMENTARY - sources
    if missing_supp:
        problems.append(f"corpus: expected supplementary files missing: {sorted(missing_supp)}")
    covered = taught | {INTRO} | SUPPLEMENTARY
    if covered != sources:
        problems.append(f"corpus: taught+Intro+supplementary != corpus "
                        f"({len(covered)} vs {len(sources)})")

    # ---- course index ----
    idx = SAP / INDEX
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
        # index must document the supplementary classification honestly
        for marker in ("supplementary reference library", "5 files", "not taught"):
            if marker not in text:
                problems.append(f"{INDEX}: supplementary classification marker {marker!r} missing")
        if "Slides Folder - Intro" not in text:
            problems.append(f"{INDEX}: Intro (index overview source) not documented")
        if len(re.findall(r"<li>", text)) < len(CHAPTERS):
            problems.append(f"{INDEX}: fewer list rows than chapters")
        # index meta totals must match the per-chapter expected counts
        total_w = sum(v[0] for v in EXPECTED.values())
        total_t = sum(v[1] for v in EXPECTED.values())
        meta = re.search(r"<span>(\d+) chapters</span><span>(\d+) interactive widgets</span><span>(\d+) plates</span>", text)
        if not meta:
            problems.append(f"{INDEX}: meta totals not found")
        else:
            nc, nw, nt = int(meta.group(1)), int(meta.group(2)), int(meta.group(3))
            if (nc, nw, nt) != (len(CHAPTERS), total_w, total_t):
                problems.append(f"{INDEX}: meta {nc}/{nw}/{nt} != expected {len(CHAPTERS)}/{total_w}/{total_t}")
        # nav chain from index back to chapters: every chapter links index already
        for name in CHAPTERS:
            if 'href="index.html"' not in (SAP / name).read_text(encoding="utf-8"):
                problems.append(f"nav: {name} missing index link")

    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  " + p)
        sys.exit(1)

    print(f"OK: {len(CHAPTERS)} chapters + {INDEX}, all structural checks passed")
    total_w = total_t = 0
    for name in CHAPTERS:
        html = (SAP / name).read_text(encoding="utf-8")
        figs = len(re.findall(r'<figure class="lk-fig"[^>]*>.*?<svg\b', html, re.S))
        quizzes = len(re.findall(r"<details>", html))
        secs = len(re.findall(r"<section id=", html))
        w, t = EXPECTED[name]
        total_w += w
        total_t += t
        print(f"  {name}: {secs} sections, {w} widgets, {t} plates, {quizzes} quiz items")
    print(f"  totals: {len(CHAPTERS)} chapters, {total_w} widgets, {total_t} plates; "
          f"taught sources = {len(taught)}/34 corpus files; supplementary = {len(SUPPLEMENTARY)} + Intro")


if __name__ == "__main__":
    main()
