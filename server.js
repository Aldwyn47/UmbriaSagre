/***MODULI***/
const express = require("express"); //modulo express (visto anche a lezione)
const pg = require("pg"); //modulo usato per accedere a postgresql da node.js
const crypto = require("crypto"); //questo modulo viene usato per generare numeri casuali (nello specifico il session number dei visitatori che hanno appena effettuato il log in)
const bcrypt = require("bcrypt"); //questo modulo viene usato per generare un hash a partire da ogni password (in modo da non doverle salvare in chiaro nel database)
const cookieParser = require("cookie-parser"); //questo modulo permette la lettura dei cookie dei visitatori
const rateLimit = require("express-rate-limit"); //questo modulo viene usato per introdurre un tetto massimo alle chiamate che possono arrivare da un singolo IP in un certo intervallo di tempo
const methodOverride = require("method-override"); //questo modulo permette di gestire richieste PUT, PATCH e DELETE inoltrate tramite i form (che a differenza delle chiamate AJAX normalmente supportano solo GET e POST)
const multer  = require('multer'); //modulo usato per salvare su disco le immagini JPG inviate dai client tramite form
const fs = require('fs'); //Modulo usato per cancellare le immagini JPG dal file system


/***COSTANTI PERSONALIZZABILI***/
const credentials = { //Credenziali usate per la connessione al database postgresql, devono corrispondere a quelle usate nello script databaseInitializer.js
    host: "localhost",
    database : "umbriasagre",
    user : "adminsagre",
    password : "password123",
    port : 8472
};
const limiter = rateLimit({ //Parametro legato al modulo "express-rate-limit"
    windowMs : 1000, //per ogni secondo..
    max : 15, //..un massimo di 15 chiamate
    standardHeaders : true,
    legacyHeaders : false
});
const storage = multer.diskStorage({ //Configurazione del diskStorage di Multer (questo modulo gestisce l'upload sul Server delle locandine inviate dagli organizzatori)
    destination: async function (req, file, callback) { //Scelta della cartella in cui salvare le locandine
        let check = await sessionCheck(req); //La funzione che sceglie la destinazione del salvataggio svolge anche alcuni controlli
        if (check!="organizzatore") //Se l'immagine è stata inviata da un visitatore che non ha la qualifica di "organizzatore", viene rifiutata
            callback(new Error(conditionSoloPerOrganizzatori), false);
        else{ //Se l'immagine è associata a un evento in cui nome, comune, datainizio e datafine corrispondono a quelli di un altro evento, l'invio non può essere accettato
            let queryObject = {
                text : "SELECT * FROM Eventi WHERE nomesagra = $1 AND comunesagra = $2 AND datainiziosagra = $3 AND datafinesagra = $4",
                values : [req.body.nomeSagra, req.body.comuneSagra, req.body.dataInizioSagra, req.body.dataFineSagra]
            }
            con.query(queryObject, function(err,resql){
                if (err){
                    callback(new Error(conditionErroreDatabase), false);
                }
                else if (resql.rows.length!=0){
                    callback(new Error(conditionEventoDuplicato), false);
                }
                else
                    callback(null, '.'+publicPath+directoryLocandine);
            });  
        }
    },
    filename: function (req, file, callback) { //Creazione del nuovo nome che verrà assegnato alla locandina nel file system del Server
        let nuovoNome = req.body.nomeSagra+req.body.comuneSagra+req.body.dataInizioSagra+req.body.dataFineSagra+".jpg";
        callback(null, nuovoNome); //Siccome due eventi non possono avere stesso nome, comune, datainizio e datafine questi quattro campi possono essere sfruttati per creare nomi univoci da dare alle locandine associate
    }
});
const upload = multer({
    storage: storage, //Lo "storage" indicato qui altro non è che il multer.diskStorage che è stato appena personalizzato
    limits: {
        fileSize : 450000 //Tetto massimo alla dimensione massima delle immagini
    },
    fileFilter: function (req, file, callback) { //Filtraggio delle estensioni accettate
        if (file.mimetype!='image/jpg' && file.mimetype!='image/jpeg')
            callback(new Error(conditionFormatoNonValido), false);
        else
            callback(null, true);
    }
});
const avvioUpload = upload.single('locandinaSagra'); //Ogni volta che verrà invocato "avvioUpload" il modulo Multer si attiverà (e saprà che deve lavorare su un singolo file allegato alla req, nello specifico quello contenuto nel parametro "locandinaSagra")
const path = "C:/Users/Aldwyn/Desktop/ProgettoImparato"; //Variabile globale che indica il path della directory in cui risiedono i file js e html della Web App
const publicPath = "/public/"; //Variabile globale che identifica la directory esposta all'esterno
const directoryLocandine = "locandine/"; //Variabile globale che identifica la directory in cui risiedono le locandine
const directoryAssets = "assets/"; //Variabile globale che identifica la directory in cui risiedono gli asset grafici
const ejsPath = "/private/"; //Variabile globale che identifica la directory in cui risiedono i file .ejs
const durataSessione = 1800000; //Variabile globale che indica la durata massima di una sessione (in millisec), impostata a 30 min
const durataMaxMessaggi = 5259600000; //Variabile globale che indica la durata massima della vita dei messaggi (in millisec), impostata a due mesi
const difficoltaNumeroSessione = 281474976710655; //Variabile globale che indica il range entro cui viene sorteggiato il numero intero che rappresenta una sessione
const intervalloPuliziaDatabase = 86400000; //Variabile globale che indica ogni quanto far partire la pulizia del database, impostata a 24 ore
const codeOk = 200; //Codici di stato e condizioni di errore
const codeCreated = 201;
const codeOkNoContent = 204;
const conditionSoloPerOrganizzatori = "Errore: La funzionalità che hai richiesto è riservata agli organizzatori di eventi.";
const conditionSoloPerUtenti = "Errore: La funzionalità che hai richiesto è riservata agli utenti comuni.";
const conditionFormatoNonValido = "Errore: Il formato dell'immagine scelta non è valido.";
const conditionImmagineTroppoGrande = "Errore: L'immagine scelta è troppo grande.";
const conditionSessioneNonValida = "Errore: La tua sessione è scaduta o non valida. Effettua di nuovo l'accesso.";
const conditionEventoDuplicato = "Errore: Esiste già in archivio un evento con lo stesso nome, luogo e data.";
const conditionErroreDatabase = "Si è verificato un errore imprevisto durante l'accesso al database.";
const conditionSessioneInesistente = "Errore: Non risulta attiva nessuna sessione.";
const conditionUsernameInesistente = "Errore: Non esiste nessun account il cui nome corrisponda a quello fornito.";
const conditionWrongPassword = "Errore: La password fornita non corrisponde.";
const conditionUsernamePreso = "Errore: Il nome utente che hai scelto non è valido in quanto già in uso.";
const conditionNonPossiediEvento = "Errore: Non risulta associato a te alcun evento con le caratteristiche indicate.";
const conditionNoIscritti = "Errore: All'evento non risulta iscritto alcun partecipante.";
const conditionGenericError = "Si è verificato un errore imprevisto.";


