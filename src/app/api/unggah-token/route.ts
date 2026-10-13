import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse, type NextRequest } from 'next/server';
import { wajibLogin, wajibFoto } from '@/lib/auth/rbac';
import { currentUser } from '@/lib/auth/session';
import { bolehUnggahBuktiTamu } from '@/lib/tamu';
import { aturanUnggah } from '@/lib/blob';

/**
 * Memberi token unggah untuk client-direct upload.
 *
 * Token hanya diberikan kalau pengguna benar-benar berhak mengunggah, jadi
 * proses otorisasi tetap di server walaupun berkasnya langsung ke storage.
 *
 * `jenis` menentukan siapa yang boleh mengunggah dan batas ukurannya:
 *  - 'bukti' -> siswa/admin (bukti transfer, maks 2 MB, boleh PDF)
 *  - 'hasil' -> admin/fotografer (foto hasil, maks 15 MB, hanya gambar)
 */
export async function POST(request: NextRequest) {
  try {
    await wajibLogin();
  } catch {
    // wajibLogin() melakukan redirect; tapi di route handler kita balas 401.
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const raw = (await request.json()) as HandleUploadBody & {
    jenis?: unknown;
    pesanan_id?: unknown;
  };
  const aturan = aturanUnggah(raw.jenis ?? 'bukti');
  if (!aturan) {
    return NextResponse.json({ error: 'Jenis unggahan tidak dikenal.' }, { status: 400 });
  }

  // Otorisasi per jenis:
  //  - 'hasil' hanya admin & fotografer,
  //  - 'bukti' boleh siswa, DAN tamu yang memegang token pesanannya sendiri
  //    (pemesan tanpa akun tetap harus bisa mengunggah bukti transfer).
  try {
    if (aturan.label === 'Bukti transfer') {
      const u = await currentUser();
      if (u && u.peran !== 'user') return new NextResponse('Unauthorized', { status: 401 });
      const dariQuery = request.nextUrl.searchParams.get('pesanan_id');
      if (!u && !(await bolehUnggahBuktiTamu(dariQuery ?? raw.pesanan_id))) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    } else {
      await wajibFoto();
    }
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const jsonResponse = await handleUpload({
    body: raw,
    request,
    onBeforeGenerateToken: async (p) => {
      // Tolak nama berkas yang menyamar (mis. ".php" atau "../../").
      const nama = p.split('/').pop() ?? '';
      if (!/^[A-Za-z0-9._-]{1,120}$/.test(nama) || nama.includes('..')) {
        throw new Error('Nama berkas tidak valid.');
      }
      return {
        allowedContentTypes: aturan.tipe,
        maximumSizeInBytes: aturan.maks,
        addRandomSuffix: true,
      };
    },
    onUploadCompleted: async () => {},
  });

  return NextResponse.json(jsonResponse);
}