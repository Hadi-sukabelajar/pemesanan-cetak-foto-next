/**
 * Asal (origin) request sesuai yang dilihat pengguna.
 *
 * Kenapa tidak pakai `request.url`?
 * Next.js sering menormalkan URL internal menjadi "localhost" kalau tidak
 * berjalan di belakang proxy. Akibatnya redirect keluar dari origin yang benar:
 * cookie flash tidak ikut terkirim (kalau host berbeda), dan redirect URI
 * OAuth jadi tidak cocok dengan yang didaftarkan di Google Console.
 *
 * Di Vercel, header X-Forwarded-* sudah diisi platform, jadi hasilnya
 * sama persis dengan domain deployment.
 */
import 'server-only';
import type { NextRequest } from 'next/server';

export function asalRequest(request: NextRequest): string {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost';
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

  return `${proto}://${host}`;
}

/** Bangun URL absolut yang tetap berada di origin yang sama. */
export function urlSekitar(request: NextRequest, jalur: string): URL {
  return new URL(jalur, asalRequest(request));
}
