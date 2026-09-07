module.exports=[{
 id:'pcd-forkjoin-dependencies',file:'pcd/cap-08-java.html',slot:null,
 title:'Fork-Join: dipendenze prima di combinare i risultati',
 overrides:{rankSpacing:30,nodeSpacing:28,wrappingWidth:240},
 caption:'Passo ricorsivo con completamento normale. La linea tratteggiata indica la programmazione del sottotask sinistro; non garantisce un altro thread né simultaneità. Il chiamante calcola il ramo destro e poi chiama join: il risultato sinistro può essere già pronto oppure richiedere altro lavoro o attesa. La combinazione usa entrambi i risultati completati. Le frecce sono dipendenze, non una timeline dei worker; eccezioni e cancellazione richiedono una politica separata.',
 source:`flowchart TD
 P["Dividi l’intervallo"] --> F["left.fork()<br/>Programma il sinistro"]
 F -.-> L["Calcolo sinistro<br/>Stesso worker o altro"]
 F --> C["right.compute()<br/>Calcola il destro qui"]
 L --> J["left.join()<br/>Ottieni il sinistro"]
 C --> J
 J --> M["Combina i risultati<br/>Somma oppure merge"]
 style J stroke:#B83D2D`
}];
