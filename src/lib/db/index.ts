import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

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
export type Db = NeonHttpDatabase<typeof schema>;

/**
 * Koneksi database (PostgreSQL).
 *
 * Kenapa dua driver?
 *
 *  - Produksi (Neon / Vercel) memakai driver HTTP serverless dari Neon.
 *    Lewat HTTPS biasa, jadi tidak menahan koneksi TCP antar request —
 *    aman untuk model serverless yang bisa diskalakan jadi banyak instance.
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

export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL belum diisi. Salin .env.example menjadi .env.local lalu isi.',
    );
  }

  if (isLokal(url)) {
    const pool = new Pool({ connectionString: url, max: 5 });
    return drizzlePg(pool, { schema }) as unknown as Db;
  }
  return drizzleNeon(neon(url), { schema });
}

/** Tipe handle transaksi yang dipakai modul bisnis. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export { schema };