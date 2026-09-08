# Stato lavori notes.ybc.sh — 8 settembre 2026

**Aggiornamento successivo:** dopo questo report, l'utente ha autorizzato il deploy.
Il lavoro completato è stato pubblicato al commit `738deb1` e verificato sul dominio
pubblico. Le indicazioni di
«preview/non pubblicato» nel corpo seguente descrivono lo stato precedente al deploy;
la copertura parziale dei contenuti e il lavoro ancora aperto restano invariati.

## Sintesi

La prima revisione di markup e impaginazione dei 15 corsi richiesti è stata
completata e pubblicata con approvazione. La successiva ricostruzione editoriale
e revisione didattica è in preview: **il sito non è ancora verificato integralmente**.

Questo documento fotografa il codice al commit `5659400` e distingue risultati
documentati, interventi parziali e lavoro futuro. Non è un nuovo audit completo.
Per prepararlo sono stati controllati stato Git, inventario, registro della prima
revisione e documentazione delle implementazioni; le suite storiche non sono state
rieseguite durante la sola redazione del report.

## 1. Repository, pubblicazione e vincoli

| Voce | Stato |
| --- | --- |
| Worktree di lavoro | `/home/ybc/notes-figure-preview` |
| Branch | `feat/editorial-diagram-presets` |
| Ultimo checkpoint implementativo | `5659400` — campionamento e intervalli OA |
| Repository servito in produzione | `/home/ybc/hosted/unibo-lessons` |
| HEAD produzione verificato | `f0f4bdeaca724112533411d98cc1a55681a777ea` |
| Pubblicazione | Caddy serve direttamente i file del repository di produzione |
| Preview | Server separato su `127.0.0.1:8787` |
| Modifiche preesistenti preservate | `review/index.html`, `review/report.md` |
| AGENTS.md | Nessuno trovato nel repository o negli antenati applicabili |

Le revisioni successive a `f0f4bde` non risultano pubblicate. Per pubblicare il
nuovo stato occorrono presentazione della preview verificata e approvazione.
Nessun riavvio di servizi estranei è necessario. La produzione non va usata come
directory di prova: scrivervi cambia immediatamente il sito pubblico.

Accesso dal computer dell'utente:

```sh
ssh -L 8787:127.0.0.1:8787 ybc@notes.ybc.sh
```

- Homepage: <http://localhost:8787/>
- Confronto estetico DL: <http://localhost:8787/review/editorial-reference/>
- Esempi riutilizzabili: <http://localhost:8787/review/presets/>
- Diagrammi di altri corsi: <http://localhost:8787/review/cross-course/>
- Ultime correzioni OA: <http://localhost:8787/oa/cap-08-statistics.html>

## 2. Conteggi e loro significato

| Misura | Conteggio | Limite del conteggio |
| --- | ---: | --- |
| Directory di corso | 22 | Le due versioni di Cybersecurity contano separatamente |
| Pagine HTML del sito | 315 | Include indici e pagine di servizio; esclude dev/review |
| Figure attuali del sito | 1.038 | Elementi `figure`, non tutti i grafici creati a runtime |
| Capitoli nei 15 corsi iniziali | 208 | Perimetro del primo audit |
| Figure attuali nei 15 corsi iniziali | 891 | Erano 882 alla base; sono state aggiunte figure |
| Figure modificate nella prima revisione | 529 | Cambi a diagrammi/didascalie, non certificazione scientifica |
| Riparazioni strutturali iniziali | 20 | Sottoinsieme delle 529 |
| Conversioni iniziali in tabelle HTML | 35 | Sottoinsieme delle 529 |
| Figure con marcatori dei generatori attuali | 106 | Occorrenze nei capitoli, inclusi riusi e nuove figure |
| Raster AI di riferimento prodotti | 1 | Un foglio con quattro proposte estetiche |
| Nuovi raster AI inseriti nei capitoli in questa revisione | 0 | Screenshot di test esclusi; immagini preesistenti conservate |
| Brief illustrativi preparati, non generati | 4 | Segmentazione, panorama, CycleGAN, diffusione |

