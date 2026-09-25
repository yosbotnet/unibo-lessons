# -*- coding: utf-8 -*-
# Data for orale.html. Answer items: str = paragraph (mini-markup: `code`, **bold**),
# tuple (lang, code) = code block. Links: "c05#s5", "p1#s3".

FILES = {
    'c01': 'cap-01-introduzione.html', 'c02': 'cap-02-modellazione.html', 'c03': 'cap-03-correttezza.html',
    'c04': 'cap-04-sezione-critica.html', 'c05': 'cap-05-semafori.html', 'c06': 'cap-06-deadlock.html',
    'c07': 'cap-07-monitor.html', 'c08': 'cap-08-progettazione.html', 'c09': 'cap-09-formalismi-visuali.html',
    'c10': 'cap-10-java.html', 'c11': 'cap-11-verifica.html', 'c12': 'cap-12-async.html',
    'c13': 'cap-13-reattiva.html', 'c14': 'cap-14-message-passing.html', 'c15': 'cap-15-attori.html',
    'c16': 'cap-16-attori-avanzati.html', 'c17': 'cap-17-distribuiti.html', 'c18': 'cap-18-algoritmi-distribuiti.html',
    'c19': 'cap-19-servizi.html',
    'p1': 'prep-assignment-01.html', 'p2': 'prep-assignment-02.html', 'p3': 'prep-assignment-03.html',
    'p4': 'prep-assignment-04.html',
}

# ---------------------------------------------------------------- asked / announced
# groups in course order: (group key, [question numbers])
MAIN_GROUPS = [
    ('c01', [11]),
    ('c05', [72, 73, 74, 75, 76, 77, 79]),
    ('c06', [26]),
    ('c07', [95, 97]),
    ('c10', [49, 50, 115, 121]),
    ('c11', [64]),
    ('p1', [89, 91, 92, 93, 109, 110, 113, 114]),
    ('c12', [132, 133, 134, 135, 136, 137, 143]),
    ('c13', [156]),
    ('p2', [163, 165, 166]),
    ('c14', [169, 170]),
    ('c15', [176, 178]),
    ('p3', [182, 225]),
    ('c17', [187]),
    ('c18', [201]),
    ('p4', [226, 227]),
]
ASKED = {11, 26, 49, 50, 64, 72, 73, 75, 76, 77, 89, 91, 92, 93, 109, 110, 114, 115, 121, 132, 133, 134, 135,
         136, 137, 143, 156, 163, 165, 166, 169, 170, 176, 178, 182, 187, 201, 225, 226, 227}
ANNOUNCED = {74, 79, 95, 97, 113}

# ---------------------------------------------------------------- the other questions
OTHER_GROUPS = [
    ('c01', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 48]),
    ('c02', [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 29, 30, 31, 32, 33, 34, 35, 36, 65]),
    ('c03', [37, 38, 39, 40, 41, 58, 59, 60, 61]),
    ('c04', [51, 53, 54, 55, 56, 57]),
    ('c05', [52, 78]),
    ('c06', [27, 28, 66, 67, 68, 80]),
    ('c07', [81, 82, 83, 84, 85, 87, 88, 90, 94, 96, 102]),
    ('c08', [98, 99, 106, 107, 108, 111, 112, 119, 120]),
    ('c09', [103, 104]),
    ('c10', [42, 43, 44, 45, 46, 69, 70, 71, 86, 100, 101, 117, 118, 122, 123, 124]),
    ('c11', [62, 63, 105]),
    ('c12', [116, 125, 126, 127, 128, 129, 130, 131, 138, 139, 140, 141, 142, 144, 145, 146, 147, 148, 149, 150, 164]),
    ('c13', [151, 152, 153, 154, 155, 157, 158, 159, 160, 161, 162]),
    ('c14', [167, 168, 171, 172, 173, 174, 175]),
    ('c15', [177, 179, 180, 181, 183, 184, 185, 186]),
    ('c17', [188, 189, 190, 191, 194, 195, 196, 197, 198]),
    ('c18', [199, 200, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211]),
    ('c19', [47, 192, 193, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224]),
]
DUPLICATES = {202: 201}

Q = {}

def q(n, text, answer, links):
    assert n not in Q, n
    Q[n] = dict(q=text, a=answer, links=links)

# ============================================================ Cap. 1
q(1, "Che cosa vuol dire concorrenza?",
  ["In un sistema concorrente più attività si sovrappongono nel tempo (una inizia prima che l'altra sia finita) e interagiscono, perché hanno dipendenze. Un programma concorrente è un insieme finito di programmi sequenziali, i processi, eseguiti sovrapposti nel tempo, anche su una sola CPU."],
  ['c01#s2'])
q(2, "Che cosa significa non determinismo?",
  ["Lo stesso programma, con lo stesso input, può produrre esecuzioni e risultati diversi. Nasce dall'indipendenza dalla velocità: non si può fare alcuna ipotesi sulla velocità relativa dei processi, quindi l'ordine in cui le loro azioni si intrecciano cambia da un'esecuzione all'altra."],
  ['c01#s2'])
q(3, "Che cosa significa programmazione concorrente?",
  ["Organizzare un programma come più processi sequenziali che si sovrappongono nel tempo e interagiscono: è un livello logico, un modo di strutturare il software, che esiste anche con una sola CPU. Il linguaggio deve permettere di creare i processi e di farli interagire (sincronizzazione, comunicazione, mutua esclusione)."],
  ['c01#s3', 'c01#s8'])
q(4, "Che cosa cambia tra concorrenza e parallelismo?",
  ["La concorrenza è un modo di strutturare il programma come attività sovrapposte che interagiscono (livello logico); il parallelismo è l'esecuzione simultanea su processori fisici distinti, con l'obiettivo delle prestazioni. Ogni programma parallelo è concorrente, non il contrario: con una CPU i processi sono concorrenti ma non paralleli."],
  ['c01#s3'])
q(5, "Che cosa cambia tra multi-core e core eterogenei?",
  ["In un multi-core ci sono più core general purpose sullo stesso chip, che condividono la RAM e a volte la cache, al più di velocità diverse (P-core ed E-core). In un'architettura eterogenea il processore è affiancato da unità di natura diversa (GPU, NPU, FPGA): una GPU, per esempio, applica lo stesso flusso di istruzioni a molti dati."],
  ['c01#s5'])
q(6, "Che cos'è la tassonomia di Flynn?",
  ["Classifica i sistemi per numero di flussi di istruzioni e di flussi di dati: SISD (la macchina di von Neumann), SIMD (la stessa istruzione su più dati: processori vettoriali, GPU), MISD (nessun sistema noto) e MIMD (ogni processore ha istruzioni e dati propri). I programmi del corso sono MIMD."],
  ['c01#s6'])
q(7, "Che cosa significa memoria condivisa?",
  ["Tutti i processori vedono un unico spazio di indirizzi e comunicano leggendo e scrivendo variabili condivise. Si distingue in SMP, dove tutti accedono alla memoria con la stessa velocità, e NUMA, dove alcuni blocchi sono fisicamente più vicini ad alcuni processori."],
  ['c01#s6'])
q(8, "Che cosa significa memoria distribuita?",
  ["Ogni processore ha il proprio spazio di indirizzi e comunica con gli altri solo inviando e ricevendo messaggi. Ne fanno parte MPP, cluster e grid."],
  ['c01#s6'])
q(9, "Che cosa si intende per throughput?",
  ["La quantità di lavoro completata nell'unità di tempo, per esempio i task completati al secondo. Aumentarlo sfruttando tutti i core è una delle motivazioni della concorrenza, insieme a reattività e scalabilità."],
  ['c01#s4', 'c10#s8'])
q(10, "Che cos'è lo speedup? Da quale legge si ricava? Qual è il valore ideale?",
  ["È il rapporto S = T1/TN tra il tempo sequenziale e quello con N processori; il valore ideale è N (speedup lineare), e oltre si va solo in casi particolari, per effetto delle cache. Il limite che la parte sequenziale impone allo speedup lo dà la legge di Amdahl (n. 11)."],
  ['c01#s7'])
q(11, "Che cos'è la legge di Amdahl e come si misura? Che cosa succede se P = 1? E se P = 0?",
  ["Dà lo speedup massimo ottenibile con N processori quando solo una frazione P del programma (tra 0 e 1) è parallelizzabile: `S = 1 / ((1 − P) + P/N)`, dove lo speedup si misura come `T1/TN`.",
   "Con P = 0 non c'è nulla da parallelizzare e S = 1 per ogni N; con P = 1 si ha S = N, lo speedup lineare. Per P intermedi S sta tra 1 e N, e quando N cresce tende al tetto 1/(1 − P): la parte sequenziale limita il guadagno qualunque sia il numero di processori. Lo speedup va quindi da 1 a N, non da 0 a 1, che è semmai l'intervallo tipico dell'efficienza."],
  ['c01#s7'])
q(12, "Che cosa si intende per efficienza? Qual è la formula? E il valore ideale?",
  ["È `E = S/N`, lo speedup diviso per il numero di processori, e dice quanto bene è stato usato ciascuno. Il valore ideale è 1: uno speedup di 8 su 64 core dà E = 0,125."],
  ['c01#s7'])
q(13, "Perché l'accesso alla memoria è un collo di bottiglia? Come si affronta il problema?",
  ["Perché i core raggiungono la RAM attraverso un bus su cui passa un'operazione di memoria alla volta, anche quando i thread accedono a indirizzi diversi e non hanno nulla da sincronizzare. Si attenua con le cache (un core che lavora sui dati in cache non usa il bus), con i protocolli di coerenza e con le architetture NUMA."],
  ['c01#s7'])
q(48, "Perché è importante tenere la CPU «occupata»?",
  ["Perché le prestazioni dipendono da quanto si usano i core: un core fermo mentre c'è lavoro è capacità sprecata. Un thread bloccato sull'I/O libera il suo core, che lavora solo se c'è un altro thread pronto, e per questo i compiti I/O-bound vogliono più thread dei core."],
  ['c01#s7'])

# ============================================================ Cap. 2
q(14, "Che cos'è un processo (in senso astratto)?",
  ["L'esecuzione di un programma sequenziale: un singolo flusso di controllo logico, l'unità di base di un sistema concorrente. Non coincide con il processo del sistema operativo: thread Java, goroutine e attori sono processi in questo senso."],
  ['c02#s1'])
q(15, "Che cos'è l'interazione? Che cosa significano cooperazione e competizione? Qualche esempio?",
  ["I processi interagiscono quando tra loro c'è una dipendenza: la **cooperazione** è attesa e voluta (comunicazione e sincronizzazione, come produttori e consumatori con un buffer), la **competizione** è necessaria ma non voluta (mutua esclusione e sezioni critiche, come più chioschi di check-in sullo stesso database). La terza forma, l'interferenza, non è né attesa né voluta (n. 24)."],
  ['c02#s1'])
q(16, "Che cos'è il meccanismo fork/join?",
  ["`fork P` avvia P in parallelo al chiamante e `join P` ne attende la fine: è flessibile ma non strutturato, come un goto, e in Java corrisponde a `t.start()` e `t.join()`. La `fork()` di Unix, che duplica un processo del sistema operativo, ne è un caso particolare; il pattern architetturale fork-join, un master-workers ricorsivo, è nel capitolo 8."],
  ['c02#s2', 'c08#s5'])
q(17, "Che cos'è il meccanismo cobegin/coend?",
  ["`cobegin S1 ‖ S2 ‖ S3 coend` (il parbegin/parend di Dijkstra) esegue le istruzioni in parallelo e prosegue quando sono finite tutte. È strutturato, ma il numero di processi è fissato nel testo del programma."],
  ['c02#s2'])
q(18, "Come si può esprimere la concorrenza in un linguaggio di programmazione?",
  ["Il linguaggio deve permettere di creare processi e di farli interagire, con tre approcci: linguaggio sequenziale più libreria (C con i Pthreads), linguaggio progettato per la concorrenza con il processo come costrutto di prima classe (Occam, Ada, Erlang, Go), oppure ibrido (Java e Scala: thread di libreria, ma `synchronized` e un lock in ogni oggetto nel linguaggio)."],
  ['c02#s2'])
q(19, "Che cos'è un'azione?",
  ["L'esecuzione atomica di un'istruzione: nel modello a interleaving ogni processo è una sequenza di azioni atomiche, e gli altri ne vedono lo stato di prima o di dopo, mai uno intermedio. Che cosa sia atomico è una scelta di modellazione, che la macchina concorrente deve garantire."],
  ['c02#s5', 'c02#s8'])
q(20, "Che cos'è la sincronizzazione?",
  ["Una relazione temporale imposta tra azioni di processi diversi: che avvengano insieme o, soprattutto, che una avvenga prima di un'altra (precedenza). Non richiede dati condivisi, e non va confusa con la mutua esclusione (n. 22)."],
  ['c02#s3'])
q(21, "Che cos'è una corsa critica? Come si affronta?",
  ["È la race condition: più processi accedono e aggiornano risorse condivise e il risultato dipende dall'ordine degli accessi. Si elimina rendendo atomica la sequenza «controlla e agisci» o leggi-modifica-scrivi, con la mutua esclusione (lock, semafori, monitor) o con un'istruzione atomica della macchina."],
  ['c02#s4'])
q(22, "Che cosa significa mutua esclusione? Che cosa cambia rispetto alla sezione critica?",
  ["La mutua esclusione è la proprietà (al più un processo alla volta accede ai dati condivisi); la sezione critica è il tratto di codice che accede agli oggetti condivisi e deve essere eseguito in mutua esclusione. Il problema della sezione critica chiede i protocolli d'ingresso e d'uscita che la racchiudono."],
  ['c02#s3'])
