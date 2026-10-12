import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Ruang } from '@/components/Ruang';
import { currentUser } from '@/lib/auth/session';
import { homePath } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { FormCsrf } from '@/components/FormCsrf';
import { IkonGoogle, googleAktif } from '@/components/GoogleButton';
import { PilihJurusanKelas } from '@/components/PilihJurusanKelas';
import { semuaJurusan, semuaKelas } from '@/lib/orders';
import { aksiDaftar } from '../actions';

export const metadata: Metadata = { title: 'Daftar' };

export default async function HalamanDaftar() {
  const u = await currentUser();
  if (u) redirect(homePath(u));

  const [token, jurusan, daftarKelas] = await Promise.all([
    csrfToken(),
    semuaJurusan(),
    semuaKelas(),
  ]);

  return (
    <Ruang judul="Daftar" aktif="daftar">
      <div className="card auth">
        <h1>Buat Akun</h1>

        {googleAktif() && (
          <>
            <a className="google" href="/api/auth/google">
              <IkonGoogle />
              Daftar dengan Google
            </a>
            <div className="or">atau pakai email</div>
          </>
        )}

        <form action={aksiDaftar} autoComplete="on">
          <FormCsrf token={token} />
          <label htmlFor="nama">Nama lengkap</label>
          <input type="text" id="nama" name="nama" required maxLength={100} />

          <label htmlFor="email">Email</label>
          <input type="email" id="email" name="email" required maxLength={150} />

          <label htmlFor="telepon">
            Nomor telepon <span className="muted">(opsional)</span>
          </label>
          <input
            type="tel"
            id="telepon"
            name="telepon"
            maxLength={20}
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
            autoComplete="tel"
          />

          <PilihJurusanKelas jurusan={jurusan} kelas={daftarKelas} wajib={false} />
          <div className="hint">Jurusan &amp; kelas boleh dikosongkan, bisa diisi saat memesan.</div>

          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
          />

          <label htmlFor="password2">Ulangi password</label>
          <input
            type="password"
            id="password2"
            name="password2"
            required
            minLength={6}
            autoComplete="new-password"
          />

          <button className="btn gold block mt" type="submit">
            Daftar
          </button>
        </form>

        <p className="center muted">
          Sudah punya akun? <a href="/masuk">Masuk</a>
        </p>
      </div>
    </Ruang>
  );
}