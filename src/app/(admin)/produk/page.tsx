import type { Metadata } from 'next';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { Ruang } from '@/components/Ruang';
import { FormCsrf } from '@/components/FormCsrf';
import { TombolAksi } from '@/components/TombolAksi';
import { getDb } from '@/lib/db';
import { produk, pesananItem } from '@/lib/db/schema';
import { rupiah } from '@/lib/format';
import { aksiSimpanProduk, aksiHapusProduk } from '../crud/actions';

export const metadata: Metadata = { title: 'Produk' };

export default async function HalamanProduk({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await wajibAdmin();
  const { edit } = await searchParams;
  const token = await csrfToken();
  const db = getDb();

  const baris = await db.select().from(produk).orderBy(asc(produk.urutan), asc(produk.id));
  const editId = Number(edit) || 0;
  const kurva = editId ? baris.find((p) => p.id === editId) : null;

  // Jumlah terjual per produk (berguna saat melihat produk yang jarang dipakai).
  const terjual = await db
    .select({
      produkId: pesananItem.produkId,
      n: sql<number>`COALESCE(SUM(${pesananItem.qty}), 0)::int`,
    })
    .from(pesananItem)
    .groupBy(pesananItem.produkId);
  const petaTerjual = new Map(terjual.map((t) => [Number(t.produkId), Number(t.n)]));

  return (
    <Ruang judul="Produk" aktif="produk" lebar>
      <h1>Produk / Jenis Pesanan</h1>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Urut</th>
              <th>Nama</th>
              <th>Keterangan</th>
              <th className="num">Harga</th>
              <th className="num">Terjual</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((r) => (
              <tr key={r.id}>
                <td>{r.urutan}</td>
                <td>
                  <b>{r.nama}</b>
                </td>
                <td>{r.keterangan}</td>
                <td className="num">{rupiah(r.harga)}</td>
                <td className="num">{petaTerjual.get(r.id) ?? 0}</td>
                <td>
                  {r.aktif ? (
                    <span className="badge b-ok">Aktif</span>
                  ) : (
                    <span className="badge b-muted">Nonaktif</span>
                  )}
                </td>
                <td>
                  <div className="row">
                    <a className="btn sm ghost" href={`/produk?edit=${r.id}`}>
                      Edit
                    </a>
                    <TombolAksi
                      action={aksiHapusProduk}
                      csrf={token}
                      id={r.id}
                      back="/produk"
                      aksi="hapus"
                      label="Hapus"
                      warna="danger"
                      konfirmasi={`Hapus produk ${r.nama}?`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {baris.length === 0 && (
              <tr>
                <td colSpan={7} className="center muted">
                  Belum ada produk.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={aksiSimpanProduk} className="card">
        <h2>{kurva ? 'Edit produk' : 'Tambah produk'}</h2>
        <FormCsrf token={token} />
        {kurva && <input type="hidden" name="id" value={kurva.id} />}

        <label htmlFor="nama">Nama</label>
        <input
          type="text"
          id="nama"
          name="nama"
          defaultValue={kurva?.nama ?? ''}
          required
          maxLength={100}
        />

        <label htmlFor="keterangan">Keterangan</label>
        <input
          type="text"
          id="keterangan"
          name="keterangan"
          defaultValue={kurva?.keterangan ?? ''}
          maxLength={200}
        />

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label htmlFor="harga">Harga (Rp)</label>
            <input
              type="number"
              id="harga"
              name="harga"
              defaultValue={kurva?.harga ?? ''}
              min={0}
              required
            />
          </div>
          <div>
            <label htmlFor="urutan">Urutan tampil</label>
            <input
              type="number"
              id="urutan"
              name="urutan"
              defaultValue={kurva?.urutan ?? baris.length + 1}
            />
          </div>
        </div>

        <label
          style={{ display: 'flex', gap: '.5rem', alignItems: 'center', fontWeight: 500 }}
        >
          <input
            type="checkbox"
            name="aktif"
            value="1"
            defaultChecked={kurva ? kurva.aktif : true}
            style={{ width: 'auto' }}
          />{' '}
          Tampilkan di form pemesanan
        </label>

        <div className="row mt">
          <button className="btn gold" type="submit">
            Simpan
          </button>
          {kurva && (
            <a className="btn ghost" href="/produk">
              Batal
            </a>
          )}
        </div>
      </form>

      <p className="muted">
        Produk yang dinonaktifkan tidak muncul lagi di form pemesanan siswa, tetapi pesanan yang sudah
        memakainya tetap utuh.
      </p>
    </Ruang>
  );
}