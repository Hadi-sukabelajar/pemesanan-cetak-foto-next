import { test, expect } from '@playwright/test';

/**
 * Endpoint pembersihan berkala (Vercel Cron).
 *
 * Endpoint ini DELETE dari database, jadi yang diuji foremost adalah
 * penolakan akses — bukan kebenarannya.
 */

test.describe('Pembersihan berkala', () => {
  test('ditolak tanpa CRON_SECRET (endpoint harus mati)', async ({ page }) => {
    // Di lingkungan tes CRON_SECRET tidak diisi, jadi endpoint diharapkan 503.
    const res = await page.request.get('/api/cron/bersihkan');
    expect(res.status()).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test('ditolak untuk admin biasa', async ({ page }) => {
    await page.goto('/masuk');
    await page.fill('#email', 'admin1');
    await page.fill('#password', '123456789');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    // Admin yang sah pun tidak boleh memicu pembersihan lewat browser:
    // endpoint ini hanya untuk Vercel Cron.
    const res = await page.request.get('/api/cron/bersihkan');
    expect(res.status()).not.toBe(200);
  });

  test('ditolak untuk siswa', async ({ page }) => {
    await page.goto('/daftar');
    await page.waitForFunction(
      () => {
        const s = document.querySelector('#jurusan_id');
        return s instanceof HTMLSelectElement && s.options.length > 1;
      },
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Murid Cron');
    await page.fill('#email', `cron${Date.now()}@sekolah.test`);
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasia123');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/pesan/, { timeout: 20_000 });

    const res = await page.request.get('/api/cron/bersihkan');
    expect(res.status()).not.toBe(200);
  });
});