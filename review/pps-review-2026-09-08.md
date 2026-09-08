# Revisione del corso PPS — 8 settembre 2026

Revisione di contenuto e forma di "Paradigmi di Programmazione e Sviluppo" (8 lezioni) contro il testo estratto dalle slide 2025/26 del corso. Tre agenti hanno rivisto le lezioni (1–3, 4–6, 7–8) una alla volta, correggendo nel sorgente e verificando ogni pagina in Chromium; il coordinatore ha curato indice, kit condiviso, titoli e figure. Report dettagliati per agente in `~/notes-figure-work/pps/review/report-{A,B,C}.md`.

## Forma

- Indice ricostruito nell'ordine del corso (qualità e test → FP → Scala → processo → logica), con numero di capitolo, minuti di studio, widget e domande per lezione.
- Titoli e `<title>` uniformati a `PPS-NN: Titolo` (prima tre pagine mostravano il nome del file come titolo).
- Kit della lezione: sei stringhe italiane nell'interfaccia dei widget (`Passo`, `Stato corrente`, `Transizioni in uscita`, ecc.) tradotte in inglese, come il resto delle pagine; nelle narrazioni dei widget `"Passo X"` → `"Step X"`.
- Il corso non aveva alcuna figura. Aggiunte tre tavole SVG inline nello stile della pagina: reticolo dei tipi di Scala (lezione 4), albero di risoluzione del programma d'esempio delle slide con ordine delle soluzioni e ramo infinito (lezione 7), ciclo Red-Green-Refactor (lezione 1).
- Contenitore vuoto `#ac-collections-practice` nella lezione 5 ora popolato con l'esempio annotato delle slide 25–30.
- Un `<function1>` non escapato in un blocco di codice (lezione 4) interrompeva il markup: corretto.

## Contenuto: errori corretti (selezione)

- **Lezione 2**: `And (Not F) T` era ridotto a F nel quiz e nello stepper; riduce a T. Dodici widget di codice annotato usavano una forma non supportata dal kit e perdevano righe. Lo stepper "CBV-like" modellava call-by-name.
- **Lezione 3**: lo stepper dello stato `CounterState` eseguiva una sessione diversa da quella delle slide; `SetADT` faceva pattern matching su casi privati di una sequenza opaca.
- **Lezione 4**: risultato dell'operatore associativo a destra 60 → 70; casi di match incoerenti con la tabella; widget contatore che incrementava due volte per "Result is 3".
- **Lezione 5**: lo stepper di `foldRight` saltava un livello di ricorsione; `` `call` `` retro-quotato in `collect` (errore di compilazione); widget con nomi non definiti; "Set = ordered" nell'esploratore; conversioni `given` assenti.
- **Lezione 6**: affermazione inventata sulla fase "più costosa"; esploratore del ciclo di sprint con transizioni errate; stepper che modellava un mini-waterfall.
- **Lezione 7**: lo stepper `find/2` era semanticamente sbagliato; l'esempio di database non conteneva il fatto necessario alle risposte mostrate; domanda del quiz sull'albero di risoluzione senza il fatto `c.` usato nella risposta; semantica del cut (verde/rosso) e `partition/4` non conformi alle slide.
- **Lezione 8**: `->/2` invece di `<-/2` (refuso delle slide propagato), binding Scala Native riallineato alla slide, callout non stilizzato per errore di classe.

Totale: 91 correzioni di contenuto, 21 widget corretti o riscritti, circa 150 integrazioni di copertura (argomenti delle slide assenti dalle lezioni, tra cui tecniche di refactoring, metaprogrammazione Prolog completa, conversioni `given`, Scala.js/Native), 18 nuove domande d'esame.

## Verifica

- Tutte le nove pagine a 1280 e 390 px: zero errori di console, zero overflow orizzontale, tutti i pulsanti dei widget esercitati.
- Bilanciamento dei tag controllato su tutte le pagine.
- Non è installata alcuna toolchain Scala/Prolog sulla macchina: il codice è stato controllato per lettura contro le slide. I casi dubbi lasciati come nelle slide sono elencati nei report degli agenti (sezione "uncertain").

## Non fatto

- Nessuna verifica di compilazione dei frammenti Scala.
- Le slide contengono alcuni refusi (es. `leaves(...) = [30,40]`, `=\=` per la disuguaglianza di termini) documentati nei report ma non riportati nelle lezioni.
