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
| Deployment | Docker |

## Project Structure

```
helpdesk/
├── CLAUDE.md
├── package.json          # Bun workspace root
├── bun.lock
├── server/               # Express API
│   ├── src/
│   │   └── index.ts      # Entry point
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
  emailAndPassword: { enabled: true, disableSignUp: true },
  trustedOrigins: ["http://localhost:5173"],
});
```

Mounted in `server/src/index.ts` **before** `express.json()`:
```ts
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json()); // must come after
```

### Client (`client/src/lib/auth-client.ts`)
```ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({ baseURL: "http://localhost:3000" });
```

The client points directly at the Express server (`http://localhost:3000`), not through the Vite proxy, because Better Auth needs to set cookies on the correct origin.

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

### Known issue
Logging in currently returns **"Invalid input: expected string, received undefined"** from the server. This is a zod v4 validation error triggered inside Better Auth — the server receives undefined for the email/password fields despite the client constructing the request correctly. Root cause not yet confirmed (suspected: Bun + `toNodeHandler` body stream reading incompatibility, or server/client version mismatch: server uses `better-auth@1.6.22`, client uses `1.6.23`).

## Key Conventions

- All API routes are prefixed with `/api`
- Auth uses database-backed sessions (not JWT)
- Role-based access: admin-only routes are protected at the middleware level
- TypeScript strict mode is enabled in both workspaces

## Documentation

**Always use Context7 MCP for library and framework documentation** — do not rely on training data for API details, configuration options, or version-specific behavior.

Workflow:
1. `resolve-library-id` with the library name and your question
2. Pick the best match (highest benchmark score + exact name match)
3. `query-docs` with the library ID and the full question
4. Use the fetched docs to write code

Apply this for: Express, React, Vite, Prisma, Tailwind, React Router, Bun, Anthropic SDK, SendGrid, Mailgun, and any other library in the stack.
