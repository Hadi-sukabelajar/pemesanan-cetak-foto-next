#!/bin/bash
# Build produksi, jalankan server, lalu jalankan pengujian.
# Dipakai karena mode `next dev` tidak bisa hydrate di lingkungan ini
# (koneksi HMR websocket diblokir), sedangkan produksi berjalan normal.
set -u
cd "$(dirname "$0")"

stop() { pkill -9 -f "next-server" 2>/dev/null; pkill -9 -f "next start" 2>/dev/null; sleep 1; }
stop

if [ "${1:-}" != "--no-build" ]; then
  echo "▸ Build produksi..."
  rm -rf .next
  if ! npm run build > /tmp/opencode/build.log 2>&1; then
    echo "✘ Build gagal:"; tail -25 /tmp/opencode/build.log; exit 1
  fi
  grep -E "^(├|└|┌|ƒ|○|●)" /tmp/opencode/build.log | head -20
fi

echo "▸ Menjalankan server..."
(setsid npm run start > /tmp/opencode/next-prod.log 2>&1 < /dev/null &)
for i in $(seq 1 40); do
  if curl -s -m 3 -o /dev/null http://127.0.0.1:3000/ 2>/dev/null; then
    echo "  server siap (${i}s)"; break
  fi
  sleep 1
done

if [ "${RUN_TESTS:-1}" = "1" ]; then
  echo "▸ Menjalankan pengujian..."
  npx playwright test 2>&1 | tail -30
  KODE=$?
  echo "▸ Koneksi database: $(docker exec fp-pg psql -U postgres -tAc 'SELECT count(*) FROM pg_stat_activity;' 2>/dev/null || echo '?')"
  exit $KODE
fi