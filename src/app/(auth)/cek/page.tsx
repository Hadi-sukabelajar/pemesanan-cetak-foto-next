import type { Metadata } from 'next';
import { Ruang } from '@/components/Ruang';
import { FormCsrf } from '@/components/FormCsrf';
import { csrfToken } from '@/lib/auth/csrf';
import { aksiCekPesanan } from './actions';

export const metadata: Metadata = { title: 'Cek Pesanan' };

const PESAN_SALAH: Record<string, string> = {
  kuitansi: 'Kuitansi tidak ditemukan atau bukan pesanan Anda.',
  pesanan: 'Pesanan tidak ditemukan.',
  batal: 'Pesanan ini sudah dibatalkan.',
};

export default async function HalamanCek({
  searchParams,
}: {
  searchParams: Promise<{ salah?: string }>;
}) {
  const token = await csrfToken();
  const { salah } = await searchParams;
  const pesan = salah ? PESAN_SALAH[salah] : undefined;

  return (
    <Ruang judul="Cek Pesanan" aktif="cek">
      <div className="card auth">
        <h1>Cek Pesanan</h1>
        {pesan && <div className="alert a-bad">{pesan}</div>}

        <p className="muted center">
          Tanpa login. Masukkan kode pesanan (dari kuitansi, contoh <b>FP-260101-AB12CD</b>) dan
          nomor HP yang Anda isi saat memesan.
        </p>

        <form action={aksiCekPesanan} autoComplete="off">
          <FormCsrf token={token} />

          <label htmlFor="kode">Kode pesanan</label>
          <input
            type="text"
            id="kode"
            name="kode"
            required
            maxLength={30}
            autoCapitalize="characters"
            placeholder="FP-......-......"
          />

          <label htmlFor="telepon">Nomor HP / WhatsApp</label>
          <input
            type="tel"
            id="telepon"
            name="telepon"
            required
            maxLength={20}
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
          />

          <button className="btn gold block mt" type="submit">
            Cek Pesanan
          </button>
        </form>

        <p className="center muted">
          Belum memesan? <a href="/pesan">Pesan sekarang</a>
        </p>
      </div>
    </Ruang>
  );
}