import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  trustedOrigins: ["http://localhost:5174"],
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
