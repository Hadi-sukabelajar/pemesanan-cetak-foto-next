import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { wajibLogin, bolehBukaPesanan } from '@/lib/auth/rbac';
import { alirkanBlob } from '@/lib/blob';

/**
 * Menampilkan / mengunduh foto hasil — pemilik pesanan, admin, guru, atau fotografer.
 *
 * Berkas TIDAK pernah diekspos lewat URL publik: semuanya dilayani dari sini
 * setelah cek izin, lalu dialirkan dari Vercel Blob. Padanan foto.php PHP.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const u = await wajibLogin();
  const { id } = await params;
  const idNum = Number(id) || 0;

  const [p] = await getDb().select().from(pesanan).where(eq(pesanan.id, idNum)).limit(1);

  if (!p || !bolehBukaPesanan(u, p.penggunaId) || !p.fotoHasil) {
    return new NextResponse('Foto tidak ditemukan.', { status: 404 });
  }

  const res = await alirkanBlob(p.fotoHasil);
  if (!res) return new NextResponse('File tidak ada.', { status: 404 });

  // Nama berkas saat diunduh mengikuti nama pemesan (mis. febri.jpeg).
  const url = new URL(request.url);
  const unduh = url.searchParams.has('dl');
  const nama = (p.namaFile ?? p.fotoHasil.split('/').pop() ?? 'foto').replace(
    /[^A-Za-z0-9._-]/g,
    '_',
  );

  res.headers.set(
    'Content-Disposition',
    `${unduh ? 'attachment' : 'inline'}; filename="${nama}"`,
  );
  return res;
}