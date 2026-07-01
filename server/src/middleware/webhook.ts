import type { Request, Response, NextFunction } from "express";

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (!expected) {
    return res.status(500).json({ error: "Webhook secret is not configured" });
  }
  if (req.header("X-Webhook-Secret") !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
