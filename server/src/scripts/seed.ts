import { auth } from "../lib/auth";
import { db } from "../lib/db";

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.SEED_ADMIN_PASSWORD ?? (() => {
  throw new Error("SEED_ADMIN_PASSWORD must be set");
})();

async function seed() {
  const ctx = await auth.$context;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} already exists, skipping.`);
    return;
  }

  const now = new Date();
  const hashed = await ctx.password.hash(password);

  const user = await ctx.internalAdapter.createUser({
    email,
    name: "Admin",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.user.update({
    where: { id: user.id },
    data: { role: "admin" },
  });

  await ctx.internalAdapter.createAccount({
    accountId: user.id,
    providerId: "credential",
    userId: user.id,
    password: hashed,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Admin created: ${email}`);
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
