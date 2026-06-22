#!/usr/bin/env bash
# Prueba rápida de despliegue del MONOLITO con Docker Compose.
set -euo pipefail
cd "$(dirname "$0")"

BASE="http://localhost:${WEB_PORT:-8080}"
echo "==> Levantando monolito (docker compose up --build)…"
docker compose up -d --build

cleanup() { echo "==> Apagando…"; docker compose down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> Esperando /api/health…"
for i in $(seq 1 40); do
  if curl -sf "$BASE/api/health" >/dev/null 2>&1; then break; fi
  sleep 2
  [ "$i" = "40" ] && { echo "FALLO: la API no respondió"; docker compose logs app; exit 1; }
done

pass=0; fail=0
check() { if [ "$1" = "$2" ]; then echo "  ✔ $3"; pass=$((pass+1)); else echo "  ✘ $3 (esperado '$2', obtenido '$1')"; fail=$((fail+1)); fi; }

U="dm_$RANDOM"
echo "==> Registro / login"
TOKEN=$(curl -sf -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U\",\"password\":\"secret123\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] && echo "  ✔ token recibido" && pass=$((pass+1)) || { echo "  ✘ sin token"; fail=$((fail+1)); }
AUTH="Authorization: Bearer $TOKEN"

echo "==> Crear personaje (modo usuario)"
CHAR=$(curl -sf -X POST "$BASE/api/characters" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Aragorn","race":"Humano","class":"Montaraz","level":5,"hp":40,"max_hp":40,"ac":16}')
CID=$(echo "$CHAR" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
check "$(echo "$CHAR" | grep -c Aragorn)" "1" "personaje creado"

echo "==> Inventario"
curl -sf -X POST "$BASE/api/characters/$CID/items" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Andúril","quantity":1,"weight":3}' >/dev/null
ITEMS=$(curl -sf "$BASE/api/characters/$CID/items" -H "$AUTH")
check "$(echo "$ITEMS" | grep -c Andúril)" "1" "objeto agregado al inventario"

echo "==> Crear mesa (party) + grimorio + bestiario (modo DM)"
PARTY=$(curl -sf -X POST "$BASE/api/parties" -H "$AUTH" -H 'Content-Type: application/json' -d '{"name":"La Comunidad"}')
PID=$(echo "$PARTY" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
check "$(echo "$PARTY" | grep -c 'join_code')" "1" "mesa creada con código"
curl -sf -X POST "$BASE/api/dm/grimoire" -H "$AUTH" -H 'Content-Type: application/json' -d '{"name":"Bola de fuego","level":3}' >/dev/null
check "$(curl -sf "$BASE/api/dm/grimoire" -H "$AUTH" | grep -c 'Bola de fuego')" "1" "hechizo en grimorio"
curl -sf -X POST "$BASE/api/dm/bestiary" -H "$AUTH" -H 'Content-Type: application/json' -d '{"name":"Goblin","cr":"1/4","hp":7}' >/dev/null
check "$(curl -sf "$BASE/api/dm/bestiary" -H "$AUTH" | grep -c Goblin)" "1" "monstruo en bestiario"

echo "==> Modo mazmorra: iniciar sala"
SESS=$(curl -sf -X POST "$BASE/api/dungeon/sessions" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"party_id\":$PID,\"name\":\"Cripta\"}")
check "$(echo "$SESS" | grep -c '"status":"waiting"')" "1" "sala iniciada en espera"

echo "==> Sync (PWA pull/push offline)"
SNAP=$(curl -sf "$BASE/api/sync/pull" -H "$AUTH")
check "$(echo "$SNAP" | grep -c Aragorn)" "1" "pull incluye personaje"
PUSH=$(curl -sf -X POST "$BASE/api/sync/push" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"operations\":[{\"entity\":\"character\",\"op\":\"update\",\"id\":$CID,\"data\":{\"name\":\"Aragorn II\",\"race\":\"Humano\",\"class\":\"Rey\",\"level\":6,\"hp\":50,\"max_hp\":50,\"ac\":18,\"stats\":{\"str\":16},\"notes\":\"\"}}]}")
check "$(echo "$PUSH" | grep -c '"ok":true')" "1" "push batch aplicado"
check "$(curl -sf "$BASE/api/characters/$CID" -H "$AUTH" | grep -c 'Aragorn II')" "1" "cambio batch persistido"

echo "==> Control de acceso (sin token => 401)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/characters")
check "$CODE" "401" "rutas protegidas exigen login"

echo ""
echo "Resultado MONOLITO: $pass pruebas OK, $fail fallidas"
[ "$fail" = "0" ]
