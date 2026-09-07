const {scenarios,trace}=require('../../pcd/assets/dining-philosophers.js');
const m=trace(scenarios[0]).model;
module.exports={id:'pcd-dining-wait',file:'pcd/cap-06-deadlock.html',slot:null,title:'Filosofi: chi attende una forchetta detenuta da chi',overrides:{direction:'TD',rankSpacing:35},
 caption:'Stato del primo tentativo dopo che ciascun Fi ha acquisito fi. La freccia Fi → Fj significa che la prossima wait di Fi richiede una forchetta detenuta da Fj; non è un trasferimento. Le etichette indicano la forchetta richiesta. Indici 0–4 coerenti con codice e tavolo. Nel modello ogni forchetta ha una sola istanza, non viene sottratta al proprietario e ogni filosofo rilascia solo dopo eat: il ciclo è un deadlock effettivo.',
 source:'flowchart TD\n'+m.pc.map((_,i)=>'F'+i+'(("F'+i+'"))').join('\n')+'\n'+m.waits().map(e=>'F'+e.from+' -->|"f'+e.fork+'"| F'+e.to).join('\n')+'\nstyle F4 stroke:#B83D2D'};
