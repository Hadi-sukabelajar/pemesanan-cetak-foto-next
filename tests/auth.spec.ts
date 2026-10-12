import { test, expect, type Page } from '@playwright/test';

/**
 * Pengujian alur autentikasi memakai browser sungguhan.
 *
 * Server Actions Next.js hanya bisa dipicu lewat form yang di-submit browser
 * (butuh header internal Next.js), jadi curl biasa tidak bisa mengujinya.
 */

async function masuk(page: Page, email: string, password: string) {
  await page.goto('/masuk');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
}

test.describe('Autentikasi', () => {
  test('halaman masuk menampilkan form', async ({ page }) => {
    await page.goto('/masuk');
    await expect(page).toHaveTitle(/Masuk/);
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('input[name="_csrf"]')).toHaveCount(1);
  });

  test('halaman beranda terbuka untuk tamu', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Foto Pelantikan/);
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.getByRole('link', { name: /Daftar/ }).first()).toBeVisible();
  });

  test('daftar harga lengkap (3 produk)', async ({ page }) => {
    await page.goto('/');
    const harga = await page.locator('.price').allInnerTexts();
    expect(harga).toHaveLength(3);
    expect(harga.join(' ')).toContain('50.000');
    expect(harga.join(' ')).toContain('80.000');
    expect(harga.join(' ')).toContain('125.000');
  });

  test('login admin berhasil dan masuk ke dashboard', async ({ page }) => {
    await masuk(page, 'admin1', '123456789');
    // Dashboard belum dibuat di fase ini; yang penting sesi terbentuk.
    await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 15_000 });
    const body = await page.content();
    expect(body).not.toContain('name="password"');
  });

  test('login dengan password salah ditolak', async ({ page }) => {
    await masuk(page, 'admin1', 'passwordsalah');
    await expect(page.locator('.alert.a-bad')).toContainText(/salah/i);
    await expect(page).toHaveURL(/\/masuk/);
  });

  test('email tak dikenal ditolak', async ({ page }) => {
    await masuk(page, 'tidakada@sekolah.test', 'apa saja');
    await expect(page.locator('.alert.a-bad')).toContainText(/salah/i);
  });

  test('email & password kosong ditolak browser', async ({ page }) => {
    await page.goto('/masuk');
    await page.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/masuk/);
  });

  test('daftar akun baru berhasil', async ({ page }) => {
    const email = `siswa${Date.now()}@sekolah.test`;
    await page.goto('/daftar');
    await page.fill('#nama', 'Uji Daftar Otomatis');
    await page.fill('#email', email);
    await page.selectOption('#jurusan_id', { index: 1 });
    await page.selectOption('#kelas_id', { index: 1 });
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasia123');
    await page.click('button[type=submit]');

    // Berhasil -> masuk ke halaman pesan (belum ada, jadi cek URL-nya)
    await page.waitForURL((u) => !u.pathname.startsWith('/daftar'), { timeout: 15_000 });
    await expect(page.locator('.alert.a-ok')).toContainText(/Berhasil/i);
  });

  test('konfirmasi password tidak sama ditolak', async ({ page }) => {
    await page.goto('/daftar');
    await page.fill('#nama', 'Gagal Daftar');
    await page.fill('#email', `gagal${Date.now()}@sekolah.test`);
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'beda123');
    await page.click('button[type=submit]');
    await expect(page.locator('.alert.a-bad')).toContainText(/tidak sama/i);
  });

  test('email ganda ditolak', async ({ page }) => {
    await page.goto('/daftar');
    await page.fill('#nama', 'Email Kembar');
    await page.fill('#email', 'admin1@sekolah.test');
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasia123');
    await page.click('button[type=submit]');
    await expect(page.locator('.alert.a-bad')).toContainText(/terdaftar/i);
  });

  test('dropdown kelas mengikuti jurusan', async ({ page }) => {
    await page.goto('/daftar');
    // Tunggu React selesai hydrate sebelum berinteraksi dengan dropdown.
    // Tunggu React selesai hydrate sebelum berinteraksi dengan dropdown.
    await page.waitForFunction(
      () => {
        const s = document.querySelector('#jurusan_id');
        return s instanceof HTMLSelectElement && s.options.length > 1;
      },
      undefined,
      { timeout: 20_000 },
    );
    // Before jurusan dipilih, kelas harus nonaktif.
    await expect(page.locator('#kelas_id')).toBeDisabled();
    await page.selectOption('#jurusan_id', { index: 1 });
    await expect(page.locator('#kelas_id')).toBeEnabled();
    const opsi = await page.locator('#kelas_id option').count();
    expect(opsi).toBeGreaterThan(1);
  });

  test('keluar menghapus sesi', async ({ page }) => {
    await masuk(page, 'admin1', '123456789');
    await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 15_000 });

    // Beranda menampilkan topbar lengkap untuk pengguna yang sudah login.
    await page.goto('/');
    await expect(page.locator('nav.nav')).toBeVisible();
    await page.getByRole('button', { name: /Keluar/ }).click();

    await expect(page.locator('.alert.a-ok')).toContainText(/keluar/i);
    // Tombol Keluar harus hilang lagi setelah keluar.
    await expect(page.getByRole('button', { name: /Keluar/ })).toHaveCount(0);
    // Dan halaman khusus siswa harus mengarahkan ke halaman masuk.
    await page.goto('/pesanan-saya');
    await expect(page).toHaveURL(/\/masuk/);
  });
});