import { integer, pgEnum, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

/** Manus account table used by the starter authentication flow. */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16 }).default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const turnoStatus = pgEnum("turno_status", ["waiting", "called", "serving", "completed", "skipped"]);

export const turnos = pgTable("turnos", {
  id: serial("id").primaryKey(),
  queueNumber: integer("queueNumber").notNull().unique(),
  firstName: varchar("firstName", { length: 80 }).notNull(),
  lastName: varchar("lastName", { length: 80 }).notNull(),
  cedula: varchar("cedula", { length: 40 }).notNull(),
  service: varchar("service", { length: 100 }).notNull(),
  status: turnoStatus("status").default("waiting").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  calledAt: timestamp("calledAt", { withTimezone: true }),
  completedAt: timestamp("completedAt", { withTimezone: true }),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Turno = typeof turnos.$inferSelect;
export type InsertTurno = typeof turnos.$inferInsert;
