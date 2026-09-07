# Diagrammi DL riproducibili

Le tavole sono definite in `dl.cjs` come nodi, porte, collegamenti e didascalie. `graph.cjs` genera SVG statici con la palette del sito. Non servono librerie aggiuntive nel browser, servizi esterni o immagini generate.

Un collegamento si scrive, per esempio:

```js
d.edge('optimizer.N', 'model.S', [[375,215],[355,215]], 'vermilion');
```

Gli estremi vengono calcolati dai nodi: spostando un nodo non si deve correggere a mano la punta della freccia. Le porte `rowE`, `colS` e `cellS` si ancorano alla riga, colonna e cella selezionata di una matrice. Le porte superiori separate NW/NE evitano di sovrapporre flussi forward/reverse. Ogni path ha `data-from`/`data-to`, ogni nodo `data-node`, per l'ispezione e i test.

Il layout generale e gli instradamenti intermedi sono ancora scelte esplicite del redattore. La generazione programmatica **non dimostra da sola la correttezza didattica**: servono equazioni, dipendenze attese e controllo visivo. In particolare, GRU segue la convenzione delle slide RNN: `u` conserva lo stato precedente, `1-u` pesa il candidato.

## Flusso di lavoro

```sh
node dev/diagrams/test.cjs
node dev/diagrams/generate.cjs --patch
# Applicare la patch prodotta al repository con apply_patch.
node dev/diagrams/generate.cjs
```

L'ultimo comando fallisce se i capitoli non coincidono con l'output del generatore. Non modificare a mano gli SVG marcati `data-generated-diagram`: cambiare il modello e rigenerare. Il comando `--patch` non scrive nei file e non pubblica nulla.

I test controllano nodi e porte esistenti, connessioni, limiti della viewBox, segmenti che attraversano nodi estranei, matrice numerica e dipendenze semantiche attese. Le schermate desktop/mobile e i test dei widget restano necessari.

Copertura iniziale: DL 1.1, 2.2, 2.4, 3.1, 7.3, 8.4, 8.5, 9.1–9.4, 10.1–10.4 (15 tavole). Il resto del sito rimane SVG scritto direttamente: non è stato migrato implicitamente.

## Revisione visiva dopo il feedback

`refine.cjs` conserva la revisione esplicita di 8.5; le altre quattro tavole
editoriali ora usano i preset descritti sotto. Gli operatori e gli stati possono essere `shape: 'circle'`, i valori
senza cornice `shape: 'plain'`; i gate restano rettangolari. Gli incroci dei circuiti
sono distinti dai nodi di diramazione con un'interruzione nel tratto sottostante.
Il tema usa il font `--lk-mono`, testo `--lk-ink`, fondo dei nodi `--lk-paper`:
non aggiunge più pannelli chiari a tutti i nodi. Dimensioni del testo invariate.

Questa è una correzione del generatore a layout esplicito. Il prototipo separato
Mermaid/ELK con layout automatico resta nel branch `prototype/diagram-presets`;
non si deve descrivere questo generatore come automatico.

## Riferimento imagegen e ricostruzione editoriale

Nel branch `feat/editorial-diagram-presets`, `editorial.cjs` legge le definizioni
JSON di 2.4, 3.1, 7.3 e 8.4 e invoca i preset. Il riferimento generato, il prompt
integrale e il confronto sono in `review/editorial-reference/`.

- Nei preset, `connect('x1','sum')` crea un segmento diretto, con estremi calcolati per
  intersezione con i bordi reali di cerchi o rettangoli. Non serve impostare a mano
  l'angolo o la posizione della punta. Il posizionamento è calcolato dal preset;
  le specifiche delle quattro tavole non contengono coordinate.
- `ports` permette punti d'ingresso distinti sul nodo concatenazione, evitando
  che quattro tensori sembrino essere sommati in una giunzione.
- La GRU è suddivisa in due sottografi; il candidato è riutilizzato mediante la
  stessa etichetta. Le definizioni dei gate e le trasformazioni affini restano
  esplicite nella didascalia, nella convenzione W/U delle slide.
- Nessuna equazione generata nel raster viene assunta come corretta.

Rigenerare la pagina di confronto con `node dev/diagrams/editorial-review.cjs`
dopo aver applicato la patch delle tavole. Nessuna chiamata imagegen è necessaria
per ricostruire o modificare gli SVG. Le tavole 10.2 e 10.3 non cambiano in questa
revisione.

## Preset riutilizzabili

Vedi [API, opzioni e limiti](presets/README.md) e
[`sources/editorial.json`](sources/editorial.json). I preset calcolano le dimensioni
del canvas e dei nodi in base ai contenuti. Gli SVG dei quattro esempi originali
restano identici byte per byte, verificati con hash di regressione.

```sh
node dev/diagrams/render-preset.cjs dev/diagrams/sources/neuron-example.json --out /tmp/neuron.svg
node dev/diagrams/presets/test.cjs
```

Il test crea `review/presets/`, con 20 esempi e sorgenti affiancati. Le altre 11
tavole generate conservano per ora il layout esplicito precedente. Il prototipo
Mermaid/ELK rimane separato; questa API non interpreta Mermaid né grafi arbitrari.
