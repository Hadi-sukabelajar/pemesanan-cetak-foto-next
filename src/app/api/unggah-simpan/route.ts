import { NextResponse } from 'next/server';
import { wajibSiswa } from '@/lib/auth/rbac';
import { get, head } from '@vercel/blob';
import {
  BATAS_BUKTI,
  BATAS_FOTO,
  deteksiJenis,
  validasiPathnameBukti,
  hapusBlob,
} from '@/lib/blob';

/**
 * Verifikasi berkas yang baru diunggah dari browser.
 *
 * Karena berkas dikirim langsung ke storage, server tidak pernah menyentuh
 * isinya. Jadi sebelum pathname-nya dipercaya, server memeriksa ulang:
 *  1. pathname-nya memang hasil unggahan kita (bukan string bebas),
 *  2. ukuran sesuai batas,
 *  3. magic bytes-nya benar-benar gambar/PDF.
 *
 * Kalau tidak cocok, berkasnya langsung dihapus supaya tidak menumpuk
 * di storage sebagai sampah.
 */
export async function POST(request: Request) {
  try {
    await wajibSiswa();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Unauthorized' }, { status: 401 });
  }

  let pathname = '';
  try {
    const body = (await request.json()) as { pathname?: unknown };
    pathname = typeof body.pathname === 'string' ? body.pathname : '';
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Permintaan tidak valid.' }, { status: 400 });
  }

  const tolak = async (pesan: string) => {
    await hapusBlob(pathname);
    return NextResponse.json({ ok: false, pesan }, { status: 400 });
  };

  if (!validasiPathnameBukti(pathname)) {
    return NextResponse.json(
      { ok: false, pesan: 'Berkas tidak dikenali.' },
      { status: 400 },
    );
  }

  // 1. Ukuran
  let ukuran: number;
  try {
    const info = await head(pathname);
    ukuran = info.size;
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Berkas tidak ditemukan.' }, { status: 404 });
  }
  if (ukuran === 0) return tolak('Berkas kosong.');
  if (ukuran > BATAS_BUKTI) {
    return tolak(`Ukuran berkas maksimal ${BATAS_BUKTI / (1024 * 1024)} MB.`);
  }

  // 2. Magic bytes
  try {
    const hasil = await get(pathname, { access: 'private' });
    if (!hasil) return tolak('Berkas tidak bisa dibaca.');
    const stream = hasil.stream;
    if (!stream) return tolak('Berkas tidak bisa dibaca.');
    const reader = stream.getReader();
    const potongan = await reader.read();
    const awal = new Uint8Array(potongan.value ?? new ArrayBuffer(0));
    const terdeteksi = deteksiJenis(awal);
    if (!terdeteksi || terdeteksi.ext !== 'pdf' && !['jpg', 'png', 'webp'].includes(terdeteksi.ext)) {
      return tolak('Format berkas harus JPG, PNG, WEBP, atau PDF.');
    }
  } catch {
    return tolak('Berkas tidak bisa diperiksa.');
  }

  return NextResponse.json({
    ok: true,
    pathname,
    nama: pathname.split('/').pop(),
    ukuran,
  });
}

export { BATAS_FOTO };