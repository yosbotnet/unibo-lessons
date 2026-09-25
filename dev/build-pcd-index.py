#!/usr/bin/env python3
"""Generate the PCD index page from the chapters' own titles and reading times.

Usage: python3 dev/build-pcd-index.py [course_dir]   (default: pcd)
"""
import html, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
course = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'pcd')

PARTS = [
    ('I', 'Concorrenza a memoria condivisa', range(1, 12), ('P1', 'prep-assignment-01.html', 'Prep esame · Assignment 1 — Poool'),
     ('pcd-plate-parte-1.webp', 'Tavola: tre processi a un gate, uno attraversa la sezione critica, due attendono', 'Tav. I', 'Mutua esclusione')),
    ('II', 'Programmazione asincrona e reattiva', range(12, 14), ('P2', 'prep-assignment-02.html', 'Prep esame · Assignment 2 — FSStat'),
     ('pcd-plate-parte-2.webp', 'Tavola: un flusso di elementi trasformato da tre stadi operatore', 'Tav. II', 'Flussi e operatori')),
    ('III', 'Message passing e attori', range(14, 17), ('P3', 'prep-assignment-03.html', 'Prep esame · Assignment 3 — Smart Home Alarm + Odds-and-Evens'),
     ('pcd-plate-parte-3.webp', 'Tavola: processi isolati che si scambiano messaggi con mailbox in coda', 'Tav. III', 'Scambio di messaggi')),
    ('IV', 'Sistemi distribuiti', range(17, 20), ('P4', 'prep-assignment-04.html', 'Prep esame · Assignment 4 — Alarm distribuito + RMI TTT'),
     ('pcd-plate-parte-4.webp', 'Tavola: nodi con orologi sfasati e una partizione raggiungono un ordine condiviso', 'Tav. IV', 'Consenso e tempo logico')),
]


def chapter(n):
    files = sorted(course.glob(f'cap-{n:02d}-*.html'))
    if len(files) != 1:
        raise SystemExit(f'expected one chapter {n:02d}, found {files}')
    s = files[0].read_text(encoding='utf-8')
    title = html.unescape(re.sub(r'<[^>]+>', '', re.search(r'<h1>(.*?)</h1>', s, re.S).group(1))).strip()
    m = re.search(r'~(\d+)\s*min', s)
    return files[0].name, title, int(m.group(1)) if m else None


def main():
    rows, total = [], 0
    for num, name, rng, prep, plate in PARTS:
        items = []
        for n in rng:
            fname, title, mins = chapter(n)
            total += mins or 0
            meta = f'{mins} min' if mins else ''
            items.append(f'      <li><a href="{fname}"><span class="idx-num">{n:02d}</span><span class="idx-title">{html.escape(title)}</span><span class="idx-meta">{meta}</span></a></li>')
        items.append(f'      <li class="idx-prep"><a href="{prep[1]}"><span class="idx-num">{prep[0]}</span><span class="idx-title">{prep[2]}</span><span class="idx-meta">orale</span></a></li>')
        rows.append(f'''  <section class="idx-part">
    <div class="idx-part-head"><span class="idx-part-num">{num}</span><h2>{name}</h2></div>
    <div class="idx-body">
    <ol class="idx-list">
{chr(10).join(items)}
    </ol>
    <figure class="idx-plate"><img src="assets/{plate[0]}" width="600" height="600" loading="lazy" alt="{plate[1]}"><figcaption><b>{plate[2]}</b> — {plate[3]}</figcaption></figure>
    </div>
  </section>''')
    hours = round(total / 60 * 2) / 2
    orale = (course / 'orale.html').exists()
    page = TEMPLATE.replace('@@PARTS@@', '\n\n'.join(rows)).replace('@@HOURS@@', f'{hours:g}'.replace('.', ','))
    page = page.replace('@@ORALE@@', ORALE if orale else '')
    (course / 'index.html').write_text(page, encoding='utf-8')
    print(f'index.html: 19 chapters, ~{hours:g} h, orale page: {orale}')


ORALE = '''  <p class="idx-orale"><a href="orale.html"><strong>Domande d'orale</strong> — le domande che Ricci ha fatto o annunciato, con risposta breve e link al capitolo</a></p>
'''

