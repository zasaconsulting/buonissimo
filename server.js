const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(__dirname));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

let sessioniTavoli = {}; 

// Nuovo Endpoint: Genera il video MP4 reale con il QR2 stampato sopra
app.post('/api/genera-video-tavolo', async (req, res) => {
    const { codice, tavolo } = req.body;
    
    // Creiamo la sessione nel database della demo
    sessioniTavoli[codice] = {
        tavolo: tavolo,
        formatoScelto: "video",
        sconto: 15,
        statoSocial: "In attesa di menzione..."
    };

    const cartellaAssets = path.join(__dirname, 'assets');
    const videoOriginale = path.join(cartellaAssets, 'video_promo.mp4');
    const qrImmagineTemporanea = path.join(cartellaAssets, `qr_${codice}.png`);
    const videoOutputFinale = path.join(cartellaAssets, `storia_${codice}.mp4`);

    try {
        // 1. Generiamo il QR Code come file PNG sul server
        const linkFollower = `${req.protocol}://${req.get('host')}/riscatta?codice=${codice}`;
        await QRCode.toFile(qrImmagineTemporanea, linkFollower, {
            width: 180,
            margin: 1
        });

        // 2. Usiamo FFmpeg per fondere il QR2 sul Video in alto a destra
        // Coordinate: x = 1080 - 180 - 50 (850), y = 60
        ffmpeg(videoOriginale)
            .input(qrImmagineTemporanea)
            .complexFilter([
                '[0:v][1:v] overlay=850:60 [outv]'
            ])
            .map('[outv]')
            .map('0:a?') // Copia l'audio se presente
            .videoCodec('libx264')
            .outputOptions('-pix_fmt yuv420p') // Massima compatibilità con smartphone
            .on('end', () => {
                // Eliminiamo il PNG temporaneo del QR per non intasare il server
                fs.unlinkSync(qrImmagineTemporanea);
                
                console.log(`[FFMPEG] Video generato con successo per codice: ${codice}`);
                res.json({ successo: true, videoUrl: `/assets/storia_${codice}.mp4` });
            })
            .on('error', (err) => {
                console.error('[FFMPEG ERRORE]:', err);
                res.status(500).json({ errore: "Errore durante il montaggio video" });
            })
            .save(videoOutputFinale);

    } catch (error) {
        console.error(error);
        res.status(500).json({ errore: "Errore del server" });
    }
});

// Vecchi endpoint di controllo cassa e webhook rimangono invariati
app.get('/api/verifica-cassa/:codice', (req, res) => {
    const codice = req.params.codice;
    const dati = sessioniTavoli[codice];
    if (dati) res.json({ trovato: true, ...dati });
    else res.json({ trovato: false });
});

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
app.listen(PORT, () => console.log(`Server attivo sulla porta ${PORT}`));
