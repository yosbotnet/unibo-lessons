module.exports=[{
 id:'pcd-swing-refresh',file:'pcd/cap-08-java.html',slot:null,
 title:'Dal worker alla vista: pubblicare uno snapshot valido',
 overrides:{rankSpacing:28,nodeSpacing:28},
 caption:'Percorso di un refresh nel cronometro editoriale, non diagramma delle classi. Il monitor viene rilasciato prima di invokeLater; la callback legge una copia immutabile. Start, Stop e Reset cambiano la versione nel modello e aggiornano subito la vista sull’EDT: un vecchio campione non può annullarli. La chiusura invalida anche le callback già accodate. I refresh vengono accorpati: al massimo una callback di refresh è in attesa, non una coda crescente di campioni.',
 source:`flowchart TD
 W["Worker · refresh periodico"] --> M["Modello · breve accesso esclusivo"]
 M --> S["Snapshot immutabile<br/>tempo · stato · versione"]
 S --> Q["invokeLater<br/>Accoda callback sull’EDT"]
 Q --> E{"Finestra aperta e<br/>versione corrente?"}
 E -->|"sì"| V["EDT · aggiorna la vista"]
 E -->|"no"| D["Scarta il campione superato"]
 style D stroke:#B83D2D`
}];
