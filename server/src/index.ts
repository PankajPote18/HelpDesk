// Must be imported before any other module so Sentry can instrument them.
import "./instrument";

import express, { type NextFunction, type Request, type Response } from "express";
import * as Sentry from "@sentry/node";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { requireAuth, requireAdmin } from "./middleware/auth";
import { requireWebhookSecret } from "./middleware/webhook";
import { startQueue } from "./lib/queue";
import usersRouter from "./routes/users";
import ticketsRouter from "./routes/tickets";
import inboundEmailRouter from "./routes/inbound-email";
import dashboardRouter from "./routes/dashboard";

const app = express();
const PORT = process.env.PORT ?? 3000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Must be before express.json() — Better Auth parses its own bodies
app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/users", requireAuth, requireAdmin, usersRouter);
app.use("/api/tickets", requireAuth, ticketsRouter);
app.use("/api/dashboard", requireAuth, requireAdmin, dashboardRouter);
app.use("/api/webhooks/inbound-email", requireWebhookSecret, inboundEmailRouter);

// Must be registered after all routes but before any other error-handling middleware.
Sentry.setupExpressErrorHandler(app);

// Express 5 automatically forwards rejected async route promises to next(err).
// This handler ensures those errors are returned as JSON rather than HTML.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { status?: number; statusCode?: number })?.statusCode
    ?? 500;
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(status).json({ error: message });
});

async function main() {
  await startQueue();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