q(23, "Che cos'è un heisenbug?",
  ["Un bug che cambia o sparisce quando lo si osserva: debugger, breakpoint e stampe alterano i tempi di esecuzione e rendono più o meno probabili certi interleaving. È tipico delle interferenze tra processi."],
  ['c02#s4'])
q(24, "Che cosa si intende per interferenza?",
  ["Un'interazione tra processi né prevista né voluta: errori tempo-dipendenti che si manifestano solo per certi rapporti tra le velocità. Il caso tipico è la race condition, come due incrementi concorrenti che ne producono uno solo."],
  ['c02#s1'])
q(25, "Che cos'è una race condition? Che cosa cambia rispetto alla corsa critica?",
  ["Nulla: «corsa critica» è la traduzione italiana di race condition. È la situazione in cui il risultato dell'accesso concorrente a risorse condivise dipende dall'ordine in cui avvengono gli accessi."],
  ['c02#s4'])
q(29, "Che cosa cambia tra modelli a scambio di messaggi e modelli a memoria condivisa?",
  ["Con la memoria condivisa i processi leggono e scrivono le stesse variabili: la comunicazione è implicita, ma servono meccanismi espliciti di mutua esclusione e sincronizzazione. Con lo scambio di messaggi ogni processo ha la propria memoria e interagisce solo con send e receive: non ci sono dati da proteggere, e comunicazione e sincronizzazione coincidono."],
  ['c02#s1'])
q(30, "Quali modelli si usano per rappresentare i sistemi concorrenti?",
  ["Il modello a interleaving con i diagrammi di stato per le esecuzioni, la logica temporale (LTL) per le proprietà e i formalismi visuali, reti di Petri e statechart. Per i sistemi distribuiti si aggiungono happened-before e causalità potenziale (capitolo 17)."],
  ['c02#s5'])
q(31, "Che cosa significa atomicità? Perché è così importante?",
  ["Un'azione è atomica se viene eseguita fino in fondo senza interleaving: gli altri vedono lo stato di prima o quello di dopo. Decide quali scenari esistono: `n := n + 1` atomico dà sempre 2 con due processi, spezzato in lettura e scrittura può dare 1 (lost update)."],
  ['c02#s8'])
q(32, "Ha senso parlare di atomicità per le strutture dati? Quali tipi sono atomici in Java? Un double lo è?",
  ["Sì: un oggetto dati è atomico se le sue operazioni passano da uno stato all'altro atomicamente, e i tipi composti in generale non lo sono, perché attraversano stati interni inconsistenti. In Java letture e scritture di boolean, byte, char, short, int, float e dei riferimenti sono atomiche; per long e double (64 bit) la specifica non lo garantisce, a meno che siano `volatile`."],
  ['c02#s8', 'c02#s9'])
q(33, "Che cos'è l'interleaving?",
  ["Il modello in cui l'esecuzione concorrente è una sequenza che intercala in modo arbitrario le azioni atomiche di tutti i processi, rispettando l'ordine interno di ciascuno, come se le eseguisse un unico processore astratto. Non significa esecuzione simultanea su processori diversi."],
  ['c02#s5'])
q(34, "Che cosa si intende per arbitrary interleaving?",
  ["Che, per l'indipendenza dalla velocità, qualunque intercalamento delle azioni atomiche che rispetti l'ordine di ogni processo è una possibile esecuzione (uno scenario), e il programma deve essere corretto in tutti. Si ignora il tempo: contano solo l'ordine parziale e la scelta di che cosa è atomico."],
  ['c02#s5'])
q(35, "Che cos'è un diagramma di stato? Come si usa per i programmi concorrenti?",
  ["È il grafo degli stati raggiungibili: uno stato è una tupla con l'etichetta della prossima istruzione di ogni processo e il valore di ogni variabile, e una transizione esegue una di quelle istruzioni. Visitandolo si verificano le proprietà: la mutua esclusione è violata se è raggiungibile uno stato che la viola, un deadlock è uno stato senza uscite in cui non tutti hanno finito."],
  ['c02#s6'])
q(36, "In un diagramma di stato ci sono 10 percorsi possibili e 8 portano al risultato atteso. Hanno una probabilità maggiore di verificarsi?",
  ["No: il modello a interleaving non assegna probabilità agli scenari, e basta uno scenario sbagliato perché il programma sia scorretto, perché prima o poi si presenta. Un test può passare mille volte proprio perché nella pratica alcuni scenari sono molto più probabili di altri."],
  ['c02#s5'])
q(65, "Che cosa significa interleaving? Nel modello a interleaving che differenza c'è rispetto a un'esecuzione senza interleaving?",
  ["La definizione è al n. 33. Se due azioni atomiche avvengono davvero nello stesso istante su due core, il modello le rappresenta come uno dei due ordini possibili, perché per l'atomicità l'effetto è lo stesso e gli accessi alla stessa cella di memoria vengono comunque serializzati dall'hardware: per questo il modello regge anche sui multicore e nei sistemi distribuiti."],
  ['c02#s5'])

# ============================================================ Cap. 3
q(37, "Che cos'è la correttezza di un programma concorrente?",
  ["Un programma concorrente è corretto se le sue proprietà di safety e di liveness valgono in tutti gli scenari possibili, comprese le computazioni infinite. Il testing ne esercita solo alcuni: rivela la presenza di errori, non la loro assenza."],
  ['c03#s1'])
q(38, "Che cos'è una proprietà di safety?",
  ["«Non succede mai niente di male»: una proprietà vera in ogni stato di ogni computazione, cioè un invariante, come la mutua esclusione. Per falsificarla basta un solo stato raggiungibile che la viola."],
  ['c03#s2'])
q(39, "Che cos'è una proprietà di liveness?",
  ["«Prima o poi succede qualcosa di buono»: in ogni computazione esiste uno stato in cui la proprietà è vera, come l'assenza di starvation. La falsifica una computazione infinita in cui non diventa mai vera, che nel diagramma di stato è un ciclo."],
  ['c03#s2'])
q(40, "Che cosa significa fairness? Ha a che fare con lo scheduling?",
  ["È la garanzia che un'azione che può essere eseguita prima o poi lo sia, cioè che ogni processo ottenga il suo turno. Sì: è un requisito sulla politica di scheduling, che decide l'interleaving, e lo stesso programma soddisfa o no una liveness a seconda della fairness assunta."],
  ['c03#s3'])
q(41, "Quanti tipi di fairness conosci?",
  ["Tre, ciascuno include il precedente: **incondizionata** (ogni azione incondizionata eleggibile viene prima o poi eseguita), **debole** (in più, ogni azione condizionata la cui condizione diventa vera e resta vera) e **forte** (in più, ogni azione condizionata la cui condizione diventa vera infinitamente spesso, anche a intermittenza). Debole e forte differiscono proprio sulle condizioni intermittenti, come `await x pari` mentre un altro incrementa x."],
  ['c03#s3'])
q(58, "Che cos'è l'algebra proposizionale?",
  ["Il calcolo proposizionale: formule costruite da proposizioni atomiche con ∧, ∨, ¬, → e ↔, vere o false in un singolo stato; nei programmi concorrenti le proposizioni sono variabili booleane o etichette («P è su p4»). Non basta per dire «in ogni stato» o «prima o poi», e per questo servono le logiche temporali."],
  ['c03#s4'])
q(59, "Che cosa sono le logiche temporali?",
  ["Logiche che aggiungono operatori temporali alla logica proposizionale o dei predicati, per parlare di come evolve il sistema; per i programmi le introdusse Pnueli (1977). Le famiglie sono due: lineare (LTL, il tempo come sequenza di stati) e ramificata (CTL, un albero di futuri)."],
  ['c03#s4'])
q(60, "Che cos'è LTL? Quali operatori ha e a che cosa servono?",
  ["La logica temporale lineare: una formula si valuta su una computazione, e il programma la soddisfa se vale in tutti i suoi scenari. Gli operatori sono □ (always: in ogni stato, per le safety), ◇ (eventually: prima o poi, per le liveness), ○ (next), U (until) e W (weak until, in cui q può non arrivare mai): per esempio □¬(p3 ∧ q3) è la mutua esclusione e □(p2 → ◇p3) l'assenza di starvation."],
  ['c03#s4', 'c03#s5'])
q(61, "Che cos'è l'overtaking? Come si evita?",
  ["Un processo che entra in sezione critica al posto di un altro che aspettava; il k-bounded overtaking chiede che, da quando P chiede di entrare, gli altri entrino al più k volte prima di lui, e si esprime con il weak until. Lo limitano protocolli come Peterson (k = 1), il biglietto del fornaio e i semafori forti; un lock con test-and-set non dà alcun limite."],
  ['c03#s6'])

# ============================================================ Cap. 4
q(51, "Quali sono le proprietà richieste a una soluzione del problema della sezione critica?",
  ["Mutua esclusione (mai due processi in CS insieme), assenza di deadlock (se alcuni cercano di entrare, prima o poi uno ci riesce) e assenza di starvation (chi cerca di entrare prima o poi ci riesce). Una versione più forte della terza è l'attesa limitata, il k-bounded overtaking."],
  ['c04#s1'])
q(53, "Che cos'è l'algoritmo di Dekker? Che problema risolve?",
  ["È la prima soluzione corretta al problema della sezione critica per due processi con sole letture e scritture atomiche. Ogni processo ha un flag «voglio entrare»: se l'altro non è interessato entra subito, altrimenti la variabile `turn` assegna il diritto di insistere, e chi non ha il turno abbassa il flag e aspetta."],
  ['c04#s3'])
q(54, "Che cos'è l'algoritmo di Peterson? Che cosa cambia rispetto a Dekker?",
  ["Risolve lo stesso problema con un solo await: ognuno alza il flag, cede il turno all'altro e aspetta finché l'altro non è interessato oppure tocca a lui (`await not wantq or turn = 1`). Se arrivano insieme perde l'ultimo che ha scritto `turn`, e nessuno sorpassa l'altro più di una volta (k = 1)."],
  ['c04#s3'])
q(55, "Perché si preferisce Peterson a Dekker, visto che è più semplice?",
  ["Perché dà le stesse garanzie (mutua esclusione, niente deadlock né starvation, con soli load e store atomici) ed è più corto e simmetrico: fonde i due controlli di Dekker in un unico await. È l'algoritmo che il corso riprende in Java, con `flag` e `turn` dichiarati `volatile`."],
  ['c04#s3'])
q(56, "Che cos'è il test-and-set? A che cosa serve?",
  ["Un'istruzione hardware che in un solo passo atomico legge una variabile e la pone a 1: `< r := x; x := 1 >`. Con essa la sezione critica per N processi si scrive in tre righe e garantisce mutua esclusione e assenza di deadlock, ma non l'assenza di starvation, e l'attesa è attiva."],
  ['c04#s5'])
q(57, "Che cos'è l'algoritmo del fornaio (bakery)? Che problema ha?",
  ["Una soluzione per N processi: chi arriva prende un biglietto numerato e viene servito in ordine di arrivo, e nella versione del corso prendere il biglietto deve essere atomico. Il difetto è l'overflow: i contatori crescono per sempre e con interi finiti prima o poi ripartono da zero."],
  ['c04#s4'])

# ============================================================ Cap. 5
q(52, "L'await fa polling (busy-waiting)?",
  ["Nel modello dei capitoli 3 e 4 sì: `await c` ritesta di continuo la condizione, ed è la stessa attesa che il semaforo busy-wait fa dentro la wait. Semafori e monitor normali invece sospendono il processo e lo risvegliano con una signal, senza consumare CPU."],
  ['c05#s3'])
q(72, "Che cos'è un semaforo? Da quali componenti è composto, che campi ha e a che cosa servono? Che cosa fanno la wait e la signal?",
  ["È la struttura introdotta da Dijkstra con cui si risolve quasi ogni problema di mutua esclusione e di sincronizzazione a memoria condivisa. Ha due campi: `S.V`, un intero ≥ 0, e `S.L`, l'insieme dei processi bloccati su S; si usa solo con due operazioni atomiche.",
   "`wait(S)`: se `S.V > 0` lo decrementa, altrimenti il processo si blocca in `S.L`. `signal(S)`: se `S.L` è vuoto incrementa `S.V`, altrimenti sveglia un processo di `S.L` e lascia `S.V` invariato, perché il permesso passa direttamente al risvegliato. Ne discende l'invariante `S.V = k + #signal − #wait`, con k valore iniziale."],
  ['c05#s1'])
q(73, "Come si possono usare i semafori? Ci sono più modi?",
  ["Tre usi, che differiscono per valore iniziale: **binario** o mutex (1, fa da lock e lo stesso processo fa wait e signal attorno alla sezione critica), **generale** o counting (N, i permessi o le risorse disponibili) ed **evento** (0: chi aspetta fa wait, chi fa accadere l'evento fa signal, mai lo stesso processo). I primi due servono alla competizione, il terzo alla cooperazione.",
   "Per le garanzie di liveness si distinguono poi i semafori deboli (`S.L` è un insieme e signal sveglia un processo qualsiasi), forti (`S.L` è una coda FIFO: niente starvation) e busy-wait (niente `S.L`, si ritesta il valore)."],
  ['c05#s2', 'c05#s3'])
q(74, "In quale contesto particolare si possono usare i semafori busy-waiting?",
  ["Su un multiprocessore, quando chi aspetta ha un processore tutto suo e non toglie CPU ad altri calcoli, e con poca contesa, cioè con attese brevi: girare per pochi istanti costa meno che sospendere il thread e cambiare contesto, e non coinvolge il sistema operativo. Si usano negli algoritmi paralleli. Il prezzo è che non garantiscono l'assenza di starvation, nemmeno con due soli processi."],
  ['c05#s3'])
