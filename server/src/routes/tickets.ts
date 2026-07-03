import { Router } from "express";
import { db } from "../lib/db";

const router = Router();

router.get("/", async (_req, res) => {
  const tickets = await db.ticket.findMany({
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
    orderBy: { createdAt: "desc" },
  });
  res.json(tickets);
});

export default router;
