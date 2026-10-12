import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import type { Pengguna } from '@/lib/db/schema';

/**
 * Ambil pesanan milik pengguna tertentu saja.
 *
 * Dipisah dari berkas 'use server' karena berkas semacam itu hanya boleh
 * mengekspor fungsi async, sedangkan fungsi ini sinkron dan dipakai juga
 * dari halaman (bukan hanya dari aksi).
 */
export async function pesananMilik(pengguna: Pengguna, id: number) {
  const [p] = await getDb()
    .select()
    .from(pesanan)
    .where(and(eq(pesanan.id, id), eq(pesanan.penggunaId, pengguna.id)))
    .limit(1);
  return p ?? null;
}

/** Pesanan milik pengguna, diurutkan dari yang terbaru. */
export async function semuaPesananMilik(pengguna: Pengguna) {
  return getDb()
    .select()
    .from(pesanan)
    .where(eq(pesanan.penggunaId, pengguna.id))
    .orderBy(desc(pesanan.id));
}