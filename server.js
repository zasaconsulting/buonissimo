const express = require('express');
const qrcode = require('qrcode');
const sharp = require('sharp');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/genera-storia', async (req, res) => {
    const tavolo = req.query.tavolo || 'Generico';
    
    // Il link che dovranno inquadrare i follower
    const linkFollower = `https://buonissimo.tiiny.site/follower.html?da_tavolo=${tavolo}`;

    try {
        const sfondoPath = path.join(__dirname, 'sfondo_storia.jpg');
        
        // 1. Leggiamo le dimensioni reali della tua immagine di sfondo
        const metadata = await sharp(sfondoPath).metadata();
        const larghezzaSfondo = metadata.width;
        const altezzaSfondo = metadata.height;

        // 2. Calcoliamo la dimensione ideale del QR (es. il 30% della larghezza dello sfondo)
        const qrSize = Math.round(larghezzaSfondo * 0.35);

        // 3. Generiamo il QR code con i colori invertiti/ottimizzati (nero su sfondo bianco)
        const qrBuffer = await qrcode.toBuffer(linkFollower, {
            width: qrSize,
            margin: 3, // Margine bianco protettivo intorno al QR
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // 4. Calcoliamo le coordinate per centrarlo perfettamente in basso
        const posizioneLeft = Math.round((larghezzaSfondo - qrSize) / 2);
        const posizioneTop = Math.round(altezzaSfondo * 0.65); // Posizionato al 65% dell'altezza (parte inferiore)

        // 5. Componiamo l'immagine finale sovrapponendo il QR centrato
        const immagineStoria = await sharp(sfondoPath)
            .composite([
                { 
                    input: qrBuffer, 
                    top: posizioneTop, 
                    left: posizioneLeft 
                }
            ])
            .jpeg()
            .toBuffer();

        res.setHeader('Content-Type', 'image/jpeg');
        res.send(immagineStoria);

    } catch (err) {
        console.error(err);
        res.status(500).send("Errore durante la generazione della storia grafica.");
    }
});

app.get('/', (req, res) => {
    res.send("Server Buonissimo Attivo e Online!");
});

app.listen(PORT, () => {
    console.log(`Server Buonissimo attivo sulla porta ${PORT}`);
});
