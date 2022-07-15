/**
 * ⚡⚡⚡ DECLARAMOS LAS LIBRERIAS y CONSTANTES A USAR! ⚡⚡⚡
 */
require('dotenv').config()
const fs = require('fs');
var unirest = require('unirest');
const express = require('express');
const cors = require('cors')
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const mysqlConnection = require('./config/mysql')
const { middlewareClient } = require('./middleware/client')
const { generateImage, cleanNumber } = require('./controllers/handle')
const { connectionReady, connectionLost } = require('./controllers/connection')
const { saveMedia } = require('./controllers/save')
const { getMessages, responseMessages, bothResponse } = require('./controllers/flows')
const { sendMedia, sendMessage, lastTrigger, sendMessageButton, readChat } = require('./controllers/send')
const app = express();
app.use(cors())
app.use(express.json())



const server = require('http').Server(app)
const io = require('socket.io')(server, {
    cors: {
        origins: ['http://localhost:3000']
    }
})

let socketEvents = { sendQR: () => { }, sendStatus: () => { } };

io.on('connection', (socket) => {
    const CHANNEL = 'main-channel';
    socket.join(CHANNEL);
    socketEvents = require('./controllers/socket')(socket)
    console.log('Se conecto')

})

app.use('/', require('./routes/web'))

const port = process.env.PORT || 3000
const SESSION_FILE_PATH = './session.json';
const HISTORY_PATH = './history.json';
var client;
var sessionData;

/**
 * Escuchamos cuando entre un mensaje
 */
// const listenMessage = () => client.on('message', async msg => {

//     const { from, body, hasMedia } = msg;
//     // Este bug lo reporto Lucas Aldeco Brescia para evitar que se publiquen estados

//     if (from === 'status@broadcast') {
//         return
//     }
//     message = body.toLowerCase();
//     console.log('BODY',message)
//     const number = from.split('@')[0];


//     console.log(number);
//     if(message.includes('codigo') || message.includes('code')){

//         var request = require('request');
//         console.log( number.replace('57', ''))

//         var options = {
//         'method': 'GET',
//         'url': 'http://aiwe_database.test/api/getCodeByPhone',
//         'headers': {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//             "phone": number.replace('57', '')
//         })

//         };

//         request(options, function (error, response) {

//            let resp = JSON.parse(response.body)
//             // sendMessage(client, from, "Tu codigo de TRAVEL es: "  + ""+resp.code+"" );

//             if (resp.success ) {
//                 sendMessage(client, from, "Tu codigo de TRAVEL es: "  + "*"+resp.code+"*" );
//             }else{
//                 sendMessage(client, from, resp.message );
//             }
//         }
//         );

//     }






//     // if(fs.existsSync(HISTORY_PATH)){

//     //      console.log("Existe");
//     //     let file = fs.readFile(HISTORY_PATH, 'utf-8', (err, data) => {
//     //         if(err) {
//     //           console.log('error: ', err);
//     //         } else {

//     //             let lista = data;

//     //             lista = JSON.parse(data)

//     //             let numSearch = lista.filter(element => element.number.includes(number));

//     //             if(numSearch.length === 0){
//     //                 console.log("New!");
//     //                 lista.push({"number":number});

//     //                 if(number.length < 15){
//     //                     updateCRM(number);
//     //                 }

//     //             }

//     //            fs.writeFile(HISTORY_PATH, JSON.stringify(lista), function (err) {
//     //             if (err) {
//     //                 console.log(`Ocurrio un error con el archivo: `, err);
//     //             }
//     //            });

//     //            console.log("Listo!");

//     //         }
//     //       });



//     // }else{
//     //     console.log("No Existe");
//     //     let file = [];
//     //     console.log(file);

//     //     file.push({"number":number});

//     //     console.log(file);
//     //     fs.writeFile(HISTORY_PATH, JSON.stringify(file), function (err) {
//     //          if (err) {
//     //              console.log(`Ocurrio un error con el archivo: `, err);
//     //          }
//     //      });

//     // }






//     await readChat(number, message)
//     /**
//      * Guardamos el archivo multimedia que envia
//      */
//     if (process.env.SAVE_MEDIA && hasMedia) {
//         const media = await msg.downloadMedia();
//         saveMedia(media);
//     }

//     /**
//      * Si estas usando dialogflow solo manejamos una funcion todo es IA
//      */

//     if (process.env.DATABASE === 'dialogflow') {
//         const response = await bothResponse(message);
//         await sendMessage(client, from, response.replyMessage);
//         if (response.media) {
//             sendMedia(client, from, response.media);
//         }
//         return
//     }

//     /**
//     * Ver si viene de un paso anterior
//     * Aqui podemos ir agregando más pasos
//     * a tu gusto!
//     */

//     const lastStep = await lastTrigger(from) || null;
//     console.log({ lastStep })
//     if (lastStep) {
//         const response = await responseMessages(lastStep)
//         await sendMessage(client, from, response.replyMessage);
//     }

//     /**
//      * Respondemos al primero paso si encuentra palabras clave
//      */
//     const step = await getMessages(message);
//     console.log({ step })

