'use server';

import { redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pengguna, produk, jurusan, kelas, pesanan } from '@/lib/db/schema';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfAman } from '@/lib/auth/csrf';
import { flash } from '@/lib/flash';
import { teks, potong, potongAtauKosong } from '@/lib/input';
import { hashPassword } from '@/lib/auth/password';
import { BIDANG_PENGATURAN } from '@/lib/pengaturan-daftar';

const POLA_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const POLA_USERNAME = /^[a-z0-9_.]{3,50}$/;
const PERAN_SAH = ['user', 'admin', 'guru', 'fotografer'] as const;

function kePengguna(nilai: string): (typeof PERAN_SAH)[number] {
  return (PERAN_SAH as readonly string[]).includes(nilai)
    ? (nilai as (typeof PERAN_SAH)[number])
    : 'user';
}

// ----------------------------------------------------------------
// Pengguna
// ----------------------------------------------------------------

export async function aksiSimpanPengguna(formData: FormData): Promise<void> {
  await wajibAdmin();
  if (!(await csrfAman(formData))) redirect('/pengguna');

  const db = getDb();
  const id = Number(teks(formData.get('id'))) || 0;
  const nama = potong(teks(formData.get('nama')), 100);
  const email = potong(teks(formData.get('email')), 150).toLowerCase();
  const username = potong(teks(formData.get('username')), 50).toLowerCase();
  const peran = kePengguna(teks(formData.get('peran')));
  const kelasId = Number(teks(formData.get('kelas_id'))) || 0;
  const password = teks(formData.get('password'), '');
  const telepon = potong(teks(formData.get('telepon')), 20);

  const saya = await wajibAdmin();

  const errors: string[] = [];
  if (nama === '') errors.push('Nama wajib diisi.');
  if (!POLA_EMAIL.test(email)) errors.push('Email tidak valid.');
  if (!id && password.length < 6) errors.push('Password minimal 6 karakter.');
  if (id && password !== '' && password.length < 6) {
    errors.push('Password baru minimal 6 karakter.');
  }
  if (username !== '' && !POLA_USERNAME.test(username)) {
    errors.push('Username 3-50 karakter: huruf kecil, angka, titik, atau underscore.');
  }
  // Cegah admin menurunkan perannya sendiri supaya tidak terkunci dari sistem.
  if (id && Number(saya.id) === id && peran !== 'admin') {
    errors.push('Kamu tidak bisa menurunkan peran akunmu sendiri.');
  }

  if (!errors.length && username !== '') {
    const bentrok = await db
      .select({ id: pengguna.id })
      .from(pengguna)
      .where(and(eq(pengguna.username, username), sql`${pengguna.id} <> ${id}`))
      .limit(1);
    if (bentrok.length) errors.push('Username sudah dipakai pengguna lain.');
  }
  if (!errors.length) {
    const bentrok = await db
      .select({ id: pengguna.id })
      .from(pengguna)
      .where(and(eq(pengguna.email, email), sql`${pengguna.id} <> ${id}`))
      .limit(1);
    if (bentrok.length) errors.push('Email sudah dipakai pengguna lain.');
  }

  const kelasValid =
    kelasId > 0
      ? ((await db.select({ id: kelas.id }).from(kelas).where(eq(kelas.id, kelasId)).limit(1))[0]
          ?.id ?? null)
      : null;

  if (errors.length) {
    await flash('bad', errors.join(' '));
    redirect(id ? `/pengguna/${id}` : '/pengguna');
  }

  const nilai = {
    nama,
    email,
    username: username === '' ? null : username,
    peran,
    kelasId: kelasValid,
    telepon: telepon === '' ? null : telepon,
  };

  if (id) {
    await db.update(pengguna).set(nilai).where(eq(pengguna.id, id));
    if (password !== '') {
      await db
        .update(pengguna)
        .set({ password: await hashPassword(password) })
        .where(eq(pengguna.id, id));
    }
    await flash('ok', 'Pengguna diperbarui.');
  } else {
    await db.insert(pengguna).values({
      ...nilai,
      password: await hashPassword(password),
    });
    await flash('ok', 'Pengguna ditambahkan.');
  }
  redirect('/pengguna');
}