Le 106 occorrenze programmatiche sono: DL 15; IRS 2; BI 2; Reti LM 1; DM 1;
Distributed Systems 10; PCD 31; Cybersecurity 14; Cybersecurity reworked 14; OA 16.
Il conteggio è stato ricontrollato sui sorgenti attuali, usando i marcatori
`data-generated-diagram`, `data-generated-plot` e `data-static-plot`/`diagram`.
Non include automaticamente ogni grafico di un widget o SVG senza tali marcatori.

**Non sommare 529 e 106:** gli insiemi si sovrappongono. Le 932 figure senza quei
marcatori non sono tutte rotte e non sono necessariamente tutte da rigenerare.
Non esiste ancora un conteggio affidabile delle figure scientificamente concluse
contro quelle ancora da controllare. L'inventario registra versioni e quantità,
ma non è un registro di approvazione finale.

Riferimenti: [inventario](notes-inventory.md), [inventario per figura](notes-inventory.json),
[registro storico](figure-ledger.json), [rapporto della prima revisione](report.md).

## 3. Registro delle task

| ID | Task | Stato e risultato |
| --- | --- | --- |
| T01 | Individuare sorgenti e pubblicazione; isolare il lavoro | Completata: repository e Caddy individuati, branch/worktree e preview separati |
| T02 | Riparare le 20 tavole con SVG interrotti | Completata nella prima revisione: eliminati tag HTML incompatibili dal contenuto SVG, ricontrollati percorsi e marker |
| T03 | Correggere i casi didattici iniziali | Completata nella prima revisione: LSTM 8.3, primo fold DM 10.3, oggetti e maschere Visione 13.1 |
| T04 | Correggere impaginazione delle tavole iniziali | Prima revisione completata; comprende priorità, casi locali e 35 tabelle native. Successivi feedback DL hanno richiesto ulteriori rifacimenti |
| T05 | Ricostruire DL nello stile approvato | Parziale: 15 tavole programmatiche; quattro ricostruzioni editoriali dal riferimento estetico. Non tutto DL è concluso |
| T06 | Rendere riutilizzabili layout e collegamenti | Implementati sette preset e adattatore Mermaid per flowchart; non un motore universale o un fork Mermaid |
| T07 | Dimostrare il riuso negli altri corsi | Completati cinque esempi reali: IRS 8.1/8.4, BI 11.3/11.4, Reti LM 10.2 |
| T08 | Correggere il reflow del contenuto sull'intero sito | Passata generale completata su 315 pagine; non equivale a verifica di tutti i widget o contenuti |
| T09 | Verificare diagrammi e modelli Distributed Systems | Revisioni mirate completate nei checkpoint; copertura del corso non certificata integralmente |
| T10 | Verificare diagrammi, codice e concorrenza PCD | Revisioni mirate completate nei checkpoint; copertura del corso non certificata integralmente |
| T11 | Verificare AI Security nelle due versioni Cybersecurity | Revisioni mirate di contenuti, evidenze, figure e widget completate; non certifica ogni capitolo dei due corsi |
| T12 | Ricostruire statistica e inferenza OA | Nove checkpoint completati nel capitolo 8; restano limiti espliciti sulle fonti dei dati e altri capitoli |
| T13 | OA Parameter Fitting, capitolo 9 | Diagnosi iniziata; nessuna correzione di questo nuovo blocco implementata al momento del report |
| T14 | Preparare quattro miglioramenti illustrativi | Brief e punti d'inserimento completati; generazione e inserimento non eseguiti |
| T15 | Certificare tutti i corsi e consegnare la nuova produzione | Aperta: richiede registro di copertura, controlli rimanenti, revisione visiva e approvazione |

### Cosa è cambiato concretamente

- **SVG e lettura:** namespace ripristinati, frecce e collegamenti completi,
  etichette riposizionate, spiegazioni spostate nelle didascalie, tabelle native,
  scorrimento locale accessibile. Niente riduzione generalizzata dei caratteri
  o overflow nascosto per mascherare problemi.
