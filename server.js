const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(__dirname));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

let sessioniTavoli = {}; 

// Endpoint leggero: Crea la sessione e restituisce il QR2 da usare come sticker
app.post('/api/inizia-sessione-video', async (req, res) => {
    const { codice, tavolo } = req.body;
    
    sessioniTavoli[codice] = {
        tavolo: tavolo,
        formatoScelto: "video",
        sconto: 15,
        statoSocial: "In attesa di menzione..."
    };

    try {
        const linkFollower = `${req.protocol}://${req.get('host')}/riscatta?codice=${codice}`;
        
        // Genera il QR2 come stringa Base64 (PNG leggerissimo)
        const qrBase64 = await QRCode.toDataURL(linkFollower, {
            width: 300,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        console.log(`[SESSIONE] Video avviato per Tavolo ${tavolo} - QR2 generato.`);
        res.json({ successo: true, qrStickerUrl: qrBase64 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ errore: "Errore nella generazione del QR" });
    }
});

// Endpoint standard per la scelta foto
app.post('/api/inizia-sessione', (req, res) => {
    const { codice, tavolo, formato } = req.body;
    sessioniTavoli[codice] = {
        tavolo: tavolo,
        formatoScelto: formato,
        sconto: 15,
        statoSocial: "In attesa di menzione..."
    };
    res.json({ successo: true });
});

// Verifica codice per il Lenovo Flexpad (Cassa)
app.get('/api/verifica-cassa/:codice', (req, res) => {
    const codice = req.params.codice;
    const dati = sessioniTavoli[codice];
    if (dati) res.json({ trovato: true, ...dati });
    else res.json({ trovato: false });
});

// Webhook simulazione Instagram
app.post('/webhook/instagram', (req, res) => {
    const { codice_demo } = req.body;
    if (codice_demo && sessioniTavoli[codice_demo]) {
        sessioniTavoli[codice_demo].sconto = 20;
        sessioniTavoli[codice_demo].statoSocial = "Tag Verificato via Webhook 🟢";
        return res.status(200).send("DEMO_OK");
    }
    res.sendStatus(404);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server Buonissimo attivo sulla porta ${PORT}`));
