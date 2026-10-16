import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeonWs } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import ws from 'ws';
import * as schema from './schema';

// Driver WebSocket Neon butuh konstruktor WebSocket eksplisit di Node.
if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
}

// Skrip Node (seed, dll.) tidak memuat .env.local sendiri seperti Next.js,
// jadi kita baca manual supaya `npm run db:seed` bisa jalan apa adanya.
// process.loadEnvFile tersedia di Node 20.12+.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // file tidak ada — andalkan env dari shell saja
  }
}

/** Tipe database tunggal supaya method chaining konsisten di semua driver. */
export type Db = ReturnType<typeof drizzlePg<typeof schema>>;

/**
 * Koneksi database (PostgreSQL).
 *
 * Kenapa dua driver?
 *
 *  - Produksi (Neon / Vercel) memakai driver WebSocket serverless dari Neon.
 *    Dipakai WebSocket (bukan HTTP) karena driver HTTP-nya tidak mendukung
 *    transaksi, sedangkan logika pesanan membutuhkannya.
 *
 *  - Pengembangan lokal memakai node-postgres (pg), karena driver HTTP-nya
 *    hanya bisa bicara ke proxy Neon, bukan ke PostgreSQL biasa di localhost.
 *
 * Driver dipilih otomatis dari host DATABASE_URL, jadi kode aplikasi tidak
 * perlu tahu bedanya. Keduanya menyediakan API Drizzle yang sama, sehingga
 * hasilnya diseragamkan ke satu tipe.
 */
function isLokal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

/**
 * Pool PostgreSQL untuk mode lokal.
 *
 * Dua hal penting di sini:
 *
 * 1. Pool harus dipakai ulang — membuat `new Pool()` tiap permintaan akan
 *    membuka koneksi baru terus-menerus sampai PostgreSQL menolak dengan
 *    "sorry, too many clients already".
 *
 * 2. Disimpan di `globalThis`, bukan di variabel modul biasa. Next.js
 *    membundel setiap route secara terpisah, jadi variabel modul akan
 *    terduplikasi per bundel dan setiap bundel membuat pool sendiri.
 *    `globalThis` dipakai bersama oleh seluruh bundel dalam satu proses.
 */
const KUNCI_POOL = Symbol.for('foto-pelantikan.db.pool');

type DbGlobal = typeof globalThis & { [KUNCI_POOL]?: Pool };

function ambilPool(url: string): Pool {
  const g = globalThis as DbGlobal;
  if (!g[KUNCI_POOL]) {
    g[KUNCI_POOL] = new Pool({ connectionString: url, max: 10 });
  }
  return g[KUNCI_POOL];
}

export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL belum diisi. Salin .env.example menjadi .env.local lalu isi.',
    );
  }

  if (isLokal(url)) {
    return drizzlePg(ambilPool(url), { schema }) as unknown as Db;
  }

  // Neon WAJIB lewat driver WebSocket (neon-serverless), bukan neon-http.
  //
  // Alasannya: neon-http adalah driver HTTP stateless dan TIDAK mendukung
  // transaksi — memanggil db.transaction() langsung melempar
  // "No transactions support in neon-http driver". Setiap pembuatan pesanan
  // memakai transaksi (nomor antrian issued dengan FOR UPDATE supaya tidak
  // pernah bentrok), jadi memakai neon-http berarti pemesanan selalu gagal
  // di produksi.
  //
  // Driver WebSocket butuh paket `ws` untuk membuat koneksi di Node.
  return drizzleNeonWs(ambilNeonPool(url), { schema }) as unknown as Db;
}

/**
 * Pool Neon via WebSocket.
 *
 * Sama seperti pool lokal, disimpan di `globalThis` supaya tidak membuat
 * koneksi baru setiap kali modul ini di-bundle ulang oleh Next.js.
 */
const KUNCI_NEON = Symbol.for('foto-pelantikan.db.neon');

type NeonGlobal = typeof globalThis & { [KUNCI_NEON]?: NeonPool };

function ambilNeonPool(url: string): NeonPool {
  const g = globalThis as NeonGlobal;
  if (!g[KUNCI_NEON]) {
    g[KUNCI_NEON] = new NeonPool({ connectionString: url, max: 10 });
  }
  return g[KUNCI_NEON];
}

/** Tipe handle transaksi yang dipakai modul bisnis. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export { schema };