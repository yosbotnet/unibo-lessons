# Correzione figure — preview del 7 settembre 2026

Stato: **non pubblicato in produzione; attende approvazione**.

## Repository e pubblicazione

- Repository: `/home/ybc/hosted/unibo-lessons`, origine `https://github.com/yosbotnet/unibo-lessons.git`, base `80d243e`.
- Sorgenti: capitoli HTML con SVG inline e widget JavaScript; non è stato trovato un generatore mantenuto delle tavole. Le correzioni sono nei sorgenti, non applicate solo al DOM durante la visita.
- Produzione: Caddy serve direttamente quel repository, come configurato in `/etc/caddy/Caddyfile`. Modificarlo avrebbe pubblicato immediatamente.
- Lavoro isolato: `/home/ybc/notes-figure-preview`, branch `fix/course-figures-2026-09-07`. Nessun AGENTS.md applicabile trovato; consultate le indicazioni grafiche di DESIGN.md. File preesistenti non tracciati preservati nella directory di produzione.
- Nessuna modifica a Caddy, nessun riavvio di servizi esistenti. La preview usa un processo HTTP separato, porta 8787.

## Risultato

Confermati **208 capitoli e 882 figure** nei 15 corsi richiesti. Il registro `figure-ledger.json` distingue gli interventi su diagrammi/didascalie dal solo contenitore scorribile: **529 figure con modifiche**, comprese **35 conversioni da tavole testuali SVG a vere tabelle HTML**. Non tutte le segnalazioni automatiche sono state trattate come errori: controllo visivo delle tavole segnalate, delle priorità e dei casi aggiuntivi, seguito da nuova verifica dei rendering.

Stile conservato: avorio, cobalto, vermiglio. Nessuna ulteriore riduzione generalizzata dei caratteri; la prosa lunga passa nelle didascalie, collegata mediante riferimenti numerati. I diagrammi larghi e le tabelle BI sono scorribili su mobile, con indicazione visibile e focus da tastiera. Nessun `overflow: hidden` usato per coprire problemi.

### Tutte le 20 tavole strutturalmente danneggiate

| Corso / capitolo | Tavole |
| --- | --- |
| DL / autoencoders | 9.5, 9.6 |
| DL / transformers | 10.4 |
| DL / generative models | 11.6, 11.7 |
| DL / reinforcement learning | 12.1, 12.2, 12.4, 12.7 |
| Bigdata / streaming | 10.5 |
| PM / planning JPPS | 8.2 |
| PM / riunioni e scope | 14.2 |
| PM / Kanban e DevOps | 18.3 |
| Reti LM / TCP prestazioni | 13.2, 13.3, 13.4, 13.6, 13.7, 13.8 |
| SAP / agent programs and architectures | 13.7 |

Causa confermata: tag HTML `sub`, `sup`, `b` o `i` nel contenuto SVG interrompevano il namespace SVG; nel DOM pubblico 194 nodi grafici erano interpretati come HTML. Ripristinati con `tspan` appropriati/Unicode. Controllati anche marker, percorsi e collegamenti: non soltanto la ricomparsa degli elementi.

Rifatti dove necessario i circuiti VAE, multi-head attention, CycleGAN, diffusione, MDP, scelta delle azioni, replay DQN, agente RL, processo di cambio scope e latenza TCP. Nei grafici TCP ora la perdita provoca un dimezzamento verticale, il conteggio per area mostra rettangolo e triangolo corretti, e la finestra dinamica distingue crescita esponenziale, lineare e plateau. I grafici periodici iniziano mostrando una porzione del ciclo precedente; la pendenza di crescita rimane costante.

### Difetti didattici e di impaginazione richiesti

- DL 8.3: bus di input collegato ai quattro gate, percorso `tanh(cₜ)` esplicito prima del prodotto con `oₜ`, equazioni coerenti con le slide RNN 32–39.
- DM 10.3: primo fold rosso largo 104, non 520; VALIDATE centrato sul solo fold, altri quattro per training.
- Visione 13.1: le stesse due auto alle stesse coordinate; stessa classe, istanze distinte; maschere derivate dalle medesime sagome SVG.
- ASMD 12.5: pseudocodice Gillespie e tabella delle due estrazioni casuali, senza pannelli sovrapposti.
- BI 11.8: tre tabelle delle gerarchie incomplete, con Serravalle per rendere evidente la differenza tra riempimento dal comune e dalla nazione. Confronto con slide 69–72 del ciclo di vita DW.
- OA 8.1: tassonomia completa, categorical compreso, descrizioni nella didascalia.
- Visione 6.2: gerarchia SVG e tabella HTML di matrici/proprietà; distinzione fra scala isotropa e anisotropa.
- Bigdata 8.3: pipeline shuffle collegata, costi e spiegazioni fuori dai box.
- ISE 8.1: soundness e completeness nelle direzioni corrette, spiegazioni nella didascalia.
- PM 11.2: legenda completa del task node in HTML.
- Correzioni locali: IRS 8.1, ASW 4.2, Netprog 6.1, Reti LM 6.3, SAP 3.5, SPE 4.2, Visione 6.3.
- Ulteriori esempi: DL 11.4 ora mostra il vero output 4×4 della convoluzione trasposta, verificato contro la slide 41; DL 12.3 distingue correttamente i rami ε / 1−ε; PM 11.3 include tutte le quattro dipendenze. Altri interventi su note, etichette, estensione delle viewBox e tabelle sono elencati nel registro completo.
- Ultimo controllo visivo: rami separati in IRS 8.4, skip connection realmente collegate in DL 11.5 e Visione 13.4, livelli di persistenza Spark in tabella (Bigdata 8.5), curve gaussiane calcolate dalla densità normale in OA 8.4–8.5.

