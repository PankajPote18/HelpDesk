const DEFAULT_ORIGINS = ["http://localhost:5173", "http://localhost:5174"];

export const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : DEFAULT_ORIGINS;
