import { STATUS_BAYAR_LABEL, STATUS_PESANAN_LABEL } from '@/lib/orders';

/** Badge status pembayaran — padanan badge_bayar() PHP. */
export function BadgeBayar({ status }: { status: string }) {
  const [label, warna] = STATUS_BAYAR_LABEL[status] ?? [status, 'muted'];
  return <span className={`badge b-${warna}`}>{label}</span>;
}

/** Badge status pesanan — padanan badge_status() PHP. */
export function BadgeStatus({ status }: { status: string }) {
  const [label, warna] = STATUS_PESANAN_LABEL[status] ?? [status, 'muted'];
  return <span className={`badge b-${warna}`}>{label}</span>;
}

/** Badge peran pengguna untuk daftar admin. */
export function BadgePeran({ peran }: { peran: string }) {
  const warna =
    peran === 'admin' ? 'accent' : peran === 'user' ? 'muted' : 'info';
  return <span className={`badge b-${warna}`}>{peran}</span>;
}