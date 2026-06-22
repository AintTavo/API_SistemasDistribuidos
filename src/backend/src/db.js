const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || 'db',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'mapa-aventurero',
  password: process.env.PGPASSWORD || 'mapa-aventurero',
  database: process.env.PGDATABASE || 'mapa-aventurero',
});

async function query(text, params) {
  return pool.query(text, params);
}

// Aplica el esquema (idempotente) y espera a que la BD esté lista.
async function init(retries = 20) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(schema);
      console.log('[db] esquema aplicado');
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`[db] esperando base de datos (${attempt}/${retries})... ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

module.exports = { pool, query, init };
