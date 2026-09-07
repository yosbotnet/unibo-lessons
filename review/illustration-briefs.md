# Brief illustrativi — da approvare, nessuna generazione eseguita

Destinazione prevista: GPT Image 2, qualità medium. Si genera soltanto il materiale pittorico: formule, frecce, etichette, maschere, crop e grafici rimangono SVG/codice. Palette di contesto: avorio #F3EFE3, blu cobalto #1546B8, vermiglio #B83D2D. Nessun testo incorporato nei bitmap. Conservare prompt, immagine sorgente, versione del modello e parametri di derivazione insieme agli asset. Non presentare illustrazioni come risultati sperimentali.

## 1. Segmentazione

Inserimento: `visione/cap-13-deep-learning-semantic-segmentation.html`, tavola 13.1, sotto lo schema vettoriale oppure come suo livello pittorico di input.

Brief: scena frontale semplice, due automobili separate della stessa classe su una strada, una a sinistra e una a destra, nessuna occlusione, sfondo neutro avorio, luce uniforme, sagome distinguibili. Generare UNA sola scena master, non tre versioni. Riutilizzare gli stessi pixel nei tre pannelli.

Derivazione controllata: tracciare due maschere vettoriali sulle sagome reali del master; stessa viewBox, stessi contorni e identica trasformazione in tutti i pannelli. Pannello semantico: entrambe le auto cobalto, stesso ID di classe. Pannello istanze: auto sinistra cobalto / ID 1, destra vermiglio / ID 2. Lo sfondo non è un'istanza di automobile. Didascalia e legenda HTML/SVG, non testo generato.

Accettazione: sovrapposizione delle maschere al master al 50% verificata al 100% di zoom; bordi coincidenti, nessun oggetto aggiunto, conteggio 2 in tutti i pannelli; stessa geometria anche su mobile. Alt: «Due automobili: un'unica classe semantica, due istanze distinte».

## 2. Panorama

Inserimento: `visione/cap-06-trasformazioni-2d-image-stitching.html`, tavola 6.3; mantenere omografia e corrispondenze geometriche in SVG.

Brief: una veduta urbana ampia con facciate, finestre e punti caratteristici ben riconoscibili, senza persone o veicoli in movimento. Generare un solo master; non richiedere due fotografie indipendenti.

Derivazione: normalizzare il master a 1536×1024 pixel; crop A=(0,128,1024,768), B=(512,128,1024,768), sovrapposizione 512×768. Per ciascun punto del master nell'intersezione, coordinate A=(x,y−128), B=(x−512,y−128). A→B è la traslazione omogenea [[1,0,−512],[0,1,0],[0,0,1]]. Se si desidera una prospettiva più complessa, applicare in codice una sola omografia nota, documentandola.

Accettazione: almeno quattro punti non collineari, errore di riproiezione numerico <0,5 px; crop sovrapposti pixel-identici e panorama ricostruito coerente. Segnalare che è un esempio sintetico controllato, non una stima da due acquisizioni reali. Alt: «Due ritagli della stessa veduta, con area comune e corrispondenze allineate».

## 3. CycleGAN

Inserimento: `dl/cap-11-generative-models.html`, tavola 11.6, striscia illustrativa separata dal circuito con generatori/discriminatori e perdite.

Brief: cavallo di profilo su fondo rurale semplice. Dal primo master derivare una variante zebra con stessa posa, inquadratura e sfondo; per il terzo pannello riutilizzare il cavallo sorgente, dichiarando esplicitamente che la ricostruzione perfetta è schematica. Non simulare metriche o attribuire l'immagine all'esecuzione di CycleGAN.

Didascalia obbligatoria: «Illustrazione concettuale cavallo → zebra → cavallo; immagini illustrative, non output sperimentali di un modello CycleGAN». Frecce G_AB e G_BA e descrizione della cycle-consistency restano vettoriali. Accettazione: soggetto, posa e scena corrispondenti; niente anatomia incoerente; etichetta illustrativa visibile desktop/mobile. Alt coerente con tale dichiarazione.

## 4. Diffusione

Inserimento: `dl/cap-11-generative-models.html`, tavola 11.7, sequenza pittorica sotto il diagramma direzionale.

Brief: una teiera cobalto con piccolo dettaglio vermiglio, riconoscibile, isolata su avorio. Generare soltanto l'immagine pulita x₀. Normalizzare i pixel in [−1,1]. Costruire in codice gli stati con seed fisso e rumore gaussiano, non con richieste generative indipendenti.

Per una vera traiettoria forward usare x_t=√(1−β_t)x_(t−1)+√β_t ε_t con ε_t indipendenti e β_t documentati. Campionare cinque stati a livelli cumulativi ᾱ circa [1,.8,.4,.1,.001]; salvare seed, schedule, indici e array numerici. Una visualizzazione alternativa di marginali x_t=√ᾱ_t x₀+√(1−ᾱ_t)ε deve dichiarare l'eventuale rumore condiviso e non chiamarla traiettoria Markov. Conversione/clipping solo per l'anteprima, senza rinormalizzare ogni pannello separatamente.

SVG: forward vermiglio sinistra→destra, reverse tratteggiato cobalto destra→sinistra, formula e tempi esterni alle immagini. Il reverse è uno schema di denoising appreso: riprodurre al contrario gli stessi frame non dimostra un modello generativo. Accettazione: dimensioni/coordinate identiche, rumore misurato coerente con schedule, direzioni inequivocabili, assenza di dettagli nuovi generati. Alt: «La stessa teiera progressivamente corrotta da rumore controllato; il percorso inverso richiede un modello appreso».

Le illustrazioni Grey Walter ed EventStorming restano escluse dal rifacimento prioritario. Nessuna chiamata a pagamento è necessaria per le correzioni attuali.