/***INIZIALIZZAZIONE***/
const con = new pg.Client(credentials); //Creazione della connessione al database
con.connect( function(err){
    if (err) throw (err);
    console.log("Connessione al database effettuata.");
    setInterval(puliziaDatabase, intervalloPuliziaDatabase); //La pulizia del database viene impostata per attivarsi a intervalli regolari
});
const app = express(); //Creazione del server


/***CARICAMENTO MIDDLEWARE***/
app.use(express.json()); //queste due linee rendono possibile il parsing delle richieste POST inviate tramite form e il conseguente accesso ai parametri allegati a esse
app.use(express.urlencoded({extended : true})); 
app.use(cookieParser()); //questa linea rende possibile il parsing dei cookie e il conseguente accesso a essi
app.use(limiter) //questa linea rende attivo il limite massimo di chiamate da uno stesso IP configurato in precedenza
app.use(publicPath, express.static('public')); //questa linea suggerisce alla Web App che deve garantire ai visitatori esterni l'accesso ai file contenuti nella directory /public (vi risiedono ad esempio il logo del sito e le locandine degli eventi)
app.use(methodOverride('_method')); //questa linea rende possibile interpretare correttamente le richieste PUT, PATCH e DELETE inviate tramite form (queste richieste vengono formulate in modo particolare e incapsulate all'interno di una richiesta POST)
app.set('view engine', 'ejs'); //questa linea rende possibile il rendering tramite ejs delle pagine Web da inviare ai client


/***DEFINIZIONE DELLE ROUTES***/
app.get("/", async function(req,res,next){
    let check = await sessionCheck(req);
    if (check=="invalid")
        gestioneErrori(conditionSessioneNonValida, res); //Se la sessione di un visitatore scade e diventa non valida, egli riceve una notifica
    else
        res.render(path+ejsPath+"index.ejs", { 
            status : check, 
            username : req.cookies.username,
            urlLogo : publicPath+directoryAssets
        } );
});

app.get("/eventi", async function(req,res){
    let check = await sessionCheck(req);
    if ( check!="utente" && check!="organizzatore" ) //Questa API viene resa disponibile solo a visitatori di tipo "utente" o "organizzatore"
        gestioneErrori(conditionSessioneNonValida, res);
    else{
        let queryClient;
        if ( check=="organizzatore" ) //Se il visitatore è di tipo "organizzatore", restituisce la lista di eventi in cui l'organizzatore risulta essere lui
            queryClient = "SELECT nomeSagra, comuneSagra, dataInizioSagra, dataFineSagra, locandinaSagra, organizzatoreSagra, numeroIscrittiSagra, idSagra FROM Eventi WHERE organizzatoreSagra = $1";
        else //Se il visitatore è di tipo "utente", restituisce tutti gli eventi tranne quelli a cui l'utente si è già iscritto
            queryClient = "SELECT nomeSagra, comuneSagra, dataInizioSagra, dataFineSagra, locandinaSagra, organizzatoreSagra, numeroIscrittiSagra, idSagra FROM Eventi EXCEPT (SELECT nomeSagra, comuneSagra, dataInizioSagra, dataFineSagra, locandinaSagra, organizzatoreSagra, numeroIscrittiSagra, idSagra FROM Iscrizioni NATURAL JOIN Eventi WHERE username = $1)";
        let queryObject = {
            text : queryClient,
            values : [req.cookies.username]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase,res);
            else {
                res.status(codeOk);
                res.end(JSON.stringify(resql.rows));
            }
        });
    }
});

