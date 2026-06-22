const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// PULL: instantánea de todo lo que la PWA puede usar sin conexión.
// (hojas + inventario + contenido del DM). El modo mazmorra NO se incluye:
// requiere conexión en tiempo real.
router.get('/pull', async (req, res) => {
  const uid = req.user.id;
  const [characters, items, parties, stories, grimoire, bestiary] = await Promise.all([
    query('SELECT * FROM characters WHERE user_id=$1', [uid]),
    query('SELECT i.* FROM inventory_items i JOIN characters c ON c.id=i.character_id WHERE c.user_id=$1', [uid]),
    query(`SELECT p.*, (p.dm_user_id=$1) AS is_dm FROM parties p
           WHERE p.dm_user_id=$1 OR p.id IN (SELECT party_id FROM party_members WHERE user_id=$1)`, [uid]),
    query(`SELECT s.* FROM stories s JOIN parties p ON p.id=s.party_id WHERE p.dm_user_id=$1`, [uid]),
    query('SELECT * FROM grimoire_spells WHERE dm_user_id=$1', [uid]),
    query('SELECT * FROM bestiary_monsters WHERE dm_user_id=$1', [uid]),
  ]);
  res.json({
    synced_at: new Date().toISOString(),
    characters: characters.rows,
    items: items.rows,
    parties: parties.rows,
    stories: stories.rows,
    grimoire: grimoire.rows,
    bestiary: bestiary.rows,
  });
});

// PUSH: aplica en bache las mutaciones acumuladas offline al restablecer conexión.
router.post('/push', async (req, res) => {
  const ops = Array.isArray(req.body && req.body.operations) ? req.body.operations : [];
  const results = [];
  for (const op of ops) {
    try {
      const out = await applyOp(req.user.id, op);
      results.push({ clientId: op.clientId || null, ok: true, server: out });
    } catch (err) {
      results.push({ clientId: op.clientId || null, ok: false, error: err.message });
    }
  }
  res.json({ applied: results.length, results });
});

async function ensureCharacterOwner(uid, charId) {
  const r = await query('SELECT 1 FROM characters WHERE id=$1 AND user_id=$2', [charId, uid]);
  if (r.rowCount === 0) throw new Error('Personaje no pertenece al usuario');
}

async function applyOp(uid, op) {
  const d = op.data || {};
  switch (`${op.entity}:${op.op}`) {
    case 'character:update': {
      await ensureCharacterOwner(uid, op.id);
      const r = await query(
        `UPDATE characters SET name=$1, race=$2, class=$3, level=$4, hp=$5, max_hp=$6, ac=$7, stats=$8, notes=$9, updated_at=now()
         WHERE id=$10 AND user_id=$11 RETURNING *`,
        [d.name, d.race, d.class, d.level, d.hp, d.max_hp, d.ac, d.stats, d.notes, op.id, uid]
      );
      return r.rows[0];
    }
    case 'item:create': {
      await ensureCharacterOwner(uid, op.characterId);
      const r = await query(
        `INSERT INTO inventory_items (character_id, name, quantity, weight, equipped, description)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [op.characterId, d.name, d.quantity || 1, d.weight || 0, !!d.equipped, d.description || '']
      );
      return r.rows[0];
    }
    case 'item:update': {
      await ensureCharacterOwner(uid, op.characterId);
      const r = await query(
        `UPDATE inventory_items SET name=$1, quantity=$2, weight=$3, equipped=$4, description=$5
         WHERE id=$6 AND character_id=$7 RETURNING *`,
        [d.name, d.quantity, d.weight, !!d.equipped, d.description, op.id, op.characterId]
      );
      return r.rows[0];
    }
    case 'item:delete': {
      await ensureCharacterOwner(uid, op.characterId);
      await query('DELETE FROM inventory_items WHERE id=$1 AND character_id=$2', [op.id, op.characterId]);
      return { deleted: op.id };
    }
    case 'story:update': {
      const owner = await query(
        'SELECT p.dm_user_id FROM stories st JOIN parties p ON p.id=st.party_id WHERE st.id=$1', [op.id]);
      if (owner.rowCount === 0 || owner.rows[0].dm_user_id !== uid) throw new Error('No autorizado');
      const r = await query('UPDATE stories SET title=$1, content=$2, updated_at=now() WHERE id=$3 RETURNING *',
        [d.title, d.content, op.id]);
      return r.rows[0];
    }
    case 'grimoire:update': {
      const r = await query(
        `UPDATE grimoire_spells SET name=$1, level=$2, school=$3, casting_time=$4, range=$5, components=$6, duration=$7, description=$8
         WHERE id=$9 AND dm_user_id=$10 RETURNING *`,
        [d.name, d.level, d.school, d.casting_time, d.range, d.components, d.duration, d.description, op.id, uid]);
      return r.rows[0];
    }
    case 'bestiary:update': {
      const r = await query(
        `UPDATE bestiary_monsters SET name=$1, type=$2, cr=$3, hp=$4, ac=$5, stats=$6, abilities=$7, description=$8
         WHERE id=$9 AND dm_user_id=$10 RETURNING *`,
        [d.name, d.type, d.cr, d.hp, d.ac, d.stats, d.abilities, d.description, op.id, uid]);
      return r.rows[0];
    }
    default:
      throw new Error(`Operación no soportada: ${op.entity}:${op.op}`);
  }
}

module.exports = router;