q(75, "Esercizio: p1 esegue le azioni atomiche a1, a2 e p2 esegue b1, b2, b3, in concorrenza. Sincronizzali con i semafori in modo che b2 venga sempre eseguita dopo a1.",
  ["L'evento da aspettare è «a1 eseguita»: si crea un semaforo evento `a1Done` inizializzato a 0, perché l'evento non è ancora accaduto. Chi aspetta fa `wait` subito prima dell'azione vincolata, chi fa accadere l'evento fa `signal` subito dopo:",
   ('plaintext', "semaphore a1Done := (0, {})\n\np1                        p2\na1                        b1\nsignal(a1Done)            wait(a1Done)\na2                        b2\n                          b3"),
   "Funziona in entrambi gli ordini: se p1 segnala per primo `a1Done` vale 1 e la wait di p2 passa senza bloccarsi; se p2 arriva prima alla wait, si blocca finché p1 non segnala."],
  ['c05#s5'])
q(76, "Prendi l'esercizio precedente e, dopo averlo sincronizzato, disegna la rete di Petri.",
  ["Prima i due processi, ciascuno da solo: una catena posto → transizione → posto con un token nel posto iniziale, una transizione per azione (a1, a2 per p1; b1, b2, b3 per p2). Poi la «colla»: il semaforo diventa un posto `a1Done` senza token, che è il suo valore iniziale.",
   "La transizione a1 ha `a1Done` come secondo posto di uscita (la signal) e b2 lo ha come secondo posto di ingresso (la wait), quindi b2 scatta solo quando p2 ha eseguito b1 e a1 ha messo un token in `a1Done`. L'errore tipico è collegare il posto dopo a1 sia ad a2 sia a b2: un posto con due transizioni in uscita è una scelta, e l'unico token andrebbe all'una o all'altra."],
  ['c09#s4', 'c05#s5'])
q(77, "Problema della sezione critica con più di due processi: che approccio semaforico usi e perché? Che problema devi evitare?",
  ["Un semaforo binario inizializzato a 1 usato come lock: `wait(S)` prima della sezione critica e `signal(S)` dopo, con lo stesso codice per qualsiasi numero di processi, che garantisce mutua esclusione e assenza di deadlock.",
   "Il problema da evitare è la starvation: con un semaforo debole la signal può svegliare sempre gli stessi processi, e uno di loro non entra mai. Serve quindi un semaforo forte, con coda FIFO (in Java `new Semaphore(1, true)`)."],
  ['c05#s4'])
q(78, "Un esempio di applicazione che usa i semafori per la sincronizzazione?",
  ["Il merge sort delle slide: due processi ordinano le due metà di un array e fanno ciascuno signal su un proprio semaforo evento, e il processo che fonde aspetta entrambi con due wait prima del merge, invece di fare join sui due processi."],
  ['c05#s5'])
q(79, "Che cos'è il problema produttori-consumatori? Da che problemi è colpito? Come si mitigano? Che cosa cambia tra l'approccio sincrono e quello asincrono?",
  ["I produttori creano dati e li inviano, i consumatori li ricevono e li elaborano: è un problema d'ordine di esecuzione. Nell'approccio sincrono non c'è buffer e i due si incontrano, e chi arriva prima aspetta; in quello asincrono un buffer condiviso li disaccoppia e assorbe le differenze di velocità.",
   "I problemi sono di sincronizzazione, non di velocità da correggere con lo scheduling: il consumatore non deve prelevare da un buffer vuoto, il produttore non deve inserire in un buffer pieno, e con più processi le operazioni sul buffer sono sezioni critiche. Si risolvono con i semafori divisi `availItems` (0) e `availPlaces` (N) più un mutex, preso dopo la wait di sincronizzazione per non andare in deadlock, oppure con un monitor o una `ArrayBlockingQueue`."],
  ['c05#s6'])

# ============================================================ Cap. 6
q(26, "Che cos'è un deadlock?",
  ["Una situazione in cui due o più processi aspettano ciascuno un evento (il rilascio di una risorsa, un segnale, un messaggio) che solo un altro del gruppo potrebbe produrre: un'attesa circolare da cui nessuno esce. Il caso tipico è l'abbraccio mortale: A tiene il lock L e chiede M, B tiene M e chiede L.",
   "Può verificarsi solo se valgono insieme le quattro condizioni di Coffman (mutua esclusione, possesso e attesa, nessuna prelazione, attesa circolare), quindi per prevenirlo basta romperne una, di solito acquisendo i lock sempre nello stesso ordine."],
  ['c06#s1', 'c06#s3'])
q(27, "Che cos'è la starvation?",
  ["Un processo aspetta indefinitamente una risorsa che gli viene negata di continuo, mentre gli altri avanzano, senza bisogno di un ciclo di attese (per esempio con un semaforo debole). Il deadlock implica la starvation dei processi coinvolti, non il viceversa."],
  ['c06#s1'])
q(28, "Che cos'è un livelock?",
  ["I processi non sono bloccati, ma cambiano stato di continuo l'uno in risposta all'altro senza progredire, come due persone che in un corridoio si spostano dalla stessa parte all'infinito; è un caso particolare di starvation. Si rompe con un po' di casualità, per esempio un'attesa casuale prima di riprovare."],
  ['c06#s1'])
q(66, "Descrivi il problema dei filosofi a cena.",
  ["Cinque filosofi alternano pensare e mangiare attorno a un tavolo con cinque forchette, una tra ogni coppia di vicini, e per mangiare servono le due forchette ai propri lati, prese una alla volta: bisogna garantire mutua esclusione sulle forchette, niente deadlock né starvation ed efficienza senza contesa. Se tutti prendono prima la sinistra si ha un deadlock, che si evita con un ticket per N − 1 filosofi o prendendo le forchette in ordine di indice."],
  ['c06#s2', 'c06#s4'])
q(67, "Quali sono le condizioni necessarie perché si verifichi un deadlock?",
  ["Le quattro condizioni di Coffman: mutua esclusione, possesso e attesa (hold and wait), nessuna prelazione e attesa circolare. Sono necessarie, non sufficienti: il deadlock è possibile solo se valgono tutte, quindi per prevenirlo basta romperne una."],
  ['c06#s3'])
q(68, "Qual è la regola generale per evitare i deadlock?",
  ["Dare un ordine totale ai lock e acquisirli sempre in quell'ordine. Rende impossibile l'attesa circolare, perché ognuno aspetterebbe un lock di rango maggiore di quello che tiene fino a tornare al primo; è ciò che fa `transferMoney` prendendo prima il lock del conto con indice minore."],
  ['c06#s5'])
q(80, "È possibile fare recovery da un deadlock? Come? Java lo fa?",
  ["In generale sì: i DBMS mantengono il grafo delle attese, vi cercano cicli e abortiscono una transazione vittima, i cui lock vengono rilasciati. La JVM no: non ha rilevamento né recupero automatico, e un deadlock si può solo diagnosticare (thread dump, `jstack`, `ThreadMXBean.findDeadlockedThreads()`), quindi in Java va prevenuto."],
  ['c06#s6'])

# ============================================================ Cap. 7
q(81, "Che cos'è un monitor?",
  ["Un'astrazione di dati (Brinch Hansen 1973, Hoare 1974) che incapsula stato, operazioni e politica di sincronizzazione e di mutua esclusione nell'accesso a quei dati. Le procedure si eseguono in mutua esclusione implicita, e per aspettare una condizione sullo stato si usano le variabili condizione."],
  ['c07#s1'])
q(82, "Perché i monitor sono in genere preferibili ai semafori?",
  ["Hanno la stessa potenza espressiva, ma sono di livello più alto: la mutua esclusione è implicita e non si può dimenticare un rilascio, e la politica di sincronizzazione sta in un solo punto, dentro la risorsa, invece che sparsa nel codice dei processi."],
  ['c07#s6'])
q(83, "Che proprietà deve avere un monitor?",
  ["Dall'esterno sono visibili solo i nomi delle procedure; le istruzioni del monitor non accedono a variabili dichiarate fuori; le variabili permanenti sono inizializzate prima che qualsiasi procedura venga chiamata. A queste si aggiunge la mutua esclusione implicita: al più una procedura attiva alla volta."],
  ['c07#s1'])
q(84, "Che cosa sono le primitive waitC e signalC? Come si chiamano in Java?",
  ["Sono le operazioni atomiche di una variabile condizione: `waitC` sospende il processo nella coda della condizione e rilascia il monitor, `signalC` risveglia il primo processo in coda e, se la coda è vuota, non fa nulla. In Java sono `wait()` e `notify()`/`notifyAll()` sul lock intrinseco, oppure `await()` e `signal()`/`signalAll()` su una `Condition`."],
  ['c07#s2', 'c07#s5'])
q(85, "Dopo una signalC, chi ha la precedenza se chi ha segnalato ha ancora istruzioni da eseguire?",
  ["Può proseguire un solo processo, e lo decide la disciplina di segnalazione: con Signal and Continue (E < W < S) continua chi ha segnalato; con Signal and Wait (E = S < W) esegue subito il risvegliato e il segnalante aspetta alla pari con chi vuole entrare; con Signal and Urgent Wait (E < S < W, quella di Hoare) il segnalante ha la precedenza su chi vuole entrare."],
  ['c07#s3'])
q(87, "Perché da dentro un monitor non si dovrebbero chiamare altri monitor? Si rischia il deadlock?",
  ["Sì: una procedura che chiama un altro monitor tiene il proprio lock per tutta la chiamata, e se un altro thread fa il percorso inverso si ha un deadlock di ordinamento dei lock, come nel pattern Observer. Inoltre, se il monitor interno fa wait, rilascia solo il proprio lock e lascia bloccato quello esterno (nested monitor lockout)."],
  ['c07#s5'])
q(88, "Che approccio adotta Java per la disciplina di segnalazione dopo una signal?",
  ["Una variante di Signal and Continue con E = W < S: chi notifica continua e tiene il lock, e il risvegliato compete alla pari con chi vuole entrare, quindi un thread appena arrivato può passargli davanti e cambiare lo stato. `notify` sveglia un solo thread, scelto arbitrariamente, e per questo le attese si scrivono con `while` (n. 96)."],
  ['c07#s5'])
q(90, "Come si implementa un monitor in Java? Quali sono i monitor nell'assignment 1, come li avete implementati e a che cosa servono?",
  ["In due modi da non mescolare: con il lock intrinseco (metodi pubblici `synchronized`, niente campi pubblici, `wait()` dentro un `while`, `notifyAll()`) oppure con `ReentrantLock` e una o più `Condition` (`lock`/`unlock` in try-finally, `await`/`signal`). Per l'assignment si elencano i propri monitor e il loro ruolo: la scheda del Poool descrive `Buffer`, `Barrier` e `RenderSynch`, costruiti su `synchronized`, `wait` e `notifyAll`."],
  ['c07#s5', 'p1#s2'])
q(94, "Che cos'è una variabile condizione?",
  ["Una variabile usabile solo dentro il monitor che rappresenta una condizione sullo stato: sospende un processo finché la condizione non diventa vera e lo risveglia quando lo diventa, con una coda FIFO e le operazioni `waitC` e `signalC`. Un segnale senza nessuno in attesa va perso, quindi va sempre accompagnata da una condizione esplicita sullo stato."],
  ['c07#s2'])
q(95, "Perché la variabile condizione deve essere legata al lock?",
  ["Perché `waitC` deve rilasciare il lock del monitor nello stesso passo atomico in cui sospende il processo. Se non lo rilasciasse, chi aspetta terrebbe il monitor occupato e nessuno potrebbe entrare a rendere vera la condizione: deadlock. Se lo rilasciasse in un passo separato, una `signalC` arrivata nell'intervallo troverebbe la coda vuota e andrebbe persa.",
   "Per questo in Java una `Condition` si ottiene dal proprio lock con `lock.newCondition()`, e `wait()` si chiama solo tenendo il lock dell'oggetto."],
  ['c07#s2'])
q(96, "Perché in Java sulle variabili condizione si usa while e non if? Quando si può usare if?",
  ["Perché Java usa una variante di Signal and Continue: il risvegliato riparte dopo il segnalante e magari dopo thread appena entrati, quando la condizione può essere tornata falsa, e la specifica ammette anche i risvegli spuri. L'`if` basterebbe solo con la ripresa immediata di Signal and Wait o Signal and Urgent Wait, che Java non offre; il `while` è corretto con qualsiasi disciplina."],
  ['c07#s5', 'c07#s3'])
q(97, "Problema dei lettori e scrittori: che operazioni mette in campo un monitor? read e write? Perché no?",
  ["No. Se la lettura fosse una procedura del monitor, la mutua esclusione implicita impedirebbe a due lettori di leggere insieme, e il monitor resterebbe occupato per tutta la durata di letture e scritture: si tornerebbe alla soluzione sovravincolata.",
   "Il monitor offre invece operazioni che aprono e chiudono l'accesso (`request_read`/`release_read`, `request_write`/`release_write`): gestisce solo i permessi, contati da `nr` e `nw`, come un allocatore di risorse. La lettura e la scrittura vere avvengono fuori, tra le due chiamate."],
  ['c07#s4'])
q(102, "Che cosa sono i gate?",
  ["Un gate, o latch, è un componente di coordinazione con due ruoli: chi chiama `await` aspetta che il cancello si apra, chi passa chiama `countDown` senza bloccarsi, e dopo N countDown il cancello si apre e resta aperto per sempre. A differenza della barriera, che è simmetrica, il latch aspetta eventi; in Java c'è `CountDownLatch`."],
  ['c07#s7'])

# ============================================================ Cap. 8
q(98, "Che differenza c'è tra componenti attivi e passivi? Qualche esempio?",
  ["Un componente attivo (agente) incapsula un proprio flusso di controllo e si progetta a partire dai suoi compiti: master, worker, produttori, consumatori, attori. Un componente passivo incapsula stato e operazioni con la loro sincronizzazione e agisce solo quando un agente lo chiama: monitor come bounded buffer, bag of tasks, contatori condivisi, latch, barriere."],
  ['c08#s2'])