app.get("/evento", async function(req,res){ 
    let check = await sessionCheck(req);
    if ( check!="utente" && check!="organizzatore" ) //Questa API viene resa disponibile solo a visitatori di tipo "utente" o "organizzatore"
        gestioneErrori(conditionSessioneNonValida, res);
    else{ //A differenza dell'API precedente questa restituisce al chiamante al più una singola tupla, ma completa di tutti i campi (incluso "descrizionSagra", che è quello potenzialmente più ingombrante)
        let queryObject = {
            text : "SELECT indirizzoSagra, descrizioneSagra FROM Eventi WHERE idSagra = $1",
            values : [req.query.idsagra]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase,res);
            else{
                res.status(codeOk);
                res.end(JSON.stringify(resql.rows));
            }
        });
    }
});

app.get("/comuni", function(req,res){
    con.query(`SELECT comune FROM Comuni`, function(err,resql){
        if (err)
            gestioneErrori(conditionErroreDatabase, res);
        else{
            res.status(codeOk);
            res.end(JSON.stringify(resql.rows));
        }
    });
});

app.get("/iscrizioni", async function(req,res){
    let check = await sessionCheck(req);
    if (check=="invalid")
        gestioneErrori(conditionSessioneNonValida, res);
    else if (check=="organizzatore"|| check=="unknown") //Questa API viene resa disponibile solo a visitatori di tipo "utente"
        gestioneErrori(conditionSoloPerUtenti, res);
    else{ //L'API restituisce tutti gli eventi a cui il visitatore risulta essere iscritto
        let queryObject = {
            text : "SELECT nomeSagra, comuneSagra, dataInizioSagra, dataFineSagra, numeroIscrittiSagra, locandinaSagra, organizzatoreSagra, idSagra FROM Iscrizioni NATURAL JOIN Eventi WHERE username = $1",
            values : [req.cookies.username]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase,res);
            else{
                res.status(codeOk);
                res.end(JSON.stringify(resql.rows));
            }
        });
    }
});

app.get("/messaggi", async function(req,res){
    let check = await sessionCheck(req);
    if ( check!="utente" && check!="organizzatore" ) //Questa API viene resa disponibile solo a visitatori di tipo "utente" o "organizzatore"
        gestioneErrori(conditionSessioneNonValida, res);
    else{ //L'API restituisce tutti i messaggi il cui destinatario risulta essere il visitatore, ordinati sulla base della data di creazione e del se sono stati già letti almeno una volta
        let queryObject = {
            text : "SELECT * FROM Messaggi WHERE destinatarioMessaggio = $1 ORDER BY dataMessaggio DESC, isNuovoMessaggio DESC",
            values : [req.cookies.username]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase,res);
            else{
                res.status(codeOk);
                res.end(JSON.stringify(resql.rows));
            }
        });
    }
});

app.get("/messaggio", async function (req,res){
    let check = await sessionCheck(req);
    if ( check!="utente" && check!="organizzatore" ) //Questa API viene resa disponibile solo a visitatori di tipo "utente" o "organizzatore"
        gestioneErrori(conditionSessioneNonValida, res);
    else{ //A differenza dell'API precedente, questa restituisce al più una singola tupla, completa però di tutti i campi (incluso "contenutoMessaggio" che è quello potenzialmente più ingombrante)
        let queryObject = {
            text : "SELECT * FROM Messaggi WHERE destinatarioMessaggio = $1 AND idMessaggio = $2",
            values : [req.cookies.username, req.query.idmessaggio]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase,res);
            else{ //Quando un visitatore scarica le informazioni relative a un messaggio per leggerlo il sistema aggiorna anche la tupla corrispondente per segnalare che il messaggio è stato letto almeno una volta
                let queryObject2 = {
                    text : "UPDATE Messaggi SET isNuovoMessaggio = 'no' WHERE destinatarioMessaggio = $1 AND idMessaggio = $2",
                    values : [req.cookies.username, req.query.idmessaggio]
                }
                con.query(queryObject2, function(err,resql2){
                    if (err)
                        gestioneErrori(conditionErroreDatabase,res);
                    else{
                        res.status(codeOk);
                        res.end(JSON.stringify(resql.rows));
                    }
                });
            }
        });
    }
});

app.get("/isUsernamePreso", function(req,res){ //Questa API esegue un controllo nel database per verificare se un nome utente risulta già in uso
    let queryObject = {
        text : "SELECT * FROM Utenti WHERE username = $1",
        values : [req.query.nome]
    }
    con.query(queryObject, function(err,resql){
        if (err)
            gestioneErrori(conditionErroreDatabase, res);
        else{
            res.status(codeOk);
            let r = {result : true};
            if (resql.rows.length==0)
                r.result = false;
            res.end(JSON.stringify(r));            
        }
    });
});

