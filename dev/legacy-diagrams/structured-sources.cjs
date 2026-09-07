module.exports=[{
 id:'pcd-structured-close',file:'pcd/cap-08-java.html',slot:null,
 title:'Structured concurrency: join non equivale a uscita di tutti i thread',
 overrides:{rankSpacing:24,wrappingWidth:270},
 caption:'Traccia controllata sull’API incubator JDK 20. Un task fallisce mentre l’altro rimane trattenuto dal test e ignora temporaneamente gli interrupt. join ritorna dopo lo shutdown; close resta in attesa. Il rilascio esterno permette al task lento di uscire e solo allora close ritorna. Le frecce indicano l’ordine osservato in questo test, non durate o un ordine universale. Ignorare gli interrupt serve qui a dimostrare il limite, non è una pratica consigliata.',
 source:`flowchart TD
 A["Task lento avviato"] --> B["Altro task fallisce"]
 B --> C["join ritorna"]
 C --> D["close inizia<br/>Il task lento è ancora vivo"]
 D --> E["Il test rilascia il task lento"]
 E --> F["Il task lento esce"]
 F --> G["close ritorna"]
 style D stroke:#B83D2D`
}];
