'use client';

import { UnggahLangsung } from './UnggahLangsung';

/**
 * Unggah bukti transfer (khusus siswa).
 * Membungkus UnggahLangsung supaya pemanggil cukup menyebut "bukti".
 */
export function UploadBukti({
  pesananId,
  onSelesai,
}: {
  pesananId: number;
  onSelesai: (pathname: string) => void;
}) {
  return (
    <UnggahLangsung
      folder="bukti"
      accept="image/jpeg,image/png,image/webp,application/pdf"
      label="Upload bukti transfer"
      tombol="Unggah bukti"
      pesananId={pesananId}
      onSelesai={(hasil) => onSelesai(hasil.pathname)}
    />
  );
}
