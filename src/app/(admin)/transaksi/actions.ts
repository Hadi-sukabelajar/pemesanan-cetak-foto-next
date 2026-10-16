'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfAman } from '@/lib/auth/csrf';
import { flash } from '@/lib/flash';
import { teks } from '@/lib/input';
import { validasiPesanan, simpanPesanan, konfirmasiBayar, ubahStatus, setNamaFile } from '@/lib/orders';

/**
 * Simpan pesanan dari form admin (transaksi offline / ubah pesanan).
 *
 * Bila pesanan lama sudah LUNAS, isi (item & total) tidak lagi diubah —
 * uang yang sudah masuk tidak boleh berbeda dengan tagihan. Yang tetap bisa
 * diubah hanya data pemesan dan status.
 */
export async function aksiSimpanTransaksi(formData: FormData): Promise<void> {
  await wajibAdmin();
  if (!(await csrfAman(formData))) redirect('/transaksi');

  const id = Number(teks(formData.get('id'))) || 0;
  const hasil = await validasiPesanan(formData, { adminMode: true, editId: id });
  if (!hasil.ok) {
    await flash('bad', hasil.errors.join(' '));
    redirect(id ? `/transaksi/${id}` : '/transaksi');
  }

  const db = getDb();
  const lama = id
    ? ((await db.select().from(pesanan).where(eq(pesanan.id, id)).limit(1))[0] ?? null)
    : null;

  let baru: number;
  try {
    baru = await simpanPesanan(hasil.data, lama?.penggunaId ?? null, id || null);
  } catch (e) {
    await flash('bad', `Pesanan gagal disimpan: ${e instanceof Error ? e.message : 'galat'}`);
    redirect(id ? `/transaksi/${id}` : '/transaksi');
  }

  if (id && lama) {
    // Status & nama file hanya untuk mode edit. Status wajib lewat
    // ubahStatus() supaya aturan "batal tidak bisa hidup lagi" dan
    // "selesai wajib lunas" tetap berlaku.
    const st = teks(formData.get('status'));
    const namaFile = teks(formData.get('nama_file')).slice(0, 150);
    if (st !== '') {
      const hasilStatus = await ubahStatus(baru, st);
      if (!hasilStatus.ok) {
        await flash('bad', hasilStatus.pesan ?? 'Status tidak bisa diubah.');
        redirect(`/transaksi/${baru}`);
      }
    }
    await setNamaFile(baru, namaFile === '' ? null : namaFile);
    await flash('ok', 'Pesanan diperbarui.');
    redirect(`/transaksi/${baru}`);
  }

  // Pesanan baru: opsional langsung ditandai lunas (misal bayar di tempat).
  const bayar = teks(formData.get('bayar'));
  if (bayar === 'cash' || bayar === 'transfer') {
    const hasilBayar = await konfirmasiBayar(baru, bayar);
    const [p] = await db.select().from(pesanan).where(eq(pesanan.id, baru)).limit(1);
    if (hasilBayar.ok) {
      await flash(
        'ok',
        `Transaksi tersimpan & LUNAS (${bayar === 'cash' ? 'Cash' : 'Transfer'}). Nomor antrian: ${p?.noAntrian}`,
      );
    } else {
      await flash('bad', hasilBayar.pesan ?? 'Pembayaran gagal dikonfirmasi.');
    }
  } else {
    await flash('ok', 'Transaksi tersimpan (belum bayar). Konfirmasi pembayaran dari Dashboard.');
  }
  redirect(`/kuitansi/${baru}`);
}