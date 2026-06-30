import { auth } from "../lib/auth";
import { db } from "../lib/db";

const email = process.env.SEED_AGENT_EMAIL ?? "agent@example.com";
const password = process.env.SEED_AGENT_PASSWORD ?? (() => {
  throw new Error("SEED_AGENT_PASSWORD must be set");
})();

async function seedAgent() {
  const ctx = await auth.$context;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Agent ${email} already exists, skipping.`);
    return;
  }

  const now = new Date();
  const hashed = await ctx.password.hash(password);

  const user = await ctx.internalAdapter.createUser({
    email,
    name: "Agent",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.internalAdapter.createAccount({
    accountId: user.id,
    providerId: "credential",
    userId: user.id,
    password: hashed,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Agent created: ${email}`);
}

seedAgent()
  .catch((err) => {
    console.error("Seed agent failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
