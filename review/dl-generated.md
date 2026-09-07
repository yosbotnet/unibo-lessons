# Seconda revisione DL — diagrammi generati da codice

La prima revisione `f0f4bde` è stata pubblicata dopo l'approvazione dell'utente: fast-forward del repository servito da Caddy, senza riavvii. HTML e CSS verificati attraverso `https://notes.ybc.sh`. I file preesistenti non tracciati sono rimasti intatti.

Questa revisione prosegue nel branch `feat/editorial-diagram-presets` e **rimane in preview**.

## Perché il primo audit non bastava

L'assenza di markup rotto o testo sovrapposto non garantisce la correttezza dei circuiti. Per esempio, 1.1 aggiornava graficamente i dati anziché il modello; 2.2 non aveva vere griglie di matrice; in 9 e 10 numerosi collegamenti non arrivavano ai rispettivi elementi. Le segnalazioni dell'utente erano fondate, non soltanto una difficoltà nel comprendere la materia.

## Correzioni

- 1.1: target separato dal dato in ingresso; aggiornamento dei parametri verso il modello.
- 2.2: matrici numeriche, riga/colonna/cella effettivamente selezionate, prodotto verificato.
- 2.4: operatori circolari +/× e frecce diagonali dirette; due pannelli separano valori forward e gradienti reverse.
- 3.1: ingressi circolari e collegamenti a ventaglio, bias, somma, attivazione e uscita; estremi ancorati analiticamente ai cerchi.
- 7.3: quattro rami Inception con dimensioni dei canali ripristinate dalle slide (192→64/128/32/32→256), riduzioni 96/16 e ingressi distinti alla concatenazione.
- 8.4: due sottografi leggibili, candidato e miscela; prodotti/somma circolari e frecce diagonali. Definizioni dei gate e convenzione delle slide in didascalia, senza il cablaggio ripetuto degli ingressi.
- 8.5: due catene di stati circolari, input a entrambe le ricorrenze e concatenazione per ogni posizione. Incroci distinti dalle diramazioni.
- 9.1–9.4: trasformazioni encoder/decoder esplicite, limite dell'identity shortcut precisato, target pulito del denoising e penalità di sparsità distinti.
- 10.1–10.4: allineamento illustrativo dichiarato; Q/K/V, softmax e prodotto AV; somme posizionali collegate; tutte le teste ricevono l'intera sequenza.

Generatore: `dev/diagrams/`, output SVG statico. 15 diagrammi, 122 collegamenti fra porte; test di geometria, dipendenze e valori numerici. Il layout e la semantica rimangono espliciti e revisionabili, non inventati automaticamente dal generatore.

Le quattro tavole editoriali ora usano preset parametrizzati: dati e opzioni in
`dev/diagrams/sources/editorial.json`, senza coordinate. I quattro SVG di riferimento
sono identici byte per byte. [Galleria dei preset](presets/): 20 esempi con variazioni
di ingressi, etichette, canali, profondità, valori e convenzioni GRU. Le altre 11
tavole non sono state migrate implicitamente. Nessuna nuova generazione di immagini.

Stile ripristinato: font originale `--lk-mono`, testo neutro, nodi sul medesimo
avorio della pagina anziché pannelli più chiari. Le dimensioni dei caratteri non
sono state ridotte. Sono state aggiornate anche le immagini della pagina di confronto.

Su richiesta dell'utente è stato generato un riferimento visivo con il tool
imagegen integrato e poi ricostruito in SVG. Vedi [confronto](editorial-reference/)
e [prompt integrale](editorial-reference/prompt.md). Il raster è un riferimento
compositivo: formule errate o collegamenti omessi non sono stati copiati. Nessuna
immagine raster ha sostituito i diagrammi nei capitoli. 10.2 e 10.3 rimangono
invariati in questa iterazione.

Verifica renderizzata sui sette capitoli interessati: desktop 1280 px e mobile 390 px, 70 schermate (comprese le figure non cambiate presenti nelle stesse pagine). Controllo visivo delle 15 nuove tavole; nessun testo fuori viewBox o sovrapposto rilevato. Il test del corpus controlla separatamente markup, marker e widget.

La copertura non comprende automaticamente 10.5–10.6 o le altre tavole non elencate. La prima revisione resta pubblicata; queste nuove tavole richiedono una successiva approvazione.

Ultima verifica dopo le correzioni visive: 30 render delle tavole generate
(1280/390 px), 15 controlli di scorrimento mobile; nessun errore. Il controllo
del corpus ha verificato 208 pagine, markup SVG e marker, integrità degli script,
374 interazioni con slider e 4697 con pulsanti, senza errori rilevati.