- **DL:** autodiff, neurone, Inception e GRU hanno guidato il nuovo linguaggio
  editoriale. Le altre tavole generate includono introduzione, moduli recurrenti,
  autoencoder e transformer. Il raster di riferimento non è stato copiato come
  fonte matematica: formule e collegamenti sono stati ricontrollati.
- **Distributed Systems:** storie e tracce eseguibili per mutua esclusione,
  elezione, causalità, consistent cut, consenso, CAP, PBFT, ledger/hash chain e Raft;
  distinzione fra disegni schematici e proprietà effettivamente dimostrate.
- **PCD:** monitor, executor, Swing/EDT, thread/lock, barriere, Fork-Join,
  structured concurrency, simulazione fisica, JPF, LTL e modelli di mutua esclusione;
  esempi verificati con strumenti e runtime pertinenti, nei perimetri documentati.
- **Cybersecurity:** FGSM e trasferibilità, robustezza, attacchi alle osservazioni,
  privacy/DP, autorizzazione degli agenti, valutazioni sanitarie, injection e limiti
  delle evidenze. Corrette anche spiegazioni e attribuzioni, non soltanto figure.
- **OA:** istogrammi da dati, test della moneta, Q–Q plot, scelta dei test,
  confronto previsioni, box plot/scatter, centro e dispersione, PDF/CDF,
  campionamento, CLT e intervalli. Calcoli, tabelle e SVG condividono dati/modelli.
- **DM:** spazio di ricerca ricostruito con 190 combinazioni reali, correggendo
  una tavola che ne disegnava 150 e un widget con disposizione non coerente.

Documentazione tecnica: [preset DL](../dev/diagrams/README.md),
[riuso cross-course](../dev/diagrams/CROSS-COURSE.md),
[reflow](../dev/content-layout/README.md),
[indice delle revisioni e test](../dev/legacy-diagrams/README.md).

## 4. Come funzionano i generatori

Ci sono tre strumenti complementari, non un unico generatore capace di capire
qualsiasi lezione:

1. **Preset semantici:** neurone, autodiff, Inception, GRU, behavior tree, schema
   relazionale, diagramma di sequenza. Specifiche JS/JSON definiscono contenuto
   e collegamenti; i preset calcolano posizioni, porte e punte delle frecce.
   Gli override supportati sono espliciti; casi non supportati devono fallire.
2. **Adattatore Mermaid:** 39 sorgenti di flowchart revisionati, con palette,
   font e percorsi rettilinei/angolari del sito. È un adattatore di build, non
   un fork, e non sostituisce i preset specifici. Queste 39 sorgenti non sono
   39 figure da aggiungere al conteggio delle 106.
3. **Grafici e tracce da modelli:** dati, formule o eventi determinano la geometria
   SVG. I test controllano anche i numeri e le proprietà, non solo il rendering.

Parte dei primi layout DL mantiene coordinate e instradamenti editoriali espliciti.
Non tutto è automatico. Il codice generato rimane SVG leggibile e verificabile,
con avorio, cobalto, vermiglio e tipografia del sito. Non richiede chiamate AI
per rigenerare i diagrammi.

Il [riferimento estetico AI](editorial-reference/) è una sola immagine.
I [quattro brief](illustration-briefs.md) prevedono bitmap solo per il materiale
pittorico; formule, maschere, crop controllati, frecce e grafici restano in codice.
Grey Walter ed EventStorming non sono stati rifatti.

## 5. Copertura dei corsi: precisazione sul «ne mancano 12»

Il numero 12 indica corsi non ancora coperti dalla seconda fase di revisioni
didattiche mirate qui raggruppata. **Non significa corsi mai visitati o modificati.**
Tutti i 22 corsi hanno ricevuto gli interventi condivisi di reflow; i 15 iniziali
anche il primo controllo esteso delle figure.

