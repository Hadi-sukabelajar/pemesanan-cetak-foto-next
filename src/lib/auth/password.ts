import { compare, hash } from 'bcryptjs';

/** Bcrypt cost factor — sama dengan password_hash(..., PASSWORD_DEFAULT) di PHP. */
const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ROUNDS);
}

/**
 * Verifikasi password.
 * Selalu return boolean (bukan string|null seperti PHP password_verify).
 * Kalau user tidak punya password (daftar lewat Google) -> false.
 */
export async function verifyPassword(
  plain: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;
  try {
    return await compare(plain, stored);
  } catch {
    return false;
  }
}