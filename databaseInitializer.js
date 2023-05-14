/* Questo script ha il solo scopo di creare la base di dati usata dal Server e deve essere eseguito una volta sola
dopo aver installato postgresql. Eventuali esecuzioni successive determineranno la perdita di tutti i dati salvati.*/

const suName = "postgres";
const suPassw = "password";
const masterDB = "postgres";
const hostN = "localhost";
const portN = 8472;

const uName = "adminsagre";
const uPassw = "password123";
const nomeDB = "umbriasagre";

const suCredentials = { //Credenziali di accesso per la connessione al database in modalità super user
    host : hostN,
    database : masterDB,
    user : suName,
    password : suPassw,
    port : portN
};

const uCredentials = { //Credenziali di accesso per connettersi alla base di dati usata per UmbriaSagre
    host : hostN,
    database : nomeDB,
    user : uName,
    password : uPassw,
    port : portN
};

//***COSTANTI PERSONALIZZABILI (devono corrispondere a quelle dichiarate negli script front end)***
const lunghezzaMaxNomeUtente = 40;
const lunghezzaMaxMessaggi = 5000;
const lunghezzaMaxTitoloMessaggi = 100;
const lunghezzaMaxNomeSagra = 60;
const lunghezzaMaxIndirizzoSagra = 100;
const lunghezzaMaxDescrizioneSagra = 5000;

const pg = require("pg"); //Modulo usato per accedere a postgresql da node.js

databaseOperations(); //L'insieme di istruzioni usate per creare la base di dati vengono incapsulate nella funzione async "databaseOperations" in modo da poter usare la keyword await