app.get("/isNuoviMessaggi", async function(req,res){
    let check = await sessionCheck(req);
    if ( check!="utente" && check!="organizzatore" ) //Questa API viene resa disponibile solo a visitatori di tipo "utente" o "organizzatore"
        gestioneErrori(conditionSessioneNonValida, res);
    else{ //L'API esegue un controllo nel database per far sapere al visitatore se risultano presenti messaggi non letti il cui destinatario è lui
        let queryObject = {
            text : "SELECT * FROM Messaggi WHERE destinatarioMessaggio = $1 AND isNuovoMessaggio = 'si'",
            values : [req.cookies.username]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase,res);
            else{
                res.status(codeOk);
                let r = {result : true};
                if (resql.rows.length==0)
                    r.result = false;
                res.end(JSON.stringify(r)); 
            }
        });
    }
});

app.post("/utente", function(req,res){ //Questa API si usa per registrare nella base di dati delle nuove credenziali di accesso
    let queryObject = {
        text : "SELECT * FROM Utenti WHERE username = $1",
        values : [req.body.username]
    }
    con.query(queryObject, function(err,resql){
        if (err)
            gestioneErrori(conditionErroreDatabase,res);
        else if (resql.rows.length==0){ //La registrazione ha luogo solo se nella base di dati non risulta già presente un altro profilo che usa lo stesso username
            bcrypt.hash(req.body.password, 10, function(err,hashedP){ //Onde evitare di salvare la password scelta in chiaro viene prima invocata la funzione bcrypt.hash con livello di difficoltà 10
                let organizzatore = false;
                if (req.body.qualificaOrganizzatore=="si")
                    organizzatore = true;
                let queryObject2 = {
                    text : "INSERT INTO Utenti VALUES ($1, $2, $3)",
                    values : [req.body.username, hashedP, organizzatore]
                }
                con.query(queryObject2, function(err,resql2){
                    if (err)
                        gestioneErrori(conditionErroreDatabase,res);
                     else{ 
                         res.status(codeCreated);
                         res.render(path+ejsPath+"bouncer.ejs", {message:"Iscrizione completata con successo."}); 
                     }           
                });
            });

        }
        else
            gestioneErrori(conditionUsernamePreso,res); //Se lo username scelto è già in uso viene restituito un messaggio di errore
    });
});

app.post("/evento", function(req,res){ //Questa API si usa per registrare nella base di dati un nuovo evento
    avvioUpload(req,res,async function(err){ //In virtù del particolare funzionamento del modulo Multer, il caricamento dell'immagine è la prima cosa che deve avere luogo
        if (err){ //Questo significa anche che una parte dei controlli li deve eseguire lo stesso Multer. Se multer innesca un errore, l'API restituisce a sua volta un errore al visitatore
            if ((err.toString()).substring(13)=="File too large"){
                res.status(400); //Bad request
                res.render(path+ejsPath+"bouncer.ejs", { message : conditionImmagineTroppoGrande});
            }
            else{
                message = err.toString().substring(7);
                gestioneErrori(message, res);
            }
        }
        else{
            let check = await sessionCheck(req);
            if (check=="invalid")
                gestioneErrori(conditionSessioneNonValida, res); //Il caricamento di un nuovo evento è una funzionalità riservata ai soli organizzatori
            else if (check=="utente"||check=="unknown")
                gestioneErrori(conditionSoloPerOrganizzatori, res);
            else{
                let queryObject = {
                    text : "SELECT * FROM Eventi WHERE nomesagra = $1 AND comunesagra = $2 AND datainiziosagra = $3 AND datafinesagra = $4",
                    values : [req.body.nomeSagra, req.body.comuneSagra, req.body.dataInizioSagra, req.body.dataFineSagra]
                }
                con.query(queryObject, function(err,resql){
                    if (err){
                        gestioneErrori(conditionErroreDatabase, res);
                    }
                    else if (resql.rows.length!=0){ //Un nuovo evento può essere caricato solo se non costituisce il duplicato di un altro evento (ovvero coincide in nome, comune, datainizio e datafine). Sto qui implicando che i quattro campi in questione sono una superchiave della tabella "Eventi", e il controllo deve necessariamente far riferimento ad essi perché la chiave primaria è di tipo seriale e quindi non esiste prima dell'effettivo inserimento della nuova tupla.
                        gestioneErrori(conditionEventoDuplicato,res);
                    }
                    else{
                        let locandinaExists = false;
                        if (req.body.locandinaEsiste=="si")
                            locandinaExists = true;
                        let queryObject2 = {
                            text : "INSERT INTO Eventi (nomeSagra, comuneSagra, dataInizioSagra, dataFineSagra, indirizzoSagra, descrizioneSagra, locandinaSagra, organizzatoreSagra, numeroIscrittiSagra) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'0')",
                            values : [req.body.nomeSagra, req.body.comuneSagra, req.body.dataInizioSagra, req.body.dataFineSagra, req.body.indirizzoSagra, req.body.descrizioneSagra, locandinaExists, req.cookies.username]
                        }
                        con.query(queryObject2, function(err,resql){
                                if(err){
                                    gestioneErrori(conditionErroreDatabase,res);
                                }
                                else{
                                    res.status(codeCreated); //Created
                                    res.render(path+ejsPath+"bouncer.ejs", { message : "Evento creato con successo." } ); 
                                }
                        });
                    }
                });
            }
        }
    });
});

