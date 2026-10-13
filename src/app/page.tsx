import Link from 'next/link';
import { Ruang, KepalaHalaman } from '@/components/Ruang';
import { currentUser } from '@/lib/auth/session';
import { homePath } from '@/lib/auth/rbac';
import { pengaturanMap, namaSekolah, judulAcara } from '@/lib/settings';
import { produkAktif, fotoProduk } from '@/lib/orders';
import { csrfToken } from '@/lib/auth/csrf';
import { FormCsrf } from '@/components/FormCsrf';
import { aksiKeluar } from '@/app/(auth)/actions';
import { rupiah } from '@/lib/format';

export default async function Beranda() {
  const [u, set, produk, csrf] = await Promise.all([
    currentUser(),
    pengaturanMap(),
    produkAktif(),
    csrfToken(),
  ]);
  const sekolah = namaSekolah(set);
  const acara = judulAcara(set);

  return (
    <Ruang judul="Beranda">
      <section className="hero">
        <div>📸 {sekolah}</div>
        <h1>{acara}</h1>
        <p>
          Pesan foto kelas dan jurusanmu secara online. Pilih ukuran, bingkai atau blok, bayar, lalu
          dapatkan nomor antrian.
        </p>
        <div className="row hero-actions">
          {u ? (
            <>
              <Link href={homePath(u)} className="btn gold">
                {u.peran === 'user' ? 'Pesan Foto' : 'Masuk ke Dashboard'}
              </Link>
              {u.peran === 'admin' && (
                <Link href="/transaksi" className="btn ghost">
                  + Transaksi Baru
                </Link>
              )}
              <form action={aksiKeluar} style={{ display: 'contents' }}>
                <FormCsrf token={csrf} />
                <button type="submit" className="btn ghost">
                  Keluar ({u.nama})
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/pesan" className="btn gold">
                Pesan Sekarang (tanpa login)
              </Link>
              <Link href="/cek" className="btn ghost">
                Cek Pesanan
              </Link>
              <Link href="/masuk" className="btn ghost">
                Punya akun? Masuk
              </Link>
            </>
          )}
        </div>
      </section>

      <div className="card">
        <h2>Daftar Harga</h2>
        {produk.map((p) => {
          const foto = fotoProduk(p);
          return (
            <div key={p.id} className="price">
              {foto && (
                <a href={foto} target="_blank" className="pthumb" title="Lihat contoh">
                  <img src={foto} alt={`Contoh ${p.nama}`} loading="lazy" />
                </a>
              )}
              <div className="pinfo">
                <b>{p.nama}</b>
                {p.keterangan && <div className="muted">{p.keterangan}</div>}
                {foto && <div className="muted" style={{ fontSize: '.78rem' }}>Foto di samping adalah contoh hasil.</div>}
              </div>
              <b>{rupiah(p.harga)}</b>
            </div>
          );
        })}
        {produk.length === 0 && <p className="muted">Belum ada produk.</p>}
      </div>

      <div className="card">
        <h2>Cara Memesan</h2>
        <ol>
          <li>
            Catat <b>kode pesanan</b>-mu. Lihat kuitansi / foto hasil lagi lewat menu{' '}
            <a href="/cek">Cek Pesanan</a> (kode + nomor HP).
          </li>
          <li>
            Klik <b>Pesan Sekarang</b> — tidak perlu login. (Punya akun? Boleh masuk dulu, bisa
            pakai Google.)
          </li>
          <li>
            Isi form pemesanan: nama, nomor HP, jurusan &amp; kelas, jenis foto, dan jumlah.
          </li>
          <li>Pilih pembayaran <b>cash</b> atau <b>transfer</b>.</li>
          <li>
            Setelah memesan, kamu langsung mendapat <b>kuitansi</b> dan <b>nomor antrian</b>; nomor
            dipanggil setelah pembayaran dikonfirmasi admin.
          </li>
        </ol>
        <p className="muted">Kontak panitia: {set.kontak}</p>
      </div>
    </Ruang>
  );
}