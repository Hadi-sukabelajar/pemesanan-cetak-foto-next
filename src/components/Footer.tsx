import type { Pengguna } from '@/lib/db/schema';
import { Brand } from './Topbar';

export function Footer({
  namaSekolah,
  judulAcara,
  kontak,
}: {
  namaSekolah: string;
  judulAcara: string;
  kontak: string;
}) {
  return (
    <footer className="foot">
      <div className="foot-grid">
        <div>
          <div className="foot-brand">
            <span className="brand-mark">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
            <b>Foto Pelantikan</b>
            <span className="brand-pill">{namaSekolah}</span>
          </div>
          <p>
            Layanan pemesanan foto {judulAcara} {namaSekolah}.
          </p>
        </div>
        <div>
          <b>Pusat Bantuan</b>
          <p>
            {namaSekolah}
            <br />
            {kontak}
          </p>
        </div>
      </div>
      <div className="foot-copy">
        © {new Date().getFullYear()} {namaSekolah} · {judulAcara}
      </div>
    </footer>
  );
}

export type { Pengguna };