q(99, "Che cos'è un agente? È attivo o passivo?",
  ["È un componente attivo, responsabile di uno o più task di cui incapsula la logica e il controllo: un thread, un event loop o un attore. Non ha metodi pubblici chiamati da altri thread, e interagisce con gli altri agenti solo attraverso componenti passivi."],
  ['c08#s2'])
q(106, "Che cos'è il pattern task decomposition?",
  ["Una decomposizione che parte dai task: il problema si scompone in modo naturale in task indipendenti o quasi, e la divisione dei dati segue. Funziona se gestire le dipendenze costa poco rispetto al tempo totale; esempi sono produttori e consumatori o un web server con un task per richiesta."],
  ['c08#s3'])
q(107, "Che cos'è il pattern data decomposition?",
  ["Una decomposizione che parte dai dati: si dividono in unità su cui lavorare in modo relativamente indipendente, e i task seguono. Scala bene con il numero di processori, come nel prodotto di matrici con un task per elemento del risultato."],
  ['c08#s3'])
q(108, "Che cosa si intende per dipendenze nel progetto di programmi concorrenti?",
  ["I vincoli tra task: temporali (un task parte solo dopo che un altro è finito, come il merge dopo gli ordinamenti) o sui dati e sulle risorse (un task usa dati prodotti da un altro, o più task condividono una risorsa). Analizzarle serve a raggruppare e ordinare i task, e dice dove gli agenti dovranno coordinarsi con barriere, latch o monitor."],
  ['c08#s3'])
q(111, "Quali sono in letteratura le tre classi architetturali di base per la concorrenza? I confini tra le tre sono rigidi?",
  ["Sono le classi di Carriero e Gelernter: result parallelism (si progetta attorno al risultato e se ne calcolano le parti insieme), specialist parallelism (una rete di specialisti, ciascuno con un solo tipo di compito) e agenda parallelism (una lista di attività, con molti generalisti su ogni passo). I confini non sono rigidi, perché un lavoro reale spesso le mescola, ma restano tre modi distinti di pensare il problema."],
  ['c08#s4'])
q(112, "Quali sono le quattro architetture concorrenti?",
  ["Master-workers (con le varianti dei framework a task e del fork-join), filter-pipeline, shared-space o blackboard, announcer-listeners. In ciascuna gli agenti si coordinano tramite un componente passivo: bag of tasks, pipe, spazio condiviso, servizio di eventi."],
  ['c08#s5'])
q(119, "Che cos'è una bag of tasks?",
  ["Il componente passivo condiviso in cui il master (e nel fork-join anche i worker) inserisce i task e da cui i worker li prelevano, di solito un monitor come un bounded buffer o una blackboard. Disaccoppia il master dai worker, il cui numero dipende dall'hardware e non dai task."],
  ['c08#s5'])
q(120, "Che cos'è il master-worker?",
  ["Un'architettura in cui un master scompone il lavoro in sottotask, li mette in una bag of tasks e raccoglie i risultati, mentre i worker prelevano un task, lo eseguono e ne comunicano il risultato. Un executor è un master-workers di cui il programmatore scrive solo il master."],
  ['c08#s5'])

# ============================================================ Cap. 9
q(103, "Che cos'è una rete di Petri?",
  ["Un modello formale e visuale del flusso di informazione e di controllo, per sistemi di eventi concorrenti con vincoli di precedenza: un grafo bipartito di posti e transizioni con token nei posti. Una transizione è abilitata quando ogni posto di ingresso ha un token, e scattando ne toglie uno da ogni ingresso e ne aggiunge uno a ogni uscita."],
  ['c09#s2'])
q(104, "Che cos'è un token in una rete di Petri? E un posto?",
  ["Un posto è un nodo che rappresenta una condizione, lo stato di un processo o una risorsa; un token in un posto dice che la condizione vale, e nel modello dei processi è un flusso di controllo o un permesso. La distribuzione dei token, la marcatura, è lo stato della rete."],
  ['c09#s2', 'c09#s3'])

# ============================================================ Cap. 10
q(42, "A che cosa serve la parola chiave synchronized in Java?",
  ["Prende il lock intrinseco di un oggetto all'ingresso di un blocco o di un metodo e lo rilascia all'uscita, anche per eccezione, così al più un thread alla volta esegue codice `synchronized` sullo stesso oggetto. Il lock è rientrante e dà anche visibilità; indica mutua esclusione, non impone alcun ordine tra i thread."],
  ['c10#s2'])
q(43, "A che cosa serve la parola chiave volatile in Java?",
  ["Ogni lettura di un campo `volatile` vede l'ultima scrittura, e la scrittura happens-before le letture successive, quindi vieta anche i riordinamenti attorno all'accesso. Dà visibilità e ordinamento, non atomicità: `count++` su un volatile perde ancora incrementi, mentre basta per un flag di stop."],
  ['c10#s3'])
q(44, "Come funziona la classe Thread in Java? Che differenza c'è tra start e run? Che cosa succede se chiamo run al posto di start?",
  ["`run` contiene il comportamento; `start` fa nascere un nuovo thread che esegue `run` e ritorna subito. Chiamare `run` direttamente è una normale chiamata di metodo, eseguita in sequenza dal thread chiamante, e non crea nessun thread."],
  ['c10#s1'])
q(45, "Quando conviene creare classi che estendono Thread e quando classi anonime?",
  ["Il funzionamento è identico: `Runnable` o una lambda servono quando la classe deve già estendere un'altra classe. Una classe con un nome è preferibile quando il thread è un concetto del progetto (`SortingWorker`, `MergingWorker`), perché rende visibili ruoli e responsabilità che una lambda nasconde."],
  ['c10#s1'])
q(46, "A che cosa serve il metodo join di un Thread?",
  ["Sospende il thread chiamante finché quel thread non termina: è la prima forma di sincronizzazione, e l'attesa si interrompe con `InterruptedException`."],
  ['c10#s1'])
q(69, "Che cosa significa lost update?",
  ["Due thread eseguono un leggi-modifica-scrivi come `count++` sulla stessa variabile: leggono entrambi 5, scrivono entrambi 6, e un aggiornamento si perde. Si evita rendendo atomica l'operazione con `synchronized`, un lock o `AtomicInteger`."],
  ['c10#s2'])
q(70, "Che cosa significa check-and-act?",
  ["Una decisione presa su un'osservazione che, al momento dell'azione, può essere già vecchia: «se il file non esiste, crealo», il singleton pigro, `if (c.getVal() > 0) c.dec()`. Anche se ogni metodo è `synchronized` la coppia non è atomica, e va resa tale con un blocco sullo stesso lock o con un metodo apposito."],
  ['c10#s2'])
q(71, "Che cosa significa lock rientrante?",
  ["Un lock acquisito per thread e non per invocazione: il thread che lo possiede può riacquisirlo senza bloccarsi, e lo libera dopo un rilascio per ogni acquisizione, così un metodo `synchronized` può chiamarne un altro sullo stesso oggetto. Non ha a che fare con l'equità, che in `ReentrantLock` è un'opzione separata del costruttore."],
  ['c10#s2'])
q(86, "Quando viene lanciata una InterruptedException?",
  ["Quando un thread sospeso in un'attesa interrompibile (`sleep`, `wait`, `join`, `BlockingQueue.put`/`take`, `Future.get`, `lockInterruptibly`, `acquire`…) riceve `interrupt()` da un altro thread, o se l'interruzione era già stata chiesta prima dell'attesa; lo stato di interruzione viene azzerato. Non sono interrompibili l'attesa di un blocco `synchronized` e `Lock.lock()`."],
  ['c10#s4'])
q(100, "Aggiungiamo un'interfaccia utente con un pulsante. Perché non può essere il main thread a gestirne l'azione?",
  ["Perché gli eventi li preleva da una coda e li consegna ai listener l'Event Dispatch Thread, l'unico thread che tocca i componenti Swing; il main costruisce la finestra e può anche terminare. L'handler deve quindi ritornare in fretta: un lavoro lungo va a un altro thread, che riconsegna gli aggiornamenti alla GUI con `SwingUtilities.invokeLater`."],
  ['c10#s11'])
q(101, "Qual è il nome del metodo usato per gestire gli eventi della GUI in Java? Lo avete usato nell'assignment 1?",
  ["`actionPerformed(ActionEvent e)` di `ActionListener`, eseguito dall'EDT. Per l'assignment si guarda il proprio codice: nella scheda del Poool l'input da tastiera arriva dalla EDT tramite `ViewFrame` e passa al game loop attraverso un `Buffer`."],
  ['c10#s11', 'p1#s1'])
q(115, "Perché un approccio a task è considerato asincrono?",
  ["Perché `execute` e `submit` non aspettano il task: lo consegnano all'executor e ritornano subito. Il task viene eseguito più tardi, da un thread del pool, in modo asincrono rispetto a chi l'ha sottomesso, che raccoglie il risultato dopo tramite la `Future` restituita da `submit`. Le chiamate asincrone si riconoscono proprio da questo: restituiscono una Future, o nulla."],
  ['c10#s5'])
q(117, "Che cos'è un Executor?",
  ["Il framework di `java.util.concurrent` che separa la sottomissione di un task dalla sua esecuzione: dentro c'è un master-workers con una bag of tasks e un pool di thread. `Executor` offre `execute`, `ExecutorService` aggiunge `submit`, che restituisce una `Future`, e il ciclo di vita (`shutdown`, `awaitTermination`…)."],
  ['c10#s5'])
q(118, "Che cos'è un task?",
  ["Un'unità di lavoro astratta, discreta e indipendente, con un inizio e una fine: non un ciclo infinito e non un thread, che è invece ciò che lo esegue. Separa il livello logico, che viene dal problema, da quello fisico, che dipende dalla macchina."],
  ['c10#s5'])
q(121, "Un programma sottomette 100 task a un fixed thread pool di 4 thread. Ogni task esegue due operazioni atomiche a e b, che stampano qualcosa, e dopo ogni a c'è un'attesa: una barriera che aspetta tutti i 100 task. Che cosa si legge eseguendolo?",
  ["Quattro «a», in un ordine qualsiasi, e poi nulla. I 4 thread prendono i primi 4 task, stampano a e si sospendono sulla barriera, che aspetta 100 arrivi; gli altri 96 task restano in coda senza un thread libero: nessuna b, nessuna eccezione, e il programma non termina. Un task che aspetta sospende il thread del pool che lo esegue: nell'Executor framework i task devono essere indipendenti.",
   "Un pool di 100 thread lo «risolve», ma è barare: il numero di thread torna a dipendere dal problema. La correzione è togliere l'attesa dai task e lasciarla al master:",
   ('java', "List<Future<?>> phaseA = new ArrayList<>();\nfor (int i = 0; i < 100; i++) { int id = i; phaseA.add(exec.submit(() -> System.out.println(\"a\" + id))); }\nfor (Future<?> f : phaseA) f.get();      // l'attesa è nel master, fuori dal pool\nfor (int i = 0; i < 100; i++) { int id = i; exec.execute(() -> System.out.println(\"b\" + id)); }")],
  ['c10#s7'])
q(122, "Come si ottiene il valore calcolato da un task dopo che ha finito?",
  ["Si scrive il task come `Callable<V>` e lo si sottomette con `submit`, che restituisce subito una `Future<V>`; `get()` blocca finché il risultato è pronto e lo restituisce, o lancia `ExecutionException`. In alternativa i task depositano i risultati in un monitor che li aggrega."],
  ['c10#s6'])
q(123, "Chi crea ComputeDocumentTask?",
  ["Nel conteggio delle parole con Fork/Join (dove il task di un documento si chiama `DocumentSearchTask`) non lo crea un master centrale, ma il task della cartella che contiene il documento: il `FolderSearchTask` fa `fork` di un task per ogni sottocartella e di uno per ogni documento, poi somma i risultati con `join`. Espansione e aggregazione sono quindi ricorsive e distribuite."],
  ['c10#s10'])
q(124, "Che cos'è una Future? A che cosa serve? Perché è utile?",
  ["Un oggetto restituito subito da `submit` che rappresenta un risultato non ancora disponibile: permette di controllarne lo stato (`isDone`), di bloccarsi fino all'arrivo (`get`, anche con timeout), di cancellare il task e di intercettarne gli errori. È utile perché chi sottomette prosegue e raccoglie i risultati dopo; la Future di Java però è bloccante, a differenza delle promise."],
  ['c10#s6'])

# ============================================================ Cap. 11
q(62, "Che cosa significa model checking?",
  ["Costruire un modello del sistema (con l'interleaving, un sistema di transizioni) ed esplorarne in modo esaustivo tutti gli stati raggiungibili, verificando le proprietà scritte come predicati o in logica temporale; se una è violata si ottiene un controesempio, la traccia che porta all'errore. Il limite è l'esplosione dello spazio degli stati."],
  ['c11#s3'])
q(63, "Che cos'è TLA+? Che linguaggio usa?",
  ["Il linguaggio di specifica di Leslie Lamport, basato su matematica discreta semplice (insiemi e predicati) e sulla logica temporale delle azioni: descrive l'insieme dei comportamenti ammessi di un sistema, e il model checker TLC ne verifica le proprietà. Accanto c'è PlusCal, un linguaggio algoritmico che viene tradotto in TLA+."],
  ['c11#s5'])
q(64, "Che cos'è JPF? Per che cosa si usa?",
  ["Java PathFinder è il model checker per Java nato alla NASA: una Java Virtual Machine scritta in Java che esegue il bytecode lungo tutti gli interleaving possibili, memorizzando gli stati, tornando indietro (backtracking) e riconoscendo quelli già visti. Non serve scrivere un modello a parte.",
   "Di base cerca deadlock ed eccezioni non catturate, compresi gli `assert` falliti; con il listener `PreciseRaceDetector` trova anche le race condition. Non accetta formule LTL: le proprietà specifiche si scrivono con `assert`. Su un programma vero si verifica un modello ridotto (monitor e 2–3 thread, niente GUI né I/O), e «no errors detected» conta solo se la ricerca è stata completa."],
  ['c11#s4'])
