# PaTavo — API (Monolito)

Gestor de mesas de **D&D**: personajes, inventario, contenido de Dungeon Master
(historias, grimorio, bestiario) y un **modo mazmorra en tiempo real**.
Toda la lógica vive en un único proceso Node/Express (arquitectura monolítica),
con una PWA servida como front-end.

## Arquitectura

```
Navegador (PWA)
      │  http://localhost:8080
      ▼
┌─────────────┐   /            (estáticos: backend/public)
│   Nginx     │   /api/*       ──► proxy ─┐
│  (puerto 80)│   /socket.io/* ──► proxy ─┤ (WebSocket)
└─────────────┘                          │
                                         ▼
                              ┌────────────────────┐
                              │  app  (Express)     │  :3000  (interno)
                              │  + Socket.IO        │
                              └─────────┬──────────┘
                                        │ pg
                                        ▼
                                 ┌────────────┐
                                 │ PostgreSQL │  (volumen patavo_db)
                                 └────────────┘
```

- **Nginx** es el único punto de entrada (`WEB_PORT`, def. **8080**). Sirve el
  front estático y reenvía la API y los WebSockets al monolito.
- **app** (`src/backend`) expone todo bajo `/api/*` y la mazmorra por Socket.IO.
  Aplica el esquema (`src/schema.sql`) al arrancar, reintentando hasta que la BD
  esté lista.
- **db** PostgreSQL, sin puerto publicado (sólo accesible dentro de la red).

## Flujo interno

1. **Auth** (`routes/auth.js`): registro/login con bcrypt → emite **JWT** (7 días).
   El middleware `requireAuth` valida el token en cada ruta protegida.
2. **Modo usuario** (`routes/characters.js`, `parties.js`): CRUD de personajes e
   inventario; creación/unión a mesas mediante `join_code`.
3. **Modo DM** (`routes/dm.js`): historias por mesa, grimorio y bestiario; sólo el
   DM de la mesa puede editar (`helpers.isDM`).
4. **Modo mazmorra** (`sockets.js`): salas en tiempo real. El **servidor** tira los
   dados (anti-trampa), gestiona turnos y propaga el lienzo a los miembros.
5. **Sync offline** (`routes/sync.js`): `pull` entrega una instantánea completa;
   `push` aplica en lote las mutaciones acumuladas sin conexión.

## Puesta en marcha

```bash
./install.sh          # instala Docker + Compose, prepara .env y levanta todo
# o manualmente:
cd src && docker compose up -d --build
```

App disponible en **http://localhost:8080**. Variables en `src/.env`
(plantilla en `src/.env.example`). Prueba de humo: `cd src && ./test.sh`.
