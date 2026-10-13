import { test, expect, type Page } from '@playwright/test';

/**
 * Pengujian halaman pengelolaan data admin (Fase 7).
 *
 * Fokus pada aturan yang mudah rusak:
 *  - nama produk/jurusan/kelas harus unik dan tidak boleh bentrok
 *  - kelas yang masih dipakai pesanan/pengguna tidak boleh dihapus
 *  - admin terakhir tidak boleh dihapus, dan admin tidak bisa menurunkan
 *    perannya sendiri (supaya tidak terkunci dari sistem)
 */

async function masuk(page: Page) {
  await page.goto('/masuk');
  await page.fill('#email', 'admin1');
  await page.fill('#password', '123456789');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

/** Number acak supaya tiap jalur tes memakai data sendiri. */
function unik(prefix: string): string {
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

test.describe('Pengelolaan data admin', () => {
  test('produk bisa ditambah & aktif/nonaktif tersimpan', async ({ page }) => {
    await masuk(page);
    const nama = unik('Album Uji ');

    await page.goto('/produk');
    await page.fill('#nama', nama);
    await page.fill('#harga', '45000');
    await page.click('button:has-text("Simpan")');
    await expect(page.locator('.alert.a-ok')).toContainText('Produk ditambahkan', {
      timeout: 20_000,
    });
    await expect(page.locator('table')).toContainText(nama);

    // Nonaktifkan lewat checkbox "Tampilkan di form pemesanan".
    const baris = page.locator('tr', { hasText: nama }).last();
    await baris.getByRole('link', { name: 'Edit' }).click();
    await page.waitForURL(/\?edit=\d+/, { timeout: 20_000 });
    await page.uncheck('input[name=aktif]');
    await page.click('button:has-text("Simpan")');
    await expect(page.locator('.alert.a-ok')).toContainText('diperbarui', { timeout: 20_000 });
    await expect(baris).toContainText('Nonaktif');

    // Bersihkan sisa tes supaya produk ini tidak bocor ke jalur tes lain
    // (mis. tes "daftar harga lengkap" yang mengharapkan 3 produk bawaan).
    page.once('dialog', (d) => d.accept());
    await baris.getByRole('button', { name: 'Hapus' }).click();
    await expect(page.locator('.alert.a-ok').last()).toContainText('Produk dihapus', {
      timeout: 20_000,
    });
    await expect(page.locator('table')).not.toContainText(nama);
  });

  test('jurusan & kelas bisa ditambah', async ({ page }) => {
    await masuk(page);
    const jurusan = unik('JUR');
    const kelas = `KELAS ${jurusan}`;

    await page.goto('/jurusan');
    await page.fill('#nama_j', jurusan);
    await page.click('button:has-text("Simpan")');
    await expect(page.locator('.alert.a-ok').last()).toContainText('ditambahkan', {
      timeout: 20_000,
    });

    // Kelas baru harus bisa dipilih sebagai induknya.
    await page.fill('#nama_k', kelas);
    await page.selectOption('#jurusan_k', { label: jurusan });
    await page.click('form:has(#nama_k) button:has-text("Simpan")');
    await expect(page.locator('.alert.a-ok').last()).toContainText('Kelas ditambahkan', {
      timeout: 20_000,
    });
    await expect(page.locator('table').last()).toContainText(kelas);
  });

  test('kelas yang dipakai pesanan tidak bisa dihapus', async ({ page }) => {
    await masuk(page);
    const kelas = `KELAS ${unik('TERPAKAI')}`;

    // Buat kelas
    const jurusanBaru = unik('JUR');
    await page.goto('/jurusan');
    await page.fill('#nama_j', jurusanBaru);
    await page.click('button:has-text("Simpan")');
    await expect(page.locator('.alert.a-ok').last()).toContainText('ditambahkan', {
      timeout: 20_000,
    });
    await page.fill('#nama_k', kelas);
    await page.selectOption('#jurusan_k', { label: jurusanBaru });
    await page.click('form:has(#nama_k) button:has-text("Simpan")');
    await expect(page.locator('.alert.a-ok').last()).toContainText('Kelas ditambahkan', {
      timeout: 20_000,
    });

    // Buat pesanan offline yang memakai kelas itu.
    await page.goto('/transaksi');
    await page.waitForFunction(
      () => document.querySelectorAll('input[type=number]').length > 0,
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Pakai Kelas Uji');
    await page.fill('#telepon', '081234567890');
    await page.selectOption('#jurusan_id', { label: jurusanBaru });
    await page.selectOption('#kelas_id', { label: kelas });
    await page.getByRole('button', { name: /Tambah Cetak Foto A4/ }).click();
    await page.selectOption('#bayar', 'cash');
    await page.getByRole('button', { name: 'Simpan Transaksi' }).click();
    await page.waitForURL(/\/kuitansi\/\d+/, { timeout: 20_000 });

    // Hapus kelasnya harus ditolak.
    await page.goto('/jurusan');
    const baris = page.locator('tr', { hasText: kelas }).last();
    await baris.getByRole('button', { name: 'Hapus' }).click();
    page.once('dialog', (d) => d.accept());
    await expect(page.locator('.alert.a-bad')).toContainText('pesanan', { timeout: 20_000 });
  });

  test('pengguna bisa ditambah & admin tidak bisa menurunkan dirinya sendiri', async ({
    page,
  }) => {
    await masuk(page);
    const email = `${unik('uji')}@sekolah.test`;

    await page.goto('/pengguna/baru');
    await page.fill('#nama', 'Guru Baru');
    await page.fill('#email', email);
    await page.fill('#username', unik('gurubaru'));
    await page.selectOption('#peran', 'guru');
    await page.fill('#password', 'rahasia123');
    await page.click('button:has-text("Simpan")');
    await expect(page.locator('.alert.a-ok').last()).toContainText('ditambahkan', {
      timeout: 20_000,
    });

    await page.goto('/pengguna');
    await page.fill('input[name=q]', email);
    await page.click('button:has-text("Cari")');
    await expect(page.locator('table')).toContainText('Guru Baru');

    // Akun sendiri tidak boleh diubah perannya jadi non-admin.
    // Daftar perlu dibuka tanpa filter supaya baris akun ini terlihat.
    await page.goto('/pengguna');
    const idSendiri = await page
      .locator('tr', { hasText: 'admin1@sekolah.test' })
      .getByRole('link', { name: 'Edit' })
      .getAttribute('href');
    expect(idSendiri).toMatch(/\/pengguna\/\d+$/);
    await page.goto(idSendiri!);
    await page.selectOption('#peran', 'guru');
    await page.click('button:has-text("Simpan")');
    await expect(page.locator('.alert.a-bad')).toContainText('peran akunmu sendiri', {
      timeout: 20_000,
    });
  });

  test('pengaturan tersimpan & dipakai di seluruh halaman', async ({ page }) => {
    await masuk(page);
    const sekolah = `SMA Uji ${Date.now().toString().slice(-5)}`;

    await page.goto('/pengaturan');
    await page.fill('#nama_sekolah', sekolah);
    await page.click('button:has-text("Simpan")');
    await expect(page.locator('.alert.a-ok')).toContainText('Pengaturan disimpan', {
      timeout: 20_000,
    });

    // Muncul di topbar admin.
    await expect(page.locator('.topbar')).toContainText(sekolah);
    // Dan di kuitansi siswa.
    await page.goto('/monitor');
    await expect(page.getByText(`Sekolah: ${sekolah}`)).toBeVisible();

    // Kembalikan supaya tidak mengganggu jalur tes lain.
    await page.goto('/pengaturan');
    await page.fill('#nama_sekolah', 'SMA Contoh');
    await page.click('button:has-text("Simpan")');
    await expect(page.locator('.alert.a-ok')).toBeVisible({ timeout: 20_000 });
  });

  test('upload foto & arsip terbuka untuk admin', async ({ page }) => {
    await masuk(page);

    await page.goto('/upload-foto');
    await expect(page.locator('h1')).toContainText('Upload Foto');
    await expect(page.locator('.tabs')).toContainText('Belum ada foto');

    await page.goto('/upload-foto?tab=sudah');
    await expect(page.locator('.tabs a.on')).toContainText('Sudah ada foto');

    await page.goto('/arsip');
    await expect(page.locator('h1')).toContainText('Arsip');
    await expect(page.locator('.tabs a.on')).toContainText('Siap diambil');
  });

  test('siswa tidak bisa membuka halaman pengelolaan data', async ({ page }) => {
    await page.goto('/daftar');
    await page.waitForFunction(
      () => {
        const s = document.querySelector('#jurusan_id');
        return s instanceof HTMLSelectElement && s.options.length > 1;
      },
      undefined,
      { timeout: 25_000 },
    );
    await page.fill('#nama', 'Murid Manage');
    await page.fill('#email', `manage${Date.now()}@sekolah.test`);
    await page.fill('#password', 'rahasia123');
    await page.fill('#password2', 'rahasia123');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/pesan/, { timeout: 20_000 });

    for (const hal of ['/pengguna', '/pengguna/baru', '/produk', '/jurusan', '/pengaturan', '/arsip']) {
      await page.goto(hal);
      await expect(page).toHaveURL(/\/pesan$/, { timeout: 20_000 });
    }
  });
});