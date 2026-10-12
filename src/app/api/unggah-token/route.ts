import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { wajibLogin } from '@/lib/auth/rbac';
import { BATAS_BUKTI, BATAS_FOTO } from '@/lib/blob';

/**
 * Memberi token unggah untuk client-direct upload.
 *
 * Token hanya diberikan kalau pengguna benar-benar berhak mengunggah, jadi
 * proses otorisasi tetap di server walaupun berkasnya langsung ke storage.
 */
export async function POST(request: Request) {
  try {
    await wajibLogin();
  } catch {
    // wajibLogin() melakukan redirect; tapi di route handler kita balas 401.
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  // Batas 2 MB untuk bukti transfer, 15 MB untuk foto hasil.
  // Folder tujuan ditentukan di dalam onBeforeGenerateToken.
  const maks = BATAS_BUKTI;

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (p) => {
      // Tolak nama berkas yang menyamar (mis. ".php" atau "../../").
      const nama = p.split('/').pop() ?? '';
      if (!/^[A-Za-z0-9._-]{1,120}$/.test(nama) || nama.includes('..')) {
        throw new Error('Nama berkas tidak valid.');
      }
      return {
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        maximumSizeInBytes: maks,
        addRandomSuffix: true,
      };
    },
    onUploadCompleted: async () => {},
  });

  return NextResponse.json(jsonResponse);
}