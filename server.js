const express = require('express');
const cors = require('cors');
const fs = require('fs');
const QRCode = require('qrcode');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(__dirname));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

let sessioniTavoli = {}; 

// Endpoint Potenziato: Genera il video reale MP4 con QR2 integrato senza saturare la RAM
app.post('/api/genera-video-tavolo', async (req, res) => {
    const { codice, tavolo } = req.body;
    
    sessioniTavoli[codice] = {
        tavolo: tavolo,
        formatoScelto: "video",
        sconto: 15,
        statoSocial: "In attesa di menzione..."
    };

    const cartellaAssets = path.join(__dirname, 'assets');
    const videoOriginale = path.join(cartellaAssets, 'video_promo.mp4');
    
    // Usiamo la cartella /tmp di Render che ha permessi di scrittura completi
    const qrImmagineTemporanea = path.join('/tmp', `qr_${codice}.png`);
    const videoOutputFinale = path.join('/tmp', `storia_${codice}.mp4`);

    try {
        // 1. Generiamo il QR Code come PNG ad alta risoluzione
        const linkFollower = `${req.protocol}://${req.get('host')}/riscatta?codice=${codice}`;
        await QRCode.toFile(qrImmagineTemporanea, linkFollower, {
            width: 180,
            margin: 1
        });

        // 2. FFmpeg unisce il QR2 al video frame per frame
        ffmpeg(videoOriginale)
            .input(qrImmagineTemporanea)
            .complexFilter([
                '[0:v][1:v] overlay=850:60' // Posiziona il QR2 in alto a destra
            ])
            .videoCodec('libx264')
            .outputOptions([
                '-pix_fmt yuv420p',       // Forza il formato colore compatibile con i player iOS
                '-preset ultrafast',      // Riduce al minimo l'uso di CPU/RAM su Render Free
                '-tune fastdecode'
            ])
            .on('end', () => {
                // Eliminiamo il QR temporaneo dal server
                if (fs.existsSync(qrImmagineTemporanea)) fs.unlinkSync(qrImmagineTemporanea);
                console.log(`[FFMPEG SUCCESS] Video con QR2 generato per codice: ${codice}`);
                
                // Forziamo gli header di riposta per l'attributo octet-stream (obbliga il download su iPhone)
                res.setHeader('Content-Type', 'video/mp4');
                res.setHeader('Content-Disposition', `attachment; filename=storia_${codice}.mp4`);

                res.download(videoOutputFinale, `storia_${codice}.mp4`, (err) => {
                    if (err) console.error("Errore invio file:", err);
                    // Rimuoviamo l'MP4 generato per non riempire il server
                    if (fs.existsSync(videoOutputFinale)) fs.unlinkSync(videoOutputFinale);
                });
            })
            .on('error', (err) => {
                console.error('[FFMPEG CRASH]:', err);
                if (fs.existsSync(qrImmagineTemporanea)) fs.unlinkSync(qrImmagineTemporanea);
                if (fs.existsSync(videoOutputFinale)) fs.unlinkSync(videoOutputFinale);
                res.status(500).json({ errore: "Errore compilazione video frame." });
            })
            .save(videoOutputFinale);

    } catch (error) {
        console.error(error);
        res.status(500).json({ errore: "Errore strutturale del server." });
    }
});

// Endpoint standard per Scelta Foto
app.post('/api/inizia-sessione', (req, res) => {
    const { codice, tavolo, formato } = req.body;
    sessioniTavoli[codice] = { tavolo, formatoScelto: formato, sconto: 15, statoSocial: "In attesa di menzione..." };
    res.json({ successo: true });
});

// Verifica codice per Lenovo Flexpad (Cassa)
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

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server Buonissimo attivo sulla porta ${PORT}`));
