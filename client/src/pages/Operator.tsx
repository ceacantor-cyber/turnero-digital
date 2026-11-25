import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Clock3, LockKeyhole, Megaphone, MoreHorizontal, PhoneCall, Radio, RotateCcw, SkipForward, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const SERVICES = ["Programación moto", "Programación carro", "Programación o asistencia a examen teórico", "Certificación", "Solicitar horarios", "Enrolamiento", "Atención al usuario"] as const;
type Service = typeof SERVICES[number];

function display(number: number) { return `T-${String(number).padStart(3, "0")}`; }
function statusLabel(status: string) { return status === "serving" ? "En atención" : status === "called" ? "Llamando" : status === "waiting" ? "En espera" : status === "completed" ? "Finalizado" : "Omitido"; }
function serviceLabel(service: string) {
  return service === "Programación moto" ? "Programación de clases prácticas de moto"
    : service === "Programación carro" ? "Programación de clases prácticas de carro"
      : service === "Agendar examen teórico y certificación" ? "Certificación"
      : service;
}

export default function Operator() {
  const [filter, setFilter] = useState<"all" | Service>("all");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [token, setToken] = useState(() => sessionStorage.getItem("turnero-operator-token") ?? "");
  const [operator, setOperator] = useState<"yury" | "jonathan">(() => (sessionStorage.getItem("turnero-operator-user") as "yury" | "jonathan") || "yury");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const login = trpc.operator.login.useMutation({ onSuccess: ({ token: newToken, username }) => { sessionStorage.setItem("turnero-operator-token", newToken); sessionStorage.setItem("turnero-operator-user", username); setToken(newToken); setOperator(username); setPassword(""); toast.success("Acceso autorizado"); }, onError: e => toast.error(e.message) });
  const logout = trpc.operator.logout.useMutation({ onSuccess: () => { sessionStorage.removeItem("turnero-operator-token"); sessionStorage.removeItem("turnero-operator-user"); setToken(""); } });
  const snapshot = trpc.queue.snapshot.useQuery(undefined, { refetchInterval: 3500, staleTime: 1500 });
  const handleOperatorError = (error: { message: string; data?: { code?: string } | null }) => {
    toast.error(error.message);
    if (error.data?.code === "UNAUTHORIZED") {
      sessionStorage.removeItem("turnero-operator-token");
      sessionStorage.removeItem("turnero-operator-user");
      setToken("");
    }
  };
  const callNext = trpc.queue.callNext.useMutation({ onSuccess: (turn) => { utils.queue.snapshot.invalidate(); turn ? toast.success(`Llamando al ${turn.displayNumber}`) : toast.info("No hay turnos pendientes con este filtro"); }, onError: e => toast.error(e.message) });
  const recall = trpc.queue.recall.useMutation({ onSuccess: () => { utils.queue.snapshot.invalidate(); toast.success("Llamado repetido"); } });
  const setServing = trpc.queue.setServing.useMutation({ onSuccess: () => utils.queue.snapshot.invalidate() });
  const complete = trpc.queue.complete.useMutation({ onSuccess: async (turn, variables) => { await utils.queue.snapshot.cancel(); utils.queue.snapshot.setData(undefined, data => data ? { ...data, active: data.active.filter(item => item.id !== variables.id), waiting: data.waiting.filter(item => item.id !== variables.id), recent: turn ? [turn, ...data.recent.filter(item => item.id !== variables.id)].slice(0, 8) : data.recent, waitingCount: data.waiting.filter(item => item.id !== variables.id).length } : data); await utils.queue.snapshot.refetch(); toast.success("Turno marcado como atendido"); }, onError: handleOperatorError });
  const skip = trpc.queue.skip.useMutation({ onSuccess: async (turn, variables) => { await utils.queue.snapshot.cancel(); utils.queue.snapshot.setData(undefined, data => data ? { ...data, active: data.active.filter(item => item.id !== variables.id), waiting: data.waiting.filter(item => item.id !== variables.id), recent: turn ? [turn, ...data.recent.filter(item => item.id !== variables.id)].slice(0, 8) : data.recent, waitingCount: data.waiting.filter(item => item.id !== variables.id).length } : data); await utils.queue.snapshot.refetch(); toast.info("Turno marcado como no atendido"); }, onError: handleOperatorError });

  const current = snapshot.data?.active?.[0];
  const allowedServices: Service[] = operator === "yury" ? ["Programación moto", "Programación o asistencia a examen teórico", "Certificación", "Solicitar horarios", "Enrolamiento", "Atención al usuario"] : ["Programación carro", "Programación o asistencia a examen teórico", "Certificación", "Solicitar horarios", "Enrolamiento", "Atención al usuario"];
  const waiting = (snapshot.data?.waiting ?? []).filter(turn => allowedServices.includes(turn.service as Service) && (filter === "all" || turn.service === filter));
  const activeCount = snapshot.data?.waitingCount ?? 0;
  const isBusy = callNext.isPending || recall.isPending || setServing.isPending || complete.isPending || skip.isPending;
  const run = (action: () => void) => { if (!isBusy) action(); };

  if (!token) {
    return <div className="operator-shell"><header className="topbar operator-topbar"><Link href="/" className="brand"><span className="brand-mark">T</span><span><strong>TURNERO</strong><small>CENTRO DE OPERACIÓN</small></span></Link><Link href="/" className="operator-link"><ArrowLeft size={15} /> Vista pública</Link></header><main className="operator-login"><div className="operator-login-card"><div className="login-icon"><LockKeyhole size={25} /></div><div className="eyebrow">Acceso restringido</div><h1>Panel de operador</h1><p>Selecciona tu usuario e ingresa la contraseña para gestionar los turnos asignados.</p><form onSubmit={(event) => { event.preventDefault(); login.mutate({ username: operator, password }); }}><label>Usuario<select value={operator} onChange={event => setOperator(event.target.value as "yury" | "jonathan")}><option value="yury">Yury — Moto, examen teórico, certificación y servicios generales</option><option value="jonathan">Jonathan — Carro, examen teórico, certificación y servicios generales</option></select></label><label>Contraseña<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Escribe la contraseña" autoFocus required /></label><button className="primary-button" type="submit" disabled={login.isPending}><LockKeyhole size={17} /> {login.isPending ? "Verificando..." : "Ingresar al panel"}</button></form><span className="login-note"><LockKeyhole size={13} /> La sesión queda activa solo en este dispositivo.</span></div></main></div>;
  }

  return (
    <div className="operator-shell">
      <header className="topbar operator-topbar">
        <Link href="/" className="brand"><span className="brand-mark">T</span><span><strong>TURNERO</strong><small>CENTRO DE OPERACIÓN</small></span></Link>
        <div className="topbar-actions"><span className="system-status"><span /> Sincronizado</span><button className="operator-link logout-button" onClick={() => logout.mutate({ token })}>Cerrar sesión</button><Link href="/" className="operator-link"><ArrowLeft size={15} /> Vista pública</Link></div>
      </header>
      <main className="operator-main">
        <div className="operator-heading"><div><div className="eyebrow"><Radio size={15} /> Consola de atención · {operator === "yury" ? "Yury" : "Jonathan"}</div><h1>Panel de llamados</h1><p>{operator === "yury" ? "Programación de clases prácticas de moto, examen teórico y servicios generales." : "Programación de clases prácticas de carro, examen teórico y servicios generales."}</p></div><div className="operator-date"><Clock3 size={17} /> Actualización automática</div></div>
        <div className="metric-row"><div className="metric-card"><span className="metric-icon green"><Users size={18} /></span><span><small>En cola</small><strong>{activeCount}</strong></span></div><div className="metric-card"><span className="metric-icon yellow"><PhoneCall size={18} /></span><span><small>Turno actual</small><strong>{current ? current.displayNumber : "—"}</strong></span></div><div className="metric-card"><span className="metric-icon blue"><CircleCheck size={18} /></span><span><small>Estado</small><strong>{current ? statusLabel(current.status) : "Disponible"}</strong></span></div></div>
        <section className="operator-grid">
          <div className="current-operation">
            <div className="panel-header"><div><span className="card-index">ATENCIÓN EN CURSO</span><h2>{current ? "Turno actual" : "Listo para llamar"}</h2></div><span className="live-label"><span /> En vivo</span></div>
            {current ? <div className="operator-current-card"><div className="operator-ticket">{current.displayNumber}</div><div className="operator-person"><UserRound size={17} /><span><strong>{current.firstName} {current.lastName}</strong><small>Cédula terminada en •••{current.cedula.slice(-3)}</small></span></div><div className="operator-service"><span>Servicio solicitado</span><strong>{current.service}</strong></div><div className="action-grid"><button className="action-primary" onClick={() => run(() => recall.mutate({ id: current.id, token }))}><Megaphone size={17} /> Repetir llamado</button>{current.status === "called" ? <button className="action-secondary" onClick={() => run(() => setServing.mutate({ id: current.id, token }))}><PhoneCall size={17} /> Marcar en atención</button> : <button className="action-secondary" onClick={() => run(() => complete.mutate({ id: current.id, token }))}><Check size={17} /> Finalizar atención</button>}<button className="action-ghost" onClick={() => run(() => skip.mutate({ id: current.id, token }))}><SkipForward size={16} /> Omitir turno</button></div></div> : <div className="operator-empty"><div className="empty-icon"><Megaphone size={30} /></div><h3>No hay un turno en atención</h3><p>Cuando estés listo, llama al siguiente turno de la cola.</p><button className="primary-button wide" onClick={() => run(() => callNext.mutate({ token, ...(filter === "all" ? {} : { service: filter }) }))}><Megaphone size={18} /> Llamar siguiente turno <ArrowRight size={18} /></button></div>}
          </div>
          <div className="queue-panel"><div className="panel-header queue-header"><div><span className="card-index">ORDEN DE LLEGADA</span><h2>Cola pendiente <span>{waiting.length}</span></h2></div><button className="icon-button" title="Actualizar" onClick={() => snapshot.refetch()}><RotateCcw size={16} /></button></div><div className="filter-row"><select value={filter} onChange={e => setFilter(e.target.value === "all" ? "all" : e.target.value as Service)}><option value="all">Mis servicios</option>{SERVICES.filter(service => allowedServices.includes(service)).map(service => <option key={service} value={service}>{serviceLabel(service)}</option>)}</select><button className="call-next-button" onClick={() => run(() => callNext.mutate({ token, ...(filter === "all" ? {} : { service: filter }) }))} disabled={Boolean(current) || callNext.isPending}><Megaphone size={16} /> Llamar siguiente</button></div><div className="queue-list">{waiting.length ? waiting.map((turn, index) => <div className="queue-item" key={turn.id}><span className="queue-position">{String(index + 1).padStart(2, "0")}</span><span className="queue-ticket">{display(turn.queueNumber)}</span><span className="queue-person"><strong>{turn.firstName} {turn.lastName}</strong><small>{serviceLabel(turn.service)}</small></span><span className="queue-time"><Clock3 size={13} /> {new Date(turn.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span><span className="queue-actions"><button className="queue-more-button" title={`Acciones de ${display(turn.queueNumber)}`} aria-label={`Acciones de ${display(turn.queueNumber)}`} onClick={() => setOpenMenuId(openMenuId === turn.id ? null : turn.id)}><MoreHorizontal size={18} className="queue-more" /></button>{openMenuId === turn.id && <span className="turn-menu"><button onClick={() => { setOpenMenuId(null); run(() => complete.mutate({ id: turn.id, token })); }}><Check size={14} /> Marcar atendido</button><button onClick={() => { setOpenMenuId(null); run(() => skip.mutate({ id: turn.id, token })); }}><SkipForward size={14} /> Marcar no atendido</button></span>}</span></div>) : <div className="queue-empty"><CircleCheck size={25} /><strong>Cola despejada</strong><span>No hay personas esperando en estos servicios.</span></div>}</div></div>
        </section>
        <section className="recent-panel"><div className="panel-header"><div><span className="card-index">HISTORIAL RECIENTE</span><h2>Últimos movimientos</h2></div><Link href="/" className="text-link">Ver vista pública <ArrowRight size={15} /></Link></div><div className="recent-list">{snapshot.data?.recent?.length ? snapshot.data.recent.map(turn => <div className="recent-item" key={turn.id}><span className={`recent-status ${turn.status}`} /> <strong>{turn.displayNumber}</strong><span>{turn.firstName} {turn.lastName}</span><small>{serviceLabel(turn.service)}</small><em>{statusLabel(turn.status)}</em></div>) : <div className="recent-empty">Los turnos finalizados u omitidos aparecerán aquí.</div>}</div></section>
      </main>
    </div>
  );
}
