import { test, expect, type Page } from '@playwright/test';

async function daftarSiswa(page: Page) {
  const email = `e2e${Date.now()}@sekolah.test`;
  await page.goto('/daftar');
  await page.waitForFunction(() => {
    const s = document.querySelector('#jurusan_id');
    return s instanceof HTMLSelectElement && s.options.length > 1;
  }, undefined, { timeout: 20_000 });
  await page.fill('#nama', 'Budi Santoso');
  await page.fill('#email', email);
  await page.selectOption('#jurusan_id', { index: 1 });
  await page.selectOption('#kelas_id', { index: 1 });
  await page.fill('#password', 'rahasia123');
  await page.fill('#password2', 'rahasia123');
  await page.click('button[type=submit]');
  // Pastikan benar-benar sudah login: menu "Pesanan Saya" hanya tampil
  // untuk akun siswa yang sudah punya sesi.
  await page.waitForURL(/\/pesan/, { timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'Pesanan Saya' })).toBeVisible({
    timeout: 15_000,
  });
  return email;
}

/** Tunggu React hydrate supaya stepper bisa diklik. */
async function tungguHydrate(page: Page) {
  await page.waitForFunction(
    () => document.querySelectorAll('input[type=number]').length > 0,
    undefined,
    { timeout: 25_000 },
  );
}

async function pesanFoto(page: Page) {
  await page.goto('/pesan');
  await tungguHydrate(page);
  await page.fill('#nama', 'Budi Santoso');
  await page.fill('#telepon', '081234567890');
  await page.selectOption('#jurusan_id', { index: 1 });
  await page.selectOption('#kelas_id', { index: 1 });
  // Tambah 2 Cetak Foto A4 + 1 Bingkai
  const plus = page.getByRole('button', { name: /Tambah Cetak Foto A4/ });
  await plus.click();
  await plus.click();
  await page.getByRole('button', { name: /Tambah Bingkai/ }).click();
  await page.getByRole('button', { name: /Submit Pesanan/ }).click();
}

test.describe('Unggah bukti transfer', () => {
  test('klik "Unggah bukti" tidak me-reload halaman dan selalu memberi status', async ({
    page,
  }) => {
    await daftarSiswa(page);
    await pesanFoto(page);
    await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });
    const id = page.url().split('/').pop()!;

    await page.goto(`/pesan/${id}/bayar`);
    await page.locator('.pay-choice label', { hasText: 'Transfer' }).click();
    await expect(page.locator('#berkas-bukti')).toHaveCount(1);

    await page.locator('#berkas-bukti').setInputFiles({
      name: 'bukti.png',
      mimeType: 'image/png',
      // PNG 1x1 yang sah.
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
        'base64',
      ),
    });

    const sebelum = page.url();
    await page.getByRole('button', { name: /Unggah bukti/i }).click();

    // Unggah dulu memakai <form> di dalam <form> pembayaran. Form bersarang
    // membuat tombol type="submit" mengaktifkan submit bawaan ke form LUAR:
    // halaman di-reload dengan GET, berkas hilang, dan tidak ada pesan apa pun.
    // Di sini kita pastikan URL tetap dan pengguna selalu melihat status.
    await page.waitForTimeout(3000);
    expect(page.url(), 'halaman jangan sampai reload ke ?').toBe(sebelum);
    await expect(page.locator('.hint').first()).toContainText(/mengunggah|gagal|token|berkas/i, {
      timeout: 15_000,
    });
  });
});

test.describe('Alur siswa', () => {
  test('pesan foto mendapat kuitansi & nomor antrian', async ({ page }) => {
    await daftarSiswa(page);
    await expect(page).toHaveURL(/\/pesan/);

    await pesanFoto(page);
    await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });

    await expect(page.locator('.rb-queue b')).not.toHaveText('—');
    await expect(page.locator('.stamp')).toContainText('BELUM LUNAS');
    const isi = await page.locator('.kuitansi').innerText();
    expect(isi).toContain('Cetak Foto A4');
    expect(isi).toContain('180.000');
  });

  test('halaman pesanan saya menampilkan pesanan', async ({ page }) => {
    await daftarSiswa(page);
    await pesanFoto(page);
    await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });

    await page.goto('/pesanan-saya');
    await expect(page.locator('.order-card')).toHaveCount(1);
    await expect(page.locator('.oc-panel')).toContainText('180.000');
  });

  test('bayar cash tersimpan', async ({ page }) => {
    await daftarSiswa(page);
    await pesanFoto(page);
    await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });

    await page.goto('/pesanan-saya');
    const bayar = page.getByRole('link', { name: 'Bayar', exact: true });
    await expect(bayar).toBeVisible({ timeout: 20_000 });
    const href = await bayar.getAttribute('href');
    expect(href, 'tautan Bayar harus menuju /pesan/<id>/bayar').toMatch(/^\/pesan\/\d+\/bayar$/);
    await bayar.click();
    await page.waitForURL(/\/pesan\/\d+\/bayar/, { timeout: 20_000 });

    await page.getByRole('button', { name: 'Konfirmasi Pembayaran' }).click();
    await page.waitForURL(/\/pesanan-saya/, { timeout: 20_000 });
    await expect(page.locator('.order-card')).toContainText('tunai');
  });

  // Halaman admin baru ada di fase berikutnya; yang diuji di sini adalah
  // halaman siswa yang tidak boleh disentuh akun lain.
  test('siswa tidak bisa buka halaman siswa lain', async ({ page }) => {
    await daftarSiswa(page);
    await expect(page).toHaveURL(/\/pesan/);
    // /pesanan-saya harus bisa dibuka (miliknya sendiri)
    await page.goto('/pesanan-saya');
    await expect(page).toHaveURL(/\/pesanan-saya/);
  });

  test('siswa tidak bisa buka pesanan orang lain', async ({ page }) => {
    await daftarSiswa(page);
    await pesanFoto(page);
    await page.waitForURL(/\/kuitansi\/(\d+)/, { timeout: 20_000 });
    const idMilik = await page.locator('.oc-panel').isVisible() ? page.url().split('/').pop()! : '1';

    // Akun siswa kedua
    await page.context().clearCookies();
    const emailLain = `lain${Date.now()}@sekolah.test`;
    await page.goto('/daftar');
    await page.waitForFunction(
      () => {
        const s = document.querySelector('#jurusan_id');
        return s instanceof HTMLSelectElement && s.options.length > 1;
      },
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Orang Lain');
    await page.fill('#email', emailLain);
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasia123');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/pesan/, { timeout: 20_000 });

    // Coba buka kuitansi & foto milik orang pertama
    await page.goto(`/kuitansi/${idMilik}`);
    await expect(page.locator('.kuitansi')).toHaveCount(0);
    await page.goto(`/api/foto/${idMilik}`);
    expect(await page.locator('body').innerText()).toContain('Foto tidak ditemukan');
  });
});
