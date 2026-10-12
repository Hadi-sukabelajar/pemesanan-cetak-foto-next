import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { Ruang } from '@/components/Ruang';
import { FormCsrf } from '@/components/FormCsrf';
import { PilihJurusanKelas } from '@/components/PilihJurusanKelas';
import { semuaJurusan, semuaKelas } from '@/lib/orders';
import { getDb } from '@/lib/db';
import { pengguna } from '@/lib/db/schema';
import { aksiSimpanPengguna } from '../../crud/actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: id && id !== 'baru' ? 'Edit Pengguna' : 'Tambah Pengguna' };
}

const PERAN = [
  { nilai: 'user', label: 'User (siswa)' },
  { nilai: 'admin', label: 'Admin' },
  { nilai: 'guru', label: 'Guru (hanya memantau)' },
  { nilai: 'fotografer', label: 'Fotografer (upload foto hasil)' },
];

export default async function FormPengguna({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  await wajibAdmin();
  const { id: idParam } = await params;
  const token = await csrfToken();

  const id = !idParam || idParam === 'baru' ? 0 : Number(idParam);
  const [jurusan, kelas] = await Promise.all([semuaJurusan(), semuaKelas()]);

  let edit = null;
  if (id) {
    const [p] = await getDb().select().from(pengguna).where(eq(pengguna.id, id)).limit(1);
    if (!p) notFound();
    edit = p;
  }

  return (
    <Ruang judul={edit ? 'Edit Pengguna' : 'Tambah Pengguna'} aktif="pengguna">
      <h1>{edit ? 'Edit Pengguna' : 'Tambah Pengguna'}</h1>

      <form action={aksiSimpanPengguna} className="card">
        <FormCsrf token={token} />
        {edit && <input type="hidden" name="id" value={edit.id} />}

        <label htmlFor="nama">Nama</label>
        <input
          type="text"
          id="nama"
          name="nama"
          defaultValue={edit?.nama ?? ''}
          required
          maxLength={100}
        />

        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          defaultValue={edit?.email ?? ''}
          required
          maxLength={150}
        />

        <label htmlFor="telepon">Nomor telepon <span className="muted">(opsional)</span></label>
        <input
          type="tel"
          id="telepon"
          name="telepon"
          defaultValue={edit?.telepon ?? ''}
          maxLength={20}
          inputMode="tel"
        />

        <label htmlFor="username">
          Username <span className="muted">(opsional, untuk login)</span>
        </label>
        <input
          type="text"
          id="username"
          name="username"
          defaultValue={edit?.username ?? ''}
          maxLength={50}
          autoCapitalize="none"
        />

        <label htmlFor="peran">Peran</label>
        <select id="peran" name="peran" defaultValue={edit?.peran ?? 'user'}>
          {PERAN.map((p) => (
            <option key={p.nilai} value={p.nilai}>
              {p.label}
            </option>
          ))}
        </select>

        <PilihJurusanKelas
          jurusan={jurusan}
          kelas={kelas}
          terpilihKelas={edit?.kelasId ?? 0}
          wajib={false}
        />

        <label htmlFor="password">{edit ? 'Password baru' : 'Password'}</label>
        <input
          type="password"
          id="password"
          name="password"
          defaultValue=""
          {...(edit ? {} : { required: true })}
          minLength={6}
          autoComplete="new-password"
        />
        {edit && <div className="hint">Kosongkan jika tidak ingin mengubah password.</div>}

        <div className="row mt">
          <button className="btn gold" type="submit">
            Simpan
          </button>
          <Link className="btn ghost" href="/pengguna">
            Batal
          </Link>
        </div>
      </form>
    </Ruang>
  );
}