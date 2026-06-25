import { createDatabase } from '../src/server/db.ts';
import { runMigrations } from '../src/server/migrations.ts';
import { seedDatabase } from '../src/server/seed.ts';

const db = createDatabase();
runMigrations(db);
seedDatabase(db);
db.close();

console.log('Seeded Haina onboarding demo data.');
