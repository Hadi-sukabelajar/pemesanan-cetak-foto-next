import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pengguna } from '@/lib/db/schema';
import { getSesi, updateSesi, buatSesi } from '@/lib/auth/session';
import { homePath } from '@/lib/auth/rbac';
import { flash } from '@/lib/flash';
import { googleAktif } from '@/components/GoogleButton';
import { asalRequest, urlSekitar } from '@/lib/asal';

/**
 * Callback Google OAuth. Padanan google_callback.php.
 *
 * Urutan pemeriksaannya penting:
 *  1. konfigurasi sudah benar,
 *  2. pengguna tidak membatalkan di layar Google,
 *  3. `state` cocok dengan yang kita simpan (proteksi CSRF),
 *  4. kode ditukar menjadi access token,
 *  5. identitas diambil dari userinfo dan emailnya benar-benar terverifikasi.
 *
 * Akun dicocokkan lewat google_id dulu; kalau belum ada, dicocokkan lewat
 * email supaya orang yang sudah daftar email lalu masuk lewat Google tetap
 * memakai akun yang sama (dan bukan dibuatkan akun kembar).
 */

type InfoGoogle = {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
};

/**
 * Balik ke halaman masuk dengan pesan error yang mudah dibaca.
 * Pesan dikirim lewat flash supaya konsisten dengan error lain di aplikasi.
 */
async function gagal(request: NextRequest, pesan: string): Promise<NextResponse> {
  await flash('bad', pesan);
  return NextResponse.redirect(urlSekitar(request, '/masuk'));
}

async function ambilJson(url: string, init?: RequestInit): Promise<unknown> {
  const kontrol = new AbortController();
  const timer = setTimeout(() => kontrol.abort(), 15_000);
  try {
    const res = await fetch(url, { ...init, signal: kontrol.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sama(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export async function GET(request: NextRequest) {
  if (!googleAktif()) return await gagal(request, 'Login Google belum dikonfigurasi.');

  const sp = request.nextUrl.searchParams;

  if (sp.get('error')) return await gagal(request, 'Login Google dibatalkan.');

  // Cek state lebih dulu, sebelum kode apa pun diproses.
  const state = sp.get('state') ?? '';
  const { data: sesi } = await getSesi();
  const tersimpan = sesi.oauthState ?? '';
  if (state === '' || !sama(state, tersimpan)) {
    return await gagal(request, 'Sesi login Google tidak valid. Coba lagi.');
  }
  await updateSesi((d) => {
    const { oauthState: _buang, ...sisa } = d;
    return sisa;
  });

  const kode = sp.get('code') ?? '';
  if (kode === '') return await gagal(request, 'Kode login Google tidak ditemukan.');

  const redirectUri = urlSekitar(request, '/api/auth/google/callback').toString();

  const token = (await ambilJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: kode,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })) as { access_token?: unknown } | null;

  if (!token || typeof token.access_token !== 'string') {
    return await gagal(request, 'Gagal mengambil token dari Google.');
  }

  const info = (await ambilJson('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })) as InfoGoogle | null;

  if (!info || typeof info.sub !== 'string' || typeof info.email !== 'string') {
    return await gagal(request, 'Data dari Google tidak lengkap.');
  }
  if (info.email_verified !== true) {
    return await gagal(request, 'Email Google belum terverifikasi.');
  }

  const gid = info.sub;
  const email = info.email.toLowerCase();
  const nama =
    (typeof info.name === 'string' ? info.name.trim() : '') || email.split('@')[0] || 'Siswa';

  const db = getDb();

  // 1. Sudah pernah masuk lewat Google?
  let [user] = await db.select().from(pengguna).where(eq(pengguna.googleId, gid)).limit(1);

  if (!user) {
    // 2. Email sama -> tautkan google_id ke akun itu, jangan buat akun baru.
    const [punyaEmail] = await db
      .select()
      .from(pengguna)
      .where(eq(pengguna.email, email))
      .limit(1);

    if (punyaEmail) {
      await db.update(pengguna).set({ googleId: gid }).where(eq(pengguna.id, punyaEmail.id));
      user = { ...punyaEmail, googleId: gid };
    } else {
      // 3. Akun baru, selalu sebagai siswa.
      const [baru] = await db
        .insert(pengguna)
        .values({
          nama: nama.slice(0, 100),
          email,
          googleId: gid,
          peran: 'user',
          // password dibiarkan NULL: akun ini hanya bisa masuk lewat Google.
        })
        .returning();
      user = baru;
    }
  }

  await buatSesi(user.id);
  await flash('ok', `Selamat datang, ${user.nama}!`);
  return NextResponse.redirect(urlSekitar(request, homePath(user)));
}