app.post("/iscrizione", async function(req,res){
    let check = await sessionCheck(req);
    if (check=="invalid")
        gestioneErrori(conditionSessioneNonValida, res);
    else if (check=="unknown"||check=="organizzatore") //Questa API viene resa disponibile solo a visitatori di tipo "utente"
        gestioneErrori(conditionSoloPerUtenti, res);
    else{ //L'API registra nella base di dati una nuova tupla che rappresenta l'iscrizione del visitatore a un evento
        let queryObject = {
            text : "INSERT INTO Iscrizioni VALUES($1,$2)",
            values : [req.cookies.username, req.body.idsagra]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase,res);
            else{
                res.status(codeCreated);
                res.end();
            }
        });
    }
});

app.post("/messaggio", async function(req,res){
    let check = await sessionCheck(req);
    if ( check!="utente" && check!="organizzatore" ) //Questa API viene resa disponibile solo a visitatori di tipo "utente" o "organizzatore"
        gestioneErrori(conditionSessioneNonValida, res);
    else{ //L'API registra nella base di dati il messaggio inviato dal visitatore. Il destinatario potrà in seguito recuperarlo invocando il "GET" corrispondente
        let data = (new Date()).toISOString().substring(0,10); //Al momento dell'inserimento il Server rileva la data corrente (in formato YYYY-MM-DD) e la registra come data di creazione del messaggio
        let expiration = Date.now() + durataMaxMessaggi; //Al messaggio viene anche allegata la sua data di scadenza, trascorsa la quale verrà distrutto dalla puliziaDatabase: essa viene impostata prendendo la data corrente (in millisecondi) e sommando la costante che rappresenta la durata massima della vita dei messaggi.
        let queryObject = {
            text : "INSERT INTO Messaggi (mittenteMessaggio,destinatarioMessaggio,dataMessaggio,expirationMessaggio,titoloMessaggio,contenutoMessaggio,isNuovoMessaggio) VALUES($1,$2,$3,$4,$5,$6,'si')",
            values : [req.cookies.username, req.body.destinatarioMessaggio, data, expiration, req.body.titoloMessaggio, req.body.contenutoMessaggio]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase,res);
            else{
                res.status(codeCreated);
                res.render(path+ejsPath+"bouncer.ejs", { message : "Messaggio inviato con successo." } );
            }
        });
    }
});

app.post("/broadcast", async function(req,res){
    let check = await sessionCheck(req);
    if (check=="invalid")
        gestioneErrori(conditionSessioneNonValida, res);
    if ( check=="utente" || check=="unknown") //Questa API viene resa disponibile solo a visitatori di tipo "organizzatore"
        gestioneErrori(conditionSoloPerOrganizzatori, res); 
    else{ //Per prima cosa l'API estrae dal database la lista di Utenti iscritti all'Evento specificato dal chiamante
        let queryObject = {
            text : "SELECT username FROM Iscrizioni WHERE idSagra = $1",
            values: [req.body.destinatarioMessaggio]
        }
        con.query(queryObject, async function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase,res);
            else{
                if (resql.rows.length!=0){ //Se risultano iscritti uno o più utenti l'API procede a registrare nella base di dati lo stesso messaggio più volte, con ognuno di essi come destinatario 
                    let data = (new Date()).toISOString().substring(0,10); //Viene per prima cosa calcolata la data di creazione del messaggio
                    let expiration = Date.now() + durataMaxMessaggi; //Viene poi calcolata la data di scadenza del messaggio, trascorsa la quale verrà distrutto da puliziaDatabase
                    let queryUtente = "INSERT INTO Messaggi (mittenteMessaggio,destinatarioMessaggio,dataMessaggio,expirationMessaggio,titoloMessaggio,contenutoMessaggio,isNuovoMessaggio) VALUES ";
                    let valoriDaInserire = [req.cookies.username, data, expiration, req.body.titoloMessaggio, req.body.contenutoMessaggio];
                    let count = 5;
                    for (el of resql.rows){ //La query che regola l'inserimento viene creata scrivendo una nuova tupla di dati da inserire per ogni utente che risulta iscritto all'evento
                        count++;
                        valoriDaInserire.push(el.username);
                        queryUtente = queryUtente + "($1, $"+count+", $2, $3, $4, $5, 'si'),";
                    }
                    queryUtente = queryUtente.slice(0,-1); //Il pattern che viene reiterato più volte termina con una virgola, ma la query finale non deve avere nessuna virgola alla fine. Per questo motivo, l'ultima virgola viene tagliata con la funzione slice.
                    let queryObject2 = {
                        text : queryUtente,
                        values : valoriDaInserire
                    }
                    con.query(queryObject2, function(err,resql2){
                        if (err)
                            gestioneErrori(conditionErroreDatabase,res);
                        else{
                            res.status(codeCreated);
                            res.render(path+ejsPath+"bouncer.ejs", { message : "Il messaggio è stato recapitato con successo a tutti gli iscritti." } );
                        }
                    });
                }
                else{
                    gestioneErrori(conditionNoIscritti,res); //Se non risulta iscritto alcun utente viene restituito un messaggio di errore
                }
            }
        });
    }
});

