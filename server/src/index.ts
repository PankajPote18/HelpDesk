import express from "express";
import cors from "cors";
import { db } from "./lib/db";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

async function main() {
  await db.$connect();
  console.log("Database connected");

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
