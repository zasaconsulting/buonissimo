const express = require('express');
const qrcode = require('qrcode');
const sharp = require('sharp');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// In-memory log of published stories (replace with DB in production)
const storiesPubblicate = [];

// GET /genera-storia?tavolo=X&ts=TIMESTAMP&lat=LAT&lng=LNG
// Returns composite JPEG: sfondo + QR2 overlay top-right
app.get('/genera-storia', async (req, res) => {
    const tavolo = req.query.tavolo || 'Generico';
    const ts = req.query.ts || Date.now();
    const lat = req.query.lat || '';
    const lng = req.query.lng || '';

    // QR2 encodes: table, timestamp, lat/lng so restaurant can verify
    const qr2Payload = JSON.stringify({ t: tavolo, ts, lat, lng });
    // Also embed as URL so scanning QR2 later can go to a verify page
    const linkQR2 = `https://buonissimo.onrender.com/verifica?tavolo=${encodeURIComponent(tavolo)}&ts=${ts}&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;

    try {
        const sfondoPath = path.join(__dirname, 'sfondo_storia.jpg');
        const metadata = await sharp(sfondoPath).metadata();
        const W = metadata.width;
        const H = metadata.height;

        // QR size: 28% of width, positioned top-right with margin
        const qrSize = Math.round(W * 0.28);
        const margin = Math.round(W * 0.04);

        const qrBuffer = await qrcode.toBuffer(linkQR2, {
            width: qrSize,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        // White rounded background for QR (add padding)
        const pad = Math.round(qrSize * 0.08);
        const boxSize = qrSize + pad * 2;

        // Create white box SVG to put behind QR
        const whitebox = Buffer.from(
            `<svg width="${boxSize}" height="${boxSize}">
              <rect x="0" y="0" width="${boxSize}" height="${boxSize}" rx="16" ry="16" fill="white"/>
            </svg>`
        );

        const boxWithQR = await sharp(whitebox)
            .composite([{ input: qrBuffer, top: pad, left: pad }])
            .png()
            .toBuffer();

        // Top-right corner position
        const posLeft = W - boxSize - margin;
        const posTop = margin;

        const immagineStoria = await sharp(sfondoPath)
            .composite([{ input: boxWithQR, top: posTop, left: posLeft }])
            .jpeg({ quality: 90 })
            .toBuffer();

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', 'inline; filename="storia_buonissimo.jpg"');
        res.send(immagineStoria);

    } catch (err) {
        console.error('Errore genera-storia:', err);
        res.status(500).send('Errore durante la generazione della storia grafica.');
    }
});

// POST /conferma-storia — called by client after user taps "Ho pubblicato"
app.post('/conferma-storia', (req, res) => {
    const { tavolo, ts, lat, lng } = req.body;
    const record = {
        tavolo: tavolo || 'Sconosciuto',
        ts: ts || Date.now(),
        lat: lat || null,
        lng: lng || null,
        ricevuto: new Date().toISOString()
    };
    storiesPubblicate.push(record);
    console.log('✅ Storia pubblicata:', record);
    res.json({ ok: true, message: 'Registrato!' });
});

// GET /stories — restaurant dashboard (basic)
app.get('/stories', (req, res) => {
    res.json(storiesPubblicate);
});

// GET /verifica — QR2 verification page for restaurant cashier
app.get('/verifica', (req, res) => {
    const { tavolo, ts, lat, lng } = req.query;
    const data = ts ? new Date(parseInt(ts)).toLocaleString('it-IT') : 'N/A';
    res.send(`
        <!DOCTYPE html><html lang="it"><head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Verifica Buonissimo</title>
        <style>body{font-family:sans-serif;background:#fffbf0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .card{background:#fff;border-radius:20px;padding:32px;box-shadow:0 4px 24px #0001;max-width:360px;text-align:center}
        h1{color:#f59e0b;font-size:1.8em;margin:0 0 8px} .badge{background:#d1fae5;color:#065f46;border-radius:99px;padding:6px 18px;font-weight:700;font-size:.9em;display:inline-block;margin-bottom:16px}
        .info{background:#fffbf0;border-radius:12px;padding:16px;text-align:left;font-size:.9em;color:#555;line-height:2}</style>
        </head><body><div class="card">
        <h1>🍽 Buonissimo</h1>
        <div class="badge">✅ Storia Verificata</div>
        <div class="info">
        <b>Tavolo:</b> ${escapeHtml(tavolo || 'N/A')}<br>
        <b>Pubblicata:</b> ${data}<br>
        ${lat ? `<b>Lat:</b> ${escapeHtml(lat)}<br><b>Lng:</b> ${escapeHtml(lng)}<br>` : ''}
        </div></div></body></html>
    `);
});

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server Buonissimo attivo sulla porta ${PORT}`);
});
