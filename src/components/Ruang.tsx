import type { ReactNode } from 'react';
import { currentUser } from '@/lib/auth/session';
import { csrfToken } from '@/lib/auth/csrf';
import { pengaturanMap, namaSekolah, judulAcara } from '@/lib/settings';
import { Topbar } from './Topbar';
import { Footer } from './Footer';
import { aksiKeluar } from '@/app/(auth)/actions';

/**
 * Kerangka halaman: topbar + konten + footer.
 * Menggantikan page_header()/page_footer() PHP.
 */
export async function Ruang({
  judul,
  aktif = '',
  lebar = false,
  children,
}: {
  judul: string;
  aktif?: string;
  lebar?: boolean;
  children: ReactNode;
}) {
  const [u, set, csrf] = await Promise.all([currentUser(), pengaturanMap(), csrfToken()]);
  const sekolah = namaSekolah(set);

  return (
    <>
      <Topbar u={u} aktif={aktif} namaSekolah={sekolah} csrf={csrf} aksiKeluar={aksiKeluar} />
      <main className={`wrap${lebar ? ' wide' : ''}`}>{children}</main>
      <Footer
        namaSekolah={sekolah}
        judulAcara={judulAcara(set)}
        kontak={set.kontak ?? ''}
      />
    </>
  );
}

/** Judul <h1> + paragraf pengantar (dipakai banyak halaman). */
export function KepalaHalaman({
  eyebrow,
  judul,
  children,
}: {
  eyebrow?: string;
  judul: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{judul}</h1>
      {children}
    </div>
  );
}

/** Daftar pesan error validasi (padanan show_errors() PHP). */
export function DaftarError({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="alert a-bad">
      <ul>
        {errors.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}