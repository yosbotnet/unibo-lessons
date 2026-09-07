module.exports = [{
 id:'pcd-executor-types',file:'pcd/cap-08-java.html',slot:null,
 title:'Executor: interfacce, ereditarietà e factory',
 overrides:{rankSpacing:36,nodeSpacing:30},
 requiredText:['Executor','ExecutorService','ScheduledExecutorService','Callable<T>','Future<T>'],
 caption:'Le frecce continue, etichettate extends, vanno dall’interfaccia derivata alla sua superinterfaccia: non rappresentano l’ordine di esecuzione. Executors è una classe factory, non una quarta interfaccia; la freccia tratteggiata indica che crea implementazioni dei servizi. Sono mostrati solo alcuni metodi. Il tipo T collega il risultato del Callable al Future restituito da submit.',
 source:`flowchart BT
 S["ScheduledExecutorService<br/>schedule · scheduleAtFixedRate"] -->|"extends"| E["ExecutorService<br/>submit: Callable<T> → Future<T><br/>shutdown · awaitTermination"]
 E -->|"extends"| B["Executor<br/>execute: Runnable"]
 F["Executors<br/>classe factory"] -.->|"crea implementazioni"| E
 style F stroke:#B83D2D`
}];
