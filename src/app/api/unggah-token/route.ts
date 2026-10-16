import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse, type NextRequest } from 'next/server';
import { wajibFoto } from '@/lib/auth/rbac';
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
  // CATATAN: jangan memanggil wajibLogin() di sini.
  //
  // Pemesan tanpa akun memang tidak punya akun, dan wajibLogin() melakukan
  // redirect() yang pada route handler jadi 401 — sehingga bukti transfer
  // tidak akan pernah bisa diunggah oleh tamu, berapa pun tokennya.
  // Otorisasi sebenarnya dilakukan per jenis di bawah: foto hasil hanya
  // untuk admin & fotografer, bukti transfer untuk siswa ATAU tamu yang
  // memegang token pesanannya sendiri.

  const raw = (await request.json()) as HandleUploadBody & {
    jenis?: unknown;
    pesanan_id?: unknown;
  };
  // SDK @vercel/blob mengirim { type, payload: { pathname, clientPayload } },
  // BUKAN { jenis } top-level. Jenis dibaca dari query ?jenis=, lalu
  // clientPayload, lalu awalan pathname, supaya "hasil/..." tidak jatuh
  // ke aturan bukti (yang membuat fotografer/admin selalu 401 + dibatasi 2 MB).
  const bodyPayload =
    raw && typeof raw === 'object' && 'payload' in raw
      ? (raw as { payload?: { pathname?: unknown; clientPayload?: unknown } }).payload
      : undefined;
  const pathnameReq =
    typeof bodyPayload?.pathname === 'string' ? (bodyPayload.pathname as string) : '';
  const clientPayload =
    typeof bodyPayload?.clientPayload === 'string'
      ? (bodyPayload.clientPayload as string)
      : '';
  const queryJenis = request.nextUrl.searchParams.get('jenis');
  let jenisReq: unknown = raw.jenis;
  if (jenisReq !== 'bukti' && jenisReq !== 'hasil') {
    if (queryJenis === 'bukti' || queryJenis === 'hasil') jenisReq = queryJenis;
    else if (clientPayload === 'bukti' || clientPayload === 'hasil') jenisReq = clientPayload;
    else if (pathnameReq.startsWith('hasil/')) jenisReq = 'hasil';
    else if (pathnameReq.startsWith('bukti/')) jenisReq = 'bukti';
    else jenisReq = 'bukti';
  }
  const aturan = aturanUnggah(jenisReq);
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
      // Pathname harus satu folder dengan jenis tokennya, supaya token
      // bukti tidak bisa dipakai mengunggah ke folder hasil (atau sebaliknya).
      const folderWajib = aturan.label === 'Bukti transfer' ? 'bukti/' : 'hasil/';
      if (!p.startsWith(folderWajib)) {
        throw new Error('Folder berkas tidak sesuai jenis unggahan.');
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