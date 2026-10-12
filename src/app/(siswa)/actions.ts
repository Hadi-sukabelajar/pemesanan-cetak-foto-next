'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { wajibSiswa } from '@/lib/auth/rbac';
import { csrfAman } from '@/lib/auth/csrf';
import { flash } from '@/lib/flash';
import { teks } from '@/lib/input';
import { validasiPesanan, simpanPesanan } from '@/lib/orders';
import { pesananMilik } from '@/lib/pesanan-akses';

/** Buat pesanan baru. */
export async function aksiSimpanPesanan(formData: FormData): Promise<void> {
  const u = await wajibSiswa();
  if (!(await csrfAman(formData))) redirect('/pesan');

  const idEdit = Number(teks(formData.get('id'))) || 0;

  // Kalau ini pengeditan, pastikan pesanan memang milik orang ini DAN
  // masih boleh diubah: sudah lunas, sudah dikirim buktinya, atau
  // dibatalkan tidak boleh disentuh isinya.
  if (idEdit) {
    const lama = await pesananMilik(u, idEdit);
    if (!lama) {
      await flash('bad', 'Pesanan tidak ditemukan.');
      redirect('/pesanan-saya');
    }
    if (
      lama.statusBayar === 'sudah' ||
      lama.statusBayar === 'menunggu_verifikasi' ||
      lama.status === 'dibatalkan'
    ) {
      await flash('warn', 'Pesanan ini tidak bisa diubah lagi.');
      redirect('/pesanan-saya');
    }
  }

  const hasil = await validasiPesanan(formData, { editId: idEdit });
  if (!hasil.ok) {
    await flash('bad', hasil.errors.join(' '));
    redirect(idEdit ? `/pesan?id=${idEdit}` : '/pesan');
  }

  let baru: number;
  try {
    baru = await simpanPesanan(hasil.data, u.id, idEdit || null);
  } catch (e) {
    await flash('bad', `Pesanan gagal disimpan: ${e instanceof Error ? e.message : 'galat tidak diketahui'}`);
    redirect('/pesanan-saya');
  }

  await flash(
    'ok',
    idEdit
      ? 'Pesanan diperbarui.'
      : 'Pesanan tersimpan & nomor antrian sudah terbit. Klik "Bayar sekarang" untuk melanjutkan pembayaran.',
  );
  redirect(`/kuitansi/${baru}`);
}

/** Hapus pesanan sendiri (hanya kalau belum lunas). */
export async function aksiHapusPesanan(formData: FormData): Promise<void> {
  const u = await wajibSiswa();
  if (!(await csrfAman(formData))) redirect('/pesanan-saya');

  const id = Number(teks(formData.get('id'))) || 0;
  const p = await pesananMilik(u, id);

  if (!p) {
    await flash('bad', 'Pesanan tidak ditemukan.');
  } else if (p.statusBayar === 'sudah') {
    await flash('bad', 'Pesanan yang sudah lunas tidak bisa dihapus. Hubungi admin.');
  } else {
    await getDb().delete(pesanan).where(eq(pesanan.id, id));
    await flash('ok', `Pesanan ${p.kode} dihapus.`);
  }
  redirect('/pesanan-saya');
}

/**
 * Pilih metode pembayaran.
 *
 * Memilih Cash membersihkan bukti transfer lama supaya tidak membingungkan
 * admin (dulu file & datanya masih tertinggal walau sudah ganti metode).
 * Unggah bukti transfer ditangani terpisah oleh aksi di /api/upload.
 */
export async function aksiBayar(formData: FormData): Promise<void> {
  const u = await wajibSiswa();
  if (!(await csrfAman(formData))) redirect('/pesanan-saya');

  const id = Number(teks(formData.get('id'))) || 0;
  const metode = teks(formData.get('metode'));
  const pathnameBukti = teks(formData.get('bukti'), '');

  const p = await pesananMilik(u, id);
  if (!p) {
    await flash('bad', 'Pesanan tidak ditemukan.');
    redirect('/pesanan-saya');
  }
  if (p.statusBayar === 'sudah') {
    await flash('warn', 'Pesanan ini sudah lunas.');
    redirect(`/kuitansi/${id}`);
  }
  if (p.status === 'dibatalkan') {
    await flash('warn', 'Pesanan ini sudah dibatalkan.');
    redirect('/pesanan-saya');
  }

  const db = getDb();

  if (metode === 'cash') {
    // Bukti transfer lama tidak relevan lagi.
    if (p.buktiTransfer) {
      const { hapusBlob } = await import('@/lib/blob');
      await hapusBlob(p.buktiTransfer);
    }
    await db
      .update(pesanan)
      .set({ metode: 'cash', statusBayar: 'belum', buktiTransfer: null })
      .where(eq(pesanan.id, id));
    await flash('ok', 'Metode cash dipilih. Bayar langsung ke panitia, lalu admin akan mengonfirmasi.');
    redirect('/pesanan-saya');
  }

  if (metode === 'transfer') {
    if (!pathnameBukti) {
      await flash('bad', 'Upload bukti transfer terlebih dahulu.');
      redirect(`/pesan/${id}/bayar`);
    }
    // Validasi ulang di server: nama file & jenisnya sudah diperiksa saat
    // unggah, tapi pastikan path-nya memang milik kita.
    const { validasiPathnameBukti } = await import('@/lib/blob');
    if (!validasiPathnameBukti(pathnameBukti)) {
      await flash('bad', 'Bukti transfer tidak valid. Silakan upload ulang.');
      redirect(`/pesan/${id}/bayar`);
    }
    if (p.buktiTransfer && p.buktiTransfer !== pathnameBukti) {
      const { hapusBlob } = await import('@/lib/blob');
      await hapusBlob(p.buktiTransfer);
    }
    await db
      .update(pesanan)
      .set({ metode: 'transfer', statusBayar: 'menunggu_verifikasi', buktiTransfer: pathnameBukti })
      .where(eq(pesanan.id, id));
    await flash('ok', 'Bukti transfer terkirim. Menunggu verifikasi admin.');
    redirect('/pesanan-saya');
  }

  await flash('bad', 'Pilih metode pembayaran.');
  redirect(`/pesan/${id}/bayar`);
}

