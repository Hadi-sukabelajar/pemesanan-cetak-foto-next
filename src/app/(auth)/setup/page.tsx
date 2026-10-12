import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Ruang } from '@/components/Ruang';
import { FormCsrf } from '@/components/FormCsrf';
import { csrfToken } from '@/lib/auth/csrf';
import { setupMasihDibuka, aksiBuatAdmin } from './actions';

export const metadata: Metadata = { title: 'Setup Admin Pertama' };

export default async function HalamanSetup() {
  // Begitu admin pertama ada, halaman ini mati untuk selamanya — sama
  // seperti setup.php, tapi tidak perlu dihapus manual dari server.
  if (!(await setupMasihDibuka())) redirect('/masuk');

  const token = await csrfToken();
  const perluKode = Boolean(process.env.SETUP_KEY);

  return (
    <Ruang judul="Setup Admin Pertama" aktif="setup">
      <div className="card auth">
        <h1>Setup Admin Pertama</h1>
        <p className="muted center">
          Buat akun admin untuk pertama kali. Halaman ini terkunci otomatis setelah admin dibuat.
        </p>

        <form action={aksiBuatAdmin} autoComplete="off">
          <FormCsrf token={token} />

          <label htmlFor="nama">Nama</label>
          <input
            type="text"
            id="nama"
            name="nama"
            defaultValue="Administrator"
            required
            maxLength={100}
          />

          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            defaultValue="admin"
            required
            autoCapitalize="none"
          />

          <label htmlFor="email">Email</label>
          <input type="email" id="email" name="email" required maxLength={150} />

          <label htmlFor="password">Password (min. 8 karakter)</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
          />

          <label htmlFor="password2">Ulangi password</label>
          <input
            type="password"
            id="password2"
            name="password2"
            required
            minLength={8}
            autoComplete="new-password"
          />

          {perluKode && (
            <>
              <label htmlFor="key">Kode setup (dari environment server)</label>
              <input type="password" id="key" name="key" required autoComplete="off" />
            </>
          )}

          <button className="btn gold block mt" type="submit">
            Buat Admin
          </button>
        </form>
      </div>
    </Ruang>
  );
}