app.put("/utente",function(req,res){ //Questa API viene invocata dai visitatori per eseguire il log-in
    let queryObject = {
        text : "SELECT * FROM Utenti WHERE username = $1",
        values : [req.body.username]
    }
    con.query(queryObject, function(err,resql){
        if (err)
            gestioneErrori(conditionErroreDatabase, res);
        else if (resql.rows.length==0)
            gestioneErrori(conditionUsernameInesistente, res);
        else { //Se lo username specificato esiste, si procede a controllare la password fornita
            bcrypt.compare(req.body.password, resql.rows[0].password, function(err,result){ //Il controllo fa uso della funzione bcrypt.compare, che esegue l'hashing della password fornita dall'utente e controlla che corrisponda effettivamente al valore salvato nel database
                if (!result)
                    gestioneErrori(conditionWrongPassword, res);
                else{ //Se le password corrispondono, il log-in ha successo
                    let sessionNumber = crypto.randomInt(1,difficoltaNumeroSessione); //Se il log-in ha successo, viene sorteggiato un numero di sessione casuale che rappresenta la sessione iniziata dall'utente
                    let sessionExpiration = Date.now() + durataSessione; //Viene anche creata una data di scadenza della sessione, trascorsa la quale il visitatore dovrà eseguire di nuovo il log-in. Essa viene generata partendo dalla data attuale (in millisec) e sommando la costante che rappresenta la durata di vita massima di una sessione.
                    let queryObject2 = {
                        text : "UPDATE Utenti SET sessionExpiration = $1, sessionNumber = $2 WHERE username = $3",
                        values : [sessionExpiration, sessionNumber, req.body.username] 
                    }
                    con.query(queryObject2, function(err,resql){
                        if (err)
                            gestioneErrori(conditionErroreDatabase,res);
                        else{ //Nella tupla associata al profilo del visitatore vengono salvati sia il numero di sessione che la sua data di scadenza. Al visitatore vengono invece restituiti due cookie (che verranno controllati durante le sue successive visite).
                            res.cookie('username',req.body.username,{ //Il primo contiene lo username con cui ha appena effettuato l'accesso
                                secure : true, //il cookie può essere trasferito solo tramite https
                                httpOnly : true, //il cookie non è accessibile tramite javascript
                                sameSite : "strict" //il browser fornisce il cookie solo se la richiesta viene dallo stesso sito che lo ha generato
                            });
                            res.cookie('sessionNumber',sessionNumber,{ //Il secondo contiene il numero di sessione che rappresenta la sessione che ha appena creato con il suo accesso.
                                secure : true, 
                                httpOnly : true, 
                                sameSite : "strict"
                            });
                            res.status(codeOk);
                            res.render(path+ejsPath+"bouncer.ejs", {message:"Login effettuato con successo."}); 
                        }
                
                    });
                }
            });
        }
    });
});
            
app.delete("/evento", async function (req,res){
    let check = await sessionCheck(req);
    if (check=="invalid")
        gestioneErrori(conditionSessioneNonValida, res);
    if (check=="utente"||check=="unknown")
        gestioneErrori(conditionSoloPerOrganizzatori, res); //Questa API viene resa disponibile solo a visitatori di tipo "organizzatore"
    else{
        let queryObject = {
            text : "SELECT * FROM Eventi WHERE idSagra = $1 AND organizzatoreSagra = $2",
            values : [req.body.idsagra, req.cookies.username]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase, res);
            else if (resql.rows.length==0) //L'API si fa carico di eliminare dal database la tupla associata all'Evento che il chiamante vuole eliminare. Essa agirà solo se il chiamante figura effettivamente come organizzatore dell'Evento che vuole eliminare.
                gestioneErrori(conditionNonPossiediEvento, res);
            else{
                let j = JSON.parse(JSON.stringify(resql.rows[0])); //Questa doppia conversione è necessaria per rendere le date estratte dal database compatibili con la funzione che procede a riportarle nel formato YYYY-MM-DD
                let locandina = path+publicPath+directoryLocandine+j.nomesagra+j.comunesagra+convertiData(j.datainiziosagra)+convertiData(j.datafinesagra)+".jpg";
                if (fs.existsSync(locandina)) //Anche la locandina associata viene eliminata (se esiste)
                    fs.unlinkSync(locandina);
                let queryObject2 = {
                    text : "DELETE FROM Eventi WHERE organizzatoreSagra = $1 AND idSagra = $2",
                    values : [req.cookies.username, req.body.idsagra]
                }
                con.query(queryObject2, function(err,resql){
                    if (err)
                        gestionErrori(conditionErroreDatabase, res);
                    else{
                        res.status(codeOk);
                        res.render(path+ejsPath+"bouncer.ejs", { message : "Evento cancellato con successo."});
                    }
                });
            }
        });
    } 
});          