| Gruppo | Corsi | Stato |
| --- | --- | --- |
| Revisioni didattiche e programmatiche mirate | DL, OA, PCD, Distributed Systems, Cybersecurity, Cybersecurity reworked | Sei corsi lavorati per blocchi, non sei corsi certificati completi |
| Seconda fase limitata a esempi selezionati | BI, DM, IRS, Reti LM | Quattro corsi con interventi puntuali; gran parte resta da approfondire |
| Ulteriore revisione approfondita da pianificare | ASMD, ASW, Bigdata, ISE, Netprog, PM, SAP, SPE, Visione, Macro, Politics, PPS | Dodici corsi; preservare e verificare le correzioni già fatte nella prima fase |

In particolare, il solo capitolo 8 OA non rappresenta tutto OA, e quindici tavole
DL non rappresentano tutte le 68 figure del corso. Non è corretto calcolare una
percentuale di completamento usando il numero di corsi semplicemente toccati.

## 6. Verifiche eseguite e limiti

### Evidenze storiche documentate

- Prima revisione dei 15 corsi: 416 visite desktop/mobile e 1.764 screenshot di
  figura; markup SVG e marker, controlli di layout e console; esercitati 374
  slider e 4.697 pulsanti. Le suite di BI, Reti LM, SAP e PM risultavano superate.
- Passata reflow: 315 pagine a 1280 e 390 px; 178 casi iniziali di overflow di
  pagina, zero dopo gli interventi nella configurazione di test documentata.
  Questo risultato non certificava i renderer Mermaid o ogni widget.
- Preset: varianti di contenuto, ordine, dimensioni e override; XML, porte,
  connessioni, bounds e confronti visivi desktop/mobile.
- Modelli specifici: test numerici, tracce eseguibili e fonti originali dove
  disponibili. Ogni checkpoint specifica versioni, dati e limiti nel proprio report.
- Ultimo checkpoint OA: nove suite numeriche/preservazione e 54 configurazioni
  browser complessive; per il widget CI, 39.200 combinazioni numeriche e 399
  stati DOM distinti per viewport con JS. Larghezze 1280, 390 e 320, con/senza JS.
  Non sono 39.200 stati DOM né 54 browser differenti.

Dettagli dell'ultimo checkpoint: [OA inferenza](../dev/legacy-diagrams/OA-INFERENCE.md).
Screenshot e risultati estesi risiedono anche in
`/home/ybc/notes-figure-review-artifacts` e
`/home/ybc/notes-legacy-review-artifacts`.

### Problemi aperti e rischi

- Manca un registro aggiornato che attribuisca a ogni figura e sezione uno stato
  di verifica e il commit esatto della relativa evidenza.
- In OA 9 sono stati osservati: Gaussiane non allineate alle medie dichiarate,
  uso ambiguo di «standard error», codice GD con fattore 2 incoerente con la loss,
  clipping/scale e cronologia da verificare nei widget di regressione.
  È diagnosi in corso, non un risultato già corretto.
- In OA 8, confronto delle previsioni, restano lacune di provenienza/allineamento
  dei dati delle slide. Sono dichiarate, non colmate inventando osservazioni.
- Il vecchio audit reflow annotava renderer Mermaid esclusi dalla configurazione
  offline e un errore widget su `ds/DS-C4.html`: verificare lo stato corrente con
  test mirati prima di considerarli aperti oppure risolti.
- Molte sezioni, stati interattivi e diagrammi senza marcatori del generatore
  restano da controllare semanticamente e visivamente.
- Chromium non equivale a Safari/Firefox o dispositivi fisici. I controlli offline
  con copie locali dei CDN non dimostrano disponibilità futura dei servizi esterni.
- Alcune evidenze e ambienti numerici sono in `/tmp`: consolidarne la conservazione
  e la ricostruibilità prima di una consegna definitiva.

## 7. Come proseguire

### P0 — Rendere misurabile lo stato

