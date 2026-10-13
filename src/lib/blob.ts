import 'server-only';
import { del, get, head, put } from '@vercel/blob';

/**
 * Penyimpanan foto & bukti transfer (Vercel Blob).
 *
 * Kenapa tidak folder uploads/ seperti di PHP?
 * File pada Vercel Functions bersifat sementara — isinya hilang begitu
 * instance dimatikan. Jadi semua berkas disimpan di object storage.
 *
 * Yang disimpan di database bukan nama file lokal, melainkan *pathname* blob
 * seperti "bukti/8f2a....jpg".
 */

/** Batas ukuran & jenis berkas (divalidasi ulang di server). */
export const BATAS_BUKTI = 2 * 1024 * 1024; // 2 MB
export const BATAS_FOTO = 15 * 1024 * 1024; // 15 MB

/** Peta magic bytes -> ekstensi. Meniru pemeriksaan finfo di PHP. */
const JENIS: Array<{ ext: string; mime: string; cocok: (b: Uint8Array) => boolean }> = [
  { ext: 'jpg', mime: 'image/jpeg', cocok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', mime: 'image/png', cocok: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    ext: 'webp',
    mime: 'image/webp',
    cocok: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    ext: 'pdf',
    mime: 'application/pdf',
    cocok: (b) =>
      b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
];

export type JenisUnggahan = 'bukti' | 'hasil';

/**
 * Periksa 12 byte pertama berkas untuk memastikan isinya benar-benar gambar
 * atau PDF — bukan sekadar nama berkas yang berakhir .jpg.
 *
 * Ini padanan finfo_file() + daftar putih di simpan_bukti()/simpan_foto_hasil()
 * versi PHP: nama file dari browser tidak pernah dipercaya.
 */
export function deteksiJenis(byteAwal: Uint8Array): { ext: string; mime: string } | null {
  for (const j of JENIS) {
    if (byteAwal.length >= 12 && j.cocok(byteAwal)) {
      return { ext: j.ext, mime: j.mime };
    }
  }
  return null;
}

/** Nama berkas acak, persis seperti bin2hex(random_bytes()) di PHP. */
function namaAcak(banyak: number): string {
  const bytes = new Uint8Array(banyak);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Simpan satu berkas ke Blob setelah divalidasi. */
export async function simpanBerkas(
  file: File,
  jenis: JenisUnggahan,
): Promise<{ ok: true; pathname: string; mime: string } | { ok: false; pesan: string }> {
  const batas = jenis === 'bukti' ? BATAS_BUKTI : BATAS_FOTO;
  if (file.size === 0) {
    return { ok: false, pesan: 'Berkas kosong.' };
  }
  if (file.size > batas) {
    const maks = batas / (1024 * 1024);
    return {
      ok: false,
      pesan:
        jenis === 'bukti'
          ? `Ukuran berkas maksimal ${maks} MB.`
          : `Ukuran foto maksimal ${maks} MB.`,
    };
  }

  // Magic bytes: baca awal berkas, bukan percaya nama/header dari browser.
  const head12 = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const terdeteksi = deteksiJenis(head12);
  if (!terdeteksi) {
    return {
      ok: false,
      pesan:
        jenis === 'bukti'
          ? 'Format berkas harus JPG, PNG, WEBP, atau PDF.'
          : 'Format foto harus JPG, PNG, atau WEBP.',
    };
  }
  // Bukti boleh PDF; foto hasil tidak.
  if (jenis === 'hasil' && terdeteksi.ext === 'pdf') {
    return { ok: false, pesan: 'Format foto harus JPG, PNG, atau WEBP.' };
  }

  const folder = jenis === 'bukti' ? 'bukti' : 'hasil';
  const pathname = `${folder}/${namaAcak(12)}.${terdeteksi.ext}`;

  await put(pathname, file, {
    access: 'private',
    contentType: terdeteksi.mime,
    addRandomSuffix: false,
    // Foto hasil tidak pernah berubah isinya, jadi boleh di-cache lama.
    cacheControlMaxAge: jenis === 'hasil' ? 60 * 60 * 24 * 30 : 0,
  });

  return { ok: true, pathname, mime: terdeteksi.mime };
}

/** Ambil nama berkas asli dari pathname blob (untuk header unduhan). */
export async function namaDariBlob(pathname: string): Promise<string | null> {
  try {
    const info = await head(pathname);
    return info.pathname.split('/').pop() ?? null;
  } catch {
    return null;
  }
}

/** Alirkan isi blob ke response (dipakai route /api/foto & /api/bukti). */
export async function alirkanBlob(pathname: string): Promise<Response | null> {
  try {
    const hasil = await get(pathname, { access: 'private' });
    if (!hasil) return null;
    return new Response(hasil.stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': hasil.blob.contentType ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=0, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return null;
  }
}

/** Hapus berkas dari Blob; diam-diam gagal kalau memang sudah tidak ada. */
export async function hapusBlob(pathname: string | null | undefined): Promise<void> {
  if (!pathname) return;
  try {
    await del(pathname);
  } catch {
    // Berkas sudah hilang di sisi storage — tidak masalah.
  }
}

/**
 * Pemeriksaan pathname berkas di Vercel Blob.
 *
 * Pathname yang sampai ke server SELALU punya bentuk:
 *
 *     <folder>/<nama-asli><suffix-acak>.<ekstensi>
 *
 * contoh: `bukti/transfer-GzDImKcfDWes5jDlNDG9mLg1wupPBs.png`
 *
 * Sufiks acak itu dibuat Vercel (addRandomSuffix) dan berisi huruf besar
 * serta angka — bukan hanya heksadesimal kecil. Versi lama regexp-nya
 * hanya menerima nama berkas yang isinya heksadesimal murni, sehingga
 * SETIAP unggahan dari browser ditolak dengan "Berkas tidak dikenali".
 * Unggahan hanya mungkin berhasil kalau nama berkas dibikin seluruhnya
 * acak di server (jalur `simpanBerkas`) — padahal itu bukan jalur yang
 * dipakai pemesan.
 *
 * Yang tetap dijaga di sini:
 *  - folder persis 'bukti' atau 'hasil' (tidak bisa keluar dari foldernya),
 *  - nama berkas hanya boleh huruf, angka, titik, garis, dan strip,
 *  - '..' dan '/' di dalam nama ditolak (anti path traversal),
 *  - ekstensi wajib salah satu yang diizinkan,
 *  - panjang dibatasi supaya storage tidak bisa dibanjiri.
 */

const EKSTENSI_BUKTI = 'jpg|png|webp|pdf';
const EKSTENSI_HASIL = 'jpg|png|webp';

/** Panjang nama berkas (tanpa folder). */
const MAKS_NAMA = 150;

function pathnameValid(pathname: string, folder: string, ekstensi: string): boolean {
  if (typeof pathname !== 'string') return false;

  const awalan = `${folder}/`;
  if (!pathname.startsWith(awalan)) return false;

  const nama = pathname.slice(awalan.length);

  if (nama === '' || nama.length > MAKS_NAMA) return false;
  if (nama.includes('/') || nama.includes('..')) return false;
  if (nama.includes('\\') || /[\r\n\0]/.test(nama)) return false;

  return new RegExp(`^[A-Za-z0-9][A-Za-z0-9._-]*\\.(${ekstensi})$`).test(nama);
}

export function validasiPathnameBukti(pathname: string): boolean {
  return pathnameValid(pathname, 'bukti', EKSTENSI_BUKTI);
}

export function validasiPathnameHasil(pathname: string): boolean {
  return pathnameValid(pathname, 'hasil', EKSTENSI_HASIL);
}

/** Aturan per jenis unggahan: batas ukuran, tipe konten, dan pola pathname. */
export type AturanUnggah = {
  maks: number;
  tipe: string[];
  valid: (pathname: string) => boolean;
  label: string;
};

/**
 * Normalisasi parameter `jenis` dari request.
 * Nilai tak dikenal dikembalikan apa adanya supaya pemanggil bisa menolak.
 */
export function aturanUnggah(jenis: unknown): AturanUnggah | null {
  if (jenis === 'bukti') {
    return {
      maks: BATAS_BUKTI,
      tipe: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      valid: validasiPathnameBukti,
      label: 'Bukti transfer',
    };
  }
  if (jenis === 'hasil') {
    return {
      maks: BATAS_FOTO,
      // Foto hasil tidak boleh PDF: halamannya selalu menampilkan <img>.
      tipe: ['image/jpeg', 'image/png', 'image/webp'],
      valid: validasiPathnameHasil,
      label: 'Foto hasil',
    };
  }
  return null;
}

/** Daftar ekstensi gambar yang boleh untuk foto hasil (dipakai pesan galat). */
export const EKSTENSI_GAMBAR = ['jpg', 'png', 'webp'] as const;
