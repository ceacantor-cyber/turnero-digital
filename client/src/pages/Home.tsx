import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, Clipboard, Clock3, ExternalLink, Hash, QrCode, Radio, RefreshCw, ShieldCheck, Sparkles, Ticket, UserRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const SERVICES = [
  { value: "Programación moto", short: "Programación de clases prácticas de moto", helper: "Turnos: 9–1 · almuerzo 1–2 · tarde hasta 2:40", icon: "M" },
  { value: "Programación carro", short: "Programación de clases prácticas de carro", helper: "Turnos: 10–12 · almuerzo 12–1 · tarde hasta 3:40", icon: "C" },
  { value: "Programación o asistencia a examen teórico", short: "Programación o asistencia a examen teórico", helper: "Turnos hasta 3:10 p. m.", icon: "T" },
  { value: "Certificación", short: "Certificación", helper: "Turnos hasta 3:10 p. m.", icon: "C" },
  { value: "Solicitar horarios", short: "Horarios", helper: "Turnos hasta 3:10 p. m.", icon: "H" },
  { value: "Enrolamiento", short: "Enrolamiento", helper: "Turnos hasta 3:10 p. m.", icon: "E" },
  { value: "Atención al usuario", short: "Usuario", helper: "Turnos hasta 3:10 p. m.", icon: "U" },
] as const;

type Service = (typeof SERVICES)[number]["value"];

type SnapshotTurn = {
  id: number;
  queueNumber: number;
  displayNumber: string;
  firstName: string;
  lastName: string;
  service: string;
  status: string;
};

function statusLabel(status?: string) {
  if (status === "called") return "Te estamos llamando";
  if (status === "serving") return "En atención";
  if (status === "completed") return "Atendido";
  if (status === "skipped") return "Omitido";
  return "En espera";
}

