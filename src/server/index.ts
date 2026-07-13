import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApiServer } from './app.ts';
import { createDatabase } from './db.ts';
import { loadServerEnv } from './env.ts';
import { runMigrations } from './migrations.ts';
import {
  seedD1GuideConfig,
  seedAnonymousFeedbackConfig,
  seedDatabase,
  seedDefaultRoleAvailability,
  seedJoinFeishuOrgTasks,
  seedKnowledgeDocStatusGuard,
  seedManagerFeedbackActions,
  seedRealFeishuFlowConfig,
  seedSubmittedPermissionFollowUps,
  seedWeeklyFeedbackConfig,
} from './seed.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

loadServerEnv(path.join(projectRoot, '.env'));

const db = createDatabase();
runMigrations(db);

const seeded = db.prepare('SELECT COUNT(*) AS total FROM roles').get() as { total: number };
if (seeded.total === 0) {
  seedDatabase(db);
}

seedD1GuideConfig(db);
seedRealFeishuFlowConfig(db);
seedDefaultRoleAvailability(db);
seedJoinFeishuOrgTasks(db);
seedSubmittedPermissionFollowUps(db);
seedWeeklyFeedbackConfig(db);
seedAnonymousFeedbackConfig(db);
seedKnowledgeDocStatusGuard(db);
seedManagerFeedbackActions(db);

const server = await createApiServer({
  db,
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 4000),
  host: '0.0.0.0',
  staticDir: path.join(projectRoot, 'dist'),
});
console.log(`Haina onboarding app listening at ${server.baseUrl}`);
