# -*- coding: utf-8 -*-
import html, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from qdata import *

# Usage: python3 dev/pcd-orale/gen.py [course_dir]   (default: pcd)
SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', sys.argv[1] if len(sys.argv) > 1 else 'pcd') + '/'
OUT = SITE + 'orale.html'

# ---------- read chapter titles and section titles from the target files (also verifies anchors)
TITLES, SECTIONS = {}, {}
for key, fn in FILES.items():
    s = open(SITE + fn, encoding='utf-8').read()
    h1 = re.search(r'<h1>(.*?)</h1>', s, re.S).group(1).strip()
    if key.startswith('c'):
        n = int(key[1:])
        TITLES[key] = f'Cap. {n} — {h1}'
    else:
        TITLES[key] = h1  # "Assignment 1 — Poool"
    secs = {}
    for m in re.finditer(r'<section id="(s\d+)"[^>]*>\s*<h2>(.*?)</h2>', s, re.S):
        t = re.sub(r'<[^>]+>', '', m.group(2)).strip()
        t = html.unescape(t)
        t = re.sub(r'^\d+\.\s*', '', t)
        secs[m.group(1)] = t
    SECTIONS[key] = secs

def short(key):
    if key.startswith('c'):
        return f'Cap. {int(key[1:])}'
    return f'Assignment {key[1:]}'

def link(ref):
    key, sid = ref.split('#')
    assert sid in SECTIONS[key], ref
    num = sid[1:]
    return (f'<a href="{FILES[key]}#{sid}">&rarr; {short(key)}, §{num} · '
            f'{html.escape(SECTIONS[key][sid], quote=False)}</a>')

