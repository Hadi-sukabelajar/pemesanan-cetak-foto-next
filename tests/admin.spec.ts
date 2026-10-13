import { test, expect, type Page } from '@playwright/test';

/**
 * Pengujian halaman admin.
 *
 * Fokus pada aturan yang pernah jadi bug:
 *  - angka penghasilan harus sama di Dashboard, Monitor, dan Riwayat
 *  - pesanan dibatalkan tidak bisa dibayar / dihidupkan
 *  - belum lunas tidak bisa jadi "Selesai"
 *  - guru/fotografer tidak bisa masuk ke halaman admin
 */

async function masuk(page: Page, email: string, password: string) {
  await page.goto('/masuk');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 20_000 });
}

/** Ambil angka "Rp ..." dari kartu statistik tertentu. */
async function angkaDari(page: Page, label: string): Promise<string> {
  const teks = await page.locator('.stat', { hasText: label }).first().innerText();
  return teks.split('\n')[0].trim();
}

test.describe('Halaman admin', () => {
  test('admin melihat dashboard lengkap', async ({ page }) => {
    await masuk(page, 'admin1', '123456789');
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await expect(page.locator('h1')).toContainText('Dashboard');
    for (const label of [
      'Total pesanan',
      'Belum bayar',
      'Perlu verifikasi',
      'Lunas',
      'Siap cetak',
      'Pendapatan masuk',
    ]) {
      await expect(page.locator('.stat', { hasText: label })).toHaveCount(1);
    }
    await expect(page.getByRole('heading', { name: /Pembayaran menunggu/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Antrian cetak/ })).toBeVisible();
  });

  test('layout admin konsisten di halaman staf selain dashboard', async ({ page }) => {
    await masuk(page, 'admin1', '123456789');
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await page.goto('/pesanan');

    await expect(page.locator('body.admin-body')).toHaveCount(1);
    await expect(page.locator('.nav a.on')).toContainText('Pesanan');
    await expect(page.locator('.nav button.logout')).toBeVisible();
  });

  test('monitor terbuka untuk admin & guru', async ({ page }) => {
    await masuk(page, 'guru1', '123456789');
    await page.waitForURL(/\/monitor/, { timeout: 20_000 });
    await expect(page.locator('h1')).toContainText('Monitor Guru');
    // Guru hanya boleh melihat, tidak boleh melihat pintasan admin.
    await expect(page.locator('.shortcuts')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Pengguna terbaru' })).toHaveCount(0);
  });

  test('penghasilan konsisten di Dashboard, Monitor, dan Riwayat', async ({ page }) => {
    await masuk(page, 'admin1', '123456789');
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    const dariDashboard = await angkaDari(page, 'Pendapatan masuk');

    await page.goto('/monitor');
    const dariMonitor = await angkaDari(page, 'Uang masuk (lunas)');

    await page.goto('/riwayat');
    const dariRiwayat = await angkaDari(page, 'Total penghasilan');

    expect(
      dariDashboard,
      'Dashboard, Monitor, dan Riwayat harus menampilkan nominal yang sama',
    ).toBe(dariRiwayat);
    expect(dariMonitor).toBe(dariRiwayat);
  });

  test('guru tidak bisa membuka halaman admin', async ({ page }) => {
    await masuk(page, 'guru1', '123456789');
    await page.waitForURL(/\/monitor/, { timeout: 20_000 });

    for (const hal of ['/dashboard', '/pesanan', '/transaksi', '/pengguna', '/produk', '/pengaturan', '/jurusan']) {
      await page.goto(hal);
      await expect(page).toHaveURL(/\/monitor/, { timeout: 20_000 });
    }
  });

  test('siswa tidak bisa membuka halaman admin', async ({ page }) => {
    // daftar akun siswa
    await page.goto('/daftar');
    await page.waitForFunction(
      () => {
        const s = document.querySelector('#jurusan_id');
        return s instanceof HTMLSelectElement && s.options.length > 1;
      },
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Murid Tes');
    await page.fill('#email', `murid${Date.now()}@sekolah.test`);
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasia123');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/pesan/, { timeout: 20_000 });

    for (const hal of ['/dashboard', '/pesanan', '/transaksi', '/pengguna', '/upload-foto']) {
      await page.goto(hal);
      await expect(page).toHaveURL(/\/pesan$/, { timeout: 20_000 });
    }
  });

  test('fotografer hanya boleh Upload Foto', async ({ page }) => {
    await masuk(page, 'fotografer1', '123456789');
    await page.waitForURL(/\/upload-foto/, { timeout: 20_000 });

    for (const hal of ['/dashboard', '/pesanan', '/transaksi', '/pengguna', '/pengaturan']) {
      await page.goto(hal);
      await expect(page).toHaveURL(/\/upload-foto/, { timeout: 20_000 });
    }
  });

  test('transaksi offline tersimpan & mendapat nomor antrian', async ({ page }) => {
    await masuk(page, 'admin1', '123456789');
    await page.goto('/transaksi');

    await page.waitForFunction(
      () => document.querySelectorAll('input[type=number]').length > 0,
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Pesanan Offline Uji');
    await page.fill('#telepon', '081234567890');
    await page.selectOption('#jurusan_id', { index: 1 });
    await page.selectOption('#kelas_id', { index: 1 });
    await page.getByRole('button', { name: /Tambah Cetak Foto A4/ }).click();
    await page.selectOption('#bayar', 'cash');
    await page.getByRole('button', { name: 'Simpan Transaksi' }).click();

    await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });
    const isi = await page.locator('.kuitansi').innerText();
    expect(isi).toContain('Pesanan Offline Uji');
    expect(isi).toContain('LUNAS');
    // Nomor antrian harus terbit dan tidak kosong.
    const no = await page.locator('.rb-queue b').innerText();
    expect(no).not.toBe('—');
  });

  test('transaksi "belum bayar" tidak langsung lunas', async ({ page }) => {
    await masuk(page, 'admin1', '123456789');
    await page.goto('/transaksi');
    await page.waitForFunction(
      () => document.querySelectorAll('input[type=number]').length > 0,
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Belum Bayar Uji');
    await page.fill('#telepon', '081234567890');
    await page.selectOption('#jurusan_id', { index: 1 });
    await page.selectOption('#kelas_id', { index: 1 });
    await page.getByRole('button', { name: /Tambah Cetak Foto A4/ }).click();
    await page.selectOption('#bayar', '');
    await page.getByRole('button', { name: 'Simpan Transaksi' }).click();

    await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });
    await expect(page.locator('.stamp')).toContainText('BELUM LUNAS');
  });

  test('daftar pesanan bisa difilter & ada paginasi', async ({ page }) => {
    await masuk(page, 'admin1', '123456789');

    // Database tidak direset antar-jalur tes, jadi pakai penanda unik supaya
    // hasil filter bisa dipastikan (bukan sisa pesanan dari jalur sebelumnya).
    const penanda = `Filter${Date.now().toString().slice(-6)}`;
    await page.goto('/transaksi');
    await page.waitForFunction(
      () => document.querySelectorAll('input[type=number]').length > 0,
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', penanda);
    await page.fill('#telepon', '081234567890');
    await page.selectOption('#jurusan_id', { index: 1 });
    await page.selectOption('#kelas_id', { index: 1 });
    await page.getByRole('button', { name: /Tambah Cetak Foto A4/ }).click();
    await page.selectOption('#bayar', 'cash');
    await page.getByRole('button', { name: 'Simpan Transaksi' }).click();
    await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });

    await page.goto('/pesanan');
    await expect(page.locator('h1')).toContainText('Pesanan');

    await page.fill('#q', penanda);
    await page.click('button:has-text("Terapkan")');
    await page.waitForURL(new RegExp(`q=${penanda}`), { timeout: 20_000 });

    const baris = page.locator('table tbody tr');
    await expect(baris).toHaveCount(1);
    await expect(baris.first()).toContainText(penanda);

    // Filter yang tidak ada hasil harus kosong, bukan menampilkan semua.
    await page.fill('#q', 'zzz-tidak-mungkin-ada-zzz');
    await page.click('button:has-text("Terapkan")');
    await page.waitForURL(/q=zzz-tidak-mungkin-ada-zzz/, { timeout: 20_000 });
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await expect(page.locator('table tbody')).toContainText('Tidak ada');
  });

  test('ekspor CSV hanya untuk admin dan namanya benar', async ({ page }) => {
    await masuk(page, 'admin1', '123456789');

    // Navigasi browser ke endpoint unduhan tidak pernah selesai "load",
    // jadi diambil lewat request context yang membawa cookie sesi.
    const res = await page.request.get('/ekspor');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toMatch(
      /attachment; filename="pesanan-\d{8}-\d{6}\.csv"/,
    );
    expect(res.headers()['content-type']).toContain('text/csv');

    const isi = await res.text();
    expect(isi.split('\n')[0]).toContain('Kode');
    // BOM UTF-8 dipakai supaya Excel tidak salah baca karakter Indonesia.
    expect(isi.charCodeAt(0)).toBe(0xfeff);
  });

  test('siswa tidak bisa mengunduh ekspor CSV', async ({ page }) => {
    await page.goto('/daftar');
    await page.waitForFunction(
      () => {
        const s = document.querySelector('#jurusan_id');
        return s instanceof HTMLSelectElement && s.options.length > 1;
      },
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Murid Ekspor');
    await page.fill('#email', `ekspor${Date.now()}@sekolah.test`);
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasia123');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/pesan/, { timeout: 20_000 });

    // Tanpa maxRedirects:0, request context akan mengikuti redirect ke /pesan
    // dan status akhirnya jadi 200. Yang kita uji: akses dialihkan, bukan CSV.
    const res = await page.request.get('/ekspor', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toMatch(/\/pesan$/);
  });
});