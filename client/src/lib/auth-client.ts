import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// TEMPORARY: confirm the exact value baked in at build time (Vite inlines
// import.meta.env.VITE_API_URL when `vite build` runs).
console.log(`[auth-client] Better Auth baseURL (from VITE_API_URL): ${baseURL}`);

export const authClient = createAuthClient({
  baseURL,
});
