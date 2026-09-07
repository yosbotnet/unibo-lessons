// Semantic sources, without coordinates. Captions explain what arrows mean.
// `slot` is the zero-based block position in e543a37; original hashes are separate.
module.exports=[
 {id:'pcd-phase-king',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:null,
 title:'Phase king binario: una fase contiene due round',
 requiredText:['copie > N/2 + f?','k = f + 1?','k ← k + 1'],
 caption:'Flusso locale di un processo corretto, non elenco dei singoli messaggi. Il primo round raccoglie le preferenze; il secondo raccoglie la proposta del king. La soglia usa la molteplicità del candidato calcolata nel primo round e include il proprio voto. Si decide soltanto dopo f + 1 fasi. Garanzia della variante: rete sincrona completa, al massimo f bizantini, N > 4f e king distinti. Valori mancanti/non validi e parità seguono il default binario 0.',
 overrides:{rankSpacing:30,nodeSpacing:30},
 source:`flowchart TD
 A["Fase k · bit corrente"] --> B["Round 1 · scambio<br/>V: un voto per mittente"]
 B --> C["Candidato e numero di copie"]
 C --> D["Round 2 · king Pk<br/>Ricevi il suo candidato"]
 D --> E{"copie > N/2 + f?"}
 E -->|"sì"| F["Mantieni candidato"]
 E -->|"no"| G["Adotta bit del king"]
 F --> H{"k = f + 1?"}
 G --> H
 H -->|"no"| I["k ← k + 1"]
 I --> A
 H -->|"sì"| J["Decidi il bit"]
 style E stroke:#B83D2D`},
 {id:'pcd-snapshot-fifo',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:8,
 title:'Due messaggi sullo stesso canale FIFO',
 caption:'Gli archi continui collegano eventi dello stesso processo. Gli archi tratteggiati sono i due messaggi P → Q: m′ è inviato in e1 e ricevuto in f1; m è inviato dopo, in e2, e ricevuto dopo, in f2. La precedente figura invertiva le ricezioni e contraddiceva l’ipotesi FIFO. Questo è il programma osservato: non è una traccia dei marker, che non sono rappresentati.',
 source:`flowchart LR
 P0(("e0 · P")) --> P1(("e1 · send m′")) --> P2(("e2 · send m")) --> P3(("e3 · P"))
 Q0(("f0 · Q")) --> Q1(("f1 · receive m′")) --> Q2(("f2 · receive m"))
 P1 -.->|"m′"| Q1
 P2 -.->|"m"| Q2`},
 {id:'pcd-cut-events',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:7,
 title:'Il programma: ordine locale e un messaggio da e2 a e5',
 caption:'Due processi sequenziali: P1 esegue e1, e2, e3; P2 esegue e4, e5, e6. Solo e2 → e5 rappresenta un messaggio: e2 lo invia ed e5 lo riceve. Gli altri archi sono ordine locale. Un taglio sceglie un prefisso di ciascuna riga logica; il confronto successivo mantiene esattamente questi eventi e questa dipendenza.',
 source:`flowchart LR
 E1(("e1 · P1")) --> E2(("e2 · send")) --> E3(("e3 · P1"))
 E4(("e4 · P2")) --> E5(("e5 · receive")) --> E6(("e6 · P2"))
 E2 -->|"m"| E5`},
 {id:'pcd-central-causal',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:0,
 title:'Coordinatore: ordine causale, non semplice ordine di arrivo',
 caption:'P1 invia la richiesta [1,0], poi un messaggio applicativo APP a P2. Solo dopo aver ricevuto APP, P2 può inviare [1,1]. La rete consegna a P0 prima la richiesta di P2, che resta in coda; [1,0] arriva dopo ed è servita per prima. Gli archi seguono questo esempio, non durate misurate. Il TOKEN di P2 parte soltanto dopo il ritorno del RELEASE di P1; anche P2 deve riceverlo prima di entrare in CS.',
 overrides:{rankSpacing:30,nodeSpacing:30},
 source:`flowchart TD
 A["P1 invia REQUEST [1,0]"]
 B["P2 riceve APP [1,0]"]
 C["P2 invia REQUEST [1,1]"]
 D["P0 riceve prima [1,1]<br/>Dipendenza non soddisfatta<br/>La richiesta attende"]
 E["P0 riceve poi [1,0]<br/>La richiesta di P1 è eligible"]
 F["P0 invia TOKEN a P1<br/>P1 entra alla ricezione"]
 G["P1 esce dalla CS<br/>Invia RELEASE a P0"]
 H["P0 riceve RELEASE<br/>Ora invia TOKEN a P2"]
 A -->|"APP [1,0]"| B
 B --> C --> D --> E --> F --> G --> H
 A -->|"REQUEST ritardata"| E
 style D stroke:#B83D2D`},
 {id:'pcd-central-token',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:1,
 title:'Un solo token: richiesta, concessione, ingresso e ritorno',
 caption:'TOKEN è il permesso di P0; RELEASE è il suo ritorno. Una richiesta eligible non basta: il coordinatore deve anche possedere il token. Il client scelto può differire dall’ultimo richiedente. Quando invia TOKEN, P0 lo marca subito assente e incrementa le concessioni, non i completamenti. Il client entra solo alla ricezione, esce prima di inviare RELEASE, e P0 registra il completamento quando RELEASE arriva. Senza una richiesta eligible o il token, P0 conserva la coda e ricontrolla ai successivi arrivi; non esegue attesa attiva.',
 overrides:{rankSpacing:30,nodeSpacing:28},
 source:`flowchart TD
 R["Un client invia REQUEST"] --> Q["P0 riceve e accoda"]
 Q --> D{"Token a P0<br/>e richiesta eligible?"}
 D -->|"no"| W["Attendi un nuovo evento<br/>Accoda REQUEST<br/>o ricevi RELEASE"]
 W -->|"ricontrolla"| D
 D -->|"sì"| T["P0 marca token assente<br/>Concesse++<br/>Invia TOKEN"]
 T --> C["Client scelto<br/>Riceve TOKEN; entra in CS"]
 C --> L["Client esce dalla CS<br/>Invia RELEASE"]
 L --> B["P0 riceve RELEASE<br/>Completate++<br/>Token di nuovo a P0"]
 B --> D
 style T stroke:#B83D2D
 style L stroke:#B83D2D`},
 {id:'pcd-causal-dependencies',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:5,
 title:'Causalità: m2 collega i due invii destinati a P3',
 caption:'Ogni nodo è un evento applicativo, non un processo intero. Gli archi m1, m2 e m3 collegano ciascun invio alla relativa consegna; gli altri archi continui indicano ordine locale. La catena send(m1) → send(m2) → deliver₂(m2) → send(m3) impone deliver₃(m1) prima di deliver₃(m3). L’arco tratteggiato è questo vincolo, non un quarto messaggio. Non sono rappresentati i tempi di arrivo al middleware.',
 overrides:{rankSpacing:36,nodeSpacing:28},
 source:`flowchart TD
 S1["P1 · send(m1) a P3"]
 S2["P1 · send(m2) a P2"]
 D2["P2 · deliver(m2)"]
 S3["P2 · send(m3) a P3"]
 D1["P3 · deliver(m1)"]
 D3["P3 · deliver(m3)"]
 S1 -->|"ordine locale"| S2
 S2 -->|"m2"| D2
 D2 -->|"ordine locale"| S3
 S1 -->|"m1"| D1
 S3 -->|"m3"| D3
 D1 -.->|"vincolo di consegna"| D3
 style D1 stroke:#B83D2D
 style D3 stroke:#B83D2D`},
 {id:'pcd-causal-buffer',file:'pcd/cap-16-algoritmi-distribuiti.html',slot:6,
 title:'P3: m3 arriva prima, ma viene consegnato dopo m1',
 caption:'Stesso esempio della figura precedente: m1 va da P1 a P3; m2 da P1 a P2; dopo la consegna di m2, P2 invia m3 a P3. Qui le frecce seguono il lavoro del middleware di P3, non nuovi invii. Il vettore mostrato è la sola colonna destinata a P3, nelle righe P1, P2, P3; ogni messaggio trasporta l’intera matrice. m1 compare una sola volta come arrivo e sblocca m3 senza che m3 debba arrivare di nuovo.',
 overrides:{rankSpacing:32},
 source:`flowchart TD
 A["Arriva m3 da P2<br/>T[*,3] = [1,1,0]"]
 B["M₃[*,3] = [0,0,0]<br/>Manca m1 da P1<br/>m3 resta nel buffer"]
 C["Arriva m1 da P1<br/>Consegna m1<br/>M₃[*,3] = [1,0,0]"]
 D["Ricontrolla il buffer<br/>Consegna m3<br/>M₃[*,3] = [1,1,0]"]
 A --> B --> C --> D
 style B stroke:#B83D2D`},
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