def md(text):
    t = html.escape(text, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    return t

def codeblock(lang, code):
    return f'<pre><code class="language-{lang}">{html.escape(code, quote=False)}</code></pre>'

def badge(n):
    if n in ASKED:
        return ' <span class="qbadge fatta">fatta</span>'
    if n in ANNOUNCED:
        return ' <span class="qbadge annunciata">annunciata</span>'
    return ''

def details(n, ind='      '):
    d = Q[n]
    out = [f'{ind}<details id="q{n}">',
           f'{ind}  <summary><span class="qn">{n}.</span> {md(d["q"])}{badge(n)}</summary>']
    for item in d['a']:
        if isinstance(item, tuple):
            out.append(codeblock(*item))
        else:
            out.append(f'{ind}  <p>{md(item)}</p>')
    links = ' '.join(link(r) for r in d['links'])
    out.append(f'{ind}  <p class="qsrc">{links}</p>')
    out.append(f'{ind}</details>')
    return '\n'.join(out)

# ---------- consistency checks
main_nums = [n for _, ns in MAIN_GROUPS for n in ns]
other_nums = [n for _, ns in OTHER_GROUPS for n in ns]
assert sorted(main_nums) == sorted(ASKED | ANNOUNCED), set(main_nums) ^ (ASKED | ANNOUNCED)
allnums = main_nums + other_nums
assert len(allnums) == len(set(allnums)) == 227, (len(allnums), len(set(allnums)))
assert set(allnums) == set(range(1, 228))
assert set(Q) == set(range(1, 228)), set(range(1, 228)) - set(Q)

n_main = len(main_nums)
n_other = len(other_nums) - len(DUPLICATES)

# ---------- page
parts = []
parts.append('''<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Domande d'orale · PCD</title>
<link rel="stylesheet" href="assets/lesson-kit.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<style>
.qn {font-family:var(--lk-mono);font-weight:600;color:var(--lk-vermilion);margin-right:.2rem}
.qbadge {display:inline-block;font-family:var(--lk-utility);font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:0 .4rem;margin-left:.35rem;border:1px solid;border-radius:2px;vertical-align:.12em;white-space:nowrap}
.qbadge.fatta {color:var(--lk-vermilion);border-color:var(--lk-vermilion);background:var(--lk-warnbg)}
.qbadge.annunciata {color:var(--lk-cobalt);border-color:var(--lk-cobalt);background:var(--lk-hl)}
.qsrc {font-family:var(--lk-utility);font-size:.85rem;margin:.5rem 0 0}
.qsrc a {display:inline-block;margin-right:.9rem}
.qdup {font-family:var(--lk-utility);font-size:.9rem;color:var(--lk-ink-soft);margin:.2rem 0 .6rem}
.qjump {font-family:var(--lk-utility);font-size:.85rem;line-height:1.9}
.qgroup h3 a {color:inherit}
</style>
</head>
<body class="lk">
  <nav class="lk-chnav" aria-label="Navigazione">
    <a href="index.html">&larr; Indice</a>
  </nav>

  <header class="lk-header">
    <div class="lk-kicker">PCD · Preparazione all'orale</div>
    <h1>Domande d'orale</h1>
''')
parts.append(f'    <div class="lk-meta"><span>227 domande dall\'elenco degli studenti</span><span>{n_main} fatte o annunciate da Ricci</span><span>{n_other} altre, divise per capitolo</span></div>\n  </header>\n')
parts.append('''
  <div class="lk-toc">
    <h3>In questa pagina</h3>
    <ol>
      <li><a href="#fatte">Le domande che Ricci ha fatto o annunciato</a></li>
      <li><a href="#altre">Tutte le altre domande, per capitolo</a></li>
    </ol>
  </div>

  <p>L'orale discute i quattro assignment e, a partire da questi, i concetti del corso. L'elenco viene da studenti che hanno già sostenuto l'esame e che hanno segnato le domande <span class="qbadge fatta">fatta</span> da Ricci e quelle <span class="qbadge annunciata">annunciata</span> da lui. Le risposte degli studenti non sono riportate, perché diverse erano sbagliate. Queste sono brevi e corrette, e ognuna rimanda alla sezione che la spiega.</p>
''')

# section 1
parts.append('''
  <section id="fatte">
    <h2>1. Le domande che Ricci ha fatto o annunciato</h2>
    <p>In ordine di corso. Le domande sul proprio assignment non hanno una risposta unica: qui c'è che cosa preparare, e la scheda dell'assignment ha il resto.</p>
''')
for key, nums in MAIN_GROUPS:
    parts.append(f'    <div class="qgroup">\n      <h3><a href="{FILES[key]}">{html.escape(TITLES[key], quote=False)}</a></h3>\n')
    parts.append('      <div class="lk-quiz">\n')
    for n in nums:
        parts.append(details(n, '        ') + '\n')
    parts.append('      </div>\n    </div>\n')
parts.append('  </section>\n')

# section 2
parts.append('''
  <section id="altre">
    <h2>2. Tutte le altre domande, per capitolo</h2>
    <p>Ogni domanda sta sotto il capitolo che le risponde. Le risposte sono di una o due frasi: per il resto c'è il collegamento alla sezione.</p>
''')
jump = ' · '.join(f'<a href="#altre-{k}">{short(k)}</a>' for k, _ in OTHER_GROUPS)
parts.append(f'    <p class="qjump">{jump}</p>\n')
for key, nums in OTHER_GROUPS:
    parts.append(f'    <div class="qgroup" id="altre-{key}">\n      <h3><a href="{FILES[key]}">{html.escape(TITLES[key], quote=False)}</a></h3>\n')
    parts.append('      <div class="lk-quiz">\n')
    for n in nums:
        if n in DUPLICATES:
            t = DUPLICATES[n]
            parts.append(f'        <p class="qdup" id="q{n}"><span class="qn">{n}.</span> {md(Q[n]["q"])} (vedi <a href="#q{t}">n. {t}</a>)</p>\n')
        else:
            parts.append(details(n, '        ') + '\n')
    parts.append('      </div>\n    </div>\n')
parts.append('  </section>\n')

parts.append('''
  <footer class="lk-foot">
    <nav class="lk-chnav" aria-label="Navigazione">
      <a href="index.html">&larr; Indice</a>
    </nav>
    <p>Fonti: elenco di 227 domande d'orale compilato da studenti che hanno sostenuto l'esame, con le loro indicazioni su quali domande Ricci ha fatto o annunciato (le loro risposte non sono riportate) · risposte ricavate dai capitoli 1–19 e dalle schede di preparazione agli assignment di queste note · Programmazione Concorrente e Distribuita, UniBo, a.a. 2025/2026 · Prof. A. Ricci</p>
  </footer>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="assets/lesson-kit.js"></script>
</body>
</html>
''')

open(OUT, 'w', encoding='utf-8').write(''.join(parts))
print('written', OUT, 'main', n_main, 'other', n_other, 'dups', len(DUPLICATES))
