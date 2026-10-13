#!/bin/bash
# Build produksi, jalankan server, lalu jalankan pengujian.
# Dipakai karena mode `next dev` tidak bisa hydrate di lingkungan ini
# (koneksi HMR websocket diblokir), sedangkan produksi berjalan normal.
set -u
cd "$(dirname "$0")"

# --- Pengaman: jangan pernah menguji database produksi ---------------------
# Suite ini sengaja merusak data: membuat akun, pesanan, dan mengubah
# Pengaturan. Kalau .env.local menunjuk ke database produksi, seluruh data itu
# akan ditulis ke sana. Karena itu skrip berhenti di sini.
HOST_DB=$(node -e "
const fs=require('fs');
let url='';
try{ url=process.env.DATABASE_URL||'' }catch(e){}
if(!url){ try{ process.loadEnvFile('.env.local'); url=process.env.DATABASE_URL||'' }catch(e){} }
try{ console.log(new URL(url).hostname) }catch(e){ console.log('') }
" 2>/dev/null)

case "$HOST_DB" in
  ""|localhost|127.0.0.1|::1) : ;;
  *)
    if [ "${IZIN_HANCUR_DATABASE:-0}" != "1" ]; then
      echo "✘ DITOLAK: .env.local menunjuk ke database non-lokal ($HOST_DB)."
      echo "  Suite pengujian sengaja merusak data (buat akun, pesanan, ubah"
      echo "  pengaturan), jadi tidak boleh jalan terhadap database produksi."
      echo
      echo "  Ubah DATABASE_URL di .env.local ke PostgreSQL lokal, atau set"
      echo "  IZIN_HANCUR_DATABASE=1 kalau memang benar-benar disengaja."
      exit 1
    fi
    ;;
esac

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