import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { FlashList } from '@/components/FlashList';
import { ambilFlash } from '@/lib/flash';
import { KonfirmasiDanger } from '@/components/KonfirmasiDanger';
import { BodyClass } from '@/components/BodyClass';
import { DaftarkanServiceWorker } from '@/components/DaftarkanServiceWorker';

const font = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Foto Pelantikan',
    template: '%s · Foto Pelantikan',
  },
  description: 'Pemesanan foto sesi pelantikan per kelas dan jurusan',
  manifest: '/manifest.json',
  applicationName: 'Foto Pelantikan',
  appleWebApp: {
    capable: true,
    title: 'Foto Pelantikan',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0e1a38',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const flash = await ambilFlash();

  return (
    <html lang="id" className={font.variable}>
      <body>
        {/* Menambahkan kelas "admin-body" ke <body> sesuai rute, karena
            desain admin memakai sidebar di layar lebar. */}
        <BodyClass />
        <KonfirmasiDanger />
        <FlashList daftar={flash} />
        <DaftarkanServiceWorker />
        {children}
      </body>
    </html>
  );
}