# Helpdesk — Project Memory

## What this is

An AI-powered ticket management system. Support emails arrive, get turned into tickets, and the system uses Claude AI to classify, summarize, and suggest replies. Agents work the queue; admins manage users.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime & package manager | Bun |
| Backend | Express 5 + TypeScript |
| Frontend | React + TypeScript + Vite |
| Database | PostgreSQL |
| ORM | Prisma |
| AI | Claude API (Anthropic) |
| Email | SendGrid or Mailgun |
| Styling | Tailwind CSS |
| Routing | React Router |
| HTTP client | Axios |
| Server state | TanStack Query (`@tanstack/react-query`) |
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

Use the **`playwright-e2e-writer` agent** to write, extend, or update Playwright tests. It has full context on the test infrastructure, credentials, conventions, and project-specific patterns.

```bash
bun run test:e2e       # headless
bun run test:e2e:ui    # interactive UI mode
```

## Key Conventions

- All API routes are prefixed with `/api`
- Auth uses database-backed sessions (not JWT)
- Every API route must be wrapped with `requireAuth`; admin routes additionally with `requireAdmin`
- **Do not wrap route handlers in try/catch.** Express 5 automatically forwards rejected async promises to the error handler. A global JSON error handler in `server/src/index.ts` converts these to `{ error: "..." }` responses with the appropriate status code
- TypeScript strict mode is enabled in both workspaces
- **HTTP requests** use `axios` with `withCredentials: true` on every call (session cookie must be forwarded)
- **Server state** (fetching, caching, mutations) uses TanStack Query — `useQuery` for reads, `useMutation` for writes; update the cache via `queryClient.setQueryData` on mutation success instead of refetching where possible
- `QueryClientProvider` is mounted in `client/src/main.tsx`; do not create additional `QueryClient` instances

## Shared Code (`core` package)

The `core/` workspace package (`@helpdesk/core`) holds code that must stay identical on both client and server — primarily Zod schemas. Never duplicate a schema; define it once in `core` and import it everywhere.

### Structure
```
core/
└── src/
    ├── index.ts          # re-exports everything
    └── schemas/
        └── user.ts       # createUserSchema, CreateUserInput, editUserSchema, EditUserInput
```

### Adding a new schema
1. Create `core/src/schemas/<domain>.ts`, export the schema(s) and their inferred types
2. Re-export from `core/src/index.ts`
3. Import on the **server**: `import { mySchema } from "@helpdesk/core"`
4. Import on the **client**: same — the Vite alias `"@helpdesk/core" → ../core/src/index.ts` and the matching tsconfig path handle resolution without an npm publish step

### Client form integration
On the client, pair the shared schema with `react-hook-form` + `zodResolver`:

```ts
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, type CreateUserInput } from "@helpdesk/core";

const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateUserInput>({
  resolver: zodResolver(createUserSchema),
});

// In JSX:
<Input {...register("email")} />
{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
```

This guarantees the client validates with exactly the same rules as the server — one source of truth.

## Validation

**Zod is used for all request body validation on the server.** Define a schema at the top of each route file and call `safeParse` at the start of any handler that accepts a body:

```ts
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

router.post("/", async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }
  const { name, email, password } = result.data; // fully typed
  // ...
});
```

- Always use `safeParse` (not `parse`) so validation errors are handled without throwing
- Return the first error message as `{ error: "..." }` with a 400 status
- Zod is a dependency of `@helpdesk/core`; both client and server inherit it transitively — do not add a separate `zod` dependency to client or server unless a schema genuinely cannot live in `core`

## Enums

Prisma generates enum objects and types in `server/src/generated/prisma/enums.ts`. Always import from there instead of using raw strings:

```ts
import { Role, TicketStatus, TicketCategory } from "../generated/prisma/enums";

// ✅
role: Role.agent
status: TicketStatus.open

// ❌ never
role: "agent"
status: "open"
```

Available enums: `Role` (`admin`, `agent`), `TicketStatus` (`open`, `resolved`, `closed`), `TicketCategory` (`general_question`, `technical_question`, `refund_request`).

## Component Testing

### Stack
- **Runner:** Vitest (`vitest run` / `vitest`)
- **DOM:** jsdom (configured in `client/vite.config.ts`)
- **Libraries:** `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`

### Running tests
```bash
bun run test          # run once (CI)
bun run test:watch    # watch mode
bun run test:write    # launch Claude to write tests for a component
```
All three scripts are in `client/package.json` and must be run from the `client/` directory (or via the workspace root with `--filter`).

### File conventions
- Test files live next to the component they test: `UsersPage.tsx` → `UsersPage.test.tsx`
- Shared test utilities live in `client/src/test/`

### Render helper — always use `renderWithQuery`
Every component test must use `renderWithQuery` from `@/test/utils` instead of RTL's bare `render`. It wraps the component in a fresh `QueryClient` (with `retry: false`) and `MemoryRouter`:

```ts
import { renderWithQuery } from "@/test/utils";

renderWithQuery(<UsersPage />);
```

### Mocking conventions
**axios** — mock the entire module at the top of the test file:
```ts
vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), isAxiosError: vi.fn() },
}));
// In each test:
vi.mocked(axios.get).mockResolvedValue({ data: [...] });
vi.mocked(axios.isAxiosError).mockReturnValue(true); // only for error-path tests
```

**auth-client** — mock `useSession` so the Navbar renders without a real session:
```ts
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: { user: { name: "Admin", role: "admin" } }, isPending: false })),
    signOut: vi.fn(),
  },
}));
```

Use `vi.resetAllMocks()` in `beforeEach` so implementations don't leak between tests.

### Async queries
- Use `await screen.findBy*` (not `getBy*`) to wait for data that loads asynchronously.
- Do not wait on text that also appears in the Navbar (e.g. the logged-in user's name). Wait on values that are unique to the component under test, such as email addresses in a data table.
- Use `waitFor` when asserting that something disappears after an async action.

### Example reference
`client/src/pages/UsersPage.test.tsx` — 13 tests covering loading skeleton, success, error, empty state, role-based rendering, modal open/close, form submission, and delete with/without confirmation.

## Documentation

**Always use Context7 MCP for library and framework documentation** — do not rely on training data for API details, configuration options, or version-specific behavior.

Workflow:
1. `resolve-library-id` with the library name and your question
2. Pick the best match (highest benchmark score + exact name match)
3. `query-docs` with the library ID and the full question
4. Use the fetched docs to write code

Apply this for: Express, React, Vite, Prisma, Tailwind, React Router, Bun, Anthropic SDK, SendGrid, Mailgun, and any other library in the stack.
