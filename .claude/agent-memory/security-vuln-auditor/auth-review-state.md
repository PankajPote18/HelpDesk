---
name: auth-review-state
description: Auth/RBAC review completed 2026-06-30 — confirmed vulnerabilities, what is solid, fix status
metadata:
  type: project
---

Security review of auth and RBAC completed 2026-06-30. Scope: all files in server/src/ and client/src/.

**Confirmed issues:**

1. **trustedOrigins mismatch (High)** — server/src/lib/auth.ts lists only http://localhost:5174. CORS allows both 5173 and 5174. Vite config.ts has no explicit port (defaults to 5173). Browser loaded on 5173 sends Origin: http://localhost:5173, which Better Auth rejects. This is the active login bug. Commit 89db562 ("Fix security bug") introduced this by changing from 5173 to 5174. Fix: list both ports in trustedOrigins.

2. **No server-side auth middleware pattern (pre-vulnerability gap)** — index.ts has no custom protected routes, no requireAuth/requireAdmin middleware. When ticket and user management routes are added, developers have no established pattern. High risk of routes shipped without auth enforcement.

3. **Hardcoded credentials in seed-agent.ts (Medium)** — email and password are literals ("agent@example.com" / "password123"), not env-driven. In git history permanently. seed.ts is slightly better (reads SEED_ADMIN_PASSWORD from env but falls back to "password123").

4. **Client-side-only admin guard (Medium-future)** — AdminRoute.tsx is the sole protection on /users. No server-side /api/users route exists yet, but when added it must have its own role check.

**What is solid:** auth before express.json order is correct; disableSignUp: true; role field has input: false (blocks API escalation); DB-backed sessions; CORS has credentials: true with specific allowed origins; .env not in git; no raw $queryRaw calls; ProtectedRoute checks isPending before session.

**Fix status:** None fixed as of 2026-06-30.
