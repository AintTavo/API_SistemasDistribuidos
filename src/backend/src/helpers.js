const { query } = require('./db');

function abilityMod(score) {
  return Math.floor((Number(score) - 10) / 2);
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function randomCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ¿El usuario es el DM de esta party?
async function isDM(userId, partyId) {
  const r = await query('SELECT 1 FROM parties WHERE id=$1 AND dm_user_id=$2', [partyId, userId]);
  return r.rowCount > 0;
}

// ¿El usuario es DM o miembro de la party? (acceso al modo mazmorra)
async function isMemberOrDM(userId, partyId) {
  const r = await query(
    `SELECT 1 FROM parties WHERE id=$1 AND dm_user_id=$2
     UNION SELECT 1 FROM party_members WHERE party_id=$1 AND user_id=$2`,
    [partyId, userId]
  );
  return r.rowCount > 0;
}

module.exports = { abilityMod, rollDie, randomCode, isDM, isMemberOrDM };
