import type { Metadata } from 'next';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { Ruang } from '@/components/Ruang';
import { FormCsrf } from '@/components/FormCsrf';
import { pengaturanMap } from '@/lib/settings';
import { aksiSimpanPengaturan } from '../crud/actions';
import { BIDANG_PENGATURAN } from '@/lib/pengaturan-daftar';

export const metadata: Metadata = { title: 'Pengaturan' };

const JENIS: Record<string, 'text' | 'textarea'> = {
  nama_sekolah: 'text',
  judul_acara: 'text',
  kontak: 'text',
  info_transfer: 'textarea',
  info_cash: 'textarea',
};

export default async function HalamanPengaturan() {
  await wajibAdmin();
  const [token, set] = await Promise.all([csrfToken(), pengaturanMap()]);

  return (
    <Ruang judul="Pengaturan" aktif="set">
      <h1>Pengaturan</h1>

      <form action={aksiSimpanPengaturan} className="card">
        <FormCsrf token={token} />
        {BIDANG_PENGATURAN.map(([kunci, label]) => (
          <div key={kunci}>
            <label htmlFor={kunci}>{label}</label>
            {JENIS[kunci] === 'textarea' ? (
              <textarea id={kunci} name={kunci} rows={3} maxLength={500} defaultValue={set[kunci] ?? ''} />
            ) : (
              <input
                type="text"
                id={kunci}
                name={kunci}
                maxLength={500}
                defaultValue={set[kunci] ?? ''}
              />
            )}
          </div>
        ))}
        <button className="btn gold mt" type="submit">
          Simpan
        </button>
      </form>

      <p className="muted">
        Nilai di sini dipakai di seluruh halaman: judul di beranda, nomor rekening di halaman
        pembayaran, dan identitas sekolah pada kuitansi.
      </p>
    </Ruang>
  );
}