import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { InsertTurno, InsertUser, Turno, turnos, User, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  } else {
    values.lastSignedIn = new Date();
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getNextQueueNumber() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select({ max: sql<number>`coalesce(max(${turnos.queueNumber}), 0)` }).from(turnos);
  return Number(result[0]?.max ?? 0) + 1;
}

export async function createTurno(data: Omit<InsertTurno, "queueNumber">): Promise<Turno> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const queueNumber = await getNextQueueNumber();
  await db.insert(turnos).values({ ...data, queueNumber });
  const created = await db.select().from(turnos).where(eq(turnos.queueNumber, queueNumber)).limit(1);
  if (!created[0]) throw new Error("No se pudo crear el turno");
  return created[0];
}

export async function getQueueSnapshot() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const active = await db.select().from(turnos).where(inArray(turnos.status, ["called", "serving"])).orderBy(asc(turnos.queueNumber));
  const waiting = await db.select().from(turnos).where(eq(turnos.status, "waiting")).orderBy(asc(turnos.queueNumber));
  const recent = await db.select().from(turnos).where(inArray(turnos.status, ["completed", "skipped"])).orderBy(desc(turnos.updatedAt)).limit(8);
  return { active, waiting, recent, waitingCount: waiting.length };
}

export async function getTurnoById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(turnos).where(eq(turnos.id, id)).limit(1);
  return result[0];
}

export async function getTurnoByQueueNumber(queueNumber: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(turnos).where(eq(turnos.queueNumber, queueNumber)).limit(1);
  return result[0];
}

export async function findNextWaiting(service?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const where = service ? and(eq(turnos.status, "waiting"), eq(turnos.service, service)) : eq(turnos.status, "waiting");
  const result = await db.select().from(turnos).where(where).orderBy(asc(turnos.queueNumber)).limit(1);
  return result[0];
}

export async function updateTurnoStatus(id: number, status: "called" | "serving" | "completed" | "skipped") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const now = new Date();
  const values: Partial<Turno> = { status, updatedAt: now };
  if (status === "called") values.calledAt = now;
  if (status === "completed" || status === "skipped") values.completedAt = now;
  await db.update(turnos).set(values).where(eq(turnos.id, id));
  return getTurnoById(id);
}
