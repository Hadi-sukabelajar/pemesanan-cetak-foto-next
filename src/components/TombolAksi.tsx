'use client';

import { useFormStatus } from 'react-dom';

type Props = {
  action: (fd: FormData) => Promise<void>;
  csrf: string;
  id: number;
  back: string;
  /** Teks tombol. */
  label: string;
  /** Class tombol: gold | ghost | ok | danger */
  warna?: string;
  /**-action: bayar | tolak | status | nama_file | hapus */
  aksi: string;
  /** Nilai tambahan, mis. status atau metode. */
  nama?: string;
  nilai?: string;
  /** Pesan konfirmasi (data-confirm). */
  konfirmasi?: string;
  /** Kolom input teks (untuk nama_file). */
  inputTeks?: { nama: string; placeholder?: string; nilai: string; panjang?: number };
  disabled?: boolean;
};

/**
 * Tombol aksi admin.
 *
 * Semua aksi berjalan lewat <form method="post"> dengan token CSRF, bukan
 * tautan GET — supaya tidak bisa dipicu diam-diam dari halaman lain.
 */
export function TombolAksi({
  action,
  csrf,
  id,
  back,
  label,
  warna = 'ghost',
  aksi,
  nama,
  nilai,
  konfirmasi,
  inputTeks,
  disabled,
}: Props) {
  return (
    <form
      method="post"
      action={action}
      className={inputTeks ? 'row' : 'inline'}
      style={{ flexWrap: 'nowrap' }}
      {...(konfirmasi ? { 'data-confirm': konfirmasi } : {})}
    >
      <input type="hidden" name="_csrf" value={csrf} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="aksi" value={aksi} />
      {nama && <input type="hidden" name={nama} value={nilai ?? ''} />}
      {inputTeks && (
        <input
          type="text"
          name={inputTeks.nama}
          defaultValue={inputTeks.nilai}
          placeholder={inputTeks.placeholder}
          maxLength={inputTeks.panjang ?? 150}
          style={{ minWidth: 130, padding: '.4rem .5rem' }}
          aria-label={inputTeks.placeholder ?? inputTeks.nama}
        />
      )}
      <TombolDalam warna={warna} label={label} disabled={disabled} />
    </form>
  );
}

function TombolDalam({
  warna,
  label,
  disabled,
}: {
  warna: string;
  label: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`btn sm ${warna}`}
      type="submit"
      disabled={pending || disabled}
    >
      {pending ? '…' : label}
    </button>
  );
}

/** Konfirmasi untuk aksi berbahaya, dipasang sekali di root client. */
export function KonfirmasiAksi() {
  return null;
}
