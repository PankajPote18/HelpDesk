import { Router } from "express";
import type { Prisma } from "../generated/prisma/client";
import {
  ticketListQuerySchema,
  assignTicketSchema,
  updateTicketStatusSchema,
  updateTicketCategorySchema,
  createTicketReplySchema,
} from "@helpdesk/core";
import { Role } from "../generated/prisma/enums";
import { db } from "../lib/db";

const router = Router();

const ticketDetailSelect = {
  id: true,
  subject: true,
  body: true,
  status: true,
  category: true,
  requesterEmail: true,
  requesterName: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true } },
  replies: {
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.TicketSelect;

router.get("/", async (req, res) => {
  const result = ticketListQuerySchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }
  const { sortBy, sortOrder, status, category, page, pageSize } = result.data;

  const orderBy: Prisma.TicketOrderByWithRelationInput =
    sortBy === "assignedTo"
      ? { assignedTo: { name: sortOrder } }
      : { [sortBy]: sortOrder };

  const where: Prisma.TicketWhereInput = {
    ...(status && { status }),
    ...(category && { category }),
  };

  const [tickets, total] = await Promise.all([
    db.ticket.findMany({
      where,
      select: {
        id: true,
        subject: true,
        status: true,
        category: true,
        requesterEmail: true,
        requesterName: true,
        createdAt: true,
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.ticket.count({ where }),
  ]);

  res.json({ tickets, total, page, pageSize });
});

router.get("/agents", async (_req, res) => {
  const agents = await db.user.findMany({
    where: { role: Role.agent, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(agents);
});

router.get("/:id", async (req, res) => {
  const ticket = await db.ticket.findUnique({
    where: { id: req.params.id },
    select: ticketDetailSelect,
  });

  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  res.json(ticket);
});

router.patch("/:id/assign", async (req, res) => {
  const result = assignTicketSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }
  const { assignedToId } = result.data;

  const ticket = await db.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  if (assignedToId !== null) {
    const agent = await db.user.findFirst({
      where: { id: assignedToId, role: Role.agent, deletedAt: null },
    });
    if (!agent) {
      return res.status(400).json({ error: "Assignee must be an active agent" });
    }
  }

  const updated = await db.ticket.update({
    where: { id: req.params.id },
    data: { assignedToId },
    select: ticketDetailSelect,
  });

  res.json(updated);
});

router.patch("/:id/status", async (req, res) => {
  const result = updateTicketStatusSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const ticket = await db.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const updated = await db.ticket.update({
    where: { id: req.params.id },
    data: { status: result.data.status },
    select: ticketDetailSelect,
  });

  res.json(updated);
});

router.patch("/:id/category", async (req, res) => {
  const result = updateTicketCategorySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const ticket = await db.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const updated = await db.ticket.update({
    where: { id: req.params.id },
    data: { category: result.data.category },
    select: ticketDetailSelect,
  });

  res.json(updated);
});

router.post("/:id/replies", async (req, res) => {
  const result = createTicketReplySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const ticket = await db.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const reply = await db.ticketReply.create({
    data: {
      ticketId: req.params.id,
      authorId: res.locals.session.user.id,
      body: result.data.body,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });

  res.status(201).json(reply);
});

export default router;
