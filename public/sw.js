/**
 * Service worker Foto Pelantikan.
 *
 * Prinsipnya: HANYA aset statis yang di-cache. Tidak ada HTML halaman dan
 * tidak ada respons /api/* yang pernah menyentuh cache.
 *
 * Alasannya: halaman-halaman aplikasi berisi data pribadi (nama, pesanan,
 * bukti transfer). Kalau HTML-nya ikut ter-cache, satu pengguna bisa
 * melihat halaman pengguna lain di perangkat yang sama, dan setelah
 * logout halamannya masih bisa dibuka offline. Risiko itu jauh lebih besar
 * daripada gunanya cache, jadi sengaja dihindari.
 *
 * Yang di-cache: file statis dengan nama ber-hash dari Next
 * (/_next/static/...) dan gambar/ikon di /public yang tidak berubah.
 */

const VERSI = 'fp-v1';

/** Hanya pola ini yang boleh dilayani dari cache. */
const STATIS = [/^\/_next\/static\//, /^\/icons\//, /^\/img\//];

self.addEventListener('install', (event) => {
  // Langsung aktif: tidak ada aset yang perlu di-precache.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Buang cache versi lama supaya tidak menumpuk.
      const nama = await caches.keys();
      await Promise.all(nama.filter((n) => n !== VERSI).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function bolehCache(url) {
  return STATIS.some((pola) => pola.test(url.pathname));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Hanya GET. POST server action, API, dan unduhan tidak boleh di-cache.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Tanpa syarat lain, jangan sentuh cache: ini mencakup HTML, /api/*,
  // bukti transfer, dan foto hasil ( semuanya butuh sesi yang benar).
  if (!bolehCache(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSI);
      const tersimpan = await cache.match(req);

      // Cache-first: file statis ber-hash tidak pernah berubah isinya.
      if (tersimpan) return tersimpan;

      try {
        const respons = await fetch(req);
        // Hanya cache jawaban yang sukses dan benar-benar statis.
        if (respons.ok && respons.type === 'basic') {
          cache.put(req, respons.clone());
        }
        return respons;
      } catch (err) {
        // Aset statis tidak bisa diambil dan tidak ada di cache.
        throw err;
      }
    })(),
  );
});