function CurrentTurn({ turn }: { turn?: SnapshotTurn | null }) {
  return (
    <div className="current-turn-card">
      <div className="section-kicker"><Radio size={14} /> En atención ahora</div>
      {turn ? (
        <div className="current-turn-content">
          <div>
            <div className="current-number">{turn.displayNumber}</div>
            <div className="current-name">{turn.firstName} {turn.lastName}</div>
            <div className="muted-line">{turn.service}</div>
          </div>
          <div className="live-dot"><span /> En vivo</div>
        </div>
      ) : (
        <div className="empty-current"><Clock3 size={28} /><span>Aún no hay un llamado activo.</span></div>
      )}
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState({ firstName: "", lastName: "", cedula: "", service: "" as Service | "" });
  const [confirmedId, setConfirmedId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const utils = trpc.useUtils();
  const snapshot = trpc.queue.snapshot.useQuery(undefined, { refetchInterval: 5000, staleTime: 2500 });
  const availability = trpc.queue.availability.useQuery(undefined, { refetchInterval: 60000, staleTime: 30000 });
  const myTurn = trpc.queue.get.useQuery({ id: confirmedId ?? 0 }, { enabled: Boolean(confirmedId), refetchInterval: 4000 });
  const createTurn = trpc.queue.create.useMutation({
    onSuccess: (turn) => {
      if (turn) setConfirmedId(turn.id);
      toast.success("Tu turno quedó registrado");
      utils.queue.snapshot.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const joinUrl = useMemo(() => (typeof window === "undefined" ? "/" : `${window.location.origin}/`), []);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(joinUrl)}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.service) {
      toast.error("Selecciona el tipo de atención");
      return;
    }
    const selectedAvailability = availability.data?.find(item => item.service === form.service);
    if (selectedAvailability && !selectedAvailability.available) {
      toast.error(selectedAvailability.message);
      return;
    }
    createTurn.mutate({ ...form, service: form.service });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      toast.success("Enlace copiado");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const current = snapshot.data?.active?.[0];
  const waitingCount = snapshot.data?.waitingCount ?? 0;
  const isConfirmed = Boolean(confirmedId && myTurn.data);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Ir al inicio">
          <span className="brand-mark">T</span>
          <span><strong>TURNERO</strong><small>ATENCIÓN ORDENADA</small></span>
        </Link>
        <div className="topbar-actions">
          <span className="system-status"><span /> Sistema operativo</span>
          <Link href="/operador" className="operator-link">Panel de operador <ArrowRight size={15} /></Link>
        </div>
      </header>

      <main className="public-main">
        <section className="intro-block">
          <div className="eyebrow"><Sparkles size={15} /> Reserva tu lugar en minutos</div>
          <h1>Atención sin filas<br /><span>confusas.</span></h1>
          <p className="intro-copy">Registra tus datos, elige el servicio que necesitas y espera tu llamado. Nosotros nos encargamos del orden.</p>
          <div className="trust-row"><ShieldCheck size={17} /><span>Tus datos se usan únicamente para organizar la atención.</span></div>
          <div className="process-line">
            <div><b>01</b><span>Registra tus datos</span></div><div className="line" />
            <div><b>02</b><span>Elige tu servicio</span></div><div className="line" />
            <div><b>03</b><span>Espera tu llamado</span></div>
          </div>
        </section>

        <section className="registration-card" aria-labelledby="register-title">
          {!isConfirmed ? (
            <form onSubmit={submit}>
              <div className="card-heading"><div><span className="card-index">PASO 01 / 02</span><h2 id="register-title">Solicita tu turno</h2></div><Ticket size={24} /></div>
              <div className="form-grid two-columns">
                <label>Nombre<input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="Ej. María" required /></label>
                <label>Apellido<input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Ej. González" required /></label>
              </div>
              <label>Número de cédula<div className="input-with-icon"><Hash size={17} /><input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} placeholder="Escribe tu número de documento" inputMode="numeric" required /></div></label>
              <div className="service-label"><span>¿Qué necesitas?</span><small>Selecciona una opción</small></div>
              <div className="schedule-note">Durante el almuerzo también puedes tomar turno: carro de 12:00 a 1:00 p. m. y moto de 1:00 a 2:00 p. m.; la atención se reanuda a las 2:00 p. m. Los turnos del cierre siguen limitados 20 minutos antes.</div>
              <div className="service-grid">
                {SERVICES.map(service => (
                  <button type="button" disabled={availability.data ? !availability.data.find(item => item.service === service.value)?.available : false} title={availability.data?.find(item => item.service === service.value)?.message} className={`service-option ${form.service === service.value ? "selected" : ""} ${availability.data && !availability.data.find(item => item.service === service.value)?.available ? "closed" : ""}`} key={service.value} onClick={() => setForm({ ...form, service: service.value })}>
                    <span className="service-icon">{service.icon}</span><span className="service-copy"><strong>{service.short}</strong><small>{availability.data?.find(item => item.service === service.value)?.available ? service.helper : "Cerrado ahora"}</small></span>{form.service === service.value && <Check size={17} className="service-check" />}
                  </button>
                ))}
              </div>
              <button className="primary-button" type="submit" disabled={createTurn.isPending}>{createTurn.isPending ? <><RefreshCw className="spin" size={18} /> Registrando...</> : <>Tomar mi turno <ArrowRight size={18} /></>}</button>
              <div className="form-footnote"><UserRound size={14} /> Atención individual, en orden de llegada.</div>
            </form>
          ) : (
            <div className="confirmation-panel">
              <div className="success-badge"><Check size={18} /> Turno confirmado</div>
              <span className="card-index">TU NÚMERO ES</span>
              <div className="ticket-number">{myTurn.data?.displayNumber}</div>
              <p className="confirmation-copy">Guarda este número. Te llamaremos en pantalla cuando sea tu momento.</p>
              <div className="confirmation-details"><span><strong>{myTurn.data?.firstName} {myTurn.data?.lastName}</strong><small>Solicitante</small></span><span><strong>{SERVICES.find(service => service.value === myTurn.data?.service)?.short ?? myTurn.data?.service}</strong><small>Servicio</small></span><span><strong>{statusLabel(myTurn.data?.status)}</strong><small>Estado</small></span></div>
              <div className="wait-note"><Clock3 size={18} /><span>Hay <b>{Math.max(0, waitingCount - (myTurn.data?.status === "waiting" ? 1 : 0))}</b> turnos en cola. Te recomendamos mantener esta pantalla abierta.</span></div>
              <button className="secondary-button" type="button" onClick={() => { setConfirmedId(null); setForm({ firstName: "", lastName: "", cedula: "", service: "" }); }}>Solicitar otro turno <ArrowRight size={17} /></button>
            </div>
          )}
        </section>
      </main>

      <section className="status-strip">
        <div className="status-content"><CurrentTurn turn={current} /><div className="waiting-card"><div className="section-kicker"><Clock3 size={14} /> Personas en espera</div><div className="waiting-number">{waitingCount}<small> turnos</small></div><span className="muted-line">Actualización automática cada pocos segundos</span></div><div className="qr-card"><div className="qr-frame"><img src={qrUrl} alt="Código QR para solicitar turno" /></div><div><div className="section-kicker"><QrCode size={14} /> Comparte este acceso</div><strong>Escanea para tomar turno</strong><span className="muted-line">Ideal para imprimir en recepción</span><button type="button" className="copy-link" onClick={copyLink}>{copied ? <Check size={14} /> : <Clipboard size={14} />} {copied ? "Copiado" : "Copiar enlace"}</button></div></div></div>
      </section>
      <footer className="site-footer"><span>Turnero Digital</span><span>Servicio claro, atención a tiempo.</span><a href={joinUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Abrir acceso público</a></footer>
    </div>
  );
}
