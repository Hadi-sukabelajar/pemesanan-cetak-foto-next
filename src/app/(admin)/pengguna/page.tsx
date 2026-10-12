import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { Ruang } from '@/components/Ruang';
import { BadgePeran } from '@/components/Badge';
import { TombolAksi } from '@/components/TombolAksi';
import { getDb } from '@/lib/db';
import { pengguna, kelas } from '@/lib/db/schema';
import { jumlahPesananPengguna } from '@/lib/query-admin';
import { tgl } from '@/lib/format';
import { aksiHapusPengguna } from '../crud/actions';

export const metadata: Metadata = { title: 'Pengguna' };

export default async function HalamanPengguna({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const saya = await wajibAdmin();
  const { q } = await searchParams;
  const cari = (q ?? '').trim();
  const token = await csrfToken();

  const db = getDb();
  const syarat = cari
    ? or(ilike(pengguna.nama, `%${cari}%`), ilike(pengguna.email, `%${cari}%`))
    : undefined;

  const baris = await db
    .select({
      id: pengguna.id,
      nama: pengguna.nama,
      email: pengguna.email,
      username: pengguna.username,
      telepon: pengguna.telepon,
      peran: pengguna.peran,
      googleId: pengguna.googleId,
      password: pengguna.password,
      dibuatPada: pengguna.dibuatPada,
      kelas: kelas.nama,
    })
    .from(pengguna)
    .leftJoin(kelas, eq(pengguna.kelasId, kelas.id))
    .where(syarat)
    .orderBy(pengguna.peran, desc(pengguna.id));

  const jumlah = await jumlahPesananPengguna(baris.map((r) => r.id));

  return (
    <Ruang judul="Pengguna" aktif="pengguna" lebar>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Pengguna ({baris.length})</h1>
        <Link className="btn gold sm" href="/pengguna/baru">
          + Tambah pengguna
        </Link>
      </div>

      <form method="get" className="row" style={{ marginBottom: '1rem' }}>
        <input
          type="search"
          name="q"
          defaultValue={cari}
          placeholder="Cari nama / email"
          style={{ maxWidth: 320 }}
        />
        <button className="btn sm" type="submit">
          Cari
        </button>
      </form>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Kelas</th>
              <th>Peran</th>
              <th>Login</th>
              <th className="num">Pesanan</th>
              <th>Daftar</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((r) => (
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
                  {r.telepon ? (
                    <>
                      <br />
                      <span className="muted">{r.telepon}</span>
                    </>
                  ) : null}
                </td>
                <td>{r.kelas ?? '-'}</td>
                <td>
                  <BadgePeran peran={r.peran} />
                </td>
                <td>
                  {r.googleId ? 'Google' : 'Email'}
                  {r.googleId && r.password ? ' + Email' : ''}
                </td>
                <td className="num">{jumlah.get(r.id) ?? 0}</td>
                <td>{tgl(r.dibuatPada, false)}</td>
                <td>
                  <div className="row">
                    <Link className="btn sm ghost" href={`/pengguna/${r.id}`}>
                      Edit
                    </Link>
                    {r.id !== Number(saya.id) && (
                      <TombolAksi
                        action={aksiHapusPengguna}
                        csrf={token}
                        id={r.id}
                        back="/pengguna"
                        aksi="hapus"
                        label="Hapus"
                        warna="danger"
                        konfirmasi={`Hapus pengguna ${r.email}?`}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {baris.length === 0 && (
              <tr>
                <td colSpan={8} className="center muted">
                  Tidak ada pengguna.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Ruang>
  );
}