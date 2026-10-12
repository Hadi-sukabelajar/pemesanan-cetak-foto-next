/**
 * Field token CSRF tersembunyi.
 *
 * Wajib ada di setiap <form action={...}>. Token-nya dicocokkan di server
 * oleh verifikasiCsrf(); kalau tidak cocok, aksi ditolak.
 */
export function FormCsrf({ token }: { token: string }) {
  return <input type="hidden" name="_csrf" value={token} />;
}