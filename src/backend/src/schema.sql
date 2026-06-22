-- ============================================================
-- El mapa del aventurero - Esquema relacional conjunto (monolito)
-- Una sola base de datos compartida por los 3 modos.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una "mesa"/party. Cualquier usuario puede ser DM de una y jugador en otra.
CREATE TABLE IF NOT EXISTS parties (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  dm_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  join_code   TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS party_members (
  party_id  INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'player', -- 'dm' | 'player'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, user_id)
);

-- MODO USUARIO: hojas/plantillas de personaje
CREATE TABLE IF NOT EXISTS characters (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_id   INTEGER REFERENCES parties(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  race       TEXT DEFAULT '',
  class      TEXT DEFAULT '',
  level      INTEGER NOT NULL DEFAULT 1,
  hp         INTEGER NOT NULL DEFAULT 10,
  max_hp     INTEGER NOT NULL DEFAULT 10,
  ac         INTEGER NOT NULL DEFAULT 10,
  stats      JSONB NOT NULL DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
  notes      TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MODO USUARIO: inventario por personaje
CREATE TABLE IF NOT EXISTS inventory_items (
  id           SERIAL PRIMARY KEY,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  weight       NUMERIC NOT NULL DEFAULT 0,
  equipped     BOOLEAN NOT NULL DEFAULT false,
  description  TEXT DEFAULT ''
);

-- MODO DUNGEON MASTER: historias por mesa
CREATE TABLE IF NOT EXISTS stories (
  id         SERIAL PRIMARY KEY,
  party_id   INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MODO DUNGEON MASTER: grimorio rápido (hechizos)
CREATE TABLE IF NOT EXISTS grimoire_spells (
  id           SERIAL PRIMARY KEY,
  dm_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  level        INTEGER NOT NULL DEFAULT 0,
  school       TEXT DEFAULT '',
  casting_time TEXT DEFAULT '',
  range        TEXT DEFAULT '',
  components   TEXT DEFAULT '',
  duration     TEXT DEFAULT '',
  description  TEXT DEFAULT ''
);

-- MODO DUNGEON MASTER: bestiario
CREATE TABLE IF NOT EXISTS bestiary_monsters (
  id          SERIAL PRIMARY KEY,
  dm_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT DEFAULT '',
  cr          TEXT DEFAULT '0',
  hp          INTEGER NOT NULL DEFAULT 1,
  ac          INTEGER NOT NULL DEFAULT 10,
  stats       JSONB NOT NULL DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
  abilities   TEXT DEFAULT '',
  description TEXT DEFAULT ''
);

-- MODO MAZMORRA: sesiones (salas) de juego en tiempo real
CREATE TABLE IF NOT EXISTS dungeon_sessions (
  id            SERIAL PRIMARY KEY,
  party_id      INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  dm_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'Sala',
  status        TEXT NOT NULL DEFAULT 'waiting', -- 'waiting' | 'active' | 'closed'
  canvas_data   JSONB NOT NULL DEFAULT '[]',     -- lista de trazos del dibujo de la mazmorra
  turn_order    JSONB NOT NULL DEFAULT '[]',     -- lista ordenada de combatientes (iniciativa)
  current_turn  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MODO MAZMORRA: registro de tiradas de habilidad
CREATE TABLE IF NOT EXISTS skill_checks (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES dungeon_sessions(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor       TEXT NOT NULL,            -- nombre del personaje o monstruo
  ability     TEXT NOT NULL,           -- str/dex/.../skill
  roll        INTEGER NOT NULL,
  modifier    INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL,
  dc          INTEGER,
  success     BOOLEAN,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_char ON inventory_items(character_id);
CREATE INDEX IF NOT EXISTS idx_stories_party ON stories(party_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON party_members(user_id);
