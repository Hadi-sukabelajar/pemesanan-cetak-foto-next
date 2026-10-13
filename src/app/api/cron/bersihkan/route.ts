import { NextResponse, type NextRequest } from 'next/server';
import { bersihkanSesi } from '@/lib/auth/session';
import { bersihkanKedaluwarsa } from '@/lib/auth/rate-limit';
import { count } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { sesi, percobaanLogin } from '@/lib/db/schema';

/**
 * Pembersihan data kedaluwarsa, dipanggil lewat Vercel Cron.
 *
 * Tanpa ini, tabel `sesi` dan `percobaan_login` akan menumpuk selamanya:
 *  - sesi 14 hari setelah dibuat masih dihitung "aktif" walau tak pernah
 *    dipakai lagi,
 *  - catatan percobaan login yang sudah lewat 15 menit tidak pernah hilang.
 *
 * Endpoint ini DELETE dari database, jadi WAJIB diamankan. Vercel mengirim
 * header `Authorization: Bearer <CRON_SECRET>` untuk setiap cron job.
 */
export async function GET(request: NextRequest) {
  const rahasia = process.env.CRON_SECRET;
  const Given = request.headers.get('authorization') ?? '';

  // Kalau CRON_SECRET belum diisi, endpoint dimatikan total — lebih baik
  // tidak jalan daripada bisa dipanggil siapa saja.
  if (!rahasia) {
    return NextResponse.json(
      { ok: false, pesan: 'CRON_SECRET belum diisi; pembersihan dimatikan.' },
      { status: 503 },
    );
  }
  if (Given !== `Bearer ${rahasia}`) {
    return NextResponse.json({ ok: false, pesan: 'Unauthorized' }, { status: 401 });
  }

  await bersihkanSesi();
  await bersihkanKedaluwarsa();

  // Berapa yang tersisa, biar mudah dicek dari log Vercel.
  const db = getDb();
  const [[sisaSesi], [sisaPercobaan]] = await Promise.all([
    db.select({ n: count() }).from(sesi),
    db.select({ n: count() }).from(percobaanLogin),
  ]);

  return NextResponse.json({ ok: true, sisaSesi, sisaPercobaan });
}