import { db } from "../lib/db";
import { Role } from "../generated/prisma/enums";
import { AI_AGENT_EMAIL } from "../lib/ai";

async function seedAiAgent() {
  const existing = await db.user.findUnique({ where: { email: AI_AGENT_EMAIL } });
  if (existing) {
    console.log(`AI agent already exists, skipping.`);
    return;
  }

  const now = new Date();

  await db.user.create({
    data: {
      email: AI_AGENT_EMAIL,
      name: "AI",
      emailVerified: true,
      role: Role.agent,
      createdAt: now,
      updatedAt: now,
    },
  });

  console.log(`AI agent created: ${AI_AGENT_EMAIL}`);
}

seedAiAgent()
  .catch((err) => {
    console.error("Seed AI agent failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
