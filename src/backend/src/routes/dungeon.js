const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { isDM, isMemberOrDM } = require('../helpers');

const router = express.Router();
router.use(requireAuth);

// El DM inicia una sala (queda "waiting" hasta que se una alguien -> "active").
router.post('/sessions', async (req, res) => {
  const { party_id, name } = req.body || {};
  if (!(await isDM(req.user.id, party_id))) return res.status(403).json({ error: 'Solo el DM puede iniciar la sala' });
  const r = await query(
    'INSERT INTO dungeon_sessions (party_id, dm_user_id, name) VALUES ($1,$2,$3) RETURNING *',
    [party_id, req.user.id, name || 'Mazmorra']
  );
  res.status(201).json(r.rows[0]);
});

// Salas activas de una party (solo DM o miembros).
router.get('/sessions/party/:partyId', async (req, res) => {
  if (!(await isMemberOrDM(req.user.id, req.params.partyId))) return res.status(403).json({ error: 'Sin acceso' });
  const r = await query(
    "SELECT * FROM dungeon_sessions WHERE party_id=$1 AND status<>'closed' ORDER BY created_at DESC",
    [req.params.partyId]
  );
  res.json(r.rows);
});

// Estado completo de una sala (lienzo + turnos). Acceso restringido.
router.get('/sessions/:id', async (req, res) => {
  const r = await query('SELECT * FROM dungeon_sessions WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
  if (!(await isMemberOrDM(req.user.id, r.rows[0].party_id))) return res.status(403).json({ error: 'Sin acceso' });
  const checks = await query('SELECT * FROM skill_checks WHERE session_id=$1 ORDER BY created_at DESC LIMIT 25', [req.params.id]);
  res.json({ ...r.rows[0], recent_checks: checks.rows });
});

router.post('/sessions/:id/close', async (req, res) => {
  const r = await query('SELECT * FROM dungeon_sessions WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
  if (r.rows[0].dm_user_id !== req.user.id) return res.status(403).json({ error: 'Solo el DM' });
  await query("UPDATE dungeon_sessions SET status='closed' WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
