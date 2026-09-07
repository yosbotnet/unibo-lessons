module.exports=[{
 id:'pcd-barrier-generations',file:'pcd/cap-08-java.html',slot:null,
 title:'Barriera ciclica: un nuovo arrivo non cancella il giro precedente',
 overrides:{rankSpacing:26,wrappingWidth:270},
 caption:'Traccia verificata con due thread e due generazioni. Il test forza B a rientrare nel secondo await prima che A possa riacquisire il monitor. A riconosce che la propria generazione g è già finita, anche se il contatore di g+1 non è zero. Azzerare soltanto un contatore condiviso non basta: ogni waiter conserva l’identità della generazione a cui appartiene. Le frecce indicano l’ordine di questa esecuzione controllata, non messaggi fra thread; interruzione e reset sono casi separati.',
 source:`flowchart TD
 A["A attende in g"] --> B["B completa g<br/>g+1 diventa corrente"]
 B --> C["B attende in g+1"]
 C --> D["A ritorna da g"]
 D --> E["A completa g+1"]
 E --> F["B ritorna da g+1"]
 style C stroke:#B83D2D`
}];
