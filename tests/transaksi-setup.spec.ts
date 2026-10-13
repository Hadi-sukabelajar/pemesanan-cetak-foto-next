import { test, expect, type Page } from '@playwright/test';

/**
 * Pengujian untuk fitur yang berpotensi "diam-diam rusak":
 *  - /transaksi/<id> (edit pesanan) — dulu 8 tautan mengarah ke sini
 *  - /setup — harus terkunci begitu admin pertama ada
 *  - login Google — harus tersembunyi & inert kalau belum dikonfigurasi
 */

async function masuk(page: Page) {
  await page.goto('/masuk');
  await page.fill('#email', 'admin1');
  await page.fill('#password', '123456789');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

/** Buat pesanan offline lalu kembalikan URL kuitansinya. */
async function buatPesananOffline(
  page: Page,
  nama: string,
  bayar: '' | 'cash' | 'transfer' = 'cash',
): Promise<string> {
  await page.goto('/transaksi');
  await page.waitForFunction(
    () => document.querySelectorAll('input[type=number]').length > 0,
    undefined,
    { timeout: 25_000 },
  );
  await page.fill('#nama', nama);
    await page.fill('#telepon', '081234567890');
  await page.selectOption('#jurusan_id', { index: 1 });
  await page.selectOption('#kelas_id', { index: 1 });
  await page.getByRole('button', { name: /Tambah Cetak Foto A4/ }).click();
  await page.selectOption('#bayar', bayar);
  await page.getByRole('button', { name: 'Simpan Transaksi' }).click();
  await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });
  return page.url();
}

test.describe('Edit pesanan offline', () => {
  test('tautan Detail dari tiap halaman admin tidak 404', async ({ page }) => {
    await masuk(page);
    const penanda = `Detail${Date.now().toString().slice(-6)}`;
    const url = await buatPesananOffline(page, penanda);
    const id = url.split('/').pop()!;

    // Halaman yang menautkan "Detail" harus punya tautan itu, dan
    // mengikuti tautannya tidak boleh berakhir di 404.
    let jumlahTautan = 0;
    for (const hal of ['/dashboard', '/pesanan', '/antrian', '/monitor']) {
      await page.goto(hal);
      const tautan = page.locator(`a[href="/transaksi/${id}"]`).first();
      if ((await tautan.count()) > 0) {
        jumlahTautan++;
        await tautan.click();
        await page.waitForURL(new RegExp(`/transaksi/${id}$`), { timeout: 20_000 });
        // Halaman edit yang tampil membuktikan tujuannya bukan 404.
        await expect(page.locator('#nama')).toHaveValue(penanda);
      }
    }
    // Minimal tiga halaman harus menautkan Detail.
    expect(jumlahTautan).toBeGreaterThanOrEqual(3);

    // Dan tujuannya benar-benar membuka form edit.
    await page.goto(`/transaksi/${id}`);
    await expect(page.locator('h1')).toContainText('Pesanan');
    await expect(page.locator('#nama')).toHaveValue(penanda);
  });

  test('pesanan lunas terkunci: isi & total tidak bisa diubah diam-diam', async ({ page }) => {
    await masuk(page);
    const penanda = `Kunci${Date.now().toString().slice(-6)}`;
    const url = await buatPesananOffline(page, penanda);
    const id = url.split('/').pop()!;

    await page.goto(`/transaksi/${id}`);
    // Pesanan lunas harus memberi tahu(formeterkunci) di dalam form.
    await expect(page.locator('.hint')).toContainText('sudah lunas');
    const totalSebelum = await page.locator('.totalbar').innerText();

    // Coba kurangi jumlah produk lalu simpan.
    await page.locator('input[type=number]').first().fill('0');
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await page.waitForTimeout(2000);

    // Setelah reload, isi & total pesanan harus tetap sama.
    await page.goto(`/transaksi/${id}`);
    await expect(page.locator('#nama')).toHaveValue(penanda);
    expect(await page.locator('.totalbar').innerText()).toBe(totalSebelum);
  });

  test('aksi admin kembali ke halaman asal, bukan ke dashboard', async ({ page }) => {
    await masuk(page);
    const penanda = `Balik${Date.now().toString().slice(-6)}`;
    // Belum dibayar — supaya tombol "Tandai lunas" tersedia.
    const url = await buatPesananOffline(page, penanda, '');
    const id = url.split('/').pop()!;
    page.once('dialog', (d) => d.accept());

    await page.goto(`/transaksi/${id}`);
    await page.getByRole('button', { name: 'Tandai lunas' }).click();

    // `back` pada form aksi harus dihormati. Sebelumnya semua path ditolak
    // oleh safeBack sehingga admin selalu mendarat di /dashboard.
    await page.waitForURL(new RegExp(`/transaksi/${id}$`), { timeout: 20_000 });
    await expect(page.locator('#nama')).toHaveValue(penanda);
    await expect(page.locator('.alert.a-ok')).toContainText('dikonfirmasi lunas');
    await expect(page.locator('.badge').first()).toHaveText(/lunas/i);
  });

  test('id yang tidak ada menampilkan halaman tidak ditemukan', async ({ page }) => {
    await masuk(page);
    const res = await page.goto('/transaksi/99999999');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Halaman setup', () => {
  test('terkunci karena admin sudah ada', async ({ page }) => {
    // Seed selalu membuat admin, jadi /setup harus selalu tertutup.
    await page.goto('/setup');
    await expect(page).toHaveURL(/\/masuk$/, { timeout: 20_000 });
  });

  test('siswa yang sudah punya akun tidak bisa membuka /setup', async ({ page }) => {
    await page.goto('/daftar');
    await page.waitForFunction(
      () => {
        const s = document.querySelector('#jurusan_id');
        return s instanceof HTMLSelectElement && s.options.length > 1;
      },
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Murid Setup');
    await page.fill('#email', `setup${Date.now()}@sekolah.test`);
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasia123');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/pesan/, { timeout: 20_000 });

    // Setup yang sudah tertutup akan mengalihkan ke /masuk, dan /masuk
    // lalu mengalihkan siswa ke beranda. Yang penting: bukan /setup.
    await page.goto('/setup');
    await expect(page).not.toHaveURL(/\/setup/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/pesan$/, { timeout: 20_000 });
  });
});

test.describe('Login Google', () => {
  test('tombol disembunyikan saat env Google belum diisi', async ({ page }) => {
    // .env.exampleFilled kosong secara bawaan, jadi tombol harus hilang.
    await page.goto('/masuk');
    await expect(page.locator('a.google')).toHaveCount(0);
  });

  test('route awal Google mengalihkan ke /masuk, bukan error 500', async ({ page }) => {
    const res = await page.goto('/api/auth/google');
    // page.goto mengikuti redirect, jadi status akhir 200 di halaman masuk.
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain('/masuk');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('callback Google selalu berakhir di /masuk dengan pesan jelas', async ({ page }) => {
    await page.goto('/masuk');
    // Env Google kosong di lingkungan tes, jadi callback harus menolak dengan
    // pesan "belum dikonfigurasi" — bukan crash dan bukan 500.
    const res = await page.goto('/api/auth/google/callback?code=palsu&state=palsu');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/\/masuk$/, { timeout: 20_000 });
    await expect(page.locator('.alert.a-bad')).toContainText(/belum dikonfigurasi/i, {
      timeout: 20_000,
    });
  });
});