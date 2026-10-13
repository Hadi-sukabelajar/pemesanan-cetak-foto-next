import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { urlSekitar } from '@/lib/asal';
import { simpanIzinTamu } from '@/lib/tamu';
import { tokenCocok } from '@/lib/izin-pesanan';

/**
 * Menyerap token pesanan dari URL ke dalam sesi.
 *
 * Alasan endpoint ini ada: halaman kuitansi adalah Server Component, dan
 * cookie hanya boleh diubah di Server Action atau Route Handler — bukan saat
 * render. Jadi ketika pemesan tanpa akun membuka tautan
 * `/kuitansi/12?t=<token>`, tokennya tidak bisa langsung disimpan ke sesi
 * dari halaman itu sendiri.
 *
 * Route handler inilah tempatnya: cookie bisa ditulis di sini. Setelah
 * disimpan, halaman dialihkan ke URL bersih
 * (`/kuitansi/12`) supaya token berhenti muncul di address bar, riwayat
 * browser, dan log server.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const idNum = Number(id) || 0;
  const token = request.nextUrl.searchParams.get('t') ?? '';

  const [p] = await getDb()
    .select({ token: pesanan.token })
    .from(pesanan)
    .where(eq(pesanan.id, idNum))
    .limit(1);

  // Token salah / pesanan tidak ada -> jangan simpan apa pun, dan jangan
  // balas differensinya juga (supaya tidak bisa dipakai menebak).
  if (!p || !tokenCocok(p.token, token)) {
    return NextResponse.redirect(urlSekitar(request, '/masuk'));
  }

  await simpanIzinTamu(idNum, p.token as string);
  return NextResponse.redirect(urlSekitar(request, `/kuitansi/${idNum}`));
}