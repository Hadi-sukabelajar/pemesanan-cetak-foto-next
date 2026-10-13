import { test, expect, type Page } from '@playwright/test';

/**
 * Alur pemesan tanpa akun (tamu).
 *
 * Diuji karena studiorpl memakai pola berbeda dari versi sebelumnya:
 * orang boleh memesan TANPA login, lalu kembali ke pesanannya lewat
 * /cek dengan kode pesanan + nomor HP.
 *
 * Yang jadi fokus di sini:
 *  - tamu bisa memesan tanpa akun dan tetap mendapat nomor antrian,
 *  - kuitansi langsung terbuka setelah memesan,
 *  - /cek hanya berhasil dengan kode + nomor HP yang BENAR,
 *  - orang lain tidak bisa membuka kuitansiatau memesan milik orang lain.
 */

/** Ambil kode pesanan yang tercetak di kuitansi (bukan lewat URL). */
async function bacaKode(page: Page): Promise<string> {
  const teksKuitansi = await page.locator('.kuitansi').innerText();
  // Kode berbentuk FP-<tanggal>-<6 hex>, contoh: FP-26-10-13-EEAE0F
  const cocok = teksKuitansi.match(/FP-\d{2}-\d{2}-\d{2}-[0-9A-F]{6}/);
  expect(cocok, `kode pesanan tidak ditemukan di kuitansi:\n${teksKuitansi.slice(0, 300)}`)
    .not.toBeNull();
  return cocok![0];
}

/** Pesan sebagai tamu (tanpa daftar, tanpa login). */
async function pesanTanpaLogin(page: Page, nama: string, telepon: string): Promise<string> {
  await page.goto('/pesan');
  await page.waitForFunction(
    () => document.querySelectorAll('input[type=number]').length > 0,
    undefined,
    { timeout: 25_000 },
  );
  await page.fill('#nama', nama);
  await page.fill('#telepon', telepon);
  await page.selectOption('#jurusan_id', { index: 1 });
  await page.selectOption('#kelas_id', { index: 1 });
  await page.getByRole('button', { name: /Tambah Cetak Foto A4/ }).click();
  await page.getByRole('button', { name: /Submit Pesanan/ }).click();

  await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });
  return page.url().split('/').pop()!;
}

