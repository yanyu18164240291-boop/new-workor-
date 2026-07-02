import { createApiServer } from './app.ts';
import { createDatabase } from './db.ts';
import { runMigrations } from './migrations.ts';
import {
  seedD1GuideConfig,
  seedAnonymousFeedbackConfig,
  seedDatabase,
  seedJoinFeishuOrgTasks,
  seedKnowledgeDocStatusGuard,
  seedSubmittedPermissionFollowUps,
  seedWeeklyFeedbackConfig,
} from './seed.ts';

const db = createDatabase();
runMigrations(db);

const seeded = db.prepare('SELECT COUNT(*) AS total FROM roles').get() as { total: number };
if (seeded.total === 0) {
  seedDatabase(db);
}

seedD1GuideConfig(db);
seedJoinFeishuOrgTasks(db);
seedSubmittedPermissionFollowUps(db);
seedWeeklyFeedbackConfig(db);
seedAnonymousFeedbackConfig(db);
seedKnowledgeDocStatusGuard(db);

const server = await createApiServer({ db, port: Number(process.env.API_PORT ?? 4000) });
console.log(`Haina onboarding API listening at ${server.baseUrl}`);
