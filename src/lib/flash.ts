/**
 * Flash message — padanan flash()/get_flash() PHP.
 * Disimpan di data sesi supaya bisa muncul sekali setelah redirect.
 */
import 'server-only';
import { getSesi, updateSesi } from '@/lib/auth/session';

export type Flash = { type: 'ok' | 'bad' | 'warn' | 'info'; msg: string };

/** Simpan pesan untuk ditampilkan sekali di halaman berikutnya. */
export async function flash(type: Flash['type'], msg: string): Promise<void> {
  await updateSesi((d) => ({
    ...d,
    flash: [...(d.flash ?? []), { type, msg } satisfies Flash].slice(-5),
  }));
}

/**
 * Ambil sekaligus kosongkan (supaya tidak muncul lagi di refresh berikutnya).
 * Harus dipanggil tepat sekali saat render halaman.
 */
export async function ambilFlash(): Promise<Flash[]> {
  const { data, id } = await getSesi();
  const isi = data.flash ?? [];
  if (!id || isi.length === 0) return isi;
  await updateSesi((d) => ({ ...d, flash: [] }));
  return isi;
}