## Verifiche

- Chromium desktop 1280×1000 e mobile 390×1000: **416 visite, 1.764 schermate di figura**. Tutte le 882 figure presenti a entrambe le larghezze.
- Audit finale: **0 nodi grafici fuori namespace, 0 testi fuori SVG, 0 sovrapposizioni fra testi rilevate, 0 errori JavaScript**. Le misure automatiche non sostituiscono il controllo visivo di frecce e circuiti, effettuato sulle priorità e sui casi segnalati.
- Markup delle tavole SVG: parsing XML dopo risoluzione delle entità HTML, riferimenti dei marker validi; nessun ID duplicato nelle figure.
- Tutti gli script inline sintatticamente validi e identici alla base, salvo la correzione dell'entità inesistente `&thetas;` in Reti LM.
- Esercitati **374 slider e 4.697 pulsanti** senza errori JavaScript. Le suite esistenti con asserzioni sugli output passano: BI **228/228**, Reti LM **184/184**, SAP **326/326**, PM **111/111**.
- Preview HTTP: **416 visite**, **863 prove di scorrimento**; nessun overflow dal contenuto di una figura al suo contenitore. Cache offline DL: CSS comune disponibile e capitolo RNN caricato offline con tutte le cinque figure. Versione cache aggiornata senza cambiare la modalità di registrazione del service worker.
- Grey Walter ed EventStorming: immagini non rifatte, test **18/18**. Aggiornato soltanto il test obsoleto che cercava EventStorming senza `?v=2` e con le vecchie dimensioni: l'asset corrente era già 1024×682 nella base.
- `git diff --check` superato. Stato della produzione invariato.

Per rendere ripetibili i controlli offline del rendering, le richieste al CDN di highlight.js sono soddisfatte con la copia locale della stessa versione 11.9.0. Le altre richieste esterne non necessarie sono bloccate. Questo audit non certifica la disponibilità futura dei CDN.

## Preview e riproducibilità

Il server serve la copia isolata e blocca percorsi nascosti, inclusa `.git`. La porta 8787 non risulta raggiungibile attraverso il dominio pubblico dalla verifica effettuata: non sono stati aperti firewall né cambiato il proxy. Per visitarla dal proprio computer:

```sh
ssh -L 8787:127.0.0.1:8787 ybc@notes.ybc.sh
```

Aprire `http://localhost:8787/review/`: selettori corso/capitolo/formato, schermate e collegamenti ai capitoli interattivi. I brief e il registro sono consultabili dalla stessa pagina. Il server può essere riavviato con `node dev/serve-figure-preview.cjs` nella worktree.

Script consegnati in `dev/`: `audit-course-figures.cjs`, `verify-course-figures.cjs`, `verify-figure-preview.cjs`, `build-figure-ledger.cjs`, `serve-figure-preview.cjs`. Dipendenza disponibile sulla VPS: `/home/ybc/hosted/unibo-lessons/dev/node_modules/playwright` (variabile `PLAYWRIGHT_PATH`; per le vecchie suite usare `NODE_PATH` con la directory node_modules).

Schermate e risultati JSON persistenti: `/home/ybc/notes-figure-review-artifacts`, separati dal repository e da produzione. Il server li espone sotto `/review/screenshots/`; `FIGURE_ARTIFACTS` permette di usare un'altra directory quando si ripetono i test.

## Problemi aperti e limiti

- **Overflow di pagina preesistenti esterni alle figure**: 102 pagine su mobile (103 nella base), 2 su desktop (`bigdata/cap-04-mapreduce.html`, `pm/cap-13-regole-operative.html`). Nessuna nuova pagina con overflow. Non sono stati nascosti o riscritti indiscriminatamente widget, tabelle e blocchi di codice estranei alle tavole. L'elenco completo è nell'artefatto `preview-verification.json`.
- Verifica eseguita con Chromium, non su dispositivi fisici o Safari/Firefox. Il controllo esteso delle figure non equivale a una nuova revisione scientifica integrale dei 15 corsi.
- I quattro miglioramenti raster sono **brief e punti d'inserimento**, non immagini generate. Nessuna chiamata a pagamento effettuata; dettagli e criteri geometrici in `illustration-briefs.md`.
- Produzione e push remoto non eseguiti. La pubblicazione richiede approvazione esplicita e un nuovo controllo dello stato della worktree di produzione, per continuare a preservare modifiche concorrenti.