export async function aksiHapusPengguna(formData: FormData): Promise<void> {
  const saya = await wajibAdmin();
  if (!(await csrfAman(formData))) redirect('/pengguna');

  const db = getDb();
  const id = Number(teks(formData.get('id'))) || 0;

  if (id === Number(saya.id)) {
    await flash('bad', 'Kamu tidak bisa menghapus akunmu sendiri.');
  } else {
    const [t] = await db.select().from(pengguna).where(eq(pengguna.id, id)).limit(1);
    if (t) {
      // Jangan sampai tidak ada admin sama sekali.
      if (t.peran === 'admin') {
        const [{ n }] = await db
          .select({ n: sql<number>`COUNT(*)::int` })
          .from(pengguna)
          .where(eq(pengguna.peran, 'admin'));
        if (Number(n) <= 1) {
          await flash('bad', 'Ini akun admin terakhir, tidak bisa dihapus.');
          redirect('/pengguna');
        }
      }
      const [{ n }] = await db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(pesanan)
        .where(eq(pesanan.penggunaId, id));
      await db.delete(pengguna).where(eq(pengguna.id, id));
      await flash(
        'ok',
        `Pengguna ${t.email} dihapus.` +
          (Number(n) > 0
            ? ` Namun ${n} pesanannya kini berstatus "offline" dan tidak bisa dibuka lagi oleh pemesannya.`
            : ''),
      );
    }
  }
  redirect('/pengguna');
}

// ----------------------------------------------------------------
// Produk
// ----------------------------------------------------------------

export async function aksiSimpanProduk(formData: FormData): Promise<void> {
  await wajibAdmin();
  if (!(await csrfAman(formData))) redirect('/produk');

  const db = getDb();
  const id = Number(teks(formData.get('id'))) || 0;
  const nama = potong(teks(formData.get('nama')), 100);
  const keterangan = potongAtauKosong(teks(formData.get('keterangan')), 200);
  const harga = Number(teks(formData.get('harga'), '0')) || 0;
  const urutan = Number(teks(formData.get('urutan'), '0')) || 0;
  const aktif = teks(formData.get('aktif')) === '1';

  const errors: string[] = [];
  if (nama === '') errors.push('Nama produk wajib diisi.');
  if (!Number.isFinite(harga) || harga < 0 || harga > 100_000_000) {
    errors.push('Harga tidak valid.');
  }
  if (errors.length) {
    await flash('bad', errors.join(' '));
    redirect('/produk');
  }

  if (id) {
    await db
      .update(produk)
      .set({ nama, keterangan, harga, urutan, aktif })
      .where(eq(produk.id, id));
    await flash('ok', 'Produk diperbarui. (Pesanan lama tidak berubah harganya.)');
  } else {
    await db.insert(produk).values({ nama, keterangan, harga, urutan, aktif });
    await flash('ok', 'Produk ditambahkan.');
  }
  redirect('/produk');
}

export async function aksiHapusProduk(formData: FormData): Promise<void> {
  await wajibAdmin();
  if (!(await csrfAman(formData))) redirect('/produk');
  await getDb().delete(produk).where(eq(produk.id, Number(teks(formData.get('id'))) || 0));
  await flash('ok', 'Produk dihapus.');
  redirect('/produk');
}

// ----------------------------------------------------------------
// Jurusan & Kelas
// ----------------------------------------------------------------

export async function aksiSimpanJurusan(formData: FormData): Promise<void> {
  await wajibAdmin();
  if (!(await csrfAman(formData))) redirect('/jurusan');

  const db = getDb();
  const id = Number(teks(formData.get('id'))) || 0;
  const nama = potong(teks(formData.get('nama')), 60);

  if (nama === '') {
    await flash('bad', 'Nama jurusan wajib diisi (maks. 60 karakter).');
    redirect('/jurusan');
  }
  const bentrok = await db
    .select({ id: jurusan.id })
    .from(jurusan)
    .where(and(eq(jurusan.nama, nama), sql`${jurusan.id} <> ${id}`))
    .limit(1);
  if (bentrok.length) {
    await flash('bad', `Jurusan "${nama}" sudah ada.`);
    redirect('/jurusan');
  }

  if (id) {
    await db.update(jurusan).set({ nama }).where(eq(jurusan.id, id));
    await flash('ok', 'Jurusan diperbarui.');
  } else {
    await db.insert(jurusan).values({ nama });
    await flash('ok', `Jurusan ${nama} ditambahkan. Sekarang tambahkan kelasnya.`);
  }
  redirect('/jurusan');
}

