import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Ruang } from '@/components/Ruang';
import { currentUser } from '@/lib/auth/session';
import { homePath } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { FormCsrf } from '@/components/FormCsrf';
import { IkonGoogle, googleAktif } from '@/components/GoogleButton';
import { aksiMasuk } from '../actions';

export const metadata: Metadata = { title: 'Masuk' };

export default async function HalamanMasuk() {
  const u = await currentUser();
  if (u) redirect(homePath(u));

  const token = await csrfToken();

  return (
    <Ruang judul="Masuk" aktif="masuk">
      <div className="card auth">
        <h1>Masuk</h1>

        {googleAktif() && (
          <>
            <a className="google" href="/api/auth/google">
              <IkonGoogle />
              Masuk dengan Google
            </a>
            <div className="or">atau pakai email</div>
          </>
        )}

        <form action={aksiMasuk}>
          <FormCsrf token={token} />
          <label htmlFor="email">Email atau Username</label>
          <input
            type="text"
            id="email"
            name="email"
            required
            autoComplete="username"
            autoCapitalize="none"
          />
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            autoComplete="current-password"
          />
          <button className="btn gold block mt" type="submit">
            Masuk
          </button>
        </form>

        <p className="center muted">
          Belum punya akun? <a href="/daftar">Daftar</a>
        </p>
      </div>
    </Ruang>
  );
}