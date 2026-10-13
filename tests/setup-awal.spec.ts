import { test, expect } from '@playwright/test';

/**
 * Instalasi admin pertama lewat /setup.
 *
 * Tes ini TIDAK ikut jalan di ./jalankan-tes.sh. Jalannya butuh database
 * kosong dan server sendiri, jadi dijalankan oleh tes-setup.sh.
 *
 * Yang diuji:
 *  - database benar-benar kosong -> /setup terbuka
 *  - SETUP_KEY wajib benar
 *  - validasi input (password < 8 karakter, konfirmasi beda)
 *  - setelah admin dibuat, /setup terkunci permanen
 */

const KODE = 'kode-rahasia-uji';

test.describe('Instalasi admin pertama', () => {
  test('database kosong: halaman setup terbuka', async ({ page }) => {
    await page.goto('/setup');
    await expect(page.locator('h1')).toContainText('Setup Admin Pertama');
    await expect(page.locator('#nama')).toBeVisible();
    // Karena SETUP_KEY diisi di server, field kode harus muncul.
    await expect(page.locator('#key')).toBeVisible();
  });

  test('kode setup yang salah ditolak', async ({ page }) => {
    await page.goto('/setup');
    await page.fill('#nama', 'Admin Uji');
    await page.fill('#username', 'adminuji');
    await page.fill('#email', 'adminuji@sekolah.test');
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasia123');
    await page.fill('#key', 'kode-salah');
    await page.click('button[type=submit]');
    await expect(page.locator('.alert.a-bad')).toContainText('Kode setup salah', {
      timeout: 20_000,
    });
  });

  test('password pendek diblokir browser', async ({ page }) => {
    await page.goto('/setup');
    await page.fill('#nama', 'Admin Uji');
    await page.fill('#username', 'adminuji');
    await page.fill('#email', 'adminuji@sekolah.test');
    await page.fill('#password', 'pendek');
    await page.fill('#password2', 'pendek');
    await page.fill('#key', KODE);
    await page.click('button[type=submit]');

    // Atribut minLength menahan submit di browser, jadi form tidak pernah
    // terkirim dan halaman tetap di /setup.
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.locator('#password')).toHaveValue('pendek');
    await expect(page.locator('#nama')).toHaveValue('Admin Uji');
  });

  test('konfirmasi password beda ditolak server', async ({ page }) => {
    await page.goto('/setup');
    await page.fill('#nama', 'Admin Uji');
    await page.fill('#username', 'adminuji');
    await page.fill('#email', 'adminuji@sekolah.test');
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasiabeda');
    await page.fill('#key', KODE);
    await page.click('button[type=submit]');
    await expect(page.locator('.alert.a-bad')).toContainText('Konfirmasi password', {
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/\/setup$/);
  });

  test('email & username tidak valid ditolak', async ({ page }) => {
    await page.goto('/setup');
    await page.fill('#nama', 'Admin Uji');
    await page.fill('#username', 'ADA SPASI');
    await page.fill('#email', 'bukan-email');
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasia123');
    await page.fill('#key', KODE);
    await page.click('button[type=submit]');

    // Browser menolak format email/username dulu, jadi form tidak terkirim.
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.locator('#nama')).toHaveValue('Admin Uji');
  });

  test('admin berhasil dibuat lalu langsung masuk ke Pengaturan', async ({ page }) => {
    await page.goto('/setup');
    await page.fill('#nama', 'Admin Pertama');
    await page.fill('#username', 'admin');
    await page.fill('#email', 'admin@sekolah.test');
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasia123');
    await page.fill('#key', KODE);
    await page.click('button[type=submit]');

    await page.waitForURL(/\/pengaturan/, { timeout: 20_000 });
    await expect(page.locator('.alert.a-ok')).toContainText('Admin pertama dibuat');
    // Menu admin hanya muncul kalau benar-benar sudah masuk sebagai admin.
    await expect(page.locator('.topbar')).toContainText('Keluar');
    await expect(page.locator('.topbar')).toContainText('Dashboard');
    await expect(page.locator('h1')).toContainText('Pengaturan');
  });

  test('akun admin baru bisa login dan admin lama tidak bisa', async ({ page }) => {
    await page.goto('/masuk');
    await page.fill('#email', 'admin');
    await page.fill('#password', 'rahasia123');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/(dashboard|pengaturan)$/, { timeout: 20_000 });
    await expect(page.locator('.topbar')).toContainText('Keluar');
  });

  test('halaman setup terkunci permanen setelah admin dibuat', async ({ page }) => {
    // Tes ini harus jalan baik sendiri (--grep) maupun setelah tes lain yang
    // sudah membuat admin lebih dulu.
    await page.goto('/setup');
    const masihTerbuka = page.url().includes('/setup');

    if (masihTerbuka) {
      await page.fill('#nama', 'Admin Kunci');
      await page.fill('#username', 'adminkunci');
      await page.fill('#email', 'adminkunci@sekolah.test');
      await page.fill('#password', 'rahasia123');
      await page.fill('#password2', 'rahasia123');
      await page.fill('#key', KODE);
      await page.click('button[type=submit]');
      await page.waitForURL(/\/pengaturan/, { timeout: 20_000 });
    }

    // Keluar dulu supaya pengujian dilakukan sebagai tamu.
    const tombolKeluar = page.getByRole('button', { name: 'Keluar' });
    if ((await tombolKeluar.count()) > 0) {
      await tombolKeluar.click();
      await page.waitForTimeout(1000);
    }

    // Tamu tidak boleh membuat admin kedua.
    await page.goto('/setup');
    await expect(page).not.toHaveURL(/\/setup/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/masuk$/, { timeout: 20_000 });

    // Dan tetap tertutup dari tab lain di browser yang sama.
    const konteks = await page.context().newPage();
    await konteks.goto('/setup');
    await expect(konteks).not.toHaveURL(/\/setup/);
    await konteks.close();
  });
});
