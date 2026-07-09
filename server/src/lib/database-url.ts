// Railway's Postgres plugin exposes both an internal DATABASE_URL (private
// network, lower latency) and a DATABASE_PUBLIC_URL (public proxy). Prefer
// the internal one when present, but fall back to the public one so the app
// still works if only that was wired up on this service.
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const hasDatabasePublicUrl = Boolean(process.env.DATABASE_PUBLIC_URL);

console.log(
  `[startup] DATABASE_URL present: ${hasDatabaseUrl}, DATABASE_PUBLIC_URL present: ${hasDatabasePublicUrl}`
);

const resolvedUrl = process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;

if (!resolvedUrl) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL or DATABASE_PUBLIC_URL in the environment."
  );
}

export const databaseUrl = resolvedUrl;
