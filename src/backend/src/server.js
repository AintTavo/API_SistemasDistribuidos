const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { attachSockets } = require('./sockets');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'monolith', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/parties', require('./routes/parties'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/dm', require('./routes/dm'));
app.use('/api/dungeon', require('./routes/dungeon'));
app.use('/api/sync', require('./routes/sync'));

// PWA / UI estática (sin paso de build).
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
attachSockets(server);

db.init()
  .then(() => server.listen(PORT, () => console.log(`[monolith] escuchando en :${PORT}`)))
  .catch((err) => {
    console.error('[monolith] fallo al iniciar', err);
    process.exit(1);
  });

module.exports = app;
