'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { wajibFoto } from '@/lib/auth/rbac';
import { csrfAman } from '@/lib/auth/csrf';
import { flash } from '@/lib/flash';
import { teks, potong } from '@/lib/input';
import { hapusBlob, validasiPathnameHasil, namaDariBlob } from '@/lib/blob';

/**
 * Simpan pathname foto hasil ke sebuah pesanan.
 *
 * Aturan bisnis:
 *  - hanya admin & fotografer yang boleh,
 *  - pathname harus hasil unggahan client-direct yang sudah tervalidasi,
 *  - foto hanya boleh dipasang ke pesanan yang sudah lunas (dan tidak dibatalkan),
 *    karena hanya foto sudah lunas yang Bhagikan ke pemesan.
 */
export async function aksiSimpanFoto(formData: FormData): Promise<void> {
  const u = await wajibFoto();
  const back = teks(formData.get('back'), '/upload-foto') || '/upload-foto';

  if (!(await csrfAman(formData))) redirect(back);

  const db = getDb();
  const id = Number(teks(formData.get('id'))) || 0;
  const pathname = potong(teks(formData.get('pathname')), 300);
  const namaFile = potong(teks(formData.get('nama_file')), 150);

  if (id <= 0 || !validasiPathnameHasil(pathname)) {
    await flash('bad', 'Berkas foto tidak dikenali. Silakan unggah ulang.');
    redirect(back);
  }

  const [p] = await db.select().from(pesanan).where(eq(pesanan.id, id)).limit(1);
  if (!p) {
    await flash('bad', 'Pesanan tidak ditemukan.');
    redirect(back);
  }
  if (p.status === 'dibatalkan') {
    await flash('bad', `Pesanan ${p.kode} dibatalkan, foto tidak bisa dipasang.`);
    redirect(back);
  }
  if (p.statusBayar !== 'sudah') {
    await flash(
      'bad',
      `Pesanan ${p.kode} belum lunas, foto hasil belum bisa dipasang. Selesaikan pembayaran dulu.`,
    );
    redirect(back);
  }

  // Ganti foto lama -> berkas lamanya langsung dihapus biar storage tidak menumpuk.
  const lama = p.fotoHasil;
  await db
    .update(pesanan)
    .set({
      fotoHasil: pathname,
      namaFile: namaFile === '' ? (await namaDariBlob(pathname)) : namaFile,
      diperbaruiPada: new Date(),
    })
    .where(eq(pesanan.id, id));

  if (lama && lama !== pathname) await hapusBlob(lama);

  await flash(
    'ok',
    `Foto hasil untuk ${p.kode} tersimpan.` +
      (u.peran === 'fotografer' ? ' Admin sudah bisa melihatnya di halaman pesanan.' : ''),
  );
  redirect(back);
}

/**
 * Lepas foto hasil dari pesanan (berkasnya ikut dihapus dari storage).
 * Berguna saat admin salah pasang foto.
 */
export async function aksiLepasFoto(formData: FormData): Promise<void> {
  await wajibFoto();
  const back = teks(formData.get('back'), '/upload-foto') || '/upload-foto';
  if (!(await csrfAman(formData))) redirect(back);

  const db = getDb();
  const id = Number(teks(formData.get('id'))) || 0;

  const [p] = await db.select().from(pesanan).where(eq(pesanan.id, id)).limit(1);
  if (!p || !p.fotoHasil) {
    await flash('bad', 'Pesanan tidak punya foto hasil.');
    redirect(back);
  }

  await hapusBlob(p.fotoHasil);
  await db
    .update(pesanan)
    .set({ fotoHasil: null, namaFile: null, diperbaruiPada: new Date() })
    .where(eq(pesanan.id, id));

  await flash('ok', `Foto hasil untuk ${p.kode} dilepas.`);
  redirect(back);
}