// Stub untuk paket `server-only`.
//
// Modul bisnis memakai `import 'server-only'` sebagai pengaman agar tidak
// pernah ikut ter-bundle ke browser. Paket itu sengaja melempar error kalau
// diimpor di luar React Server Component — termasuk skrip Node biasa.
//
// Untuk skrip uji (tsx) kita arahkan ke stub kosong ini supaya logika bisnis
// tetap bisa diuji langsung ke database.
export {};