q(105, "Che cosa significa stuttering?",
  ["Un passo in cui lo stato non cambia: in TLA+ ogni specifica lo ammette per costruzione (`[Next]_vars`), per confrontare specifiche con livelli di dettaglio diversi. Senza ipotesi di fairness un comportamento può quindi «balbettare» per sempre e smentire le liveness, come la starvation freedom di Peterson."],
  ['c11#s5'])

# ============================================================ Prep 1 (asked)
q(89, "Come avete strutturato l'assignment 1? Quali sono gli aspetti principali che caratterizzano la vostra soluzione concorrente?",
  ["È una domanda sul proprio codice, e si risponde con l'architettura consegnata. Da preparare: quali sono i componenti attivi e quelli passivi, le fasi del lavoro e quali sono parallele, le due versioni richieste (platform thread con monitor scritti da voi, e task sull'Executor Framework) e perché differiscono, come le fasi si sincronizzano.",
   "La scheda di preparazione ricostruisce tutto questo per il Poool: il frame come pipeline di sei passi, i monitor `Buffer`, `Barrier` e `RenderSynch` nella v1, `invokeAll` al posto del `Barrier` nella v2."],
  ['p1#s1', 'p1#s2'])
q(91, "Come si dimensiona il pool di thread? Come avete scelto il numero di thread nell'assignment 1? Cambiarlo portava a prestazioni diverse?",
  ["La regola generale è N_cpu + 1 per i task CPU-bound e `N_threads = N_cpu · U_cpu · (1 + W/C)` quando i task aspettano. Il Poool è CPU-bound (W/C ≈ 0), quindi circa un thread per core, N_cpu + 1.",
   "Il valore va confermato misurando: variando i thread lo speedup cresce fino al numero di core e poi si ferma, con il tetto fissato dalla parte seriale (Amdahl). All'orale portate i numeri del vostro benchmark e il valore scelto."],
  ['c10#s8', 'p1#s3'])
q(92, "Che approccio avete usato per coordinare l'esecuzione delle varie fasi e far collaborare i componenti attivi e passivi?",
  ["Si risponde nominando i propri componenti. Il principio: gli agenti (thread) non si chiamano tra loro, interagiscono solo attraverso componenti passivi, i monitor. Per un lavoro a fasi lo schema tipico è un master-workers ripetuto: il master distribuisce il lavoro di una fase, aspetta che tutti abbiano finito (barriera, latch, Future) e solo dopo passa alla fase successiva.",
   "Nella scheda del Poool il main loop distribuisce il lavoro con un `Buffer` per worker e attende il rendezvous su un `Barrier` (v1), oppure consegna i task con `invokeAll` (v2)."],
  ['c08#s2', 'c08#s6', 'p1#s3'])
q(93, "Avete usato un buffer bounded o unbounded?",
  ["Dipende dal proprio codice, ma la scelta va motivata. Un buffer limitato blocca il produttore quando è pieno e frena chi produce più di quanto si smaltisce; uno illimitato non lo blocca mai, ma può crescere senza limite.",
   "Nella scheda del Poool il `Buffer` dell'input è unbounded: i produttori (tastiera e bot) sono lenti, il game loop svuota tutto con `poll()` a ogni frame, e un buffer limitato bloccherebbe la EDT congelando l'interfaccia."],
  ['p1#s3', 'c05#s6'])
q(109, "Quali sono le prove di correttezza che avete fatto nell'assignment 1?",
  ["Si descrivono le proprie. Il caso tipico è un model checking con JPF di un modello ridotto: i monitor con 2–3 thread, senza GUI né I/O, le proprietà scritte come `assert` e il deadlock controllato da JPF, più una versione volutamente sbagliata per mostrare che la verifica trova davvero l'errore.",
   "Vanno aggiunti i test sul risultato, sapendo che cosa un test non può dimostrare. La scheda del Poool descrive `StrategyEquivalence` (stesso risultato della versione sequenziale) e la verifica JPF del `Barrier`."],
  ['c11#s4', 'p1#s3'])
q(110, "Le proprietà che avete scritto (anche quelle verificate con TINA sulla rete di Petri) sono di safety o di liveness?",
  ["Vanno classificate una per una con un criterio: se una violazione si mostra con un'esecuzione finita (uno stato cattivo raggiungibile) è safety; se serve un'esecuzione infinita in cui la cosa buona non arriva mai è liveness.",
   "Mutua esclusione, limiti del buffer, rete limitata, invarianti di posto e «nessuna marcatura morta raggiungibile» sono safety; «chi chiede la sezione critica prima o poi entra», «il programma termina», «ogni elemento prodotto viene consumato» sono liveness. Attenzione ad «assenza di deadlock», che può indicare l'una o l'altra: dite quale intendete."],
  ['c11#s2', 'p1#s3'])
q(113, "Come fate a capire che sono finiti i task da eseguire nell'assignment 1?",
  ["Dipende da come nascono i task. Se il loro numero è noto quando li si sottomette si contano i completamenti: un monitor che attende N risultati, un latch inizializzato a N, le Future (`get` su ciascuna o `invokeAll`), oppure `shutdown` più `awaitTermination`. Se i task ne generano altri un bag vuoto non basta: serve un contatore dei task pendenti, e il lavoro è finito quando arriva a zero.",
   "Nella scheda del Poool il numero di task di una fase è noto: il `Barrier` conta i report dei worker (v1), `invokeAll` ritorna quando tutte le Future sono complete (v2)."],
  ['c08#s6', 'p1#s3'])
q(114, "Come avete usato JPF?",
  ["Si racconta il proprio setup. JPF esplora tutti gli interleaving, quindi si verifica un modello ridotto: i monitor e i thread che li usano, 2–3 thread e pochi cicli, file e GUI sostituiti da dati in memoria, le proprietà come `assert` e il deadlock lasciato al controllo di JPF.",
   "Conviene verificare anche una versione volutamente rotta, per mostrare che la verifica trova l'errore, e leggere «no errors detected» insieme alle statistiche. Nella scheda del Poool: `TestBarrier` con 2 parti e 2 round, e `UnsafeBarrier`, a cui manca un `synchronized`."],
  ['c11#s4', 'p1#s3'])

# ============================================================ Cap. 12
q(116, "Che cosa si intende per programmazione asincrona?",
  ["Avviare un'operazione senza aspettarne la fine: il chiamante prosegue e il risultato arriva più tardi, come evento gestito da una callback, da una promise o con await. È il modo «a eventi» di fare concorrenza, duale ai thread, in cui un event loop esegue gli handler e le operazioni lente vanno a thread in background."],
  ['c12#s1', 'c12#s2'])
q(125, "Che cosa significa event-driven programming?",
  ["Un programma è una collezione di handler, routine eseguite quando si verifica l'evento a cui sono associate: il flusso di controllo lo decidono gli eventi, non il programmatore. Il modello di esecuzione di riferimento è l'event loop."],
  ['c12#s1'])
q(126, "Come funziona l'event loop nella programmazione event-driven?",
  ["Un solo flusso di controllo aspetta un evento sulla coda, sceglie l'handler associato e lo esegue fino in fondo, poi torna ad aspettare. Gli eventi che arrivano nel frattempo, dall'ambiente o dai worker in background, restano in coda."],
  ['c12#s1'])
q(127, "Due handler possono essere eseguiti insieme?",
  ["Non nello stesso event loop: li esegue un solo thread, uno dopo l'altro, quindi non ci sono race e non servono lock. Un sistema può però avere più event loop, come i verticle di Vert.x, i cui handler girano in parallelo con stato proprio e comunicano generando eventi."],
  ['c12#s1'])
q(128, "Che cos'è il pattern reactor?",
  ["È l'event loop come pattern architetturale (Schmidt, POSA 2), che separa il demultiplexing e il dispatching degli eventi dalla logica applicativa: un demultiplexer sincrono attende che un handle (per esempio una socket) sia pronto, e un dispatcher trova l'handler registrato e ne chiama il metodo hook. È l'architettura sotto JavaScript, Node.js, Vert.x e le GUI."],
  ['c12#s1'])
q(129, "Che cos'è un handler?",
  ["Una routine associata a un evento, eseguita dall'event loop quando quell'evento arriva. Può essere registrata anche dinamicamente, come una callback."],
  ['c12#s1'])
q(130, "Che caratteristiche deve avere un handler?",
  ["Viene eseguito fino in fondo senza interruzioni e deve terminare presto; non contiene chiamate bloccanti né attese attive, perché ogni operazione lenta diventa asincrona (never-blocking). Può generare nuovi eventi, che il loop vedrà solo dopo la sua fine, e accede solo allo stato del proprio event loop."],
  ['c12#s2'])
q(131, "Come diventa il codice `r = syncTask(p); s = r + 1` usando un task asincrono?",
  ["Il seguito del calcolo diventa la callback passata come ultimo argomento, `asyncTask(p, (r) => { s = r + 1; })`: asyncTask ritorna subito, e l'event loop esegue la callback quando r è pronto."],
  ['c12#s3'])
q(132, "Considera il codice seguente. Si può determinare a priori l'ordine delle tre operazioni L1, L2 e L3?",
  [('javascript', "x = 0                          // L1\nasynctask(x, (res) => {\n  x = x + res                  // L2\n});\nx = x + 1                      // L3"),
   "Sì: L1, L3, L2, sempre. L1, la chiamata ad `asynctask` e L3 appartengono allo stesso handler, che l'event loop esegue per intero; `asynctask` affida il lavoro a un thread in background e registra L2 come handler del completamento, eseguito in un ciclo successivo del loop. L2 potrebbe anche non essere mai eseguita, se il task fallisce o non termina."],
  ['c12#s3'])
q(133, "Rispetto alla domanda precedente, perché anche se il risultato è pronto prima di L3 l'handler non viene eseguito prima?",
  ["Perché non c'è preemption: il worker che ha finito può solo accodare l'evento di completamento, e l'event loop guarda la coda solo quando l'handler corrente è terminato. La callback la esegue l'event loop, non il worker: per questo non ci sono race su x, che viene scritta sempre dallo stesso thread."],
  ['c12#s3'])
q(134, "Appiattisci il codice precedente usando le promise.",
  [('javascript', "x = 0;                                   // L1\nconst p = asyncTask(x);                  // restituisce subito una promise pending\np.then((res) => { x = x + res; });       // L2: registrata, non eseguita\nx = x + 1;                               // L3"),
   "`asyncTask` non riceve più la callback: restituisce subito una promise, e `then` registra la reazione, che l'event loop eseguirà dopo il codice corrente. L'ordine resta L1, L3, L2: cambia la forma del codice, non il motore."],
  ['c12#s5'])
q(135, "Aggiungi il meccanismo di async e await.",
  [('javascript', "async function f() {\n  const res = await asyncTask(x);\n  x = x + res;               // L2\n}\nx = 0;                       // L1\nf();\nx = x + 1;                   // L3"),
   "`f()` parte subito, chiama `asyncTask(x)` con x = 0 e si sospende all'`await`, restituendo il controllo al chiamante, che esegue L3. L2 arriva quando la promise si risolve: l'ordine resta L1, L3, L2. `await` sospende la funzione, non il thread."],
  ['c12#s7'])
q(136, "Considera il codice seguente. Appiattiscilo con le promise.",
  [('javascript', "x = 0\nasynctask1(x, (res1) => {\n  asynctask2(x + res1, (res2) => {\n    console.log(res2);\n  });\n});\nx = x + 1"),
   "Con le promise:",
   ('javascript', "x = 0;\nasyncTask1(x)\n  .then((res1) => asyncTask2(x + res1))   // restituire la promise appiattisce\n  .then((res2) => console.log(res2));\nx = x + 1;"),
   "Il segreto è che `then` restituisce una nuova promise che segue l'esito del valore restituito dalla callback: la prima callback restituisce la promise di `asyncTask2`, il secondo `then` si aggancia a quella e l'annidamento sparisce. Nota che `x + res1` si valuta quando la callback viene eseguita, cioè dopo `x = x + 1`: in entrambe le versioni lì x vale già 1."],
  ['c12#s5'])
q(137, "Riesci a farlo anche con async e await?",
  [('javascript', "async function run() {\n  const res1 = await asyncTask1(x);\n  const res2 = await asyncTask2(x + res1);\n  console.log(res2);\n}\nx = 0;\nrun();\nx = x + 1;"),
   "`run()` parte subito e si sospende al primo `await`; il chiamante esegue `x = x + 1`. Quando le promise si risolvono l'event loop riprende `run`, e `x + res1` si valuta con x già a 1. È cambiata la forma del codice, non il motore."],
  ['c12#s7'])
q(138, "Nel codice seguente (con `var`) che cosa viene stampato?",
  [('javascript', "for (var i = 0; i < 3; i++) {\n  setTimeout(() => { console.log(i) }, 0)\n}"),
   "3, 3, 3. Le tre callback sono task eseguiti dopo la fine del `for`, e con `var` esiste un solo binding di i, condiviso dalle tre closure, che a quel punto vale 3."],
  ['c12#s6'])
q(139, "Nel codice seguente (con `let`) che cosa viene stampato?",
  [('javascript', "for (let i = 0; i < 3; i++) {\n  setTimeout(() => { console.log(i) }, 0)\n}"),
   "0, 1, 2. Le callback girano comunque dopo il `for`, ma `let` crea un binding nuovo a ogni iterazione e ogni closure cattura il proprio, che nessuno modifica più: la differenza la fanno le closure, non l'event loop."],
  ['c12#s6'])
