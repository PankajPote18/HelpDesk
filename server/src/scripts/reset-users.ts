import { db } from "../lib/db";

const emails = [
  process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
  process.env.SEED_AGENT_EMAIL ?? "agent@example.com",
];

async function resetUsers() {
  const deleted = await db.user.deleteMany({ where: { email: { in: emails } } });
  console.log(`Deleted ${deleted.count} user(s). Re-run db:seed and db:seed-agent.`);
}

resetUsers()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => process.exit(0));
