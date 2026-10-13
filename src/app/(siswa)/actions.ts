'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { wajibSiswa, homePath } from '@/lib/auth/rbac';
import { currentUser } from '@/lib/auth/session';
import { tokenTersimpan, simpanIzinTamu } from '@/lib/tamu';
import { csrfAman } from '@/lib/auth/csrf';
import { flash } from '@/lib/flash';
import { teks } from '@/lib/input';
import { validasiPesanan, simpanPesanan } from '@/lib/orders';
import { pesananMilik, pesananMilikTamu } from '@/lib/pesanan-akses';

/** Buat pesanan baru. */
export async function aksiSimpanPesanan(formData: FormData): Promise<void> {
  // Boleh tanpa login — pemesan tamu dibuatkan pesanan dengan penggunaId null.
  // Yang tidak boleh: admin/guru/fotografer memesan lewat form ini.
  const u = await currentUser();
  if (u && u.peran !== 'user') redirect(homePath(u));
  if (!(await csrfAman(formData))) redirect('/pesan');

  const idEdit = Number(teks(formData.get('id'))) || 0;

  // Kalau ini pengeditan, pastikan pesanan memang milik orang ini DAN
  // masih boleh diubah: sudah lunas, sudah dikirim buktinya, atau
  // dibatalkan tidak boleh disentuh isinya.
  //
  // Tamu boleh mengedit pesanannya sendiri selama masih memegang tokennya,
  // tapi TIDAK boleh mengedit lewat ?id= milik orang lain.
  if (idEdit) {
    const lama = u
      ? await pesananMilik(u, idEdit)
      : await pesananMilikTamu(idEdit, await tokenTersimpan(idEdit));
    if (!lama) {
      await flash('bad', 'Pesanan tidak ditemukan.');
      redirect(u ? '/pesanan-saya' : '/cek');
    }
    if (
      lama.statusBayar === 'sudah' ||
      lama.statusBayar === 'menunggu_verifikasi' ||
      lama.status === 'dibatalkan'
    ) {
      await flash('warn', 'Pesanan ini tidak bisa diubah lagi.');
      redirect(u ? '/pesanan-saya' : '/cek');
    }
  }

  const hasil = await validasiPesanan(formData, { editId: idEdit });
  if (!hasil.ok) {
    await flash('bad', hasil.errors.join(' '));
    redirect(idEdit ? `/pesan?id=${idEdit}` : '/pesan');
  }

  let baru: number;
  let token: string | null = null;
  try {
    baru = await simpanPesanan(hasil.data, u?.id ?? null, idEdit || null, (t) => {
      token = t;
    });
  } catch (e) {
    await flash('bad', `Pesanan gagal disimpan: ${e instanceof Error ? e.message : 'galat tidak diketahui'}`);
    redirect(u ? '/pesanan-saya' : '/cek');
  }

  await flash(
    'ok',
    idEdit
      ? 'Pesanan diperbarui.'
      : u
        ? 'Pesanan tersimpan & nomor antrian sudah terbit. Klik "Bayar sekarang" untuk melanjutkan pembayaran.'
        : 'Pesanan tersimpan. Catat KODE PESANAN dan nomor HP-mu untuk membuka kuitansi lagi lewat menu Cek Pesanan.',
  );

  // Simpan token ke sesi lalu buka kuitansi lewat URL bersih.
  //
  // Ini dilakukan langsung di Server Action — di sinilah cookie BOLEH diubah,
  // sedangkan di Server Component (halaman kuitansi) tidak boleh. Kalau
  // tokeninstead dialihkan lewat /api/.../ambil, peramban akan melakukan
  // navigasi sisi-klien ke route handler dan tidak mengikuti redirect-nya.
  if (!idEdit && token) {
    await simpanIzinTamu(baru, token);
  }
  redirect(`/kuitansi/${baru}`);
}

/** Hapus pesanan sendiri (hanya kalau belum lunas). */
export async function aksiHapusPesanan(formData: FormData): Promise<void> {
  const u = await currentUser();
  if (u && u.peran !== 'user') redirect(homePath(u));
  if (!(await csrfAman(formData))) redirect(u ? '/pesanan-saya' : '/cek');

  const id = Number(teks(formData.get('id'))) || 0;
  const p = u
    ? await pesananMilik(u, id)
    : await pesananMilikTamu(id, await tokenTersimpan(id));

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
  const u = await currentUser();
  if (u && u.peran !== 'user') redirect(homePath(u));
  if (!(await csrfAman(formData))) redirect(u ? '/pesanan-saya' : '/cek');

  const id = Number(teks(formData.get('id'))) || 0;
  const metode = teks(formData.get('metode'));
  const pathnameBukti = teks(formData.get('bukti'), '');
  // Tamu yang tidak punya akun diarahkan kembali ke /cek, bukan daftar.
  const kembali = u ? '/pesanan-saya' : '/cek';

  const p = u
    ? await pesananMilik(u, id)
    : await pesananMilikTamu(id, await tokenTersimpan(id));
  if (!p) {
    await flash('bad', 'Pesanan tidak ditemukan.');
    redirect(kembali);
  }
  if (p.statusBayar === 'sudah') {
    await flash('warn', 'Pesanan ini sudah lunas.');
    redirect(`/kuitansi/${id}`);
  }
  if (p.status === 'dibatalkan') {
    await flash('warn', 'Pesanan ini sudah dibatalkan.');
    redirect(kembali);
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
    redirect(kembali);
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
    redirect(kembali);
  }

  await flash('bad', 'Pilih metode pembayaran.');
  redirect(`/pesan/${id}/bayar`);
}

