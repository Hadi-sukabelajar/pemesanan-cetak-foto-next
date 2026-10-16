import type { Metadata } from 'next';
import Link from 'next/link';
import { wajibStaf } from '@/lib/auth/rbac';
import { Ruang } from '@/components/Ruang';
import { BadgeBayar, BadgeStatus, BadgePeran } from '@/components/Badge';
import { pengaturanMap, namaSekolah } from '@/lib/settings';
import {
  statistikMonitor,
  rekapPerKelas,
  rekapPerProduk,
  daftarPesanan,
  penggunaTerbaru,
  antrianSekarang,
} from '@/lib/query-admin';
import { rupiah, tgl, kapital } from '@/lib/format';

export const metadata: Metadata = { title: 'Monitor' };

// Data segar tiap 60 detik (melengkapi meta refresh di bawah).
export const revalidate = 60;

export default async function HalamanMonitor() {
  const u = await wajibStaf();
  const isAdmin = u.peran === 'admin';

  const [st, set, perKelas, perProduk, terbaru, antrian, penggunaBaru] = await Promise.all([
    statistikMonitor(),
    pengaturanMap(),
    rekapPerKelas(),
    rekapPerProduk(),
    daftarPesanan({}, { ambil: 15 }),
    antrianSekarang(),
    isAdmin ? penggunaTerbaru(10) : Promise.resolve([]),
  ]);

  return (
    <Ruang judul="Monitor" aktif="monitor" lebar>
      {/* Refresh otomatis tiap 60 detik (setara meta refresh versi PHP). */}
      <meta httpEquiv="refresh" content="60" />

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>📊 Monitor {isAdmin ? 'Admin' : 'Guru'}</h1>
        <span className="muted">
          Diperbarui {tgl(new Date())} · otomatis tiap 60 dtk
        </span>
      </div>

      {!isAdmin && (
        <div className="alert a-info">
          Akun guru hanya untuk memantau (tidak bisa mengubah data).
        </div>
      )}

      {isAdmin && (
        <div className="shortcuts">
          <Link className="btn sm" href="/dashboard">Dashboard</Link>
          <Link className="btn sm" href="/antrian">Antrian</Link>
          <Link className="btn sm" href="/pesanan">Pesanan</Link>
          <Link className="btn sm" href="/upload-foto">📷 Upload Foto</Link>
          <Link className="btn sm" href="/riwayat">Riwayat &amp; Penghasilan</Link>
          <Link className="btn sm" href="/pengguna">Pengguna</Link>
          <Link className="btn sm" href="/produk">Produk</Link>
          <Link className="btn sm" href="/jurusan">Jurusan &amp; Kelas</Link>
          <Link className="btn sm" href="/pengaturan">Pengaturan</Link>
        </div>
      )}

      <div className="now">
        <div>
          <div style={{ color: '#cfd6ea', fontSize: '.85rem' }}>Antrian dipanggil</div>
          <b>{antrian.sekarang?.no ?? '—'}</b>
        </div>
        <div>
          {antrian.sekarang ? (
            <>
              <div style={{ fontSize: '1.1rem', color: '#fff' }}>
                <b>{antrian.sekarang.nama}</b>
              </div>
              <div style={{ color: '#cfd6ea' }}>{antrian.sekarang.kelasNama}</div>
            </>
          ) : (
            <div style={{ color: '#cfd6ea' }}>Tidak ada antrian aktif.</div>
          )}
          <div style={{ color: '#cfd6ea', fontSize: '.85rem', marginTop: '.3rem' }}>
            Nomor terbit terakhir: {antrian.terakhir || '-'}
          </div>
        </div>
      </div>

      <h2>Ringkasan pesanan</h2>
      <div className="grid stats" style={{ marginBottom: '1rem' }}>
        <Stat angka={st.total} label="Total pesanan" />
        <Stat angka={st.belum} label="Belum bayar" />
        <Stat angka={st.verifikasi} label="Menunggu verifikasi" />
        <Stat angka={st.lunas} label="Lunas" />
        <Stat angka={st.menunggu + st.diproses} label="Menunggu / diproses" />
        <Stat angka={st.siapCetak} label="Siap cetak" />
        <Stat angka={st.selesai} label="Selesai" />
        <Stat angka={st.dibatalkan} label="Dibatalkan" />
      </div>

      <div className="grid stats" style={{ marginBottom: '1rem' }}>
        <Stat angka={rupiah(st.pendapatan)} label="Uang masuk (lunas)" />
        <Stat angka={rupiah(st.uangTunggu)} label="Tagihan belum lunas" />
        <Stat angka={st.akunSiswa} label="Akun siswa" />
        <Stat angka={st.akunAdmin} label="Akun admin" />
        <Stat angka={st.akunGuru} label="Akun guru" />
      </div>

      <div className="mon-grid">
        <div>
          <h2>Per kelas</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th className="num">Pesanan</th>
                  <th className="num">Lunas</th>
                  <th className="num">Uang masuk</th>
                </tr>
              </thead>
              <tbody>
                {perKelas.map((r) => (
                  <tr key={r.kelas}>
                    <td>
                      <b>{r.kelas}</b>
                    </td>
                    <td className="num">{r.jml}</td>
                    <td className="num">{r.lunas}</td>
                    <td className="num">{rupiah(r.uang)}</td>
                  </tr>
                ))}
                {perKelas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="center muted">
                      Belum ada pesanan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2>Per produk</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th className="num">Jumlah</th>
                  <th className="num">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {perProduk.map((r) => (
                  <tr key={r.namaProduk}>
                    <td>
                      <b>{r.namaProduk}</b>
                    </td>
                    <td className="num">{r.qty}</td>
                    <td className="num">{rupiah(r.nilai)}</td>
                  </tr>
                ))}
                {perProduk.length === 0 && (
                  <tr>
                    <td colSpan={3} className="center muted">
                      Belum ada pesanan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2>Pesanan terbaru</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama / Kelas</th>
              <th>Pesan</th>
              <th className="num">Total</th>
              <th>Pembayaran</th>
              <th>Pesanan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {terbaru.map((p) => (
              <tr key={String(p.id)}>
                <td>
                  {p.noAntrian ? (
                    <b style={{ fontSize: '1.2rem' }}>{p.noAntrian}</b>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <b>{p.nama as string}</b>
                  <br />
                  <span className="muted">
                    {p.kelasNama as string} · {p.kode as string} ·{' '}
                    {tgl(p.dibuatPada as Date)}
                  </span>
                </td>
                <td>{p.ringkas as string}</td>
                <td className="num">{rupiah(p.total as number)}</td>
                <td>
                  <BadgeBayar status={p.statusBayar as string} />
                  {p.metode ? (
                    <>
                      <br />
                      <span className="muted">{kapital(p.metode as string)}</span>
                    </>
                  ) : null}
                </td>
                <td>
                  <BadgeStatus status={p.status as string} />
                </td>
                <td>
                  <a className="btn sm ghost" href={`/kuitansi/${p.id}`}>
                    Kuitansi
                  </a>
                  {isAdmin && (
                    <a className="btn sm ghost" href={`/transaksi/${p.id}`}>
                      Detail
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {terbaru.length === 0 && (
              <tr>
                <td colSpan={7} className="center muted">
                  Belum ada pesanan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <>
          <h2>Pengguna terbaru</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email / Username</th>
                  <th>Kelas</th>
                  <th>Peran</th>
                  <th>Daftar</th>
                </tr>
              </thead>
              <tbody>
                {penggunaBaru.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.nama}</b>
                    </td>
                    <td>
                      {r.email}
                      {r.username ? (
                        <>
                          <br />
                          <span className="muted">@{r.username}</span>
                        </>
                      ) : null}
                    </td>
                    <td>{r.kelas ?? '-'}</td>
                    <td>
                      <BadgePeran peran={r.peran} />
                    </td>
                    <td>{tgl(r.dibuatPada, false)}</td>
                  </tr>
                ))}
                {penggunaBaru.length === 0 && (
                  <tr>
                    <td colSpan={5} className="center muted">
                      Belum ada pengguna.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="muted">Sekolah: {namaSekolah(set)}</p>
    </Ruang>
  );
}

function Stat({ angka, label }: { angka: string | number; label: string }) {
  return (
    <div className="stat">
      <b>{angka}</b>
      <span>{label}</span>
    </div>
  );
}