q(140, "Che cos'è la pyramid of doom, o callback hell?",
  ["Comporre in sequenza operazioni asincrone con le callback significa annidarle: il codice cresce verso destra invece che verso il basso ed è difficile da leggere, riusare ed estendere. Insieme allo spaghetti asincrono forma il callback hell, che promise e async/await appiattiscono."],
  ['c12#s4'])
q(141, "A che cosa serve il metodo supplyAsync? Quando si può usare? Va bene con gli eventi?",
  ["`CompletableFuture.supplyAsync(supplier)` esegue il Supplier su un thread del `ForkJoinPool.commonPool()` (o dell'executor passato) e restituisce subito una `CompletableFuture` a cui attaccare callback, quindi va bene per lanciare calcoli o I/O su un pool di thread. In un framework a eventi non va usata come una promise: le callback non passano dall'event loop ma le esegue il thread che completa lo stadio precedente, e se toccano stato condiviso tornano le race."],
  ['c12#s5'])
q(142, "Che cosa si intende per callback?",
  ["Una funzione passata a un'operazione asincrona, di solito come ultimo argomento, da eseguire quando il risultato sarà pronto: un handler registrato per l'evento «operazione finita», cioè la continuazione del CPS. Di solito è una closure, quindi vede le variabili del contesto che l'ha creata."],
  ['c12#s3'])
q(143, "Che cosa significa CPS?",
  ["Continuation-passing style (Sussman e Steele, 1975): invece di restituire un valore, la funzione riceve come argomento in più una continuazione, il resto del calcolo, e la chiama con il risultato. In stile diretto `int sum(a, b)` restituisce a + b; in CPS `void sum(a, b, k)` chiama `k(a + b)`, e il chiamante passa ciò che vuole fare dopo.",
   "Poiché non si torna mai indietro lo stack non serve: il CPS è programmazione stackless. Nella programmazione asincrona la continuazione è la callback, e non la esegue il thread che ha svolto il lavoro: la esegue l'event loop quando arriva l'evento di completamento."],
  ['c12#s3'])
q(144, "Che cos'è una promise? Che cosa cambia rispetto a una future?",
  ["Una promise rappresenta il risultato non ancora disponibile di un'operazione asincrona e vive nel mondo a eventi: non ha una get bloccante e si configura con `then`, le cui callback esegue l'event loop, mentre la `Future` di Java vive nel mondo a thread e ci si blocca con `get()`. Alcune librerie dividono i due lati: in Vert.x `Promise` è il lato di chi produce (complete, fail) e `Future` quello in sola lettura del cliente."],
  ['c12#s5'])
q(145, "In che stato può trovarsi una promise?",
  ["Pending alla creazione, fulfilled (o resolved) se l'operazione termina bene, rejected se fallisce. Quando non è più pending si dice settled, e da quel momento stato e valore non cambiano più."],
  ['c12#s5'])
q(146, "Che cosa cambia tra task e microtask?",
  ["I task (I/O, timer, input dell'utente) si servono uno alla volta, ciascuno fino in fondo; i microtask, come le reazioni delle promise, vengono eseguiti tutti appena lo stack si svuota, prima del task successivo. Una catena infinita di microtask blocca quindi l'intera applicazione."],
  ['c12#s6'])
q(147, "Che cos'è una coroutine? Perché si usa? Quanti thread ci sono? È un meccanismo di alto o di basso livello?",
  ["Una generalizzazione della subroutine che si può sospendere e riprendere, cedendo il controllo (yield) a un'altra: multitasking cooperativo, con cui si costruiscono task cooperativi, iteratori, event loop e async/await. Molte coroutine possono stare su un solo thread, che ne esegue una alla volta senza context switch del sistema operativo; è un meccanismo di basso livello."],
  ['c12#s8'])
q(148, "Che cosa fa la parola chiave async in JavaScript? Quando si usa?",
  ["Marca una funzione come asincrona: è l'unico posto dove si può usare `await`, e la funzione restituisce sempre una promise. Chiamarla esegue subito il corpo, nello stesso ciclo, fino al primo `await`."],
  ['c12#s7'])
q(149, "Che cosa fa la parola chiave await in JavaScript? Quando si usa?",
  ["Si usa dentro una funzione `async`: `await p` sospende la funzione (non il thread) e restituisce il controllo al chiamante, e l'event loop la riprende quando p si risolve, con il valore della promise o con un'eccezione se è rigettata. Permette di scrivere codice asincrono in stile sincrono."],
  ['c12#s7'])
q(150, "Che cos'è una suspending function?",
  ["In Kotlin, una funzione marcata `suspend` che può sospendersi (per esempio in `delay`) senza bloccare il thread, che intanto esegue altre coroutine. Si chiama solo da un'altra funzione sospendibile o da un builder come `launch`, `async` o `runBlocking`."],
  ['c12#s8'])
q(164, "Come funziona Vert.x per quanto riguarda la programmazione asincrona?",
  ["Realizza il reactor con più event loop: ogni componente attivo è un verticle con il proprio event loop, l'unico che tocca i suoi campi, e tutte le API sono asincrone e restituiscono una `Future` di Vert.x, configurata con `onSuccess`, `onFailure` e `compose`. Il codice bloccante va in `executeBlocking`, e i verticle comunicano solo con l'event bus."],
  ['c12#s9'])

# ============================================================ Cap. 13
q(151, "Che cosa significa programmazione reattiva?",
  ["Un paradigma orientato ai flussi di dati e alla propagazione del cambiamento: si dichiarano le relazioni tra valori che variano nel tempo, e il linguaggio o la libreria aggiorna automaticamente tutto ciò che dipende da un valore quando questo cambia. Il programmatore dice che cosa fare, il sistema decide quando."],
  ['c13#s1'])
q(152, "Quali sono le astrazioni della programmazione reattiva?",
  ["Gli event stream, valori discreti nel tempo come i click del mouse, e i behaviour (o signal), valori continui che hanno un valore in ogni istante, come un timer o una temperatura. Sono valori di prima classe, che si passano ad altre funzioni e si compongono."],
  ['c13#s2'])
q(153, "Quali sono i problemi della programmazione asincrona?",
  ["L'inversione del controllo (il flusso lo decidono eventi in ordine imprevedibile), l'aggiornamento manuale di tutto ciò che dipende da un dato cambiato, la logica frammentata in tanti handler (spaghetti asincrono) e callback che agiscono solo per effetti collaterali; con le callback annidate si aggiunge la pyramid of doom. Promise e async/await ne risolvono una parte, la programmazione reattiva nasce per gli altri."],
  ['c13#s1', 'c12#s4'])
q(154, "Che cosa significano modello pull e modello push?",
  ["In pull chi ha bisogno di un valore lo chiede alla sorgente (demand-driven, naturale nei linguaggi lazy); in push la sorgente, quando ha un dato nuovo, lo spinge a chi ne dipende (data-driven, linguaggi eager). In entrambi i dati vanno dal produttore al consumatore: cambia chi prende l'iniziativa."],
  ['c13#s3'])
q(155, "Che cosa significa glitch?",
  ["Un'inconsistenza temporanea della propagazione push: un valore viene ricalcolato prima che siano aggiornate tutte le espressioni da cui dipende, combinando dati nuovi e vecchi, e mostra uno stato mai esistito. Si evita aggiornando i nodi del grafo delle dipendenze in ordine topologico; nei sistemi distribuiti è ancora un problema aperto."],
  ['c13#s3'])
q(156, "Che cosa cambia tra una variabile imperativa e una reattiva?",
  ["Dopo `x = 1; y = x + 1; x = 2`, in un linguaggio imperativo y vale 2: l'assegnamento dà un nome al valore di x + 1 in quel momento, e i cambiamenti successivi di x non lo toccano. In un linguaggio reattivo y vale 3: l'assegnamento dichiara una relazione, come l'uguale della matematica, e y deve valere x + 1 in ogni istante.",
   "La variabile reattiva è quindi un valore che varia nel tempo, un flusso: il sistema mantiene il grafo delle dipendenze e ricalcola y a ogni cambiamento di x."],
  ['c13#s1'])
q(157, "Che cosa significa lifting? Di che tipi può essere?",
  ["La conversione di una variabile o di una funzione normale in una reattiva, che registra la dipendenza nel grafo (come `liftB` nel timer di Flapjax). Può essere implicito (Bacon.js), esplicito (React.js) o entrambi (Flapjax, esplicito come libreria e implicito come compilatore)."],
  ['c13#s4'])
q(158, "Che cosa sono composability e readability nella programmazione reattiva?",
  ["La componibilità è saper orchestrare più task asincroni usando i risultati dei precedenti come input dei successivi; va di pari passo con la leggibilità, che con molti livelli di callback si perde. Le librerie reattive le ottengono con catene di operatori sui flussi."],
  ['c13#s5'])
q(159, "A che cosa serve l'operazione subscribe nella programmazione reattiva?",
  ["Costruire una catena di operatori è solo una configurazione, e nessun dato scorre: la `subscribe` lega un Publisher a un Subscriber, e la richiesta del Subscriber risale la catena fino alla sorgente e fa partire il flusso. L'eccezione sono i flussi hot, che emettono comunque."],
  ['c13#s5'])
q(160, "Che cos'è la backpressure? Come funziona e a che cosa serve?",
  ["Un controllo di flusso in cui il consumatore dice al produttore quanti elementi è pronto a ricevere (`request(n)`), trasformando il push in un ibrido push-pull; serve quando uno stadio è più lento del precedente e bloccare non si può. In RxJava c'è solo su `Flowable`, con strategie di buffer, scarto e campionamento."],
  ['c13#s9'])
q(161, "Che cosa cambia tra un flusso cold e uno hot?",
  ["Un flusso cold riparte da capo per ogni subscriber, che riceve tutti gli elementi, ed emette solo se qualcuno è sottoscritto (per esempio `range`, `fromIterable`). Un flusso hot emette al proprio ritmo anche senza subscriber, e chi arriva tardi riceve solo gli elementi successivi (sensori, eventi della GUI, dati dalla rete)."],
  ['c13#s8'])
q(162, "Che cos'è il pattern Observable?",
  ["Nel pattern Observer un subject tiene una lista di osservatori e li notifica con un push quando accade qualcosa. Rx lo estende («l'Observer fatto bene»): un Observable emette una sequenza di valori e ne segnala la fine o l'errore (`onNext`, `onCompleted`, `onError`), le sequenze si compongono con operatori e una sottoscrizione si può annullare."],
  ['c13#s5'])

# ============================================================ Prep 2 (asked)
q(163, "Che cosa avete usato della programmazione reattiva nell'assignment 2?",
  ["È una domanda sul proprio codice: si indicano classi e operatori della versione Rx. Da preparare: come i file diventano un flusso (una sorgente cold, `flatMap` per la ricorsione sulle sottodirectory, operatori di aggregazione per il conteggio e le bande), dove stanno `subscribeOn` e `observeOn`, se serve la backpressure (`Flowable` e quale strategia) e come funzionano stop e aggiornamenti live (`dispose`, `scan`).",
   "La scheda avverte che nel repository del corso la soluzione non c'è: rileggete la vostra prima dell'orale."],
  ['p2#s2', 'p2#s3', 'c13#s7'])
q(165, "Come avete strutturato la parte asincrona dell'assignment 2?",
  ["Si descrive la versione a event loop consegnata, con i punti che la scheda elenca: `getFSReport` restituisce subito una Future/Promise; nessuna chiamata bloccante sull'event loop (API asincrona del file system, oppure `executeBlocking`); come si capisce che la scansione ricorsiva è finita (Future dei figli composte ricorsivamente, o un contatore di operazioni pendenti gestito dal solo event loop).",
   "Va detto anche perché le statistiche non richiedono lock: tutte le callback girano sull'unico thread dell'event loop."],
  ['p2#s2', 'p2#s3', 'c12#s9'])
q(166, "Dove si vede l'uso delle promise nell'assignment 2?",
  ["Va indicato nel proprio codice: dove un metodo asincrono crea una `Promise`, restituisce subito la sua `future()` e la completa (`complete` o `fail`) a lavoro finito; dove le operazioni si concatenano con `compose` invece di annidare callback; dove `Future.all` aspetta i risultati delle sottodirectory.",
   "Bisogna saper spiegare che la catena resta piatta solo se la lambda di `compose` restituisce la nuova future: fare la chiamata dentro `onSuccess` riporta la piramide."],
  ['c12#s9', 'p2#s3'])

# ============================================================ Cap. 14
q(167, "Che cos'è un modello a scambio di messaggi?",
  ["Un modello in cui i processi non condividono memoria e interagiscono solo inviandosi messaggi su canali: si trasferiscono dati, mai il flusso di controllo. È il modello naturale del distribuito, usato sempre più anche su una sola macchina (Go, attori, Web Worker)."],
  ['c14#s1'])
q(168, "Quali sono le operazioni primitive del modello a scambio di messaggi?",
  ["`send ch(espressioni)` e `receive ch(variabili)` su un canale con un nome e un tipo di messaggio; l'accesso al canale è atomico, e i messaggi viaggiano per copia. Un canale con buffer è di fatto il bounded buffer del produttore-consumatore."],
  ['c14#s1'])
q(169, "Che cosa cambia tra un approccio sincrono e uno asincrono nello scambio di messaggi?",
  ["Nel sincrono il canale non ha buffer: la send si blocca finché il messaggio non è ricevuto e la receive finché qualcuno non invia, quindi il trasferimento è un punto d'incontro, un'azione atomica comune ai due processi. Nell'asincrono il canale ha una coda FIFO: la send ha successo appena il messaggio è accodato e si blocca solo la receive, a coda vuota.",
   "Il sincrono dà una sincronizzazione gratuita ma porta facilmente al deadlock; l'asincrono disaccoppia ed è la scelta di quasi tutti i sistemi moderni. La send sincrona aspetta la ricezione, non una risposta: quella è il rendez-vous."],
  ['c14#s2'])
