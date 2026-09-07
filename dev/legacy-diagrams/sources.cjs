// Semantic sources, without coordinates. Captions explain what arrows mean.
// `slot` is the zero-based block position in e543a37; original hashes are separate.
module.exports=[
 {id:'pcd-chang-ring',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:3,
 title:'Chang–Roberts: anello logico unidirezionale',
 caption:'Le frecce sono canali verso il successore: P1 → P2 → P3 → P4 → P1. Non sono una cronologia dei messaggi. Il PID massimo diventa leader soltanto quando riceve indietro la propria candidatura; poi avvia un giro distinto di annuncio.',
 source:`flowchart LR
 P1(("P1")) --> P2(("P2"))
 P2 --> P3(("P3"))
 P3 --> P4(("P4"))
 P4 --> P1`},
 {id:'pcd-chang-phases',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:4,
 title:'Un solo iniziatore: candidatura, ritorno, annuncio',
 caption:'Anello P2 → P7 → P3 → P1 → P5 → P4 → P2. Il primo invio è P2 → P7: election(2). P7 sostituisce 2 con 7; election(7) percorre P7 → P3 → P1 → P5 → P4 → P2 → P7. Solo dopo questo ritorno P7 invia leader(7) lungo lo stesso giro completo. Totale: 7 election + 6 leader = 13 trasmissioni. Le frecce tra i riquadri ordinano le fasi, non rappresentano collegamenti di rete.',
 overrides:{rankSpacing:32},
 source:`flowchart TD
 A["1 · Avvio da P2<br/>P2 → P7: election(2)<br/>1 trasmissione"]
 B["2 · Candidatura di P7<br/>Giro completo di election(7)<br/>6 trasmissioni<br/>Ritorno a P7"]
 C["3 · Annuncio da P7<br/>Giro completo di leader(7)<br/>6 trasmissioni<br/>Ritorno a P7"]
 A --> B --> C
 style C stroke:#B83D2D`},
 {id:'pcd-interleavings',file:'pcd/cap-02-modellazione.html',slot:1,
 title:'Due assegnamenti atomici: tutti gli stati raggiungibili',
 caption:'k₁ = 1 e k₂ = 2 restano costanti. Ogni freccia esegue un solo assegnamento atomico; p₂ e q₂ indicano la fine. P poi Q termina con n = 2; Q poi P termina con n = 1.',
 source:`flowchart TD
 S0["n = 0<br/>P: p₁ · Q: q₁"]
 SP["n = 1<br/>P: p₂ · Q: q₁"]
 SQ["n = 2<br/>P: p₁ · Q: q₂"]
 FP["n = 2<br/>P: p₂ · Q: q₂"]
 FQ["n = 1<br/>P: p₂ · Q: q₂"]
 S0 -->|"P: n := k₁"| SP
 S0 -->|"Q: n := k₂"| SQ
 SP -->|"Q: n := k₂"| FP
 SQ -->|"P: n := k₁"| FQ
 style FP stroke:#B83D2D
 style FQ stroke:#B83D2D`},
 {id:'pcd-exchange-central',file:'pcd/cap-12-message-passing.html',slot:5,
 title:'Scambio centralizzato: raccolta e distribuzione',
 caption:'Ogni collegamento rappresenta due messaggi in fasi distinte: il processo invia il proprio valore a P₀; P₀ restituisce min e max dopo la raccolta. Con N = 4 servono 2(N − 1) = 6 messaggi.',
 source:`flowchart TD
 P0(("P₀"))
 P1(("P₁"))
 P2(("P₂"))
 P3(("P₃"))
 P0 <--> P1
 P0 <--> P2
 P0 <--> P3`},
 {id:'pcd-exchange-all',file:'pcd/cap-12-message-passing.html',slot:6,
 title:'Scambio simmetrico: tutti inviano a tutti',
 caption:'Gli stessi quattro processi delle altre strategie. Ogni coppia si scambia due valori, uno per direzione: 6 coppie e 12 messaggi, cioè N(N − 1). Anche P₀ e P₃ inviano agli altri; ciascun processo calcola min e max localmente.',
 source:`flowchart LR
 P0(("P₀"))
 P1(("P₁"))
 P2(("P₂"))
 P3(("P₃"))
 P0 <--> P1
 P0 <--> P2
 P0 <--> P3
 P1 <--> P2
 P1 <--> P3
 P2 <--> P3`},
 {id:'pcd-exchange-ring',file:'pcd/cap-12-message-passing.html',slot:7,
 title:'Scambio ad anello: due giri nella stessa direzione',
 caption:'P₀ avvia un primo giro per aggregare min e max; un secondo giro distribuisce il risultato globale. Con questi due giri completi e N = 4 si hanno 2N = 8 messaggi. Le frecce indicano il verso di invio, non quattro invii simultanei.',
 source:`flowchart LR
 P0(("P₀")) --> P1(("P₁"))
 P1 --> P2(("P₂"))
 P2 --> P3(("P₃"))
 P3 --> P0`},
 {id:'pcd-ricart-request',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:2,
 title:'Ricart–Agrawala: richiesta, ingresso e rilascio',
 overrides:{rankSpacing:32},
 caption:'Il richiedente usa la coppia (timestamp, ID) per ordinare totalmente le richieste. Attende un OK da ciascuno degli altri N − 1 processi; soltanto dopo entra in sezione critica. In uscita risponde alle richieste differite. Il trattamento delle richieste ricevute è descritto nel protocollo sottostante.',
 source:`flowchart TD
 A["Richiesta di Pᵢ<br/>stato = REQUESTING<br/>req = (timestamp, i)"]
 B["Invia REQUEST(req)<br/>agli altri N − 1 processi"]
 C["Attendi N − 1 OK<br/>da mittenti distinti"]
 D["stato = HELD<br/>Esegui la sezione critica"]
 E["Uscita: stato = RELEASED"]
 F["Invia OK ai richiedenti<br/>in pendingQ; svuota la coda"]
 A --> B --> C --> D --> E --> F
 style D stroke:#B83D2D`},
 {id:'pcd-consensus-rounds',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:9,
 title:'Consenso crash-stop sincrono: esempio senza guasti, f = 1',
 caption:'Traccia senza guasti con valori iniziali 1, 2 e 3, entro un modello che tollera al massimo f = 1 crash. Ogni round diffonde i valori appresi agli altri processi. Le frecce seguono lo stato locale, non i singoli messaggi: dopo il primo round V = {1,2,3}; dopo il secondo tutti decidono min(V) = 1. Un caso senza guasti non costituisce da solo una dimostrazione di tolleranza ai crash.',
 overrides:{rankSpacing:50,nodeSpacing:30},
 source:`flowchart TD
 A1["P₁ · inizialmente<br/>V = {1}"]
 A2["P₂ · inizialmente<br/>V = {2}"]
 A3["P₃ · inizialmente<br/>V = {3}"]
 B1["P₁ · dopo round 1<br/>V = {1,2,3}"]
 B2["P₂ · dopo round 1<br/>V = {1,2,3}"]
 B3["P₃ · dopo round 1<br/>V = {1,2,3}"]
 C1["P₁ · dopo round 2<br/>min(V) = 1"]
 C2["P₂ · dopo round 2<br/>min(V) = 1"]
 C3["P₃ · dopo round 2<br/>min(V) = 1"]
 A1 --> B1 --> C1
 A2 --> B2 --> C2
 A3 --> B3 --> C3`},
 {id:'pcd-smr-order',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:10,
 title:'Replica di macchine a stati: prima accordo sul log, poi esecuzione',
 caption:'Schema logico, non una topologia di rete: il consenso è eseguito dai moduli distribuiti nei server. I comandi impegnati nello stesso ordine alimentano macchine a stati deterministiche. Le repliche possono avanzare a velocità diverse, ma non applicano comandi diversi nella stessa posizione.',
 source:`flowchart TD
 C["Comandi dei client"] --> O["Protocollo di consenso<br/>Ordine comune dei comandi"]
 O --> L1["Server 1<br/>Log impegnato"]
 O --> L2["Server 2<br/>Log impegnato"]
 O --> L3["Server 3<br/>Log impegnato"]
 L1 --> M1["Macchina a stati<br/>server 1"]
 L2 --> M2["Macchina a stati<br/>server 2"]
 L3 --> M3["Macchina a stati<br/>server 3"]`},
 {id:'pcd-raft-replication',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:11,
 title:'Raft: replica del log guidata dal leader',
 caption:'Esempio con tre server e leader stabile. Il client invia il comando al leader; AppendEntries propaga il log e l’indice di commit ai follower. Le risposte tornano al leader. Ciascun server applica soltanto le voci impegnate, in ordine. Non sono raffigurati elezione, retry e risposta al client; il quorum non è un servizio esterno.',
 overrides:{rankSpacing:55,nodeSpacing:20},
 source:`flowchart TD
 C["Client"] -->|"comando"| L["Server 1 · leader<br/>modulo Raft + log"]
 L -->|"AppendEntries"| F2["Server 2 · follower<br/>modulo Raft + log"]
 F2 -.->|"risposta"| L
 L -->|"AppendEntries"| F3["Server 3 · follower<br/>modulo Raft + log"]
 F3 -.->|"risposta"| L
 L -->|"dopo commit"| M1["Macchina a stati<br/>server 1"]
 F2 -->|"dopo commit"| M2["Macchina a stati<br/>server 2"]
 F3 -->|"dopo commit"| M3["Macchina a stati<br/>server 3"]
 style L stroke:#B83D2D`},
 {id:'ds-threat-chain',file:'ds/DS-M1.html',slot:0,
 title:'Chain of threats: fault, error, failure',
 caption:'A fault is activated into an erroneous internal state; propagation to the service interface can cause failure. That service failure may act as a fault in a containing system. The arrows describe causal stages, not guaranteed outcomes of every fault.',
 overrides:{direction:'TD'},
 source:`flowchart LR
 F["Fault"] -->|"Activation"| E["Error"]
 E -->|"Propagation to interface"| F2["Service failure"]
 F2 -->|"Causation in parent system"| F3["Fault in parent system"]`},
 {id:'ds-independent-contexts',file:'ds/DS-M2.html',slot:8,
 title:'Distributed concurrent computing: independent contexts',
 caption:'Each process has its own spatial and temporal context. The bidirectional connection denotes asynchronous message passing; it does not imply a shared clock, bounded delivery time, or simultaneous execution.',
 source:`flowchart LR
 subgraph C1["Context 1 · T, S"]
 P1["Process 1"]
 end
 subgraph C2["Context 2 · T′, S′"]
 P2["Process 2"]
 end
 P1 <-->|"Asynchronous<br/>messages"| P2`}
];
