import type { Metadata } from 'next';
import { asc, eq, sql } from 'drizzle-orm';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { Ruang } from '@/components/Ruang';
import { FormCsrf } from '@/components/FormCsrf';
import { TombolAksi } from '@/components/TombolAksi';
import { getDb } from '@/lib/db';
import { jurusan, kelas, pesanan } from '@/lib/db/schema';
import {
  aksiSimpanJurusan,
  aksiHapusJurusan,
  aksiSimpanKelas,
  aksiHapusKelas,
} from '../crud/actions';

export const metadata: Metadata = { title: 'Jurusan & Kelas' };

export default async function HalamanJurusan({
  searchParams,
}: {
  searchParams: Promise<{ edit_j?: string; edit_k?: string }>;
}) {
  await wajibAdmin();
  const sp = await searchParams;
  const token = await csrfToken();
  const db = getDb();

  const editJ = Number(sp.edit_j) || 0;
  const editK = Number(sp.edit_k) || 0;

  const [daftarJurusan, daftarKelas] = await Promise.all([
    db
      .select({
        id: jurusan.id,
        nama: jurusan.nama,
        jumlah: sql<number>`(SELECT COUNT(*)::int FROM ${kelas} WHERE ${kelas.jurusanId} = ${jurusan.id})`,
      })
      .from(jurusan)
      .orderBy(asc(jurusan.nama)),
    db
      .select({
        id: kelas.id,
        nama: kelas.nama,
        jurusanId: kelas.jurusanId,
        jurusan: jurusan.nama,
        jumlahPesanan: sql<number>`(SELECT COUNT(*)::int FROM ${pesanan} WHERE ${pesanan.kelasId} = ${kelas.id})`,
      })
      .from(kelas)
      .innerJoin(jurusan, eq(kelas.jurusanId, jurusan.id))
      .orderBy(asc(jurusan.nama), asc(kelas.nama)),
  ]);

  const kurvaJ = daftarJurusan.find((j) => j.id === editJ) ?? null;
  const kurvaK = daftarKelas.find((k) => k.id === editK) ?? null;

  return (
    <Ruang judul="Jurusan & Kelas" aktif="kelas" lebar>
      <h1>Jurusan &amp; Kelas</h1>

      <h2>1. Jurusan ({daftarJurusan.length})</h2>
      <form action={aksiSimpanJurusan} className="card">
        <FormCsrf token={token} />
        <input type="hidden" name="id" value={editJ} />
        <label htmlFor="nama_j">{editJ ? 'Ubah nama jurusan' : 'Tambah jurusan'}</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input
            type="text"
            id="nama_j"
            name="nama"
            defaultValue={kurvaJ?.nama ?? ''}
            placeholder="contoh: RPL"
            maxLength={60}
            required
          />
          <button className="btn gold" type="submit">
            Simpan
          </button>
          {editJ && (
            <a className="btn ghost" href="/jurusan">
              Batal
            </a>
          )}
        </div>
      </form>

      <div className="tablewrap">
        <table style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th>Jurusan</th>
              <th className="num">Kelas</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {daftarJurusan.map((j) => (
              <tr key={j.id}>
                <td>
                  <b>{j.nama}</b>
                </td>
                <td className="num">{j.jumlah}</td>
                <td>
                  <div className="row">
                    <a className="btn sm ghost" href={`/jurusan?edit_j=${j.id}`}>
                      Edit
                    </a>
                    <TombolAksi
                      action={aksiHapusJurusan}
                      csrf={token}
                      id={j.id}
                      back="/jurusan"
                      aksi="hapus_jurusan"
                      label="Hapus"
                      warna="danger"
                      konfirmasi={`Hapus jurusan ${j.nama}?`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {daftarJurusan.length === 0 && (
              <tr>
                <td colSpan={3} className="center muted">
                  Belum ada jurusan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>2. Kelas ({daftarKelas.length})</h2>
      {daftarJurusan.length === 0 ? (
        <div className="alert a-warn">Tambahkan jurusan dulu sebelum menambah kelas.</div>
      ) : (
        <form action={aksiSimpanKelas} className="card">
          <FormCsrf token={token} />
          <input type="hidden" name="id" value={editK} />
          <label htmlFor="jurusan_k">{editK ? 'Ubah kelas' : 'Tambah kelas'} — jurusan</label>
          <select id="jurusan_k" name="jurusan_id" required defaultValue={kurvaK?.jurusanId ?? ''}>
            <option value="">— pilih jurusan —</option>
            {daftarJurusan.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nama}
              </option>
            ))}
          </select>

          <label htmlFor="nama_k">Nama kelas</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input
              type="text"
              id="nama_k"
              name="nama"
              defaultValue={kurvaK?.nama ?? ''}
              placeholder="contoh: X RPL A"
              maxLength={60}
              required
            />
            <button className="btn gold" type="submit">
              Simpan
            </button>
            {editK && (
              <a className="btn ghost" href="/jurusan">
                Batal
              </a>
            )}
          </div>
        </form>
      )}

      <div className="tablewrap">
        <table style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th>Jurusan</th>
              <th>Kelas</th>
              <th className="num">Pesanan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {daftarKelas.map((k) => (
              <tr key={k.id}>
                <td>{k.jurusan}</td>
                <td>
                  <b>{k.nama}</b>
                </td>
                <td className="num">{k.jumlahPesanan}</td>
                <td>
                  <div className="row">
                    <a className="btn sm ghost" href={`/jurusan?edit_k=${k.id}`}>
                      Edit
                    </a>
                    <TombolAksi
                      action={aksiHapusKelas}
                      csrf={token}
                      id={k.id}
                      back="/jurusan"
                      aksi="hapus_kelas"
                      label="Hapus"
                      warna="danger"
                      konfirmasi={`Hapus kelas ${k.nama}?`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {daftarKelas.length === 0 && (
              <tr>
                <td colSpan={4} className="center muted">
                  Belum ada kelas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted">
        Kelas yang masih dipakai pesanan atau akun pengguna tidak bisa dihapus, supaya data lama tidak
        jadi yatim.
      </p>
    </Ruang>
  );
}