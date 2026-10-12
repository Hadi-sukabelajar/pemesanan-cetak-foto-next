import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `server-only` menjaga modul bisnis tidak ikut ter-bundle ke browser.
  // TODO: aktifkan enforceJsDoc/typedRoutes bila sudah stabil di seluruh rute.
  images: {
    // Foto hasil disimpan di Vercel Blob dan disajikan lewat route handler
    // milik kita sendiri (/api/foto/[id]) supaya cek izin tetap berlaku.
    remotePatterns: [],
  },
  // Batas ukuran body 4,5 MB berlaku untuk route handler. Upload foto besar
  // memakai client-direct ke Blob sehingga tidak melewati batas ini.
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;