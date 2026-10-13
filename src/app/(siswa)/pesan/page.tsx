import type { Metadata } from 'next';
import { eq, asc } from 'drizzle-orm';
import { Ruang, KepalaHalaman } from '@/components/Ruang';
import { homePath } from '@/lib/auth/rbac';
import { currentUser } from '@/lib/auth/session';
import { tokenTersimpan } from '@/lib/tamu';
import { pesananMilikTamu } from '@/lib/pesanan-akses';
import { csrfToken } from '@/lib/auth/csrf';
import { FormCsrf } from '@/components/FormCsrf';
import { BarisProduk } from '@/components/BarisProduk';
import { PilihJurusanKelas } from '@/components/PilihJurusanKelas';
import { pengaturanMap, judulAcara } from '@/lib/settings';
import { produkUntukForm, semuaJurusan, semuaKelas, itemPesanan, fotoProduk } from '@/lib/orders';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { redirect } from 'next/navigation';
import { aksiSimpanPesanan } from '../actions';

export const metadata: Metadata = { title: 'Pesan Foto' };

export default async function HalamanPesan({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  // Terbuka untuk semua, termasuk tamu tanpa akun.
  const u = await currentUser();
  // Admin/guru/fotografer tidak memakai form pemesanan siswa.
  if (u && u.peran !== 'user') redirect(homePath(u));

  const { id: idParam } = await searchParams;
  const idEdit = Number(idParam) || 0;

  // Saat mengedit, pesanan HARUS milik pengguna ini — atau, untuk tamu,
  // harus dipegang token-nya. Tanpa itu, ?id= dipakai untuk mengintip
  // pesanan orang lain.
  let edit = null;
  const qtyAwal: Record<number, number> = {};
  if (idEdit) {
    const p = u
      ? ((await getDb()
          .select()
          .from(pesanan)
          .where(eq(pesanan.id, idEdit))
          .limit(1))[0] ?? null)
      : await pesananMilikTamu(idEdit, await tokenTersimpan(idEdit));

    const milikSendiri = p && (u ? p.penggunaId === u.id : true);
    if (!p || !milikSendiri) {
      redirect(u ? '/pesanan-saya' : '/cek');
    }
    // Pesanan yang sudah lunas / buktinya sudah dikirim / dibatalkan
    // isinya tidak boleh diubah — hanya data pemesan yang masih bisa dirapikan.
    if (
      p.statusBayar === 'sudah' ||
      p.statusBayar === 'menunggu_verifikasi' ||
      p.status === 'dibatalkan'
    ) {
      redirect(u ? '/pesanan-saya' : '/cek');
    }
    edit = p;
    for (const it of await itemPesanan(idEdit)) {
      if (it.produkId) qtyAwal[it.produkId] = it.qty;
    }
  }

  const [token, set, jurusan, daftarKelas] = await Promise.all([
    csrfToken(),
    pengaturanMap(),
    semuaJurusan(),
    semuaKelas(),
  ]);

  const produk = (await produkUntukForm({ editId: idEdit })).map((p) => ({
    id: p.id,
    nama: p.nama,
    keterangan: p.keterangan,
    harga: p.harga,
    nonaktif: p.nonaktif,
    foto: fotoProduk(p),
  }));

  const kelasAwal = edit?.kelasId ?? u?.kelasId ?? 0;

  return (
    <Ruang judul={edit ? 'Ubah Pesanan' : 'Pesan Foto'} aktif="pesan">
      <KepalaHalaman
        eyebrow={judulAcara(set)}
        judul={edit ? `Ubah Pesanan ${edit.kode}` : 'Form Pemesanan Foto Pelantikan'}
      >
        <p className="muted" style={{ margin: 0 }}>
          Lengkapi data, pilih jenis foto, lalu kirim pesanan untuk mendapatkan nomor antrian.
        </p>
      </KepalaHalaman>

      <form action={aksiSimpanPesanan} className="order-grid" data-order-form>
        <FormCsrf token={token} />
        {edit && <input type="hidden" name="id" value={edit.id} />}

        <div className="order-main">
          <div className="card">
            <h2>Data Pemesan</h2>
            {!u && (
              <div className="alert a-info">
                Kamu memesan tanpa akun. Setelah mengirim, catat <b>kode pesanan</b> dan nomor
                HP-mu untuk membuka kuitansi lagi lewat menu Cek Pesanan.
              </div>
            )}

            <label htmlFor="nama">Nama</label>
            <input
              type="text"
              id="nama"
              name="nama"
              defaultValue={edit?.nama ?? u?.nama ?? ''}
              required
              maxLength={100}
            />

            <label htmlFor="telepon">Nomor HP / WhatsApp</label>
            <input
              type="tel"
              id="telepon"
              name="telepon"
              defaultValue={edit?.telepon ?? u?.telepon ?? ''}
              required
              maxLength={20}
              inputMode="tel"
              placeholder="08xxxxxxxxxx"
              autoComplete="tel"
            />
            <div className="hint">
              Dipakai panitia bila perlu menghubungi, dan sebagai kunci untuk membuka pesanan
              ini lagi lewat <b>Cek Pesanan</b>.
            </div>
            <PilihJurusanKelas
              jurusan={jurusan}
              kelas={daftarKelas}
              terpilihKelas={kelasAwal}
              wajib
            />
          </div>

          <h2 className="section-title">
            Pilih Jenis Pesanan <span className="muted">(isi jumlah)</span>
          </h2>
          <BarisProduk produk={produk} qtyAwal={qtyAwal} />

          <div className="card">
            <label htmlFor="catatan" style={{ marginTop: 0 }}>
              Catatan (opsional)
            </label>
            <textarea
              id="catatan"
              name="catatan"
              rows={2}
              maxLength={255}
              defaultValue={edit?.catatan ?? ''}
              placeholder="Misal: bingkai warna hitam"
            />
          </div>
        </div>

        <aside className="order-side">
          <div className="card summary">
            <h2>Ringkasan Pesanan</h2>
            <p className="muted" style={{ margin: 0 }}>
              {produk.some((p) => p.nonaktif)
                ? 'Ada jenis pesanan yang sudah tidak aktif. Jumlahnya tetap dipakai seperti sebelumnya.'
                : 'Isi jumlah pada tiap jenis pesanan di samping.'}
            </p>
            <button className="btn gold block mt" type="submit">
              {edit ? 'Simpan Perubahan' : 'Submit Pesanan'}
            </button>
          </div>
        </aside>
      </form>
    </Ruang>
  );
}