import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AmbilFlash } from '@/components/AmbilFlash';
import { BodyClass } from '@/components/BodyClass';

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

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="id" className={font.variable}>
      <body>
        {/* Menambahkan kelas "admin-body" ke <body> sesuai rute, karena
            desain admin memakai sidebar di layar lebar. */}
        <BodyClass />
        <AmbilFlash />
        {children}
      </body>
    </html>
  );
}