import { TRPCError } from "@trpc/server";

export type ServiceName =
  | "Programación moto"
  | "Programación carro"
  | "Solicitar horarios"
  | "Enrolamiento"
  | "Atención al usuario"
  | "Programación o asistencia a examen teórico"
  | "Certificación";

type Window = { start: number; end: number };

const serviceLabels: Record<ServiceName, string> = {
  "Programación carro": "Programación carro",
  "Programación moto": "Programación moto",
  "Solicitar horarios": "Atención general",
  "Enrolamiento": "Atención general",
  "Atención al usuario": "Atención general",
  "Programación o asistencia a examen teórico": "Programación o asistencia a examen teórico",
  "Certificación": "Certificación",
};

function colombiaNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(values.weekday);
  const hour = Number(values.hour) === 24 ? 0 : Number(values.hour);
  return { weekday, minutes: hour * 60 + Number(values.minute) };
}

function windowsFor(service: ServiceName, weekday: number): Window[] {
  if (weekday === 0) return [];
  if (service === "Programación carro") {
    return weekday === 6 ? [{ start: 8 * 60, end: 12 * 60 }] : [{ start: 10 * 60, end: 12 * 60 }, { start: 14 * 60, end: 16 * 60 }];
  }
  if (service === "Programación moto") {
    return weekday === 6 ? [{ start: 8 * 60, end: 12 * 60 }] : [{ start: 9 * 60, end: 13 * 60 }, { start: 14 * 60, end: 15 * 60 }];
  }
  return [{ start: 8 * 60, end: 15 * 60 + 30 }];
}

function formatTime(minutes: number) {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? "p. m." : "a. m.";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function intakeWindowsFor(service: ServiceName, weekday: number) {
  if (weekday >= 1 && weekday <= 5 && service === "Programación carro") {
    return [{ start: 10 * 60, end: 12 * 60 }, { start: 12 * 60, end: 13 * 60 }, { start: 14 * 60, end: 15 * 60 + 40 }];
  }
  if (weekday >= 1 && weekday <= 5 && service === "Programación moto") {
    return [{ start: 9 * 60, end: 13 * 60 }, { start: 13 * 60, end: 14 * 60 }, { start: 14 * 60, end: 14 * 60 + 40 }];
  }
  return windowsFor(service, weekday).map(window => ({ ...window, end: window.end - 20 }));
}

export function getServiceSchedule(service: ServiceName, date = new Date()) {
  const { weekday, minutes } = colombiaNow(date);
  const serviceWindows = windowsFor(service, weekday);
  const intakeWindows = intakeWindowsFor(service, weekday);
  const available = intakeWindows.some(window => minutes >= window.start && minutes < window.end);
  const scheduleText = intakeWindows.length
    ? intakeWindows.map(window => `${formatTime(window.start)} – ${formatTime(window.end)}`).join(" y ")
    : "No hay atención los domingos";
  const serviceHoursText = serviceWindows.length
    ? serviceWindows.map(window => `${formatTime(window.start)} – ${formatTime(window.end)}`).join(" y ")
    : "No hay atención los domingos";
  const cutoffNote = ` Para alcanzar a ser atendido, el turno debe tomarse 20 minutos antes del cierre.`;
  const withinServiceWindow = serviceWindows.some(window => minutes >= window.start && minutes < window.end);
  const nextServiceWindow = serviceWindows.find(window => minutes < window.start);
  const lunchNote = !withinServiceWindow && available && nextServiceWindow
    ? ` Puedes tomar el turno durante el horario de almuerzo; la atención se reanuda a las ${formatTime(nextServiceWindow.start)}.`
    : "";
  let message = available
    ? `Disponible para tomar turno: ${scheduleText}. Atención: ${serviceHoursText}.${lunchNote}${cutoffNote}`
    : withinServiceWindow
      ? `Ya no es posible tomar este turno porque la atención termina a la hora indicada (${serviceHoursText}). ${cutoffNote} El último momento para solicitarlo era: ${scheduleText}.`
      : `En este momento no hay atención para ${serviceLabels[service]}. Horario de atención: ${serviceHoursText}. ${cutoffNote} Recepción de turnos: ${scheduleText}.`;
  if (weekday === 0) message = "No hay atención los domingos.";
  return { service, available, scheduleText, serviceHoursText, message, cutoffNote };
}

export function assertServiceAvailable(service: ServiceName) {
  const availability = getServiceSchedule(service);
  if (!availability.available) {
    throw new TRPCError({ code: "BAD_REQUEST", message: availability.message });
  }
  return availability;
}

export function getAllAvailability(services: readonly ServiceName[]) {
  return services.map(service => getServiceSchedule(service));
}

export function isServiceAvailable(service: ServiceName) {
  const { weekday, minutes } = colombiaNow();
  return windowsFor(service, weekday).some(window => minutes >= window.start && minutes < window.end);
}
