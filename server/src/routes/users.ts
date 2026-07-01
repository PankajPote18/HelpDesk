import { Router } from "express";
import { createUserSchema, editUserSchema } from "@helpdesk/core";
import { db } from "../lib/db";
import { auth } from "../lib/auth";
import { Role } from "../generated/prisma/enums";

const router = Router();

router.get("/", async (_req, res) => {
  const users = await db.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

router.post("/", async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const { name, email, password } = result.data;

  const existing = await db.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) {
    return res.status(409).json({ error: "A user with that email already exists" });
  }

  const ctx = await auth.$context;
  const now = new Date();
  const hashed = await ctx.password.hash(password);

  const user = await ctx.internalAdapter.createUser({
    email,
    name,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.internalAdapter.createAccount({
    accountId: user.id,
    providerId: "credential",
    userId: user.id,
    password: hashed,
    createdAt: now,
    updatedAt: now,
  });

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: Role.agent,
    createdAt: now,
  });
});

router.patch("/:id", async (req, res) => {
  const result = editUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const { name, email, password } = result.data;
  const { id } = req.params;

  const user = await db.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (email !== user.email) {
    const taken = await db.user.findFirst({ where: { email, deletedAt: null, id: { not: id } } });
    if (taken) {
      return res.status(409).json({ error: "A user with that email already exists" });
    }
  }

  const updated = await db.user.update({
    where: { id },
    data: { name, email },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (password) {
    const ctx = await auth.$context;
    const hashed = await ctx.password.hash(password);
    await db.account.updateMany({
      where: { userId: id, providerId: "credential" },
      data: { password: hashed, updatedAt: new Date() },
    });
  }

  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const session = res.locals.session;

  if (session.user.id === id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  const user = await db.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.role === Role.admin) {
    return res.status(400).json({ error: "Admin accounts cannot be deleted" });
  }

  await db.user.update({ where: { id }, data: { deletedAt: new Date() } });
  await db.session.deleteMany({ where: { userId: id } });

  res.status(204).send();
});

export default router;