q(170, "Un esempio di linguaggio che supporta nativamente lo scambio di messaggi sincrono?",
  ["Go: i canali creati senza buffer (`make(chan T)`) sono sincroni, e send e receive si aspettano a vicenda; con `make(chan T, k)` il canale ha invece un buffer di capacità k. Altri esempi sono Occam, derivato dal CSP di Hoare, e Ada con il rendez-vous."],
  ['c14#s2', 'c14#s8'])
q(171, "Quali schemi di comunicazione esistono?",
  ["Le slide ne elencano tre: one-to-one (un canale per coppia, tipico del sincrono), many-to-one (un ricevente e molti mittenti: porte e client-server) e many-to-many (competizione in ricezione e non determinismo). A lezione si aggiunge il one-to-many, in cui più riceventi competono e ogni messaggio va a uno solo."],
  ['c14#s3'])
q(172, "Che cos'è una guardia? Da quanti componenti è composta?",
  ["Nella comunicazione con guardia di Dijkstra, `B; C → S`, la guardia è la coppia di un'espressione booleana B sullo stato locale e di un'istruzione di comunicazione C, di solito una receive; S è il blocco da eseguire. Ha successo se B è vera e C può procedere, fallisce se B è falsa, si blocca se B è vera ma C deve aspettare."],
  ['c14#s5'])
q(173, "In che ordine vengono eseguite più guardie soddisfatte?",
  ["In nessun ordine: se più guardie hanno successo se ne sceglie una in modo non deterministico e si esegue solo quella, mentre gli altri messaggi restano nei loro canali. Nel costrutto `do … od` la selezione si ripete finché tutte le guardie falliscono."],
  ['c14#s5'])
q(174, "Che cosa significa peer-to-peer? Quali strutture si possono creare tra i nodi?",
  ["Responsabilità distribuite tra processi pari che si coordinano con un protocollo di messaggi, senza un server. Nello scambio dei valori le topologie sono tre: centralizzata (2(n − 1) messaggi, coordinatore collo di bottiglia), simmetrica (n(n − 1) messaggi, massima distribuzione) e ad anello (2n messaggi, concorrenza limitata)."],
  ['c14#s6'])
q(175, "Che cosa significa rendez-vous?",
  ["Una sincronizzazione estesa: il chiamante (call) aspetta non solo che l'accettante riceva la richiesta (accept), ma anche che esegua il servizio e restituisca il risultato. Ada lo offre nativamente con entry e accept; oggi l'idea sopravvive nelle chiamate di procedura remota e, in forma asincrona, nell'ask degli attori."],
  ['c14#s7'])

# ============================================================ Cap. 15
q(176, "Che cos'è il paradigma ad attori?",
  ["Un modello di concorrenza in cui tutto è un attore: un'entità con un indirizzo, una mailbox, uno stato privato e un comportamento, che non condivide memoria e interagisce solo con messaggi asincroni. Un attore agisce solo quando riceve un messaggio, e lo elabora per intero prima del successivo (macro-step): sul suo stato non ci sono race né lock, ma un handler non deve mai bloccarsi.",
   "Il modello è di Hewitt (1973), formulato da Agha (1986); nel corso si usa Apache Pekko, e ne sono esempi anche Erlang e ActorFoundry."],
  ['c15#s1'])
q(177, "Con chi può comunicare un attore?",
  ["Solo con gli attori di cui conosce l'indirizzo: quelli che ha creato, quelli che conosceva alla creazione e quelli ricevuti nei messaggi. Poiché gli indirizzi viaggiano nei messaggi, la topologia della comunicazione cambia a run time."],
  ['c15#s1'])
q(178, "Quali sono le primitive del modello ad attori?",
  ["Tre: **send**, l'invio asincrono di un messaggio, dopo il quale il mittente prosegue subito; **create**, che crea un nuovo attore con un comportamento iniziale; **become**, che fissa comportamento e stato per il prossimo messaggio.",
   "In Pekko typed sono `tell`, `ctx.spawn` e il `Behavior` restituito dall'handler; in Erlang `!`, `spawn` e la chiamata ricorsiva con il nuovo stato."],
  ['c15#s1'])
q(179, "Quali sono gli aspetti chiave del modello ad attori?",
  ["Cinque proprietà: reattività pura (lavora solo quando riceve un messaggio), incapsulamento dello stato, semantica a macro-step (un messaggio elaborato per intero prima del successivo), fairness (ogni messaggio prima o poi viene consegnato ed elaborato) e location transparency (per inviare basta l'indirizzo, locale o remoto)."],
  ['c15#s1'])
q(180, "Parla dell'event loop incapsulato e della receive implicita negli attori.",
  ["Dietro ogni attore c'è un ciclo che aspetta un messaggio, sceglie l'handler e lo esegue fino in fondo. In Pekko e ActorFoundry il ciclo sta nel framework, incapsulato nell'attore, e il programmatore scrive solo gli handler (receive implicita); in Erlang la `receive` la scrive il programmatore, ed è selettiva."],
  ['c15#s2'])
q(181, "Che framework avete usato nell'assignment 3? In che linguaggio avete fatto il primo punto?",
  ["Per il primo esercizio, il sistema d'allarme, Apache Pekko (il fork open source di Akka) con l'API typed, in Java come gli esempi del corso; il secondo esercizio, il torneo pari-e-dispari, si fa in Go con goroutine e canali."],
  ['c15#s3', 'p3#s1'])
q(183, "Un attore è un componente attivo o passivo?",
  ["Attivo: incapsula il proprio flusso di controllo e decide lui quando elaborare un messaggio, a differenza di un oggetto o di un monitor, pur restando puramente reattivo."],
  ['c15#s1'])
q(184, "Che cosa succede se in Akka un attore non può momentaneamente accettare un messaggio a causa del suo stato?",
  ["Lo mette da parte nello stash e lo reinserisce in mailbox con `unstashAll` quando cambia stato (`Behaviors.withStash`). In ActorFoundry lo stesso effetto si ottiene con i local synchronization constraints."],
  ['c15#s5'])
q(185, "Com'è strutturato internamente un attore?",
  ["Ha un indirizzo, una mailbox con i messaggi non ancora elaborati, uno stato privato e un comportamento; sotto c'è un event loop, esplicito o incapsulato nel framework, che estrae un messaggio ed esegue l'handler fino in fondo."],
  ['c15#s1', 'c15#s2'])
q(186, "Come si rende proattivo un attore?",
  ["Spezzando il lavoro in passi, ciascuno innescato da un messaggio che l'attore invia a se stesso, così tra un passo e l'altro gli altri messaggi (per esempio uno stop) possono essere elaborati. In Pekko, se il lavoro dipende dal tempo, si usano i timer di `Behaviors.withTimers`."],
  ['c15#s5', 'c16#s1'])

# ============================================================ Prep 3 (asked)
q(182, "Come avete strutturato gli attori e i messaggi nel primo punto dell'assignment 3?",
  ["Si risponde sul proprio codice: l'elenco degli attori e dei loro ruoli (tastierino, sensori, centralina, sirena), il protocollo dei messaggi come interfaccia sigillata di record immutabili, un `Behavior` per ciascuno dei cinque stati dell'allarme, i timer per exit ed entry delay (da cancellare se il PIN arriva prima), lo stash o lo scarto per i messaggi fuori stato.",
   "La scheda propone una topologia a stella con la centralina al centro, e avverte che nel repository il codice consegnato non c'è: va recuperato e riletto."],
  ['p3#s2', 'p3#s3', 'c16#s1'])
q(225, "Come avete strutturato ad alto livello l'assignment 3?",
  ["Due esercizi con due modelli di message passing: il sistema d'allarme ad attori in Pekko (asincrono: `tell` su mailbox, un messaggio alla volta) e il torneo pari-e-dispari in Go con goroutine e canali (sincrono sui canali senza buffer, solo message passing, nessuna memoria condivisa).",
   "Per il secondo la scheda propone una goroutine per giocatore, un arbitro per partita che riceve le due mosse, i canali dei vincitori come ingressi del round successivo e la terminazione senza busy-wait. La risposta va data sulla propria soluzione."],
  ['p3#s1', 'p3#s2'])

# ============================================================ Cap. 17
q(187, "In un sistema distribuito, quando un evento e1 è accaduto prima di un evento e2? Qual è la relazione che li lega?",
  ["La relazione happened-before di Lamport, e1 → e2, la più piccola che soddisfa tre regole: e1 ed e2 sono nello stesso processo ed e1 viene prima; e1 è l'invio di un messaggio ed e2 la ricezione di quello stesso messaggio; esiste un evento g con e1 → g e g → e2 (transitività). Se non vale né e1 → e2 né e2 → e1, gli eventi sono concorrenti.",
   "È un ordine parziale, non un tempo fisico. Non va confusa con la sua implementazione: gli orologi logici e vettoriali sono i meccanismi che la realizzano."],
  ['c17#s5'])
q(188, "Che cosa significa programmazione distribuita?",
  ["Scrivere un programma le cui parti girano su nodi diversi, ciascuno con la propria memoria, e interagiscono solo scambiandosi messaggi in rete. Ogni sistema distribuito è concorrente, e in più non ha memoria né clock condivisi e subisce guasti parziali."],
  ['c17#s1'])
q(189, "Quali sono i punti chiave della programmazione distribuita?",
  ["Le tre assenze: niente orologio condiviso (gli eventi di nodi diversi non si ordinano con il tempo fisico), niente memoria condivisa (nessuno conosce lo stato globale) e niente rilevamento accurato dei guasti (senza un limite ai ritardi un processo lento e uno caduto sono indistinguibili)."],
  ['c17#s2'])
q(190, "Che cos'è il teorema CAP?",
  ["Un sistema in rete che condivide dati non può garantire insieme consistenza (C), alta disponibilità (A) e tolleranza alle partizioni (P). Poiché le partizioni capitano, il contenuto reale è: durante una partizione si rinuncia a C oppure ad A, scegliendo anche operazione per operazione, mentre senza partizioni si possono avere entrambe."],
  ['c17#s3'])
q(191, "Che cos'è la latenza?",
  ["Il tempo che un messaggio impiega ad arrivare, o una richiesta a ricevere risposta. È legata a CAP: la scelta si presenta durante un timeout, quando bisogna annullare l'operazione (meno disponibilità) o procedere (rischio di inconsistenza)."],
  ['c17#s3'])
q(194, "Quali sono i modelli di ordinamento dei messaggi?",
  ["Per le esecuzioni ci sono tre modelli, dal più concreto al più astratto: interleaving (ordine totale tra tutti gli eventi), happened-before (ordine parziale, totale dentro ogni processo) e causalità potenziale (parziale anche dentro un processo). Per la consegna dei messaggi le garanzie sono FIFO, causale, totale e sincrona."],
  ['c17#s4', 'c18#s5'])
q(195, "Come funziona il modello happened-before?",
  ["Un'esecuzione è una coppia (E, →): l'insieme degli eventi e l'ordine parziale happened-before (n. 187), in cui gli eventi di ogni processo sono totalmente ordinati e e → f se nel diagramma c'è un cammino da e a f. È il modello adatto a catturare un'esecuzione reale, dove un ordine totale tra nodi diversi non si può osservare."],
  ['c17#s5', 'c17#s6'])
q(196, "Come funziona il modello di causalità potenziale?",
  ["Raffina happened-before: dentro un processo non tutti gli eventi sono in rapporto causale, quindi l'ordine locale è solo quello delle dipendenze potenziali (per esempio due ricezioni su porte diverse che aggiornano oggetti diversi). Un diagramma di causalità potenziale equivale all'insieme dei diagrammi happened-before consistenti con esso, ed è il modello adatto al debugging distribuito."],
  ['c17#s6'])
q(197, "Che cosa sono gli orologi logici?",
  ["Gli orologi di Lamport: ogni processo tiene un contatore, lo incrementa a ogni evento, lo allega ai messaggi e alla ricezione prende il massimo tra il proprio e quello ricevuto, più uno. Garantiscono che a → b implichi C(a) < C(b), ma non il contrario, quindi non riconoscono gli eventi concorrenti."],
  ['c17#s7'])
q(198, "Che cosa sono gli orologi vettoriali?",
  ["Ogni processo tiene un vettore di N contatori, con la propria componente per i propri eventi e le altre per ciò che sa degli altri; i vettori viaggiano nei messaggi e alla ricezione si prende il massimo componente per componente. Vale a → b se e solo se V(a) < V(b), quindi vettori incomparabili indicano eventi concorrenti; il limite è che N deve essere noto."],
  ['c17#s8'])

# ============================================================ Cap. 18
q(199, "Quali sono le sfide principali negli algoritmi distribuiti?",
  ["Le tre assenze: niente clock né memoria condivisi, e guasti. Si usano happened-before e orologi logici per ordinare gli eventi; quasi tutti gli algoritmi assumono un sistema asincrono senza guasti, e quando si gestiscono i guasti si assume un sistema sincrono per avere timeout affidabili."],
  ['c18#s1'])
q(200, "Come funziona l'algoritmo centralizzato per la sezione critica?",
  ["Un coordinatore custodisce un token: chi vuole entrare gli manda una richiesta, entra quando riceve il token e uscendo lo restituisce (tre messaggi), e se il token è fuori il coordinatore accoda la richiesta invece di rispondere «no». Per servire le richieste secondo happened-before ogni messaggio porta un vettore delle richieste note, e il coordinatore ritarda una richiesta finché quelle che la precedono causalmente non sono servite."],
  ['c18#s2'])
