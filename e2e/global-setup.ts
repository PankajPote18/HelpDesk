import { execSync } from "child_process";
import * as dotenv from "dotenv";
import path from "path";
import { Client } from "pg";

const serverDir = path.resolve(__dirname, "../server");

async function ensureDatabaseExists(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.slice(1).split("?")[0];
  url.pathname = "/postgres";

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created database: ${dbName}`);
    }
  } finally {
    await client.end();
  }
}

export default async function globalSetup() {
  dotenv.config({ path: path.join(serverDir, ".env.test") });

  const env = { ...process.env, NODE_ENV: "test" };

  await ensureDatabaseExists(process.env.DATABASE_URL!);

  // Drop, recreate, and migrate the test database from scratch
  execSync("bunx prisma migrate reset --force", {
    cwd: serverDir,
    env,
    stdio: "inherit",
  });

  // Seed test admin user
  execSync("bun run src/scripts/seed.ts", {
    cwd: serverDir,
    env,
    stdio: "inherit",
  });

  // Seed test agent user
  execSync("bun run src/scripts/seed-agent.ts", {
    cwd: serverDir,
    env,
    stdio: "inherit",
  });
}
