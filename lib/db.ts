import { Pool } from "pg";

const globalForDb = globalThis as unknown as { __pool?: Pool };

export const pool = globalForDb.__pool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") globalForDb.__pool = pool;
