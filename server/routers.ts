import { TRPCError } from "@trpc/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createTurno, findNextWaiting, getQueueSnapshot, getTurnoById, getTurnoByQueueNumber, updateTurnoStatus } from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { assertServiceAvailable, getAllAvailability, isServiceAvailable, type ServiceName } from "./schedule";

const serviceOptions = [
  "Programación moto",
  "Programación carro",
  "Programación o asistencia a examen teórico",
  "Certificación",
  "Solicitar horarios",
  "Enrolamiento",
  "Atención al usuario",
] as const;

const serviceSchema = z.enum(serviceOptions);
const OPERATOR_PASSWORD_HASH = "cd1c9c55a5f9f42a5a2bc1d243b417e298c15a174c70f81cf585ef1d6dbc7ac3";
const commonOperatorServices = ["Programación o asistencia a examen teórico", "Certificación", "Solicitar horarios", "Enrolamiento", "Atención al usuario"] as const;
const operatorNames = { yury: "Yury", jonathan: "Jonathan" } as const;
const OPERATOR_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function signOperatorToken(operator: "yury" | "jonathan", expiresAt: number) {
  const payload = `${operator}.${expiresAt}`;
  const signature = createHmac("sha256", OPERATOR_PASSWORD_HASH).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function requireOperator(token: string) {
  const [operator, expiresAtText, signature] = token.split(".");
  const expiresAt = Number(expiresAtText);
  if ((operator !== "yury" && operator !== "jonathan") || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || !signature) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Contraseña de operador requerida." });
  }
  const expected = createHmac("sha256", OPERATOR_PASSWORD_HASH).update(`${operator}.${expiresAt}`).digest("hex");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "La sesión del operador ya no es válida. Ingresa nuevamente." });
  }
  return operator as "yury" | "jonathan";
}

function operatorServices(operator: "yury" | "jonathan") {
  return operator === "yury"
    ? ["Programación moto", ...commonOperatorServices]
    : ["Programación carro", ...commonOperatorServices];
}

const toPublicTurno = (turno: Awaited<ReturnType<typeof getTurnoById>>) => {
  if (!turno) return null;
  return {
    ...turno,
    displayNumber: `T-${String(turno.queueNumber).padStart(3, "0")}`,
  };
};

const publicTurnos = (turnos: Awaited<ReturnType<typeof getQueueSnapshot>>["active"]) =>
  turnos.flatMap(turno => {
    const publicTurno = toPublicTurno(turno);
    return publicTurno ? [publicTurno] : [];
  });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  operator: router({
    login: publicProcedure
      .input(z.object({ username: z.enum(["yury", "jonathan"]), password: z.string().min(1) }))
      .mutation(({ input }) => {
        const passwordHash = createHash("sha256").update(input.password).digest("hex");
        if (passwordHash !== OPERATOR_PASSWORD_HASH) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Contraseña incorrecta." });
        }
        const token = signOperatorToken(input.username, Date.now() + OPERATOR_TOKEN_TTL_MS);
        return { token, username: input.username, displayName: operatorNames[input.username] };
      }),
    logout: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(({ input }) => { requireOperator(input.token); return { success: true } as const; }),
  }),
  queue: router({
    options: publicProcedure.query(() => serviceOptions),
    availability: publicProcedure.query(() => getAllAvailability(serviceOptions)),
    snapshot: publicProcedure.query(async () => {
      try {
        const snapshot = await getQueueSnapshot();
        return {
          active: publicTurnos(snapshot.active),
          waiting: publicTurnos(snapshot.waiting),
          recent: publicTurnos(snapshot.recent),
          waitingCount: snapshot.waitingCount,
        };
      } catch (error) {
        console.error("[Queue] snapshot failed", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No fue posible consultar la cola." });
      }
    }),
    create: publicProcedure
      .input(z.object({
        firstName: z.string().trim().min(2, "Escribe tu nombre.").max(80),
        lastName: z.string().trim().min(2, "Escribe tu apellido.").max(80),
        cedula: z.string().trim().min(4, "Escribe un número de cédula válido.").max(40),
        service: serviceSchema,
      }))
      .mutation(async ({ input }) => {
        try {
          assertServiceAvailable(input.service as ServiceName);
          const turno = await createTurno({ ...input, status: "waiting" });
          return toPublicTurno(turno);
        } catch (error) {
          console.error("[Queue] create failed", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No fue posible registrar el turno." });
        }
      }),
    find: publicProcedure
      .input(z.object({ queueNumber: z.number().int().positive() }))
      .query(async ({ input }) => toPublicTurno(await getTurnoByQueueNumber(input.queueNumber))),
    callNext: publicProcedure
      .input(z.object({ token: z.string().min(1), service: serviceSchema.optional() }))
      .mutation(async ({ input }) => {
        const operator = requireOperator(input.token);
        const snapshot = await getQueueSnapshot();
        const allowed = operatorServices(operator);
        if (input.service && !allowed.includes(input.service)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Este operador no tiene turnos asignados para ese servicio." });
        }
        const availableServices = allowed.filter(service => isServiceAvailable(service as ServiceName));
        if (input.service) assertServiceAvailable(input.service as ServiceName);
        const active = snapshot.active.find(turno => turno.status === "called" || turno.status === "serving");
        if (active) return toPublicTurno(active);
        const next = input.service
          ? await findNextWaiting(input.service)
          : (await Promise.all(availableServices.map(service => findNextWaiting(service)))).filter(Boolean).sort((a, b) => a!.queueNumber - b!.queueNumber)[0];
        if (!next) return null;
        return toPublicTurno(await updateTurnoStatus(next.id, "called"));
      }),
    recall: publicProcedure
      .input(z.object({ id: z.number().int().positive(), token: z.string().min(1) }))
      .mutation(async ({ input }) => { requireOperator(input.token); return toPublicTurno(await updateTurnoStatus(input.id, "called")); }),
    setServing: publicProcedure
      .input(z.object({ id: z.number().int().positive(), token: z.string().min(1) }))
      .mutation(async ({ input }) => { requireOperator(input.token); return toPublicTurno(await updateTurnoStatus(input.id, "serving")); }),
    complete: publicProcedure
      .input(z.object({ id: z.number().int().positive(), token: z.string().min(1) }))
      .mutation(async ({ input }) => { requireOperator(input.token); return toPublicTurno(await updateTurnoStatus(input.id, "completed")); }),
    skip: publicProcedure
      .input(z.object({ id: z.number().int().positive(), token: z.string().min(1) }))
      .mutation(async ({ input }) => { requireOperator(input.token); return toPublicTurno(await updateTurnoStatus(input.id, "skipped")); }),
    get: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => toPublicTurno(await getTurnoById(input.id))),
  }),
});

export type AppRouter = typeof appRouter;
