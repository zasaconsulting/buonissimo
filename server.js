const express = require('express');
const qrcode = require('qrcode');
const sharp = require('sharp');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve i file statici (come la tua pagina del tavolo)
app.use(express.static(__dirname));

// ROTTA: Genera l'immagine della storia per il Instagram
app.get('/genera-storia', async (req, res) => {
    const tavolo = req.query.tavolo || 'Generico';
    
    // 1. Il link che dovranno inquadrare i follower dalla storia su Instagram
    const linkFollower = `https://tuo-progetto-backend.render.com/riscatta?da_tavolo=${tavolo}`;

    try {
        // 2. Generiamo il QR code per i follower come un buffer di immagine (PNG)
        const qrBuffer = await qrcode.toBuffer(linkFollower, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        // 3. Prendiamo lo sfondo della storia (es. un'immagine 1080x1920 pixel del locale)
        // Nota: devi avere un file chiamato "sfondo_storia.jpg" nella stessa cartella
        const sfondoPath = path.join(__dirname, 'sfondo_storia.jpg');

        // 4. USIAMO SHARP PER COMPORRE L'IMMAGINE: Incolliamo il QR code sullo sfondo
        const immagineStoria = await sharp(sfondoPath)
            .composite([
                { 
                    input: qrBuffer, 
                    top: 1100, // Coordinata Y: posiziona il QR nella metà inferiore della storia
                    left: 390  // Coordinata X: centra il QR (1080 di larghezza / 2 - 150)
                }
            ])
            .jpeg()
            .toBuffer();

        // 5. Rispondiamo inviando direttamente l'immagine risultante
        res.setHeader('Content-Type', 'image/jpeg');
        res.send(immagineStoria);

    } catch (err) {
        console.error(err);
        res.status(500).send("Errore durante la generazione della storia grafica.");
    }
});

// Avvia il server
app.listen(PORT, () => {
    console.log(`Server Buonissimo attivo sulla porta ${PORT}`);
});