Creare un registro di avanzamento distinto dall'inventario, con una riga per
figura e riferimenti alle sezioni/widget associati. Campi minimi: corso, pagina,
identificativo, hash del sorgente, problema, intervento, test, screenshot desktop
e mobile, fonte didattica, commit verificato, stato e problema residuo.

Stati proposti: `da-verificare`, `problema-confermato`, `in-lavorazione`,
`verificato-in-preview`, `limite-documentato`, `approvato`, `pubblicato`.
Una migrazione automatica o un test di overflow non deve assegnare da solo lo
stato `verificato-in-preview`.

### P1 — Chiudere il blocco già diagnosticato

OA 9: iniziare dalle sezioni 1–3 e 6, tavole 9.1/9.2 e widget delle metriche e
dei minimi quadrati. Usare dati dichiarati, Gaussiane e curve di costo calcolate,
convenzioni delle loss esplicite, gradienti coerenti e assenza di clipping.
Mantenere distinti i due campioni sintetici dei widget. Poi affrontare il resto
del capitolo e OA 10, senza dichiarare OA completato in anticipo.

### P2 — Parallelizzare per corsi, con responsabilità separate

Piano proposto, **non avviato con questa task di report**. Dopo autorizzazione a
delegare, utilizzare al massimo tre agenti più il coordinatore, per esempio:

| Responsabile | Primo blocco indipendente | Consegna richiesta |
| --- | --- | --- |
| Coordinatore | OA 9, registro, integrazione e coerenza visiva | Checkpoint verificato e riepilogo complessivo |
| Agente A | Restante DL e regressioni delle tavole approvate | Inventario locale, correzioni, fonti, test e screenshot |
| Agente B | Visione: trasformazioni, stitching, segmentazione | Stesse evidenze; nessuna generazione a pagamento implicita |
| Agente C | ASMD: tavole dense, simulazione e pseudocodice | Stesse evidenze, dati e codice eseguibili ove pertinenti |

Assegnare file di corso esclusivi. Le modifiche ai generatori condivisi vanno
coordinate per evitare conflitti; un agente non deve ridisegnare di propria
iniziativa la tipografia o la palette. Far eseguire in sequenza le suite browser
pesanti sulla VPS, mentre ispezione e test leggeri possono procedere in parallelo.
Gli agenti non pubblicano e non riavviano servizi.

Ruotare poi sui corsi rimanenti secondo errori confermati e densità di figure,
non secondo il solo numero di segnalazioni automatiche. I corsi già parzialmente
lavorati conservano una coda esplicita: non escono dal perimetro.

### P3 — Usare lo strumento adatto a ogni figura

- Preservare le strutture utili; preferire SVG calcolato per quantità e connessioni.
- Estendere i preset soltanto per famiglie realmente ricorrenti, con override
  documentati e test; non forzare tutti i grafici in box generici.
- Usare tabelle native e codice per dati e pseudocodice.
- Usare i quattro brief pittorici solo nella fase autorizzata di generazione;
  conservare master, derivazioni e dichiarazione di natura illustrativa.

### P4 — Verifica e pubblicazione per blocchi

Per considerare un blocco concluso: sorgenti e didascalie coerenti, formule/dati
verificati, frecce complete, font e palette corretti, markup valido, controllo
visivo desktop/mobile, widget e tastiera funzionanti, fallback appropriato,
assenza di regressioni e problemi residui espliciti.

Produrre piccoli checkpoint con elenco delle figure, confronto visivo e test
ripetibili. Mostrare la preview all'utente, chiedere approvazione per la release
identificata, verificare nuovamente lo stato della produzione e pubblicare solo
il blocco approvato con possibilità di rollback. Non occorre aspettare di finire
ogni corso per proporre un rilascio verificato.

## 8. Prossima consegna attesa

Il prossimo avanzamento dovrebbe fornire il registro iniziale di copertura e
un blocco OA 9 corretto e verificato, non soltanto un nuovo conteggio di file.
Il successo dell'intero lavoro resta una verifica documentata di figure,
contenuti e widget: non la conversione indiscriminata di tutto in immagini.
