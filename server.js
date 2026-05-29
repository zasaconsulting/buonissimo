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

// Nuovo Endpoint Corretto con percorsi /tmp per i permessi di Render
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
    
    // SPOSTATI IN /tmp: Qui Node.js e FFmpeg hanno i permessi totali di scrittura su Render
    const qrImmagineTemporanea = path.join('/tmp', `qr_${codice}.png`);
    const videoOutputFinale = path.join('/tmp', `storia_${codice}.mp4`);

    try {
        // 1. Generiamo il QR Code come file PNG in /tmp
        const linkFollower = `${req.protocol}://${req.get('host')}/riscatta?codice=${codice}`;
        await QRCode.toFile(qrImmagineTemporanea, linkFollower, {
            width: 180,
            margin: 1
        });

        // 2. Usiamo FFmpeg per fondere il QR2 sul Video (Corretto senza mappatura audio problematica)
        ffmpeg(videoOriginale)
            .input(qrImmagineTemporanea)
            .complexFilter([
                '[0:v][1:v] overlay=850:60'
            ])
            .videoCodec('libx264')
            .outputOptions('-pix_fmt yuv420p')
            .on('end', () => {
                // Eliminiamo il QR temporaneo
                if (fs.existsSync(qrImmagineTemporanea)) {
                    fs.unlinkSync(qrImmagineTemporanea);
                }
                console.log(`[FFMPEG] Video generato con successo in /tmp per codice: ${codice}`);
                
                // Spediamo direttamente il file video generato come download al client
                res.download(videoOutputFinale, `storia_${codice}.mp4`, (err) => {
                    if (err) console.error("Errore nel download del file:", err);
                    // Eliminiamo il video da /tmp dopo l'invio
                    if (fs.existsSync(videoOutputFinale)) {
                        fs.unlinkSync(videoOutputFinale);
                    }
                });
            })
            .on('error', (err) => {
                console.error('[FFMPEG ERRORE]:', err);
                res.status(500).json({ errore: "Errore durante il montaggio video" });
            })
            .save(videoOutputFinale);
        
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
