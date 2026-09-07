module.exports=[{
 id:'pcd-thread-start',file:'pcd/cap-08-java.html',slot:null,title:'Chiamare run non equivale ad avviare un thread',
 overrides:{rankSpacing:28,nodeSpacing:28,wrappingWidth:270},
 caption:'Esempio Java 17 con t creato da new Thread(task), non un thread virtuale. La chiamata diretta esegue il task sul chiamante e non cambia lo stato NEW di t. Se poi si chiama start, il task viene eseguito di nuovo, questa volta sul thread t. start è ammesso una sola volta, anche se t è già terminato. join attende la terminazione; non riavvia il thread. Le frecce descrivono queste operazioni, non tutti gli stati JVM possibili.',
 source:`flowchart TD
 T["t = new Thread(task)<br/>Stato NEW"] --> D["Chiamata diretta: t.run()"]
 D --> C["Task sul chiamante<br/>t resta NEW"]
 T --> S["Primo t.start()"]
 C --> S
 S --> W["Task sul thread t"]
 W --> E["run termina<br/>Stato TERMINATED"]
 E -->|"un altro start"| X["IllegalThreadStateException"]
 style X stroke:#B83D2D`
}];