test.describe('Pemesan tanpa login', () => {
  test('form pesan terbuka untuk tamu & nomor antrian terbit', async ({ page }) => {
    await pesanTanpaLogin(page, 'Tamu Baru', '081234567890');

    // Langsung sampai kuitansi, tanpa login.
    await expect(page.locator('.kuitansi')).toHaveCount(1);
    await expect(page.locator('.rb-queue b')).not.toHaveText('—');
    // Tidak ada tombol "Pesanan Saya" untuk tamu.
    await expect(page.getByRole('link', { name: 'Pesanan Saya' })).toHaveCount(0);
  });

  test('token tidak bocor di URL kuitansi', async ({ page }) => {
    await pesanTanpaLogin(page, 'Tamu Url', '081234567891');
    // Setelah token diserap ke sesi, URL harus bersih — supaya token tidak
    // ikut tersimpan di riwayat browser atau log server.
    expect(page.url()).not.toContain('t=');
    expect(page.url()).not.toContain('token');
  });

  test('nomor HP wajib diisi', async ({ page }) => {
    await page.goto('/pesan');
    await page.waitForFunction(
      () => document.querySelectorAll('input[type=number]').length > 0,
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Tanpa Hp');
    await page.selectOption('#jurusan_id', { index: 1 });
    await page.selectOption('#kelas_id', { index: 1 });
    await page.getByRole('button', { name: /Tambah Cetak Foto A4/ }).click();
    // Form harus punya field telepon dan menandainya wajib.
    const telepon = page.locator('#telepon');
    await expect(telepon).toHaveAttribute('required', '');
  });

  test('nomor HP tidak valid ditolak server', async ({ page }) => {
    await page.goto('/pesan');
    await page.waitForFunction(
      () => document.querySelectorAll('input[type=number]').length > 0,
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Hp Ngawur');
    await page.fill('#telepon', '123');
    await page.selectOption('#jurusan_id', { index: 1 });
    await page.selectOption('#kelas_id', { index: 1 });
    await page.getByRole('button', { name: /Tambah Cetak Foto A4/ }).click();
    await page.getByRole('button', { name: /Submit Pesanan/ }).click();

    await expect(page.locator('.alert.a-bad')).toContainText('Nomor HP', { timeout: 20_000 });
  });

  test('cek pesanan berhasil dengan kode + nomor HP yang benar', async ({ page }) => {
    // Pesan sebagai tamu, catat kode pesanannya.
    await pesanTanpaLogin(page, 'Tamu Cek', '081234567892');
    const kode = await bacaKode(page);
    expect(kode, 'kode pesanan harus tercetak di kuitansi').toBeTruthy();

    // Browser baru = tanpa sesi, tanpa token.
    const konteks = page.context();
    await konteks.clearCookies();

    await page.goto('/cek');
    await page.fill('#kode', kode!);
    await page.fill('#telepon', '081234567892');
    await page.click('button[type=submit]');

    await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });
    await expect(page.locator('.kuitansi')).toHaveCount(1);
    await expect(page.locator('.kuitansi')).toContainText('Tamu Cek');
  });

  test('cek pesanan ditolak bila nomor HP salah', async ({ page }) => {
    await pesanTanpaLogin(page, 'Tamu Hp Salah', '081234567893');
    const kode = await bacaKode(page);
    await page.context().clearCookies();

    await page.goto('/cek');
    await page.fill('#kode', kode!);
    await page.fill('#telepon', '089999999999');
    await page.click('button[type=submit]');

    await expect(page.locator('.alert.a-bad')).toContainText('Pesanan tidak ditemukan', {
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/\/cek/);
  });

  test('cek pesanan ditolak bila kode salah', async ({ page }) => {
    await pesanTanpaLogin(page, 'Tamu Kode Salah', '081234567894');
    await page.context().clearCookies();

    await page.goto('/cek');
    await page.fill('#kode', 'FP-26-01-01-ZZ9999');
    await page.fill('#telepon', '081234567894');
    await page.click('button[type=submit]');

    await expect(page.locator('.alert.a-bad')).toContainText('Pesanan tidak ditemukan', {
      timeout: 20_000,
    });
  });

  test('format nomor HP berbeda tetap dikenali', async ({ page }) => {
    await pesanTanpaLogin(page, 'Tamu Format', '081234567895');
    const kode = await bacaKode(page);
    await page.context().clearCookies();

    // Dimasukkan sebagai 62..., harus tetap cocok dengan 08... yang tersimpan.
    await page.goto('/cek');
    await page.fill('#kode', kode!);
    await page.fill('#telepon', '6281234567895');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });
    await expect(page.locator('.kuitansi')).toContainText('Tamu Format');
  });

  test('orang lain tidak bisa membuka kuitansi tanpa token', async ({ page }) => {
    const id = await pesanTanpaLogin(page, 'Tamu Privat', '081234567896');

    // Tamu lain: sesi lain, tanpa token.
    const lain = await page.context().browser()!.newContext();
    const p2 = await lain.newPage();
    await p2.goto(`/kuitansi/${id}`);
    await expect(p2).toHaveURL(/\/cek/, { timeout: 20_000 });
    await p2.goto(`/api/foto/${id}`);
    expect(await p2.locator('body').innerText()).toContain('Foto tidak ditemukan');
    await lain.close();
  });

  test('token palsu tidak bisa dipakai membuka kuitansi', async ({ page }) => {
    const id = await pesanTanpaLogin(page, 'Tamu Token Palsu', '081234567897');

    const lain = await page.context().browser()!.newContext();
    const p2 = await lain.newPage();
    // Token acak 32 hex — bentuknya benar tapi nilainya salah.
    await p2.goto(`/api/pesanan/${id}/ambil?t=${'0'.repeat(32)}`);
    await expect(p2).toHaveURL(/\/masuk/, { timeout: 20_000 });
    await lain.close();
  });

  test('tamu bisa mengedit pesanannya sendiri sebelum bayar', async ({ page }) => {
    const id = await pesanTanpaLogin(page, 'Tamu Edit', '081234567898');

    await page.goto(`/pesan?id=${id}`);
    await page.waitForFunction(
      () => document.querySelectorAll('input[type=number]').length > 0,
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Tamu Edit Baru');
    await page.getByRole('button', { name: /Simpan Perubahan/ }).click();
    await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });
    await expect(page.locator('.kuitansi')).toContainText('Tamu Edit Baru');
  });

  test('tamu tidak bisa mengedit pesanan orang lain lewat ?id=', async ({ page }) => {
    const id = await pesanTanpaLogin(page, 'Tamu Milik Orang', '081234567899');

    const lain = await page.context().browser()!.newContext();
    const p2 = await lain.newPage();
    await p2.goto(`/pesan?id=${id}`);
    await expect(p2).toHaveURL(/\/cek/, { timeout: 20_000 });
    await lain.close();
  });

  test('beranda & navigasi menawarkan pesan tanpa login', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('link', { name: /Pesan Sekarang/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Cek Pesanan/i }).first()).toBeVisible();
  });

  test('admin tetap bisa membuka pesanan tamu', async ({ page }) => {
    const id = await pesanTanpaLogin(page, 'Tamu Untuk Admin', '081234567800');

    await page.goto('/masuk');
    await page.fill('#email', 'admin1');
    await page.fill('#password', '123456789');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.goto(`/transaksi/${id}`);
    await expect(page.locator('#nama')).toHaveValue('Tamu Untuk Admin');
    await expect(page.locator('#telepon')).toHaveValue('081234567800');
  });
});