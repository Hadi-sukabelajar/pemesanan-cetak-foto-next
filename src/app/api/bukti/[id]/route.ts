import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { bolehBukaBukti } from '@/lib/auth/rbac';
import { currentUser } from '@/lib/auth/session';
import { tokenTersimpan } from '@/lib/tamu';
import { alirkanBlob } from '@/lib/blob';

/**
 * Menampilkan bukti transfer.
 *
 * Bukti lebih sensitif (nomor rekening + nama pemesan), jadi HANYA pemilik
 * pesanan dan admin yang boleh — bukan guru, walau guru bisa membuka
 * kuitansi untuk memantau. Padanan bukti.php PHP.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const idNum = Number(id) || 0;
  const u = await currentUser();

  const [p] = await getDb().select().from(pesanan).where(eq(pesanan.id, idNum)).limit(1);

  if (!p || !bolehBukaBukti(u, p, await tokenTersimpan(idNum)) || !p.buktiTransfer) {
    return new NextResponse('Bukti tidak ditemukan.', { status: 404 });
  }

  const res = await alirkanBlob(p.buktiTransfer);
  if (!res) return new NextResponse('File tidak ada.', { status: 404 });
  return res;
}