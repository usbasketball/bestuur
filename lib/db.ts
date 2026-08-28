import "temporal-polyfill/full/global";
import { Pool } from "pg";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "@/prisma/contract.d";
import contractJson from "@/prisma/contract.json";

const globalForDb = globalThis as unknown as { __pool?: Pool };

export const pool = globalForDb.__pool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") globalForDb.__pool = pool;

export const db = postgres<Contract>({
  contractJson,
  pg: pool,
});