app.delete("/iscrizione", async function (req,res){ 
    let check = await sessionCheck(req);
    if (check=="invalid")
        gestioneErrori(conditionSessioneNonValida, res); 
    else if (check=="organizzatore"||check=="unknown") //Questa API viene resa disponibile solo a visitatori di tipo "utente"
        gestioneErrori(conditionSoloPerUtenti, res);
    else{ //L'API si fa carico di eliminare dal database la tupla che rappresenta l'iscrizione dell'Utente a un determinato Evento
        let queryObject = {
            text : "DELETE FROM Iscrizioni WHERE idSagra = $1 AND username = $2",
            values : [req.body.idsagra, req.cookies.username]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase, res);
            else{
                res.status(codeOkNoContent);
                res.end();
            }
        });
    } 
});

app.delete("/messaggio", async function (req,res){ 
    let check = await sessionCheck(req);
    if ( check!="utente" && check!="organizzatore" )
        gestioneErrori(conditionSessioneNonValida, res); //Questa API viene resa disponibile solo a visitatori di tipo "utente" o "organizzatore"
    else{ //L'API si fa carico di eliminare dal database la tupla che rappresenta il messaggio che il visitatore ha chiesto di eliminare. L'eliminazione ha luogo solo se il visitatore figura effettivamente come destinatario.
        let queryObject = {
            text : "DELETE FROM Messaggi WHERE destinatarioMessaggio = $1 AND idMessaggio = $2",
            values : [req.cookies.username, req.body.idmessaggio]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase, res);
            else{
                res.status(codeOkNoContent);
                res.end();
            }
        });
    } 
}); 
        
app.delete("/sessione", function(req,res){ //Questa API permette ai visitatori di eseguire il log-out, eliminando la loro sessione attiva e riportando la tupla associata al loro profilo al suo stato originale
    if (typeof(req.cookies.username)!="string")
        gestioneErrori(conditionSessioneInesistente, res);
    else{
        let queryObject = {
            text : "SELECT * FROM Utenti WHERE username = $1 AND sessionNumber = $2",
            values : [req.cookies.username, req.cookies.sessionNumber]
        }
        con.query(queryObject, function(err,resql){
            if (err)
                gestioneErrori(conditionErroreDatabase,res);
            else if (resql.rows.length==0) //L'API agisce solo se le informazioni contenute nei cookie del visitatore corrispondono effettivamente a una sessione attiva
                gestioneErrori(conditionSessioneInesistente, res);
            else{ //La sessione viene eliminata riportando a 0 il numero di sessione e la sua scadenza
                let queryObject2 = {
                    text : "UPDATE Utenti SET sessionNumber = 0 , sessionExpiration = 0 WHERE username = $1 AND sessionNumber = $2",
                    values : [req.cookies.username, req.cookies.sessionNumber]
                }
                con.query(queryObject2, function(err,resql2){
                                if (err)
                                    gestioneErrori(conditionErroreDatabase, res);
                                else { 
                                    res.status(codeOk) //OK
                                    res.clearCookie("username"); //In caso di successo vengono anche eliminati i cookie del visitatore
                                    res.clearCookie("sessionNumber");
                                    res.render(path+ejsPath+"bouncer.ejs", { message : "Disconnessione effettuata con successo."});
                                }
                });
            }
        });
    }
});

app.use(function(req,res,next){
    res.status(404); //Not found
    res.end();
});

/***AVVIO DEL SERVER***/
app.listen(80, function(){
    console.log("Server in ascolto sulla porta 80.");
});

app.listen(443,function(){
    console.log("Server in ascolto sulla porta 443.");
});



/***FUNZIONI DI SUPPORTO***/
async function sessionCheck(req){ //Questa funzione si fa carico di confrontare i cookie di un visitatore con le informazioni sulle sessioni attive che risiedono nel database
    if ((typeof(req.cookies.username))!="string"){ //I visitatori che hanno effettuato correttamente il log-in hanno tutti un cookie di nome "username" impostato. Se il cookie non è impostato, il visitatore viene classificato come "sconosciuto" che deve eseguire il log-in o la registrazione. 
        return "unknown";
    }
    else { //Se il cookie "username" è presente, si cerca una tupla tra i profili registrati il cui username corrisponda a quello del cookie
        let queryObject = {
            text : "SELECT username, sessionNumber, sessionExpiration, qualificaOrganizzatore FROM Utenti WHERE username = $1",
            values : [req.cookies.username]
        }
        let resql = await con.query(queryObject);
            if (resql.rows.length==0) //Se non viene trovata alcuna tupla, il visitatore ha evidentemente manomesso il cookie assegnando come valore uno username inventato che non esiste: il suo status viene identificato come "non valido"
                return "invalid";
            else if (resql.rows[0].sessionnumber!=req.cookies.sessionNumber || resql.rows[0].sessionnumber==0) //Se viene trovata la tupla corrispondente, si controlla il numero di sessione: se esso non corrisponde o nella tupla è impostato a 0 (ovvero non risulta attiva alcuna sessione), lo status del visitatore è "non valido"
                return "invalid";
            else if ( (Date.now() - resql.rows[0].sessionexpiration) > 0 ) //Se username e numero di sessione corrispondono ma la data attuale ha superato la data di scadenza della sessione, il visitatore sta evidentemente cercando di ripristinare una vecchia sessione ormai scaduta: per motivi di sicurezza il suo status è "non valido"
                return "invalid";
            else if (resql.rows[0].qualificaorganizzatore) //Se username e numero di sessione corrispondono e la sessione non è scaduta il visitatore ha superato il controllo. Resta solo da stabilire se è un utente semplice o un organizzatore.
                return "organizzatore";
            else
                return "utente";
    }
}

