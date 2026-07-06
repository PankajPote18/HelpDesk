import type { Request, Response, NextFunction } from "express";

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (!expected) {
    return res.status(500).json({ error: "Webhook secret is not configured" });
  }
  // SendGrid's Inbound Parse webhook can't set custom headers, so the secret must also be
  // accepted as a query param on the configured URL (e.g. .../inbound-email?secret=...).
  const provided = req.header("X-Webhook-Secret") ?? (typeof req.query.secret === "string" ? req.query.secret : undefined);
  if (provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
