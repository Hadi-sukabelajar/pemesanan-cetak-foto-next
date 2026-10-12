/**
 * Transaksi baru.
 *
 * Halamannya sama persis dengan /transaksi/[id] — bedanya hanya parameter id
 * yang kosong, sehingga form menampilkan pesanan kosong (mode tambah baru)
 * alih-alih memuat pesanan yang ada.
 *
 * Dipisah sebagai berkas sendiri supaya /transaksi (tanpa id) tetap punya
 * route; tanpa berkas ini, /transaksi akan 404.
 */
export { default, generateMetadata } from './[id]/page';