q(201, "Come si possono realizzare sezioni critiche con un approccio completamente decentralizzato?",
  ["Con l'algoritmo di Ricart–Agrawala. Chi vuole entrare invia a tutti gli altri una richiesta marcata (timestamp logico, id) ed entra dopo aver ricevuto N − 1 OK. Chi riceve una richiesta risponde subito OK, a meno che sia in sezione critica o stia a sua volta chiedendo con una coppia minore: in quei casi accoda il richiedente e gli manda l'OK all'uscita.",
   "Costa 2(N − 1) messaggi per ingresso e non richiede canali FIFO, ma ogni processo deve conoscere tutti gli altri e il guasto di uno blocca chi aspetta il suo OK. L'alternativa è l'algoritmo con un coordinatore che custodisce un token (n. 200)."],
  ['c18#s3'])
q(203, "Che cos'è un leader? Come si elegge?",
  ["Un processo scelto tra N per un compito particolare, per esempio fare da coordinatore di un algoritmo centralizzato. Poiché può cadere, serve un algoritmo che lo elegga e lo rielegga: di solito si sovrappone alla rete un anello logico, su cui lavora Chang–Roberts (n. 204)."],
  ['c18#s4'])
q(204, "Come funziona l'algoritmo di Chang–Roberts?",
  ["Su un anello ogni processo ha un id unico e vince il massimo: chi avvia invia `election(myid)` al vicino, chi riceve un id maggiore del proprio lo inoltra, uno minore lo sostituisce con il proprio se non ha ancora partecipato, altrimenti lo scarta. Chi riceve indietro il proprio id è il massimo, si proclama leader e fa girare `leader(myid)`."],
  ['c18#s4'])
q(205, "Quali meccanismi rendono sincrono un sistema distribuito?",
  ["I sincronizzatori, che simulano una rete sincrona sopra una asincrona assumendo assenza di guasti o un ritardo massimo noto. Ogni processo ha un contatore, il pulse, tale che i messaggi inviati al pulse i sono ricevuti al pulse i, e il sincronizzatore dice quando si può passare al successivo."],
  ['c18#s5'])
q(206, "Che cos'è un algoritmo di snapshot globale? A che cosa serve?",
  ["Un algoritmo che cattura uno stato globale consistente verificatosi nel passato: uno stato locale per processo più lo stato dei canali, tale che se contiene la ricezione di un messaggio ne contiene anche l'invio. Serve a rilevare deadlock e terminazione, a osservare predicati globali e a calcolare funzioni globali."],
  ['c18#s6'])
q(207, "Come funziona l'algoritmo di snapshot di Chandy–Lamport?",
  ["Su canali FIFO, chi avvia salva il proprio stato, diventa rosso e invia un marker su ogni canale in uscita, e un processo bianco che riceve un marker fa lo stesso; lo stato di un canale sono i messaggi ricevuti dopo essere diventati rossi e prima del marker su quel canale. Il FIFO garantisce che nessun processo bianco riceva un messaggio da uno rosso, quindi lo snapshot è consistente senza fermare nessuno."],
  ['c18#s6'])
q(208, "Che cos'è il problema del consenso?",
  ["Mettere d'accordo processi distribuiti su un valore: ognuno propone un valore e alla fine decide in modo irrevocabile. I requisiti sono terminazione (ogni processo corretto decide), accordo (tutti i corretti decidono lo stesso valore) e integrità (se tutti i corretti hanno proposto lo stesso valore, decidono quello)."],
  ['c18#s7'])
q(209, "Esistono algoritmi di consenso su reti asincrone?",
  ["No, se anche un solo processo può andare in crash: è il risultato FLP (Fischer, Lynch, Paterson, 1985), valido per ogni algoritmo deterministico, perché un processo caduto è indistinguibile da uno lento. Se ne esce cambiando le ipotesi: sincronia, algoritmi randomizzati o sincronia parziale (Paxos, Raft)."],
  ['c18#s7'])
q(210, "Esistono algoritmi di consenso su reti sincrone?",
  ["Sì: con al più f crash bastano f + 1 round in cui ognuno invia a tutti i valori che conosce e non ha ancora inviato, considerando caduto chi non si fa sentire entro il timeout, e alla fine tutti applicano la stessa funzione di decisione. Con processi bizantini serve di più (n. 211)."],
  ['c18#s8'])
q(211, "Che cos'è il Byzantine General Agreement?",
  ["Il consenso quando i processi guasti possono comportarsi in modo arbitrario, anche mentendo, raccontato da Lamport, Shostak e Pease (1982) come generali di cui alcuni traditori. Non si risolve se N ≤ 3f: servono almeno 3f + 1 processi, e l'algoritmo del re delle slide, con la soglia N/2 + f, ne richiede N > 4f."],
  ['c18#s9'])

# ============================================================ Cap. 19
q(47, "Perché introdurre i thread in un programma Java fa venir meno il principio «write once, run anywhere»?",
  ["Perché i thread Java poggiano su quelli del sistema operativo: scheduling, numero massimo di thread e memoria per lo stack dipendono dalla piattaforma. E l'interleaving cambia da una macchina all'altra, quindi una race condition mai vista su un computer può comparire su un altro: la correttezza non può dipendere dalla piattaforma su cui si è provato."],
  ['c19#s1', 'c10#s1'])
q(192, "Che cos'è un MOM (Message-Oriented Middleware)?",
  ["Un middleware che offre messaggistica: i client inviano e ricevono messaggi tramite code (point-to-point) o topic (publish/subscribe), con persistenza e garanzie di consegna. Rispetto all'RPC rende i messaggi espliciti, l'interazione asincrona e la comunicazione persistente, e disaccoppia i partecipanti; un esempio è RabbitMQ."],
  ['c19#s4'])
q(193, "Che cos'è un middleware?",
  ["Uno strato software tra il sistema operativo e le applicazioni distribuite, con vita propria, che offre servizi come la comunicazione, i nomi per trovare le risorse e la persistenza, così che le parti di un'applicazione interagiscano senza scendere a socket e protocolli. Esempi: RPC, Java RMI, CORBA, i MOM."],
  ['c19#s1'])
q(212, "Che cos'è un servizio distribuito?",
  ["Un componente software fornito attraverso un endpoint raggiungibile in rete: un provider lo offre, dei consumer lo usano scambiando messaggi secondo un contratto. È oggi l'approccio principale ai sistemi distribuiti su Internet."],
  ['c19#s5'])
q(213, "Che cos'è il contratto di un servizio e da quali elementi è composto?",
  ["Il contratto (API) è l'insieme di tutti i messaggi che il servizio supporta, esposto a un endpoint; nei big web service lo descrive un WSDL, con le operazioni astratte nel portType e il protocollo concreto nel binding. In una SOA REST si scompone in capability e poggia su un contratto uniforme di tre elementi: URI, metodi HTTP e media type."],
  ['c19#s5', 'c19#s6'])
q(214, "Che cosa si intende per discoverability?",
  ["La proprietà per cui la descrizione di un servizio può essere trovata e capita da persone e da altri servizi che potrebbero usarlo. È uno degli otto principi di progetto dei servizi."],
  ['c19#s5'])
q(215, "Che cosa significa SOA?",
  ["Service-Oriented Architecture: uno stile architetturale che scompone la logica di business in servizi più piccoli e autonomi, distribuiti logicamente e fisicamente, che interoperano grazie a contratti e standard condivisi. I suoi componenti sono servizio, contratto, endpoint, messaggio, policy e service consumer."],
  ['c19#s5'])
q(216, "Che cos'è SOAP?",
  ["Un linguaggio XML che definisce l'architettura e il formato dei messaggi dei web service: un Envelope con un Header estensibile (instradamento, qualità del servizio) e un Body con il contenuto. Il contratto invece non lo definisce SOAP ma WSDL."],
  ['c19#s6'])
q(217, "Che cosa sono i microservizi? E i big web service?",
  ["I microservizi sono uno stile in cui un'applicazione è una suite di piccoli servizi, ciascuno nel proprio processo, organizzati per capacità di business, con protocolli leggeri e deploy e dati indipendenti. I big web service standardizzano invece l'interoperabilità tra sistemi enterprise con uno stack pesante: XML, SOAP, WSDL e gli standard WS-*."],
  ['c19#s7', 'c19#s6'])
q(218, "Quali sono gli stili architetturali per i servizi?",
  ["Le slide ne confrontano quattro: a strati, esagonale (la logica al centro, porte e adattatori verso l'esterno), monolitico (un unico eseguibile) e a microservizi (un insieme di servizi, ciascuno con la propria architettura, tipicamente esagonale)."],
  ['c19#s7'])
q(219, "Pro e contro dei microservizi?",
  ["Pro: rilascio e scalabilità indipendenti, team autonomi per area di business, libertà di linguaggi e database, confini espliciti, guasti confinati al servizio. Contro: si progetta un sistema distribuito, con latenza su ogni interazione, comunicazione complessa, disponibilità ridotta dalle chiamate sincrone e dati da mantenere consistenti tra servizi."],
  ['c19#s7'])
q(220, "Che cos'è il cloud computing?",
  ["Un cambio di paradigma nell'erogazione dei servizi informatici: calcolo, dati e servizi si spostano off-premise, in un impianto centralizzato e trasparente rispetto alla posizione, e si pagano per l'uso. È una delle scelte principali per le applicazioni distribuite su larga scala."],
  ['c19#s8'])
q(221, "Che cosa significano CapEx e OpEx?",
  ["CapEx è la spesa in conto capitale, cioè comprare in anticipo l'infrastruttura per il picco di domanda; OpEx è la spesa operativa. Il cloud trasforma la prima nella seconda: si paga l'uso effettivo delle risorse, quindi i costi seguono gli incassi."],
  ['c19#s8'])
q(222, "Quali sono i modelli di servizio del cloud computing?",
  ["IaaS (infrastruttura di calcolo e memorizzazione, per esempio Amazon EC2), PaaS (una piattaforma per sviluppare applicazioni, per esempio Google App Engine) e SaaS (applicazioni pronte in rete, per esempio Salesforce); salendo, il fornitore gestisce sempre più livelli. A questi si aggiunge il FaaS (n. 223)."],
  ['c19#s8'])
q(223, "Che cos'è il FaaS?",
  ["Function as a Service: codice organizzato in funzioni attivate da eventi, eseguite dalla piattaforma senza server da gestire e con scalabilità automatica. Esempi: AWS Lambda, Google Cloud Functions."],
  ['c19#s8'])
q(224, "Che cos'è il serverless computing?",
  ["Il modello che generalizza il FaaS, con quattro caratteristiche: nessun server né sistema operativo da gestire, fatturazione per invocazione, scalabilità automatica, disponibilità e tolleranza ai guasti incorporate. Le funzioni sono effimere e senza stato: lo stato sta in un data store."],
  ['c19#s8'])

# ============================================================ Prep 4 (asked)
q(226, "Come avete usato RMI? Come vi siete trovati a ripensare il problema con RMI dopo gli attori?",
  ["Si descrive il proprio tris. Lo schema che la scheda propone: una lobby remota pubblicata sul registry per creare una partita o unirsi a una esistente per nome; un oggetto remoto partita progettato come monitor, perché il runtime RMI esegue le chiamate su più thread; listener remoti per notificare le mosse senza polling; `RemoteException` gestita come parte del contratto.",
   "Il confronto: con gli attori il flusso di controllo sta nell'attore, l'interazione è asincrona e la mailbox serializza i messaggi, quindi niente lock; con RMI si torna a oggetti passivi e chiamate sincrone, lo stato va protetto e le notifiche vanno costruite con callback remote. Il «come vi siete trovati» è personale: va detto con esempi dal proprio codice."],
  ['p4#s2', 'p4#s3', 'c19#s3'])
q(227, "In RMI è utile identificare componenti attivi e passivi. Quali sono i vostri?",
  ["Passivi: gli oggetti remoti, cioè lobby e partita sul server e i listener sul client. Non hanno un flusso di controllo proprio: i loro metodi li eseguono i thread del runtime RMI. Attivi: i client (il thread della UI o del main, che invoca e resta bloccato fino alla risposta) e, sul server, i thread del runtime RMI.",
   "Le conseguenze da dire: l'oggetto partita è condiviso tra più thread e va fatto monitor; la callback verso il client gira su un thread RMI del client, quindi l'aggiornamento della GUI passa alla EDT con `SwingUtilities.invokeLater`. La risposta finale va data sulle classi della propria soluzione."],
  ['p4#s3', 'c19#s3'])

q(202, "Come funziona l'algoritmo di Ricart–Agrawala?", None, [])

q(49, "Perché il numero di thread si sceglie di solito pari al numero di CPU più uno?",
  ["È la regola per i task CPU-bound: N_cpu processori raggiungono di solito l'utilizzo ottimo con N_cpu + 1 thread. Il thread in più serve perché anche un thread di solo calcolo ogni tanto si ferma, per esempio per un page fault, quando la pagina che gli serve non è in memoria e il sistema operativo lo sospende per caricarla: in quel momento il thread in più tiene occupato il core.",
   "Più thread di così aggiungono solo costi di cambio di contesto. Con 16 core, 17 thread; il numero si ricava a run time con `Runtime.getRuntime().availableProcessors()`, non si scrive nel codice."],
  ['c10#s8'])
q(50, "Se ci sono molte operazioni di I/O ha senso aumentare ancora il numero di thread? Cambia qualcosa?",
  ["Sì. Se i task si bloccano sull'I/O, in ogni istante una parte dei thread non può usare la CPU, quindi servono più thread dei core per tenerli occupati. La formula è `N_threads = N_cpu · U_cpu · (1 + W/C)`, con U_cpu l'utilizzo di CPU voluto e W/C il rapporto tra tempo di attesa e tempo di calcolo di un task: con 8 core, U_cpu = 1 e W/C = 3 servono 32 thread.",
   "Con W/C = 0 la formula torna a N_cpu, e il «+1» è il margine empirico del caso CPU-bound. In pratica il valore si conferma misurando l'utilizzo della CPU con pool di dimensioni diverse."],
  ['c10#s8'])