//     if (step) {
//         const response = await responseMessages(step)
//         await sendMessage(client, from, response.replyMessage, response.trigger);


//         if (!response.delay && response.media) {
//             sendMedia(client, from, response.media);
//         }
//         if (response.delay && response.media) {
//             setTimeout(() => {
//                 sendMedia(client, from, response.media);
//             }, response.delay)
//         }
//         return
//     }

//     //Si quieres tener un mensaje por defecto
//     if (process.env.DEFAULT_MESSAGE === 'true') {
//         const response = await responseMessages('DEFAULT')
//         await sendMessage(client, from, response.replyMessage, response.trigger);

//         /**
//          * Si quieres enviar botones
//          */
//         if(response.hasOwnProperty('actions')){
//             const { actions } = response;
//             await sendMessageButton(client, from, null, actions);
//         }
//         return
//     }
// });

/**
 * Revisamos si tenemos credenciales guardadas para inciar sessio
 * este paso evita volver a escanear el QRCODE
 */
const withSession = () => {
    // Si exsite cargamos el archivo con las credenciales
    console.log(`Validando session con Whatsapp...`)
    sessionData = require(SESSION_FILE_PATH);
    client = new Client({
        session: sessionData,
        puppeteer: {
            args: [
                '--no-sandbox'
            ],
        }
    });

    client.on('ready', () => {
        connectionReady()
        // listenMessage()
        loadRoutes(client);
        socketEvents.sendStatus()
    });

    client.on('auth_failure', () => connectionLost())

    client.initialize();
}

/**
 * Generamos un QRCODE para iniciar sesion
 */
const withOutSession = () => {

    console.log('No tenemos session guardada');
    // let dirSessionStorage = __dirname + "\\.wwebjs_auth";
    // console.log(dirSessionStorage.replaceAll('\\', '//'));


    client = new Client({
        authStrategy: new LocalAuth({
            clientId: "33333",
            dataPath: ".//.wwebjs_auth//session-33333"
            // dataPath:dirSessionStorage
        }),
        puppeteer: {
            args: [
                '--no-sandbox'
            ],
        }
    });

    client.on('qr', qr => generateImage(qr, () => {
        qrcode.generate(qr, { small: true });
        console.log(`Ver QR http://localhost:${port}/qr`)
        socketEvents.sendQR(qr)
    }))

    client.on('ready', (a) => {
        connectionReady()
        // listenMessage()
        loadRoutes(client);

        app.get('/auto', function (req, res) {
            const { tell, message } = req.query;
            try {
                sendMessage(client, tell, message);
                res.send('Success');
            } catch (error) {
                res.send(`error: ${error}`);

            }
        });

        app.get('/update', function (req, res) {
            const { tell, message } = req.query;
            try {
                console.log(" - me llego - ");
                res.send('success');
            } catch (error) {
                res.send(`error: ${error}`);

            }
        });

        app.get('/quit', function (req, res) {
            const { tell, message } = req.query;
            try {
                var rimraf = require("rimraf");
                rimraf("./.wwebjs_auth", function () { console.log("Borrado"); });
                res.send('Success');
            } catch (error) {
                res.send(`error: ${error}`);

            }
        });
        // socketEvents.sendStatus(client)
    });

    client.on('auth_failure', () => connectionLost());

    client.on('authenticated', (session) => {
        console.log(client._sessions);
        sessionData = session;
        if (sessionData) {
            fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
                if (err) {
                    console.log(`Ocurrio un error con el archivo: `, err);
                }
            });
        }
        console.log("authenticated");
        // console.log(session);

        // sessionData = session;
        // fs.writeFile(SESSION_FILE_PATH, session, function (err) {
        //     if (err) {
        //         console.log(`Ocurrio un error con el archivo: `, err);
        //     }
        // });
    });

    client.initialize();
    console.log("inicializado");
}

// function getAbsolutePath() {
//     var loc = window.location;
//     var pathName = loc.pathname.substring(0, loc.pathname.lastIndexOf('/') + 1);
//     return loc.href.substring(0, loc.href.length - ((loc.pathname + loc.search + loc.hash).length - pathName.length));
// }


(fs.existsSync(SESSION_FILE_PATH) && MULTI_DEVICE === 'false') ? withSession() : withOutSession();
const request = require('request');

setInterval(() => {
    console.log(" - se lo lleve - ");
    request(process.env.AUX_URL, (err, res, body) => {
        console.log('error:', err);
        console.log('statusCode:', res && res.statusCode);
        console.log('body:', body);
    });
}, 930000);

/**
 * Cargamos rutas de express
 */

const loadRoutes = (client) => {
    app.use('/api/', middlewareClient(client), require('./routes/api'))
}
/**
 * Revisamos si existe archivo con credenciales!
 */

//  fs.unlink('./WWebJS');
// console.log("Go");

// (fs.existsSync(SESSION_FILE_PATH)) ? withSession() : withOutSession();



/**
 * Verificamos si tienes un gesto de db
 */

if (process.env.DATABASE === 'mysql') {
    mysqlConnection.connect()
}

server.listen(port, () => {
    console.log(`El server esta listo por el puerto ${port}`);
})

