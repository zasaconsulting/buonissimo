const express = require('express');
const cors = require('cors');
const fs = require('fs');
const QRCode = require('qrcode');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');

// Configura il percorso corretto per l'eseguibile binario di FFmpeg su Linux/Render
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
app.use(cors());
app.use(express.json());

// Rende accessibili i file statici della root (index.html, cassa.html) e gli assets (video_promo.mp4)
app.use(express.static(__dirname));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Database temporaneo in memoria per la tracciabilità degli sconti dei tavoli durante la demo
let sessioniTavoli = {}; 

/**
 * 1. ENDPOINT GENERAZIONE VIDEO PRO CON OVERLAY QR2 (FFmpeg)
 * Riceve la richiesta, crea la sessione, timbra il video frame per frame e forza il download su iOS.
 */
app.post('/api/genera-video-tavolo', async (req, res) => {
    const { codice, tavolo } = req.body;
    
    sessioniTavoli[codice] = {
        tavolo: tavolo,
        formatoScelto: "video",
        sconto: 15, // Sconto di base alla creazione della sessione
        statoSocial: "In attesa di menzione..."
    };

    const cartellaAssets = path.join(__dirname, 'assets');
    const videoOriginale = path.join(cartellaAssets, 'video_promo.mp4');
    
    // Spostiamo l'elaborazione dei file in /tmp per superare le restrizioni di scrittura del filesystem di Render
    const qrImmagineTemporanea = path.join('/tmp', `qr_${codice}.png`);
    const videoOutputFinale = path.join('/tmp', `storia_${codice}.mp4`);

    try {
        // Generiamo il codice QR2 ad alta risoluzione in formato PNG
        const linkFollower = `${req.protocol}://${req.get('host')}/riscatta?codice=${codice}`;
        await QRCode.toFile(qrImmagineTemporanea, linkFollower, {
            width: 180,
            margin: 1
        });

        // Avviamo il montaggio video con FFmpeg
        ffmpeg(videoOriginale)
            .input(qrImmagineTemporanea)
            .complexFilter([
                // W-w-60 posiziona il QR calcolando la larghezza del video originale (W) meno quella del QR (w) lasciando 60px di margine.
                // 60 fissa il margine superiore a 60px dal bordo alto. Nessuna distorsione del video.
                '[0:v][1:v] overlay=W-w-60:60' 
            ])
            .videoCodec('libx264')
            .outputOptions([
                '-pix_fmt yuv420p',       // Forza il campionamento colore compatibile al 100% con Safari e iOS
                '-preset ultrafast',      // Abbassa l'uso di CPU/RAM per prevenire i blocchi di memoria sui server gratuiti di Render
                '-tune fastdecode'
            ])
            .on('end', () => {
                // Pulizia del file QR temporaneo dal
