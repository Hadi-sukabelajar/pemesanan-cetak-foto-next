#!/bin/bash
# Tes instalasi admin pertama (/setup).
#
# Berbeda dari jalankan-tes.sh, skrip ini memakai database KOSONG dan server
# sendiri di port 3001, karena /setup hanya terbuka saat belum ada admin.
# Database pengembangan di 55432 tidak tersentuh sama sekali.
set -u
cd "$(dirname "$0")"

PORT=3001
DB_UJI="foto_pelantikan_setup_uji"
PG_URL="postgresql://postgres:postgres@127.0.0.1:55432/$DB_UJI"
KODE="kode-rahasia-uji"

stop() {
  pkill -9 -f "next-server" 2>/dev/null
  pkill -9 -f "next start" 2>/dev/null
  sleep 1
}

# Kembalikan server utama supaya tidak tertinggal mati.
restore() {
  pkill -9 -f "PORT=$PORT" 2>/dev/null
  pkill -9 -f "next-server" 2>/dev/null
  docker exec fp-pg psql -U postgres -d postgres -c \
    "DROP DATABASE IF EXISTS $DB_UJI;" >/dev/null 2>&1
  (setsid env DATABASE_URL="$PG_URL_ASLI" npm run start > /tmp/opencode/next-prod.log 2>&1 < /dev/null &)
  for i in $(seq 1 30); do
    curl -s -m 3 -o /dev/null http://127.0.0.1:3000/ && break
    sleep 1
  done
}

PG_URL_ASLI="postgresql://postgres:postgres@127.0.0.1:55432/foto_pelantikan"
PG_URL_ASLI="$(grep -o 'postgresql://[^"]*' .env.local 2>/dev/null | head -1)"
[ -z "${PG_URL_ASLI}" ] && PG_URL_ASLI="postgresql://postgres:postgres@127.0.0.1:55432/foto_pelantikan"

echo "▸ Build produksi..."
rm -rf .next
if ! npm run build > /tmp/opencode/build-setup.log 2>&1; then
  echo "✘ Build gagal:"; tail -20 /tmp/opencode/build-setup.log; exit 1
fi

echo "▸ Menyiapkan database kosong '$DB_UJI'..."
docker exec fp-pg psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS $DB_UJI;" >/dev/null
docker exec fp-pg psql -U postgres -d postgres -c "CREATE DATABASE $DB_UJI;" >/dev/null

echo "▸ Memasang skema (tanpa seed — harus kosong)..."
if ! DATABASE_URL="$PG_URL" npx drizzle-kit push --force > /tmp/opencode/push-setup.log 2>&1; then
  echo "✘ Gagal memasang skema:"; tail -20 /tmp/opencode/push-setup.log; exit 1
fi

stop
echo "▸ Menjalankan server uji di port $PORT (SETUP_KEY diisi)..."
(
  setsid env \
    DATABASE_URL="$PG_URL" \
    SESSION_SECRET="kode-rahasia-uji-untuk-sesi-yang-panjang-sekalinya-123456" \
    SETUP_KEY="$KODE" \
    PORT="$PORT" \
    npm run start > /tmp/opencode/next-setup.log 2>&1 < /dev/null &
)

siap=0
for i in $(seq 1 40); do
  if curl -s -m 3 -o /dev/null "http://127.0.0.1:$PORT/setup"; then siap=1; break; fi
  sleep 1
done
if [ "$siap" != "1" ]; then
  echo "✘ Server uji tidak siap:"; tail -20 /tmp/opencode/next-setup.log; restore; exit 1
fi
echo "  server siap (${i}s)"

echo "▸ Menjalankan pengujian setup..."
export SKIP_SETUP=1
FILTER=()
if [ -n "${1:-}" ]; then FILTER=(--grep "$1"); fi

BASE_URL="http://127.0.0.1:$PORT" npx playwright test tests/setup-awal.spec.ts "${FILTER[@]}" 2>&1 | tail -"${2:-25}"
KODE_HASIL=$?

restore
echo "▸ Database uji dihapus, server utama dikembalikan."
exit $KODE_HASIL