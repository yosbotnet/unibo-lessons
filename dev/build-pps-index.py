#!/usr/bin/env python3
"""Regenerate the PPS index lists from the lessons' own titles and reading times.

Keeps the existing index page (style, hero, plates) and rewrites the meta line, the study notes and
each part's lesson list. Usage: python3 dev/build-pps-index.py [course_dir]   (default: pps)
"""
import html, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
course = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'pps')
PARTS = [range(1, 2), range(2, 5), range(5, 8), range(8, 9), range(9, 12)]

STUDY = '''  <div class="lk-overview">
    <h2>How to study</h2>
    <ul>
      <li>The lessons follow the <strong>order of the course</strong>: quality and testing, functional programming, Scala for larger software, process, then logic programming. Each lesson is built from one slide deck (two for Prolog) and opens with <em>the lesson in one paragraph</em>.</li>
      <li>The <strong>exam</strong> is your project, its discussion, and questions on FP and LP concepts. Lessons 2–7 and 9–11 are the concept core; lessons 1 and 8 matter mostly for how you build, test and document the project.</li>
      <li>Every code example is shown in full and was compiled or run (Scala 3.3.6, Java 21, tuProlog 4.0.3); the printed outputs are the real ones. Each lesson ends with practice questions under <strong>Check your understanding</strong>.</li>
      <li>Each lesson lists the decks, labs and code it comes from at the bottom. The slides are the official source; these notes are a study aid.</li>
    </ul>
  </div>
'''


def lesson(n):
    files = sorted(course.glob(f'PPS-{n:02d}-*.html'))
    if len(files) != 1:
        raise SystemExit(f'expected one lesson {n:02d}, found {files}')
    s = files[0].read_text(encoding='utf-8')
    title = html.unescape(re.sub(r'<[^>]+>', '', re.search(r'<h1>(.*?)</h1>', s, re.S).group(1))).strip()
    m = re.search(r'~(\d+)\s*min', s)
    return files[0].name, title, int(m.group(1)) if m else None


def main():
    src = course / 'index.html'
    page = src.read_text(encoding='utf-8')
    lists, total, count = [], 0, 0
    for rng in PARTS:
        items = []
        for n in rng:
            fname, title, mins = lesson(n)
            total += mins or 0
            count += 1
            meta = f'{mins} min' if mins else ''
            items.append(f'      <li><a href="{fname}"><span class="idx-num">{n:02d}</span><span class="idx-title">{html.escape(title)}</span><span class="idx-meta">{meta}</span></a></li>')
        lists.append('<ol class="idx-list">\n' + '\n'.join(items) + '\n    </ol>')
    parts = iter(lists)
    page = re.sub(r'<ol class="idx-list">[\s\S]*?</ol>', lambda m: next(parts), page)
    hours = round(total / 60 * 2) / 2
    page = re.sub(r'<div class="lk-meta">.*?</div>', f'<div class="lk-meta"><span>{count} lessons</span><span>~{hours:g} hours of reading</span><span>exam: project + FP/LP questions</span></div>', page, count=1)
    page = re.sub(r'  <div class="lk-overview">[\s\S]*?</div>\n', STUDY, page, count=1)
    src.write_text(page, encoding='utf-8')
    print(f'index.html: {count} lessons, ~{hours:g} h')


if __name__ == '__main__':
    main()
