import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import type { Request, Response, NextFunction } from "express";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  res.locals.session = session;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = res.locals.session ?? await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}
