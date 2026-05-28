const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// 1. Rende accessibili i file nella cartella principale (index.html, cassa.html, ecc.)
app.use(express.static(__dirname));

// 2. Fornisce l'accesso alla cartella degli assets (video_promo.mp4)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// 3. Se qualcuno va sull'indirizzo base senza specificare nulla, gli mostra index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Database in memoria per tracciare lo sconto associato al QR2
let sessioniTavoli = {}; 

// Inizializza la sessione prima del reindirizzamento a Instagram
app.post('/api/inizia-sessione', (req, res) => {
    const { codice, tavolo, formato } = req.body;
    sessioniTavoli[codice] = {
        tavolo: tavolo,
        formatoScelto: formato,
        sconto: 15, // Sconto base di partenza
        statoSocial: "In attesa di menzione..."
    };
    console.log(`[SESSIONE] Creato codice ${codice} per Tavolo ${tavolo} (Scelta: ${formato})`);
    res.sendStatus(200);
});

// Endpoint Webhook di Instagram (Reale / Simulazione demo)
app.post('/webhook/instagram', (req, res) => {
    const { codice_demo } = req.body;

    // Gestione interna pulsante demo dal Lenovo Flexpad
    if (codice_demo && sessioniTavoli[codice_demo]) {
        sessioniTavoli[codice_demo].sconto = 20;
        sessioniTavoli[codice_demo].statoSocial = "Tag Verificato via Webhook 🟢";
        console.log(`[UPGRADE] Il codice demo ${codice_demo} passa al 20% di sconto.`);
        return res.status(200).send("DEMO_OK");
    }

    // Struttura standard di produzione per la ricezione notifiche di Meta
    if (req.body.object === 'instagram') {
        // In produzione: parsa req.body per individuare la menzione 'story_mentions'
        // e aggiorna lo sconto della sessione attiva corrispondente al 20%.
        return res.status(200).send('EVENT_RECEIVED');
    }
    res.sendStatus(404);
});

// Verifica Webhook per configurazione Meta Developers
app.get('/webhook/instagram', (req, res) => {
    const VERIFY_TOKEN = "BUONISSIMO_SECRET_TOKEN";
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
        res.status(200).send(req.query['hub.challenge']);
    } else {
        res.sendStatus(403);
    }
});

// Interrogazione del database effettuata dal Lenovo Flexpad (Cassa)
app.get('/api/verifica-cassa/:codice', (req, res) => {
    const codice = req.params.codice;
    const dati = sessioniTavoli[codice];
    if (dati) {
        res.json({ trovato: true, ...dati });
    } else {
        res.json({ trovato: false, messaggio: "Codice inesistente." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server Buonissimo in ascolto sulla porta ${PORT}`));
