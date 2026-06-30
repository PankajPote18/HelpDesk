# Helpdesk — Project Memory

## What this is

An AI-powered ticket management system. Support emails arrive, get turned into tickets, and the system uses Claude AI to classify, summarize, and suggest replies. Agents work the queue; admins manage users.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime & package manager | Bun |
| Backend | Express + TypeScript |
| Frontend | React + TypeScript + Vite |
| Database | PostgreSQL |
| ORM | Prisma |
| AI | Claude API (Anthropic) |
| Email | SendGrid or Mailgun |
| Styling | Tailwind CSS |
| Routing | React Router |
| E2E Testing | Playwright |
| Deployment | Docker |

## Project Structure

```
helpdesk/
├── CLAUDE.md
├── package.json          # Bun workspace root
├── playwright.config.ts  # E2E test config
├── bun.lock
├── e2e/                  # Playwright tests
│   ├── global-setup.ts   # DB reset + seed before test runs
│   └── tests/            # Test files go here
├── server/               # Express API
│   ├── src/
│   │   ├── index.ts      # Entry point
│   │   ├── lib/
│   │   │   ├── auth.ts   # Better Auth config
│   │   │   └── db.ts     # Prisma client
│   │   ├── middleware/
│   │   │   └── auth.ts   # requireAuth, requireAdmin
│   │   └── scripts/
│   │       ├── seed.ts        # Seeds admin user
│   │       └── seed-agent.ts  # Seeds agent user
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env              # Dev secrets (gitignored)
│   ├── .env.test         # Test DB config (gitignored)
│   ├── package.json
│   └── tsconfig.json
└── client/               # React SPA
    ├── src/
    │   ├── main.tsx
    │   └── App.tsx
    ├── vite.config.ts    # Proxies /api → localhost:3000
    ├── index.html
    └── package.json
```

## Running the Project

Bun is installed at `%USERPROFILE%\.bun\bin\bun.exe`. If `bun` is not on PATH, run:
```powershell
[Environment]::SetEnvironmentVariable("PATH", "$env:PATH;$env:USERPROFILE\.bun\bin", "User")
```
Then restart the terminal.

```bash
bun run dev       # starts both server (port 3000) and client (port 5173)
bun run build     # builds client then server
```

The Vite dev server proxies all `/api/*` requests to `http://localhost:3000`, so the frontend never hardcodes ports.

## Domain Model

**Ticket statuses:** `open` → `resolved` → `closed`

**Ticket categories:** `general_question`, `technical_question`, `refund_request`

**User roles:**
- `admin` — seeded at deployment; manages agent accounts
- `agent` — created by admin; works tickets

## Authentication

### Library
Better Auth (`better-auth`) with the email/password plugin. Sign-up is **disabled** — agents are created by admins only.

### Server (`server/src/lib/auth.ts`)
```ts
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  trustedOrigins: ["http://localhost:5173", "http://localhost:5174"],
  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "agent", input: false },
    },
  },
});
```

Both ports are listed because Vite defaults to 5173 but falls back to 5174 if occupied. `input: false` on `role` prevents users from self-escalating via the auth API.

Mounted in `server/src/index.ts` **before** `express.json()`:
```ts
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json()); // must come after
```

### Client (`client/src/lib/auth-client.ts`)
```ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
});
```

The client points directly at the Express server, not through the Vite proxy, because Better Auth needs to set cookies on the correct origin.

### Usage patterns
```ts
// Check session (React hook)
const { data: session, isPending } = authClient.useSession();

// Sign in
await authClient.signIn.email(
  { email, password },
  { onSuccess: () => navigate("/"), onError: (ctx) => setError(ctx.error.message) }
);

// Sign out
await authClient.signOut();
```

### Protected routes
`client/src/components/ProtectedRoute.tsx` wraps pages that require login. It checks `isPending` before `!session` to avoid a flash-redirect on first render.

`client/src/components/AdminRoute.tsx` additionally checks `session.user.role === "admin"`. This is a UX guard only — all admin API routes must also be protected server-side.

## Auth Middleware

`server/src/middleware/auth.ts` exports two middleware functions:

```ts
import { requireAuth, requireAdmin } from "./middleware/auth";

// Protect all routes in a router
app.use("/api/tickets", requireAuth, ticketRouter);

// Admin-only routes
app.use("/api/users", requireAuth, requireAdmin, userRouter);
```

- `requireAuth` — validates the session, attaches it to `res.locals.session`, returns 401 if missing
- `requireAdmin` — checks `role === "admin"`, returns 403 otherwise; reuses session from `res.locals` if already fetched

**Every new API route must use one of these.** The client-side guards are UX only.

## Seed Scripts

```bash
bun run db:seed        # creates admin user
bun run db:seed-agent  # creates agent user
```

Both scripts read credentials from env vars and **throw** if the password var is unset — there are no hardcoded fallbacks.

| Script | Env vars required |
|---|---|
| `seed.ts` | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` |
| `seed-agent.ts` | `SEED_AGENT_EMAIL`, `SEED_AGENT_PASSWORD` |

## E2E Testing

Playwright is configured at the workspace root. Tests live in `e2e/tests/`.

```bash
bun run test:e2e       # headless
bun run test:e2e:ui    # interactive UI mode
```

Before each test run, `e2e/global-setup.ts` automatically:
1. Creates the `helpdesk_test` database if it doesn't exist
2. Runs `prisma migrate reset --force` for a clean slate
3. Seeds known test users

The server runs against `helpdesk_test` during tests because Playwright passes `NODE_ENV: "test"` to the server process, and Bun auto-loads `server/.env.test` when `NODE_ENV=test`.

**Test credentials:**
| Role | Email | Password |
|---|---|---|
| Admin | `admin@test.com` | `TestAdmin1!` |
| Agent | `agent@test.com` | `TestAgent1!` |

Never test against the dev `helpdesk` database.

## Key Conventions

- All API routes are prefixed with `/api`
- Auth uses database-backed sessions (not JWT)
- Every API route must be wrapped with `requireAuth`; admin routes additionally with `requireAdmin`
- TypeScript strict mode is enabled in both workspaces

## Documentation

**Always use Context7 MCP for library and framework documentation** — do not rely on training data for API details, configuration options, or version-specific behavior.

Workflow:
1. `resolve-library-id` with the library name and your question
2. Pick the best match (highest benchmark score + exact name match)
3. `query-docs` with the library ID and the full question
4. Use the fetched docs to write code

Apply this for: Express, React, Vite, Prisma, Tailwind, React Router, Bun, Anthropic SDK, SendGrid, Mailgun, and any other library in the stack.
