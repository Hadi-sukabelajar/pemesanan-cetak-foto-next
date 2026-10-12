'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfAman } from '@/lib/auth/csrf';
import { flash } from '@/lib/flash';
import { teks, potongAtauKosong } from '@/lib/input';
import { safeBack } from '@/lib/safe-back';
import {
  konfirmasiBayar,
  tolakBukti,
  ubahStatus,
  setNamaFile,
  hapusPesanan,
} from '@/lib/orders';
import { hapusBlob } from '@/lib/blob';

/**
 * Aksi admin — terjemahan admin/_aksi.php.
 *
 * Aturan yang dijaga di sini (sudah pernah jadi bug):
 *  - Pesanan `dibatalkan` tidak bisa dikonfirmasi lunas maupun dihidupkan.
 *  - Pesanan belum lunas tidak bisa ditandai "Selesai".
 *  - Bukti transfer tidak bisa ditolak kalau pesanan sudah lunas
 *    (dulu file buktinya terhapus padahal database tidak berubah).
 *  - Tujuan redirect dibatasi ke folder admin/ (anti path traversal).
 */
async function denganAksi(formData: FormData, jalankan: () => Promise<void>): Promise<void> {
  await wajibAdmin();
  const back = safeBack(teks(formData.get('back')));
  if (!(await csrfAman(formData))) redirect(back);
  try {
    await jalankan();
  } catch (e) {
    await flash('bad', e instanceof Error ? e.message : 'Aksi gagal.');
  }
  redirect(back);
}

/** Konfirmasi pesanan lunas. */
export async function aksiBayar(formData: FormData): Promise<void> {
  await denganAksi(formData, async () => {
    const id = Number(teks(formData.get('id'))) || 0;
    const p = await getPesanan(id);
    if (!p) {
      await flash('bad', 'Pesanan tidak ditemukan.');
      return;
    }
    if (p.status === 'dibatalkan') {
      await flash('bad', `Pesanan ${p.kode} sudah dibatalkan, tidak bisa dikonfirmasi lunas.`);
      return;
    }
    const m = teks(formData.get('metode'));
    const metode = m === 'cash' || m === 'transfer' ? m : null;
    const hasil = await konfirmasiBayar(id, metode);
    if (!hasil.ok) {
      await flash('bad', hasil.pesan ?? 'Gagal mengonfirmasi.');
      return;
    }
    await flash('ok', `${p.kode} dikonfirmasi lunas. Nomor antrian: ${p.noAntrian}`);
  });
}

/** Tolak bukti transfer (hanya untuk pesanan yang belum lunas). */
export async function aksiTolak(formData: FormData): Promise<void> {
  await denganAksi(formData, async () => {
    const id = Number(teks(formData.get('id'))) || 0;
    const p = await getPesanan(id);
    if (!p) {
      await flash('bad', 'Pesanan tidak ditemukan.');
      return;
    }
    const hasil = await tolakBukti(id);
    if (!hasil.ok) {
      await flash('bad', hasil.pesan ?? 'Gagal menolak.');
      return;
    }
    // Berkas baru dihapus setelah UPDATE benar-benar berhasil, supaya
    // bukti tidak hilang sendirian kalau pesanannya ternyata sudah lunas.
    if (p.buktiTransfer) await hapusBlob(p.buktiTransfer);
    await flash('warn', `Bukti transfer ${p.kode} ditolak. User diminta upload ulang.`);
  });
}

/** Ubah status pesanan. */
export async function aksiStatus(formData: FormData): Promise<void> {
  await denganAksi(formData, async () => {
    const id = Number(teks(formData.get('id'))) || 0;
    const hasil = await ubahStatus(id, teks(formData.get('status')));
    if (!hasil.ok) {
      await flash('bad', hasil.pesan ?? 'Status tidak diubah.');
      return;
    }
    await flash('ok', `Status pesanan diperbarui.`);
  });
}

/** Simpan nama file foto hasil secara manual. */
export async function aksiNamaFile(formData: FormData): Promise<void> {
  await denganAksi(formData, async () => {
    const id = Number(teks(formData.get('id'))) || 0;
    await setNamaFile(id, potongAtauKosong(teks(formData.get('nama_file')), 150));
    await flash('ok', 'Nama file disimpan.');
  });
}

/** Hapus pesanan beserta berkas buktinya. */
export async function aksiHapus(formData: FormData): Promise<void> {
  await wajibAdmin();
  const back = safeBack(teks(formData.get('back')), '/pesanan');
  if (!(await csrfAman(formData))) redirect(back);

  try {
    const id = Number(teks(formData.get('id'))) || 0;
    const p = await getPesanan(id);
    if (!p) {
      await flash('bad', 'Pesanan tidak ditemukan.');
    } else {
      await hapusBlob(p.buktiTransfer);
      await hapusBlob(p.fotoHasil);
      await hapusPesanan(id);
      await flash('ok', `Pesanan ${p.kode} dihapus.`);
    }
  } catch (e) {
    await flash('bad', e instanceof Error ? e.message : 'Gagal menghapus.');
  }

  // Dari form edit, kembali ke daftar (formnya sudah tidak ada).
  redirect(back.includes('transaksi') ? '/pesanan' : back);
}

async function getPesanan(id: number) {
  const [p] = await getDb().select().from(pesanan).where(eq(pesanan.id, id)).limit(1);
  return p ?? null;
}

