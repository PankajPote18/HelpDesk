// Must be imported before any other module so Sentry can instrument them.
import "./instrument";

import path from "path";
import fs from "fs";
import express, { type NextFunction, type Request, type Response } from "express";
import * as Sentry from "@sentry/node";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { corsOrigins } from "./lib/origins";
import { requireAuth, requireAdmin } from "./middleware/auth";
import { requireWebhookSecret } from "./middleware/webhook";
import { startQueue } from "./lib/queue";
import usersRouter from "./routes/users";
import ticketsRouter from "./routes/tickets";
import inboundEmailRouter from "./routes/inbound-email";
import dashboardRouter from "./routes/dashboard";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// NOTE: Bun's bundler inlines process.env.NODE_ENV as a literal at build
// time (whatever it was during `bun build`), so this can print a value that
// no longer matches the runtime environment — it does NOT reflect what's
// actually set on the deployed service. Don't gate behavior on it; see the
// fs.existsSync check below instead.
console.log(`[startup] NODE_ENV (baked in at build time): ${process.env.NODE_ENV ?? "(unset)"}`);
console.log(`[startup] PORT: ${PORT}`);

app.use((req, _res, next) => {
  console.log(`[request] ${req.method} ${req.path}`);
  next();
});

app.use(
  cors({
    origin: corsOrigins,
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

// Single-service deploy: this server also serves the client's built static
// assets, since Railway runs one service for the whole monorepo rather than
// separate client/server deployments. Gated on the build actually being
// present on disk (checked at runtime) rather than NODE_ENV, since Bun bakes
// process.env.NODE_ENV into the bundle at build time and it can't be trusted
// to reflect the deployed runtime environment.
const clientDist = path.join(import.meta.dir, "../../client/dist");
const indexHtml = path.join(clientDist, "index.html");
const clientDistExists = fs.existsSync(clientDist);
const indexHtmlExists = fs.existsSync(indexHtml);

console.log(`[startup] clientDist resolved to: ${clientDist}`);
console.log(`[startup] clientDist exists: ${clientDistExists}`);
console.log(`[startup] index.html exists: ${indexHtmlExists}`);

if (indexHtmlExists) {
  app.use(express.static(clientDist));
  // TEMPORARY: returning JSON instead of sendFile(index.html) to isolate
  // whether the 502 is caused by missing/broken static assets or something
  // else in request handling. Revert to sendFile once confirmed working.
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.json({
      status: "ok",
      message: "Diagnostic root route — static SPA fallback temporarily disabled",
      clientDist,
      clientDistExists,
      indexHtmlExists,
    });
  });
} else {
  app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "Helpdesk API is running (no client build found)" });
  });
}

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

process.on("unhandledRejection", (reason) => {
  console.error("[fatal] Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[fatal] Uncaught exception:", err);
});

async function main() {
  console.log("[startup] Starting queue...");
  await startQueue();
  console.log("[startup] Queue started. Binding HTTP server...");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[startup] Server listening on 0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[fatal] Failed to start server:", err);
  process.exit(1);
});
