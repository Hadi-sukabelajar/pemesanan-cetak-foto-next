import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Ruang } from '@/components/Ruang';
import { wajibSiswa } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { FormCsrf } from '@/components/FormCsrf';
import { PilihBayar } from '@/components/PilihBayar';
import { BadgeBayar } from '@/components/Badge';
import { pengaturanMap } from '@/lib/settings';
import { itemPesanan } from '@/lib/orders';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { rupiah } from '@/lib/format';
import { flash } from '@/lib/flash';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Bayar ${id}` };
}

export default async function HalamanBayar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await wajibSiswa();
  const { id } = await params;
  const idNum = Number(id) || 0;

  const [token, set] = await Promise.all([csrfToken(), pengaturanMap()]);

  const [p] = await getDb()
    .select()
    .from(pesanan)
    .where(eq(pesanan.id, idNum))
    .limit(1);

  if (!p || p.penggunaId !== u.id) {
    await flash('bad', 'Pesanan tidak ditemukan.');
    redirect('/pesanan-saya');
  }
  if (p.statusBayar === 'sudah') redirect(`/kuitansi/${idNum}`);
  if (p.status === 'dibatalkan') {
    await flash('warn', 'Pesanan ini sudah dibatalkan.');
    redirect('/pesanan-saya');
  }

  const items = await itemPesanan(p.id);

  return (
    <Ruang judul="Pembayaran" aktif="riwayat">
      <h1>Pembayaran</h1>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <b>{p.kode}</b>
            <div className="muted">
              {p.nama} · {p.kelasNama}
            </div>
          </div>
          <BadgeBayar status={p.statusBayar} />
        </div>
        <table style={{ marginTop: '.6rem' }}>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>
                  {it.namaProduk} × {it.qty}
                </td>
                <td className="num">{rupiah(it.harga * it.qty)}</td>
              </tr>
            ))}
            <tr>
              <td>
                <b>Total</b>
              </td>
              <td className="num">
                <b>{rupiah(p.total)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Pilih metode pembayaran</h2>
        <PilihBayar
          pesananId={p.id}
          token={token}
          metodeAwal={p.metode}
          infoCash={set.info_cash ?? ''}
          infoTransfer={set.info_transfer ?? ''}
          total={p.total}
          sudahAdaBukti={Boolean(p.buktiTransfer)}
        />
      </div>

      <p className="center">
        <Link href="/pesanan-saya">Bayar nanti</Link>
      </p>
    </Ruang>
  );
}