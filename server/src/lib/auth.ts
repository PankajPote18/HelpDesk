import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { corsOrigins } from "./origins";

const baseURL = process.env.BETTER_AUTH_URL;

// TEMPORARY: confirm exactly what Better Auth resolves BETTER_AUTH_URL to at
// runtime (this is a genuine runtime env read, not build-time inlined).
console.log(`[startup] Better Auth baseURL (from BETTER_AUTH_URL): ${baseURL ?? "(unset)"}`);

export const auth = betterAuth({
  baseURL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  trustedOrigins: corsOrigins,
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "agent",
        input: false,
      },
    },
  },
});