export async function aksiHapusJurusan(formData: FormData): Promise<void> {
  await wajibAdmin();
  if (!(await csrfAman(formData))) redirect('/jurusan');

  const db = getDb();
  const id = Number(teks(formData.get('id'))) || 0;
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(kelas)
    .where(eq(kelas.jurusanId, id));

  if (Number(n) > 0) {
    await flash('bad', `Jurusan masih punya ${n} kelas. Hapus atau pindahkan kelasnya dulu.`);
  } else {
    await db.delete(jurusan).where(eq(jurusan.id, id));
    await flash('ok', 'Jurusan dihapus.');
  }
  redirect('/jurusan');
}

export async function aksiSimpanKelas(formData: FormData): Promise<void> {
  await wajibAdmin();
  if (!(await csrfAman(formData))) redirect('/jurusan');

  const db = getDb();
  const id = Number(teks(formData.get('id'))) || 0;
  const nama = potong(teks(formData.get('nama')), 60);
  const jurusanId = Number(teks(formData.get('jurusan_id'))) || 0;

  const [{ n: nJurusan }] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(jurusan)
    .where(eq(jurusan.id, jurusanId));
  if (!jurusanId || Number(nJurusan) === 0) {
    await flash('bad', 'Pilih jurusan untuk kelas ini.');
    redirect('/jurusan');
  }
  if (nama === '') {
    await flash('bad', 'Nama kelas wajib diisi (maks. 60 karakter).');
    redirect('/jurusan');
  }
  const bentrok = await db
    .select({ id: kelas.id })
    .from(kelas)
    .where(and(eq(kelas.nama, nama), sql`${kelas.id} <> ${id}`))
    .limit(1);
  if (bentrok.length) {
    await flash('bad', 'Nama kelas sudah ada.');
    redirect('/jurusan');
  }

  if (id) {
    await db.update(kelas).set({ nama, jurusanId }).where(eq(kelas.id, id));
    // Nama kelas yang tersimpan di pesanan ikut diperbarui supaya laporan tetap rapi.
    await db.update(pesanan).set({ kelasNama: nama }).where(eq(pesanan.kelasId, id));
    await flash('ok', 'Kelas diperbarui.');
  } else {
    await db.insert(kelas).values({ nama, jurusanId });
    await flash('ok', 'Kelas ditambahkan.');
  }
  redirect('/jurusan');
}

export async function aksiHapusKelas(formData: FormData): Promise<void> {
  await wajibAdmin();
  if (!(await csrfAman(formData))) redirect('/jurusan');

  const db = getDb();
  const id = Number(teks(formData.get('id'))) || 0;

  const [{ n: nPesanan }] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(pesanan)
    .where(eq(pesanan.kelasId, id));
  const [{ n: nUser }] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(pengguna)
    .where(eq(pengguna.kelasId, id));

  if (Number(nPesanan) > 0) {
    await flash('bad', `Kelas masih dipakai ${nPesanan} pesanan, tidak bisa dihapus.`);
  } else if (Number(nUser) > 0) {
    await flash('bad', `Kelas masih dipakai ${nUser} akun pengguna, tidak bisa dihapus.`);
  } else {
    await db.delete(kelas).where(eq(kelas.id, id));
    await flash('ok', 'Kelas dihapus.');
  }
  redirect('/jurusan');
}

// ----------------------------------------------------------------
// Pengaturan
// ----------------------------------------------------------------

export async function aksiSimpanPengaturan(formData: FormData): Promise<void> {
  await wajibAdmin();
  if (!(await csrfAman(formData))) redirect('/pengaturan');

  const { pengaturan } = await import('@/lib/db/schema');
  const db = getDb();

  for (const [kunci] of BIDANG_PENGATURAN) {
    const nilai = potong(teks(formData.get(kunci)), 500);
    await db
      .insert(pengaturan)
      .values({ kunci, nilai })
      .onConflictDoUpdate({ target: pengaturan.kunci, set: { nilai } });
  }
  await flash('ok', 'Pengaturan disimpan.');
  redirect('/pengaturan');
}