TEMPLATE = '''<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PCD — Percorso di studio</title>
<link rel="stylesheet" href="assets/lesson-kit.css">
<style>
  .idx-part{margin:3rem 0 2.2rem}
  .idx-part-head{display:flex;align-items:baseline;gap:1rem;border-bottom:1px solid var(--lk-rule);padding-bottom:.4rem;margin-bottom:.9rem}
  .idx-part-num{font-family:var(--lk-display);font-weight:700;font-size:2.6rem;line-height:1;color:var(--lk-vermilion)}
  .idx-part-head h2{border:0;margin:0;padding:0;font-size:1.3rem}
  body.lk .idx-part-head h2::before,body.lk .lk-overview h2::before{display:none}
  .idx-list{list-style:none;margin:0;padding:0}
  .idx-list li{border-bottom:1px solid var(--lk-rule-soft)}
  .idx-list a{display:flex;align-items:baseline;gap:.9rem;padding:.55rem .2rem;text-decoration:none;color:var(--lk-ink)}
  .idx-list a:hover{background:var(--lk-paper-light)}
  .idx-list a:hover .idx-title{color:var(--lk-cobalt)}
  .idx-num{flex:0 0 2.2rem;font-family:var(--lk-mono);font-size:.82rem;color:var(--lk-vermilion);font-variant-numeric:tabular-nums}
  .idx-title{flex:1;font-weight:400}
  .idx-meta{flex:0 0 auto;font-family:var(--lk-mono);font-size:.75rem;color:var(--lk-ink-soft);font-variant-numeric:tabular-nums}
  .idx-list li.idx-prep a{background:var(--lk-paper-light)}
  .idx-list li.idx-prep .idx-num{color:var(--lk-forest);letter-spacing:.02em}
  .idx-list li.idx-prep .idx-title{font-weight:700}
  .idx-orale a{display:block;border:1px solid var(--lk-vermilion);padding:.8rem 1rem;text-decoration:none;color:var(--lk-ink);background:var(--lk-paper-light)}
  .idx-orale a strong{color:var(--lk-vermilion)}
  .idx-hero{margin:1.8rem 0 0}
  .idx-hero img{width:100%;height:auto;border:1px solid var(--lk-rule-soft)}
  .idx-body{display:grid;grid-template-columns:1fr 180px;gap:1.4rem;align-items:start}
  .idx-plate{margin:0}
  .idx-plate img{width:100%;height:auto;border:1px solid var(--lk-rule-soft)}
  .idx-plate figcaption{font-family:var(--lk-mono);font-size:.68rem;color:var(--lk-ink-soft);margin-top:.35rem}
  .idx-plate figcaption b{color:var(--lk-vermilion);font-weight:600}
  @media(max-width:560px){.idx-list a{flex-wrap:wrap}.idx-meta{flex-basis:100%;padding-left:3.1rem}
    .idx-body{grid-template-columns:1fr}.idx-plate{max-width:230px;margin:.4rem auto 0}}
</style>
</head>
<body class="lk">
  <header class="lk-header">
    <div class="lk-kicker">Università di Bologna · Prof. Alessandro Ricci · a.a. 2025/2026</div>
    <h1>Programmazione Concorrente e Distribuita</h1>
    <div class="lk-meta"><span>19 capitoli</span><span>4 pagine di prep esame</span><span>~@@HOURS@@ ore di lettura</span></div>
  </header>

  <figure class="lk-fig idx-hero">
    <img src="assets/pcd-plate-hero.webp" width="1024" height="683" alt="Tavola tecnica: tracce di istruzioni indipendenti convergono in un interleaving e si risolvono in una struttura ordinata">
    <figcaption><b>Tavola 00</b> — Tracce indipendenti → interleaving → ordine. Il percorso del corso in una figura.</figcaption>
  </figure>

  <div class="lk-overview">
    <h2>Come studiare</h2>
    <ul>
      <li>I capitoli seguono l'ordine del corso e dei moduli delle slide. Ogni capitolo raccoglie in un unico posto ciò che le lezioni hanno detto su un argomento, spiegato una volta sola, e si apre con <em>il capitolo in un paragrafo</em>.</li>
      <li>L'orale è una discussione individuale sugli assignment più i concetti del corso. Alla fine di ogni parte c'è una pagina di <strong>prep esame</strong> sull'assignment corrispondente.</li>
      <li>I laboratori interattivi calcolano davvero qualcosa (interleaving, stati raggiungibili, consegna dei messaggi): usali per verificare quello che leggi.</li>
      <li>Le liste delle slide sono complete; quelle meno centrali sono in blocchi richiudibili «Dalle slide». Ciò che va oltre le slide è segnato «Oltre le slide».</li>
    </ul>
  </div>

@@ORALE@@
@@PARTS@@

  <footer class="lk-foot">
    <p>Scritto dalle slide dei moduli 1.1–4.3 e dalle lab notes, con le trascrizioni di 23 lezioni, e riorganizzato per concetto · la versione precedente è nella storia git.</p>
    <p>Programmazione Concorrente e Distribuita · ISI LM · UniBo Cesena · ybc.sh</p>
  </footer>
</body>
</html>
'''

if __name__ == '__main__':
    main()
