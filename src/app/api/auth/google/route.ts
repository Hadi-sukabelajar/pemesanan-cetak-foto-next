import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { updateSesi } from '@/lib/auth/session';
import { googleAktif } from '@/components/GoogleButton';
import { urlSekitar } from '@/lib/asal';

/**
 * Mulai login dengan Google (OAuth 2.0 Authorization Code).
 *
 * Padanan google_login.php. Bedanya cuma di tempat menyimpan `state`:
 * di sini disimpan di data sesi di database, bukan $_SESSION, supaya tetap
 * konsisten lintas instance serverless.
 */
export async function GET(request: NextRequest) {
  if (!googleAktif()) {
    return NextResponse.redirect(urlSekitar(request, '/masuk'));
  }

  const state = randomBytes(16).toString('hex');
  await updateSesi((d) => ({ ...d, oauthState: state }));

  // Redirect URI harus persis sama dengan yang didaftarkan di Google Console.
  const redirectUri = urlSekitar(request, '/api/auth/google/callback').toString();

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}