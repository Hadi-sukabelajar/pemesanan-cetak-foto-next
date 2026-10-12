import { redirect } from 'next/navigation';

/**
 * Formulir pembayaran dikirim ke sini sebagai POST biasa, lalu langsung
 * diteruskan ke Server Action.
 *
 * Dipakai supaya <form> di komponen klien tetap punya `action` yang valid
 * (Server Action tidak bisa dipanggil langsung dari modul 'use client').
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const { aksiBayar } = await import('@/app/(siswa)/actions');
  await aksiBayar(formData);
  redirect('/pesanan-saya');
}