module.exports={
 id:'pcd-jpf-outcomes',file:'pcd/cap-09-verifica.html',slot:null,
 title:'JPF: tre esiti distinti, una garanzia limitata al modello',
 overrides:{rankSpacing:28,nodeSpacing:26,wrappingWidth:240},
 caption:'Programma, input, librerie modellate, proprietà e configurazione definiscono il perimetro. Un controesempio confuta una proprietà nel modello e va interpretato rispetto al programma reale. Senza violazioni, occorre distinguere esplorazione completa da limiti o interruzioni: “no errors found” da solo non basta. Errori di avvio o incompatibilità non sono controesempi del programma né verifiche riuscite. La correttezza della specifica rispetto ai bisogni resta una questione di validazione.',
 source:`flowchart TD
 A["Programma e input<br/>Proprietà e configurazione"] --> B["VM JPF e librerie modello"]
 B --> C["Esplora gli stati raggiungibili"]
 C -->|"violazione"| E["Controesempio<br/>Proprietà violata"]
 C -->|"nessuna osservata"| D{"Ricerca completa<br/>nel perimetro dichiarato?"}
 D -->|"sì"| F["Proprietà valide<br/>nel modello dichiarato"]
 D -->|"no"| G["Esito non conclusivo<br/>Limiti o interruzione"]
 style E stroke:#B83D2D
 style G stroke:#B83D2D`
};
