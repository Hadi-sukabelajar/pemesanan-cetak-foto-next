import Link from 'next/link';
import type { Pengguna } from '@/lib/db/schema';
import { homePath } from '@/lib/auth/rbac';
import { KeluarForm } from './KeluarForm';

type ItemNav = { href: string; label: string; kunci: string; gaya?: 'mon' };

/**
 * Menu per peran — padanan elseif di page_header() PHP.
 * Guru hanya boleh melihat Monitor, fotografer hanya Upload Foto.
 */
function menu(u: Pengguna): ItemNav[] {
  switch (u.peran) {
    case 'admin':
      return [
        { href: '/', label: 'Beranda', kunci: 'beranda' },
        { href: '/monitor', label: 'Monitor', kunci: 'monitor', gaya: 'mon' },
        { href: '/dashboard', label: 'Dashboard', kunci: 'dash' },
        { href: '/transaksi', label: 'Transaksi Baru', kunci: 'transaksi' },
        { href: '/antrian', label: 'Antrian', kunci: 'antrian' },
        { href: '/pesanan', label: 'Pesanan', kunci: 'pesanan' },
        { href: '/upload-foto', label: 'Upload Foto', kunci: 'foto' },
        { href: '/arsip', label: 'Arsip Foto', kunci: 'arsip' },
        { href: '/riwayat', label: 'Riwayat & Penghasilan', kunci: 'riwayat_admin' },
        { href: '/pengguna', label: 'Pengguna', kunci: 'user' },
        { href: '/produk', label: 'Produk', kunci: 'produk' },
        { href: '/jurusan', label: 'Jurusan', kunci: 'kelas' },
        { href: '/pengaturan', label: 'Pengaturan', kunci: 'set' },
      ];
    case 'fotografer':
      return [{ href: '/upload-foto', label: 'Upload Foto', kunci: 'foto' }];
    case 'guru':
      return [{ href: '/monitor', label: 'Monitor', kunci: 'monitor', gaya: 'mon' }];
    case 'user':
      return [
        { href: '/pesan', label: 'Pesan Foto', kunci: 'pesan' },
        { href: '/pesanan-saya', label: 'Pesanan Saya', kunci: 'riwayat' },
      ];
    default:
      // Tamu: pesan tanpa login, lalu kembali lewat Cek Pesanan.
      return [
        { href: '/pesan', label: 'Pesan Foto', kunci: 'pesan' },
        { href: '/cek', label: 'Cek Pesanan', kunci: 'cek' },
      ];
  }
}

function IkonKamera() {
  return (
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
  );
}

export function Brand({ u, namaSekolah }: { u: Pengguna | null; namaSekolah: string }) {
  return (
    <Link href={u ? homePath(u) : '/'} className="brand">
      <span className="brand-mark">
        <IkonKamera />
      </span>
      <span>Foto Pelantikan</span>
      <span className="brand-pill">{namaSekolah}</span>
    </Link>
  );
}

export function Topbar({
  u,
  aktif,
  namaSekolah,
  csrf,
  aksiKeluar,
}: {
  u: Pengguna | null;
  aktif: string;
  namaSekolah: string;
  csrf: string;
  aksiKeluar: (fd: FormData) => Promise<void>;
}) {
  const item = u ? menu(u) : [];
  const belumMasuk = [
    { href: '/pesan', label: 'Pesan Foto', kunci: 'pesan' },
    { href: '/cek', label: 'Cek Pesanan', kunci: 'cek' },
    { href: '/masuk', label: 'Masuk', kunci: 'masuk' },
    { href: '/daftar', label: 'Daftar', kunci: 'daftar' },
  ];

  return (
    <header className="topbar">
      <Brand u={u} namaSekolah={namaSekolah} />
      <nav className="nav">
        {!u &&
          belumMasuk.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={aktif === i.kunci ? 'on' : ''}
            >
              {i.label}
            </Link>
          ))}
        {u &&
          item.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={[
                aktif === i.kunci ? 'on' : '',
                i.gaya ?? '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {i.label}
            </Link>
          ))}
        {u && <KeluarForm action={aksiKeluar} csrf={csrf} />}
      </nav>
    </header>
  );
}