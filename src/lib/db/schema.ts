// Skema database — terjemahan dari MySQL (database/database.sql) ke PostgreSQL.
//
// Pemetaan dari skema MySQL lama:
//   AUTO_INCREMENT  -> GENERATED ALWAYS AS IDENTITY
//   ENUM(...)       -> text + CHECK constraint
//   utf8mb4 ci     -> biarkan default Postgres (sudah case-sensitive & UTF-8)
//   FK ON DELETE SET NULL / CASCADE -> sama persis di Postgres
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uuid,
} from 'drizzle-orm/pg-core';

/** Nilai status pembayaran yang sah (dulu ENUM). */
export const STATUS_BAYAR = ['belum', 'menunggu_verifikasi', 'sudah'] as const;
/** Nilai status pesanan yang sah (dulu ENUM). */
export const STATUS_PESANAN = [
  'menunggu',
  'diproses',
  'siap_cetak',
  'selesai',
  'dibatalkan',
] as const;
/** Peran pengguna yang sah (dulu ENUM). */
export const PERAN = ['user', 'admin', 'guru', 'fotografer'] as const;

export type StatusBayar = (typeof STATUS_BAYAR)[number];
export type StatusPesanan = (typeof STATUS_PESANAN)[number];
export type Peran = (typeof PERAN)[number];

export const jurusan = pgTable('jurusan', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  nama: text('nama').notNull().unique(),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
});

export const kelas = pgTable(
  'kelas',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    jurusanId: integer('jurusan_id')
      .notNull()
      .references(() => jurusan.id, { onDelete: 'restrict' }),
    nama: text('nama').notNull().unique(),
    dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('kelas_jurusan_idx').on(t.jurusanId)],
);

export const pengguna = pgTable(
  'pengguna',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    nama: text('nama').notNull(),
    // Opsional, boleh dipakai untuk login (mis. admin1, guru1)
    username: text('username').unique(),
    email: text('email').notNull().unique(),
    telepon: text('telepon'),
    // NULL jika daftar lewat Google
    password: text('password'),
    googleId: text('google_id').unique(),
    peran: text('peran')
      .$type<Peran>()
      .notNull()
      .default('user'),
    kelasId: integer('kelas_id').references(() => kelas.id, { onDelete: 'set null' }),
    dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('pengguna_peran_idx').on(t.peran)],
);

export const produk = pgTable('produk', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  nama: text('nama').notNull(),
  keterangan: text('keterangan'),
  harga: integer('harga').notNull(),
  aktif: boolean('aktif').notNull().default(true),
  urutan: integer('urutan').notNull().default(0),
});

export const pesanan = pgTable(
  'pesanan',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    kode: text('kode').notNull().unique(),
    // NULL = pesanan tamu (tanpa login) atau pesanan offline yang diinput admin
    penggunaId: integer('pengguna_id').references(() => pengguna.id, { onDelete: 'set null' }),
    nama: text('nama').notNull(),
    // Nomor HP pemesan, sudah dinormalisasi ke format 08xx.
    // Wajib untuk semua orang (termasuk tamu) karena dipakai untuk kembali
    // ke pesanannya lewat halaman /cek.
    telepon: text('telepon'),
    kelasId: integer('kelas_id').references(() => kelas.id, { onDelete: 'set null' }),
    // Disalin dari kelas saat pesanan dibuat, supaya tetap terbaca walau kelas dihapus
    kelasNama: text('kelas_nama'),
    catatan: text('catatan'),
    total: integer('total').notNull().default(0),
    metode: text('metode'), // 'cash' | 'transfer' | NULL
    statusBayar: text('status_bayar')
      .$type<StatusBayar>()
      .notNull()
      .default('belum'),
    // pathname di Vercel Blob (bukan nama file lokal)
    buktiTransfer: text('bukti_transfer'),
    noAntrian: integer('no_antrian').unique(),
    status: text('status').$type<StatusPesanan>().notNull().default('menunggu'),
    namaFile: text('nama_file'),
    // pathname di Vercel Blob
    fotoHasil: text('foto_hasil'),
    // Kunci akses (bearer secret) untuk membuka kuitansi, bukti, dan foto
    // hasil tanpa login. Dibuat untuk SETIAP pesanan baru: 32 karakter hex
    // (128 bit) sehingga mustahil ditebak, tapi tetap perlu dijaga —
    // siapa pun yang memegangnya bisa membuka isi pesanan tersebut.
    token: text('token').unique(),
    dibayarPada: timestamp('dibayar_pada', { withTimezone: true }),
    dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
    diperbaruiPada: timestamp('diperbarui_pada', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('pesanan_status_bayar_idx').on(t.statusBayar),
    index('pesanan_status_idx').on(t.status),
    index('pesanan_pengguna_idx').on(t.penggunaId),
  ],
);

export const pesananItem = pgTable(
  'pesanan_item',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    pesananId: integer('pesanan_id')
      .notNull()
      .references(() => pesanan.id, { onDelete: 'cascade' }),
    produkId: integer('produk_id').references(() => produk.id, { onDelete: 'set null' }),
    // Disalin agar tetap terbaca walau produk dihapus / harganya berubah
    namaProduk: text('nama_produk').notNull(),
    harga: integer('harga').notNull(),
    qty: integer('qty').notNull(),
  },
  (t) => [index('pesanan_item_pesanan_idx').on(t.pesananId)],
);

export const pengaturan = pgTable('pengaturan', {
  kunci: text('kunci').primaryKey(),
  nilai: text('nilai'),
});

/**
 * Sesi pengguna — pengganti $_SESSION PHP.
 * Cookie hanya berisi id sesi bertanda tangan; isi/data disimpan di sini
 * supaya tetap konsisten walau request dilayani instance berbeda.
 */
export const sesi = pgTable(
  'sesi',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    penggunaId: integer('pengguna_id').references(() => pengguna.id, { onDelete: 'cascade' }),
    // JSON: { csrf, flash[], login_fail, oauth_state }
    data: text('data').notNull().default('{}'),
    kedaluwarsa: timestamp('kedaluwarsa', { withTimezone: true }).notNull(),
    dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sesi_kedaluwarsa_idx').on(t.kedaluwarsa)],
);

/**
 * Pembatas percobaan login — menggantikan penyimpanan di sys_get_temp_dir()
 * supaya penghitung tidak hilang tiap instance dan tidak bisa dilewati
 * dengan menghapus cookie.
 */
export const percobaanLogin = pgTable(
  'percobaan_login',
  {
    // sha1(ip + '|' + email), bukan nilai aslinya
    kunci: text('kunci').primaryKey(),
    jumlah: integer('jumlah').notNull().default(0),
    terakhir: timestamp('terakhir', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('percobaan_login_terakhir_idx').on(t.terakhir)],
);

export type Jurusan = typeof jurusan.$inferSelect;
export type Kelas = typeof kelas.$inferSelect;
export type Pengguna = typeof pengguna.$inferSelect;
export type Produk = typeof produk.$inferSelect;
export type Pesanan = typeof pesanan.$inferSelect;
export type PesananItem = typeof pesananItem.$inferSelect;
export type Sesi = typeof sesi.$inferSelect;