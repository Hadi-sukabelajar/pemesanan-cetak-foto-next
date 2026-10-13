import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // tests/setup-awal.spec.ts butuh database kosong + server sendiri,
  // jadi tidak ikut jalan di ./jalankan-tes.sh. Jalankan via ./tes-setup.sh.
  testIgnore: process.env.SKIP_SETUP ? [] : ['**/setup-awal.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    // Bisa diarahkan ke server lain lewat env, dipakai oleh tes setup
    // yang butuh database kosong dan servernya sendiri.
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});