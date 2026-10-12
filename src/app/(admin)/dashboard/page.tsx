import type { Metadata } from 'next';
import Link from 'next/link';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { Ruang, KepalaHalaman } from '@/components/Ruang';
import { BadgeBayar, BadgeStatus } from '@/components/Badge';
import { TombolAksi } from '@/components/TombolAksi';
import { pengaturanMap, namaSekolah, judulAcara } from '@/lib/settings';
import { statistikDashboard, daftarPesanan, hitungPesanan } from '@/lib/query-admin';
import { nomorAntrianTerakhir } from '@/lib/orders';
import { sql, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pengguna } from '@/lib/db/schema';
import { rupiah, kapital } from '@/lib/format';
import { aksiBayar, aksiTolak, aksiStatus } from '../actions';

export const metadata: Metadata = { title: 'Dashboard Admin' };

export default async function HalamanDashboard() {
  await wajibAdmin();
  const [token, set, stat, terakhir, jmlPengguna] = await Promise.all([
    csrfToken(),
    pengaturanMap(),
    statistikDashboard(),
    nomorAntrianTerakhir(),
    getDb()
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(pengguna)
      .where(eq(pengguna.peran, 'user')),
  ]);

  // Yang masih perluappersetujuan: bukti transfer masuk, atau sudah pilih
  // metode tapi belum lunas.
  const menunggu = [
    ...(await daftarPesanan({ statusBayar: 'menunggu_verifikasi' }, { ambil: 20 })),
    ...(await daftarPesanan({ statusBayar: 'belum' }, { ambil: 20 })),
  ].slice(0, 30);

  const totalAntrian = await hitungPesanan({ statusBayar: 'sudah' });
  const antrian = await daftarPesanan({ statusBayar: 'sudah' }, { urut: 'antrian' });
  const back = '/dashboard';

  return (
    <Ruang judul="Dashboard Admin" aktif="dash" lebar>
      <KepalaHalaman judul="Dashboard">
        <span className="eyebrow">{namaSekolah(set)}</span>
        <p className="muted" style={{ margin: 0 }}>{judulAcara(set)}</p>
      </KepalaHalaman>

      <div className="grid stats" style={{ marginBottom: '1rem' }}>
        <Stat angka={stat.total} label="Total pesanan" />
        <Stat angka={stat.belum} label="Belum bayar" />
        <Stat angka={stat.verifikasi} label="Perlu verifikasi" />
        <Stat angka={stat.lunas} label="Lunas" />
        <Stat angka={stat.siapCetak} label="Siap cetak" />
        <Stat angka={rupiah(stat.pendapatan)} label="Pendapatan masuk" />
        <Stat angka={Number(jmlPengguna[0]?.n ?? 0)} label="Pengguna terdaftar" />
      </div>

      <h2>Pembayaran menunggu ({menunggu.length})</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Pesanan</th>
              <th>Pesan</th>
              <th className="num">Total</th>
              <th>Bayar</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {menunggu.map((p) => (
              <tr key={String(p.id)}>
                <td>
                  <b>{p.kode as string}</b>
                  <br />
                  <span className="muted">
                    {p.nama as string} · {p.kelasNama as string}
                  </span>
                </td>
                <td>{p.ringkas as string}</td>
                <td className="num">{rupiah(p.total as number)}</td>
                <td>
                  <BadgeBayar status={p.statusBayar as string} />
                  <br />
                  <span className="muted">
                    {p.metode ? kapital(p.metode as string) : 'belum pilih'}
                  </span>
                </td>
                <td>
                  <div className="row">
                    {p.buktiTransfer ? (
                      <a className="btn sm ghost" target="_blank" href={`/api/bukti/${p.id}`}>
                        Lihat bukti
                      </a>
                    ) : null}
                    <TombolAksi
                      action={aksiBayar}
                      csrf={token}
                      id={Number(p.id)}
                      back={back}
                      aksi="bayar"
                      label="Sudah bayar"
                      warna="ok"
                      nama="metode"
                      nilai={(p.metode as string) || 'cash'}
                      konfirmasi={`Konfirmasi ${p.kode as string} sudah dibayar?`}
                    />
                    {p.buktiTransfer ? (
                      <TombolAksi
                        action={aksiTolak}
                        csrf={token}
                        id={Number(p.id)}
                        back={back}
                        aksi="tolak"
                        label="Tolak"
                        warna="danger"
                        konfirmasi="Tolak bukti transfer ini?"
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {menunggu.length === 0 && (
              <tr>
                <td colSpan={5} className="center muted">
                  Tidak ada pembayaran yang menunggu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>Antrian cetak ({totalAntrian})</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama / Kelas</th>
              <th>Pesan</th>
              <th>Status</th>
              <th>Nama file</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {antrian.map((p) => {
              const status = String(p.status);
              const lunas = String(p.statusBayar) === 'sudah';
              return (
                <tr key={String(p.id)}>
                  <td>
                    <b style={{ fontSize: '1.2rem' }}>{p.noAntrian ?? '—'}</b>
                  </td>
                  <td>
                    <b>{p.nama as string}</b>
                    <br />
                    <span className="muted">
                      {p.kelasNama as string} · {p.kode as string}
                    </span>
                  </td>
                  <td>
                    {p.ringkas as string}
                    {p.catatan ? (
                      <>
                        <br />
                        <span className="muted">Catatan: {p.catatan as string}</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <BadgeStatus status={status} />
                  </td>
                  <td>
                    <TombolAksi
                      action={aksiStatus}
                      csrf={token}
                      id={Number(p.id)}
                      back={back}
                      aksi="nama_file"
                      label="Simpan"
                      warna="ghost"
                      inputTeks={{
                        nama: 'nama_file',
                        placeholder: 'IMG_0123.jpg',
                        nilai: (p.namaFile as string) ?? '',
                      }}
                    />
                  </td>
                  <td>
                    <div className="row">
                      {status !== 'siap_cetak' && status !== 'selesai' && (
                        <TombolAksi
                          action={aksiStatus}
                          csrf={token}
                          id={Number(p.id)}
                          back={back}
                          aksi="status"
                          nama="status"
                          nilai="siap_cetak"
                          label="Siap cetak"
                          warna="gold"
                        />
                      )}
                      {status === 'selesai' ? (
                        <TombolAksi
                          action={aksiStatus}
                          csrf={token}
                          id={Number(p.id)}
                          back={back}
                          aksi="status"
                          nama="status"
                          nilai="diproses"
                          label="Buka lagi"
                          warna="ghost"
                          konfirmasi={`Kembalikan ${p.kode as string} ke status Diproses?`}
                        />
                      ) : lunas ? (
                        <TombolAksi
                          action={aksiStatus}
                          csrf={token}
                          id={Number(p.id)}
                          back={back}
                          aksi="status"
                          nama="status"
                          nilai="selesai"
                          label="Selesai"
                          warna="ok"
                        />
                      ) : null}
                      <Link className="btn sm ghost" href={`/transaksi/${p.id}`}>
                        Detail
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {antrian.length === 0 && (
              <tr>
                <td colSpan={6} className="center muted">
                  Antrian kosong.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">Nomor terbit terakhir: {terakhir || '-'}</p>
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