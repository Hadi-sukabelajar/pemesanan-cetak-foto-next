/// Skema Drizzle untuk Neon (PostgreSQL).
/// Jalankan: npm run db:push
import { defineConfig } from 'drizzle-kit';

// drizzle-kit berjalan di Node, jadi env dimuat manual dari .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // drizzle-kit memilih driver otomatis dari host: PostgreSQL lokal
    // memakai node-postgres, Neon memakai driver serverless-nya.
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});