async function databaseOperations(){
    var con = new pg.Client(suCredentials);
    await con.connect();
    console.log("\n***Connesso al database come " + suCredentials.user + ".***\n");
    let q;
    q = `DROP DATABASE IF EXISTS ${nomeDB};`
    await con.query( q );
    console.log(q+"\n");
    q = `DROP USER IF EXISTS ${uName};`
    await con.query( q );
    console.log(q+"\n");
    q = `CREATE USER ${uName} with password '${uPassw}';`
    await con.query( q );
    console.log(q+"\n");
    q = `CREATE DATABASE ${nomeDB} WITH OWNER ${uName};`
    await con.query( q );
    console.log(q+"\n");
    await con.end();
    console.log("\n*** " + suCredentials.user + " disconnesso dal database.***\n");
    con = new pg.Client(uCredentials);
    await con.connect();
    console.log("\n***Connesso al database come " + uCredentials.user + ".***\n");
    q = `CREATE DOMAIN TuserName AS VARCHAR(${lunghezzaMaxNomeUtente}) NOT NULL CHECK (VALUE <> '');`;
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE DOMAIN TpasswordHash AS VARCHAR NOT NULL;";
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE DOMAIN Torganizzatore AS BOOLEAN";
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE DOMAIN Texpiration AS BIGINT;";
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE DOMAIN TsessionNumber AS BIGINT CHECK (VALUE >=0);";
    await con.query( q );
    console.log(q+"\n");
    q = `CREATE DOMAIN TnomeSagra AS VARCHAR(${lunghezzaMaxNomeSagra}) NOT NULL;`;
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE DOMAIN TcomuneSagra AS VARCHAR NOT NULL CHECK (VALUE <> '');";
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE DOMAIN Tdata AS DATE NOT NULL;";
    await con.query( q );
    console.log(q+"\n");
    q = `CREATE DOMAIN TindirizzoSagra AS VARCHAR(${lunghezzaMaxIndirizzoSagra}) NOT NULL CHECK (VALUE <> '');`;
    await con.query( q );
    console.log(q+"\n");
    q = `CREATE DOMAIN TdescrizioneSagra AS VARCHAR(${lunghezzaMaxDescrizioneSagra});`;
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE DOMAIN TnumeroIscrittiSagra AS INTEGER DEFAULT 0 CHECK (value>=0);";
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE DOMAIN TcontenutoMessaggio AS VARCHAR("+lunghezzaMaxMessaggi+") CHECK (VALUE <> '')";
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE DOMAIN TtitoloMessaggio AS VARCHAR("+lunghezzaMaxTitoloMessaggi+") CHECK (VALUE <> '')";
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE TABLE Comuni (comune TcomuneSagra PRIMARY KEY);";
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE TABLE Utenti (username TuserName PRIMARY KEY, password TpasswordHash, qualificaOrganizzatore Torganizzatore, sessionExpiration Texpiration, sessionNumber TsessionNumber);";
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE TABLE Eventi (nomeSagra TnomeSagra, comuneSagra TcomuneSagra REFERENCES Comuni(comune) ON DELETE CASCADE ON UPDATE CASCADE, dataInizioSagra Tdata, dataFineSagra Tdata, indirizzoSagra TindirizzoSagra, descrizioneSagra TdescrizioneSagra, locandinaSagra BOOLEAN, organizzatoreSagra TuserName REFERENCES Utenti(username) ON DELETE CASCADE ON UPDATE CASCADE, numeroIscrittiSagra TnumeroIscrittiSagra, idSagra SERIAL PRIMARY KEY, CONSTRAINT univocita UNIQUE (nomeSagra, comuneSagra, dataInizioSagra, dataFineSagra), CHECK(dataFineSagra>=dataInizioSagra));";
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE TABLE Iscrizioni (username Tusername REFERENCES Utenti(username) ON DELETE CASCADE ON UPDATE CASCADE, idSagra INTEGER REFERENCES Eventi(idSagra) ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY(idSagra, username));";
    await con.query( q );
    console.log(q+"\n");
    q = "CREATE TABLE Messaggi ( mittenteMessaggio Tusername REFERENCES Utenti(username) ON DELETE CASCADE ON UPDATE CASCADE, destinatarioMessaggio Tusername REFERENCES Utenti(username) ON DELETE CASCADE ON UPDATE CASCADE, dataMessaggio Tdata, expirationMessaggio Texpiration, titoloMessaggio TtitoloMessaggio, contenutoMessaggio TcontenutoMessaggio, isNuovoMessaggio CHAR(2), idMessaggio SERIAL PRIMARY KEY );";
    await con.query( q );
    console.log(q+"\n");
    q = `CREATE FUNCTION aumentaNumeroIscritti()
	RETURNS TRIGGER
AS $BODY$
	DECLARE
	BEGIN
		UPDATE Eventi SET numeroIscrittiSagra = numeroIscrittiSagra + 1 WHERE (Eventi.idSagra = NEW.idSagra);
		RETURN NEW;
	END
$BODY$
LANGUAGE PLPGSQL;`;
    await con.query( q );
    console.log(q+"\n");
    q = `CREATE TRIGGER aumentaNumeroIscritti
	AFTER INSERT ON Iscrizioni
	FOR EACH ROW
	EXECUTE PROCEDURE aumentaNumeroIscritti();`;
    await con.query( q );
    console.log(q+"\n");
    q = `CREATE FUNCTION riduciNumeroIscritti()
	RETURNS TRIGGER
AS $BODY$
	DECLARE
	BEGIN
		UPDATE Eventi SET numeroIscrittiSagra = numeroIscrittiSagra - 1 WHERE (Eventi.idSagra = OLD.idSagra);
		RETURN NEW;
	END
$BODY$
LANGUAGE PLPGSQL;`;
    await con.query( q );
    console.log(q+"\n");
        q = `CREATE TRIGGER riduciNumeroIscritti
	AFTER DELETE ON Iscrizioni
	FOR EACH ROW
	EXECUTE PROCEDURE riduciNumeroIscritti();`;
    await con.query( q );
    console.log(q+"\n");
    q = "INSERT INTO Comuni VALUES ('Assisi');"; //I comuni umbri sono più di 100, per semplicità mi sono limitato ad aggiungere alcuni tra i più popolati
    await con.query( q );
    console.log(q+"\n");
    q = "INSERT INTO Comuni VALUES ('Foligno');";
    await con.query( q );
    console.log(q+"\n");
    q = "INSERT INTO Comuni VALUES ('Gubbio');";
    await con.query( q );
    console.log(q+"\n");
    q = "INSERT INTO Comuni VALUES ('Perugia');";
    await con.query( q );
    console.log(q+"\n");
    q = "INSERT INTO Comuni VALUES ('Spoleto');";
    await con.query( q );
    console.log(q+"\n");
    q = "INSERT INTO Comuni VALUES ('Terni');";
    await con.query( q );
    console.log(q+"\n");
    await con.end();
    console.log("\n*** " + uCredentials.user + " disconnesso dal database.***\n");
    console.log("Operazioni concluse.\n\n");
}