function gestioneErrori(err,res){ //Questa funzione si fa carico di allegare a ogni condizione di errore personalizzata uno status HTTP specifico prima di inviare la risposta al Client
    switch(err){
        case conditionSessioneNonValida : //La condizione di "sessione non valida" viene associata agli utenti la cui sessione è scaduta o il cui status presenta delle anomalie a livello di cookie (ad esempio username inesistenti).
            res.clearCookie("username"); //Si esegue pertanto un reset dei suoi cookie in modo da obbligarlo ad effettuare nuovamente il log-in
            res.clearCookie("sessionNumber");
            res.status(440); //Session expired
            break;
        case conditionSessioneInesistente :
            res.clearCookie("username");
            res.clearCookie("sessionNumber");
            res.status(400); //Bad request
            break;
        case conditionErroreDatabase :
            res.status(500); //Internal server error
            break;
        case conditionEventoDuplicato :
            res.status(400); //Bad request
            break;
        case conditionSoloPerOrganizzatori :
            res.status(401); //Unauthorized
            break;
        case conditionSoloPerUtenti :
            res.status(401); //Unauthorized
            break;
        case conditionFormatoNonValido :
            res.status(400); //Bad request
            break;
        case conditionUsernameInesistente :
            res.status(401); //Unauthorized
            break;
        case conditionWrongPassword :
            res.status(401); //Unauthorized
            break;
        case conditionUsernamePreso :
            res.status(400); //Bad request
            break;
        case conditionGenericError :
            res.status(500); //Internal server error
            break;
        case conditionNonPossiediEvento:
            res.status(401); //Unauthorized
            break;
        case conditionNoIscritti:
            res.status(400); //Bad request
            break;
        default :
            res.status(500); //Internal server error
    }
    res.render(path+ejsPath+"bouncer.ejs", { message : err });
}

function puliziaDatabase(){ //Questa funzione si fa carico di eliminare dal database tutte le tuple che sono associate a messaggi o eventi troppo vecchi. Il suo scopo è liberare automaticamente spazio nel database se gli utenti si dimenticano di cancellare manualmente i record in questione.
    let sogliaScadenzaMessaggi = Date.now();
    con.query( `DELETE FROM Messaggi WHERE expirationMessaggio < '${sogliaScadenzaMessaggi}'`, function(err,resql){ //Vengono cancellati i messaggi la cui data di scadenza è passata
        let millisec = new Date();
        let data = new Date( millisec.getTime() - ( 7 * 60 * 60 * 24 * 1000 ) ); //Sottrazione di una settimana
        let sogliaScadenzaEventi = data.toISOString().substring(0,10); //Conversione al formato YYYY-MM-DD
        con.query ( `SELECT * FROM Eventi WHERE dataFineSagra < '${sogliaScadenzaEventi}'`, function(err,resql2){ //Vengono cancellati gli eventi che si sono conclusi da più di una settimana
            if (err)
                console.log(err);
            else{
                let j = JSON.parse(JSON.stringify(resql2.rows)); //Questa doppia conversione è necessaria per rendere le date estratte dal database compatibili con la funzione che procede a riportarle nel formato YYYY-MM-DD
                for (el of j){ //Prima dell'eliminazione si procede a eliminare anche le eventuali locandine associate
                    let locandina = path+publicPath+directoryLocandine+el.nomesagra+el.comunesagra+convertiData(el.datainiziosagra)+convertiData(el.datafinesagra)+".jpg";
                    if (fs.existsSync(locandina))
                        fs.unlinkSync(locandina);
                }
                con.query( `DELETE FROM Eventi WHERE dataFineSagra < '${sogliaScadenzaEventi}'`, function(err,resql3){ //Si procede poi con l'eliminazione vera e propria
                    if (err)
                        console.log(err);
                });
            }
        });
    }); 
}

function convertiData(arg){ //Questa funzione esegue un post-processing sui campi di tipo "Date" che vengono estratti lato Server dal database postgresql, riportandoli al formato YYYY-MM-DD
    //Questo post-processing è necessario perché JavaScript purtroppo altera automaticamente i valori di tipo "Date" estratti da postgreSql applicando la timezone locale e aggiungendo informazioni sull'ora: nel caso dell'Italia questo fa scorrere la data indietro di un giorno
    let yyyymmdd = (arg.toString()).substring(0,10); //Per prima cosa si isola la parte che ci interessa della data (ovvero solo YYYY-MM-DD)
    let dt = new Date(yyyymmdd); //Si crea un oggetto di tipo Date a partire dalla stringa YYYY-MM-DD
    let dt2 = new Date(dt.getTime() + 60 * 60 * 24 * 1000); //Si usa il metodo getTime per ottenere il valore in millisecondi dell'oggetto appena creato. A questo valore si aggiunge un giorno (in millisecondi). Con il nuovo valore si crea un nuovo oggetto di tipo Date, che contiene quindi la data corretta.
    let result = dt2.toISOString().substring(0,10); //Conversione al formato YYYY-MM-DD
    return result;
}