import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { wajibLogin, wajibSiswa, wajibFoto } from '@/lib/auth/rbac';
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
export async function POST(request: Request) {
  try {
    await wajibLogin();
  } catch {
    // wajibLogin() melakukan redirect; tapi di route handler kita balas 401.
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const raw = (await request.json()) as HandleUploadBody & { jenis?: unknown };
  const aturan = aturanUnggah(raw.jenis ?? 'bukti');
  if (!aturan) {
    return NextResponse.json({ error: 'Jenis unggahan tidak dikenal.' }, { status: 400 });
  }

  // Otorisasi per jenis: siswa tidak boleh mengunggah foto hasil, dan
  // fotografer tidak boleh mengunggah bukti transfer.
  try {
    if (aturan.label === 'Bukti transfer') await wajibSiswa();
    else await wajibFoto();
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