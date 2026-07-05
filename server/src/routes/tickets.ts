import { Router } from "express";
import type { Prisma } from "../generated/prisma/client";
import { ticketListQuerySchema } from "@helpdesk/core";
import { db } from "../lib/db";

const router = Router();

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

export default router;
