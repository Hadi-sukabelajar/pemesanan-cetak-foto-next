import { NextResponse } from 'next/server';
import { wajibFoto } from '@/lib/auth/rbac';
import { currentUser } from '@/lib/auth/session';
import { bolehUnggahBuktiTamu } from '@/lib/tamu';
import { get, head } from '@vercel/blob';
import { aturanUnggah, deteksiJenis, hapusBlob } from '@/lib/blob';

/**
 * Verifikasi berkas yang baru diunggah dari browser.
 *
 * Karena berkas dikirim langsung ke storage, server tidak pernah menyentuh
 * isinya. Jadi sebelum pathname-nya dipercaya, server memeriksa ulang:
 *  1. pathname-nya memang hasil unggahan kita (bukan string bebas),
 *  2. pengguna berhak mengunggah jenis itu,
 *  3. ukuran sesuai batas,
 *  4. magic bytes-nya benar-benar gambar/PDF.
 *
 * Kalau tidak cocok, berkasnya langsung dihapus supaya tidak menumpuk
 * di storage sebagai sampah.
 */
export async function POST(request: Request) {
  const raw = (await request.json().catch(() => ({}))) as {
    pathname?: unknown;
    jenis?: unknown;
    pesanan_id?: unknown;
  };

  const aturan = aturanUnggah(raw.jenis ?? 'bukti');
  if (!aturan) {
    return NextResponse.json({ ok: false, pesan: 'Jenis unggahan tidak dikenal.' }, { status: 400 });
  }

  // Sama seperti /api/unggah-token: tamu pemilik pesanan boleh mengunggah
  // bukti transfer untuk pesanannya sendiri.
  try {
    if (aturan.label === 'Bukti transfer') {
      const u = await currentUser();
      if (u && u.peran !== 'user') {
        return NextResponse.json({ ok: false, pesan: 'Unauthorized' }, { status: 401 });
      }
      if (!u && !(await bolehUnggahBuktiTamu(raw.pesanan_id))) {
        return NextResponse.json({ ok: false, pesan: 'Unauthorized' }, { status: 401 });
      }
    } else {
      await wajibFoto();
    }
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Unauthorized' }, { status: 401 });
  }

  const pathname = typeof raw.pathname === 'string' ? raw.pathname : '';

  const tolak = async (pesan: string) => {
    await hapusBlob(pathname);
    return NextResponse.json({ ok: false, pesan }, { status: 400 });
  };

  if (!aturan.valid(pathname)) {
    return NextResponse.json({ ok: false, pesan: 'Berkas tidak dikenali.' }, { status: 400 });
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
  if (ukuran > aturan.maks) {
    return tolak(`Ukuran berkas maksimal ${Math.round(aturan.maks / (1024 * 1024))} MB.`);
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
    if (!terdeteksi) return tolak('Format berkas harus JPG, PNG, WEBP, atau PDF.');

    // Foto hasil harus gambar; bukti transfer boleh PDF.
    const bolehPdf = terdeteksi.ext === 'pdf';
    if (!bolehPdf && !['jpg', 'png', 'webp'].includes(terdeteksi.ext)) {
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