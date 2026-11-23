// Motor de reglas puro: sin React, sin localStorage. Todo recibe "hoy" explícito.
export const SCHEMA_VERSION = 2;
export const SECTORES = ["Hornos", "Amasado", "Laminado y frío", "Pastelería", "Cafetería"] as const;
export type Sector = (typeof SECTORES)[number];
export type Perfil = "Operación" | "Revisor" | "Auditor";
export interface Actor { id: string; nombre: string; perfil: Perfil }

export interface Equipo {
  id: string; nombre: string; sector: Sector; frecuenciaDias: number;
  ultimoService: string; fechaCompra: string; fueraDeServicio: boolean; motivo: string; averiaAbierta: boolean;
}
export type TipoComando =
  | "crear" | "editar" | "borrar" | "registrarService" | "marcarFuera" | "desmarcarFuera"
  | "abrirAveria" | "cerrarAveria" | "proponer" | "decidirPropuesta" | "ajuste";
export interface Comando {
  id: string; tipo: TipoComando; entidad: string; actor: Actor; instante: string;
  revisionEsperada: number; datos: Record<string, unknown>;
}
export interface Evento {
  id: string; comandoOrigen: string; registro: string; estadoAnterior: unknown; estadoNuevo: unknown;
  efecto: string; motivo: string; revisionAnterior: number; revisionNueva: number;
}
export interface Propuesta {
  id: string; registro: string; versionPartida: number; cambios: Partial<Equipo>; motivo: string;
  creador: string; decision: "pendiente" | "aprobada" | "rechazada"; decisor: string | null;
}
export interface Ajuste {
  id: string; registro: string; eventoCorregido: string; cambios: Partial<Equipo>; motivo: string;
  aplicado: boolean; valoresCongelados: Equipo | null;
}
export interface Cierre { id: string; fecha: string; contadores: Contadores; actor: string }
export interface Snapshot {
  schemaVersion: number; revision: number;
  entidades: { equipos: Equipo[]; propuestas: Propuesta[]; ajustes: Ajuste[]; cierres: Cierre[] };
  eventos: Evento[]; comandosAplicados: Comando[]; comandosRechazados: { comando: Comando; error: string }[];
}

// ---------- Fechas ----------
const DAY = 86_400_000;
const toUtc = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y!, m! - 1, dd!); };
export const diffDias = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY);
export const sumarDias = (d: string, n: number) => new Date(toUtc(d) + n * DAY).toISOString().slice(0, 10);
export const esFecha = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(toUtc(d));

// ---------- Estado derivado ----------
export type Estado = "Al día" | "Service en 15 días" | "Service vencido";
export const diasRestantes = (e: Equipo, hoy: string) => e.frecuenciaDias - diffDias(e.ultimoService, hoy);
export function estadoDe(e: Equipo, hoy: string): Estado {
  const d = diasRestantes(e, hoy);
  if (d > 15) return "Al día";
  if (d >= 1) return "Service en 15 días";
  return "Service vencido";
}
export interface Contadores { alDia: number; pronto: number; vencido: number; fuera: number }
export function contadores(equipos: Equipo[], hoy: string): Contadores {
  const c = { alDia: 0, pronto: 0, vencido: 0, fuera: 0 };
  for (const e of equipos) {
    if (e.fueraDeServicio) { c.fuera++; continue; }
    const s = estadoDe(e, hoy);
    if (s === "Al día") c.alDia++; else if (s === "Service en 15 días") c.pronto++; else c.vencido++;
  }
  return c;
}
export function porcentaje(num: number, den: number): string {
  return den === 0 ? "Sin datos" : `${Math.round((num / den) * 100)}%`;
}
export function bloqueosService(e: Equipo): string[] {
  const b: string[] = [];
  if (e.fueraDeServicio) b.push("Está fuera de servicio");
  if (e.averiaAbierta) b.push("Tiene una avería abierta");
  return b;
}

// ---------- Validación de equipo ----------
export function validarEquipo(e: Equipo, otros: Equipo[], hoy: string): string[] {
  const err: string[] = [];
  const nombre = e.nombre?.trim() ?? "";
  if (!nombre) err.push("Poné un nombre.");
  else if (otros.some((o) => o.id !== e.id && o.nombre.trim().toLowerCase() === nombre.toLowerCase()))
    err.push("Ya hay un equipo con ese nombre.");
  if (!SECTORES.includes(e.sector)) err.push("Elegí un sector válido.");
  if (!Number.isInteger(e.frecuenciaDias) || e.frecuenciaDias < 1) err.push("La frecuencia tiene que ser un número entero de días (mínimo 1).");
  if (!esFecha(e.ultimoService)) err.push("Fecha de último service inválida.");
  if (!esFecha(e.fechaCompra)) err.push("Fecha de compra inválida.");
  if (esFecha(e.ultimoService) && diffDias(hoy, e.ultimoService) > 0) err.push("El último service no puede ser futuro.");
  if (esFecha(e.fechaCompra) && diffDias(hoy, e.fechaCompra) > 0) err.push("La fecha de compra no puede ser futura.");
  if (esFecha(e.ultimoService) && esFecha(e.fechaCompra) && diffDias(e.fechaCompra, e.ultimoService) < 0)
    err.push("El último service no puede ser anterior a la compra.");
  return err;
}

// ---------- Aplicación de comandos ----------
export type Resultado =
  | { ok: true; snap: Snapshot; evento: Evento | null; duplicado: boolean }
  | { ok: false; snap: Snapshot; error: string };

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const firma = (c: Comando) => ({ tipo: c.tipo, entidad: c.entidad, actor: c.actor.id, datos: c.datos });
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function aplicar(snap: Snapshot, cmd: Comando, hoy: string): Resultado {
  const fail = (error: string): Resultado => ({ ok: false, snap, error });
  const previo = snap.comandosAplicados.find((c) => c.id === cmd.id);
  if (previo) {
    return igual(firma(previo), firma(cmd))
      ? { ok: true, snap, evento: snap.eventos.find((e) => e.comandoOrigen === cmd.id) ?? null, duplicado: true }
      : fail(`El comando ${cmd.id} ya se usó con otros datos. No se escribió nada.`);
  }
  if (cmd.revisionEsperada !== snap.revision)
    return fail(`Revisión desactualizada: esperabas la ${cmd.revisionEsperada} y la actual es ${snap.revision}. Recargá los datos y volvé a intentar.`);
  if (cmd.actor.perfil === "Auditor") return fail("El perfil Auditor solo puede consultar.");

  const next = clone(snap);
  const eqs = next.entidades.equipos;
  const idx = eqs.findIndex((e) => e.id === cmd.entidad);
  const eq = idx >= 0 ? eqs[idx]! : null;
  const d = cmd.datos;
  const motivo = typeof d["motivo"] === "string" ? (d["motivo"] as string) : "";
  let anterior: unknown = eq ? clone(eq) : null;
  let nuevo: unknown = null;
  let efecto = "";
  const needEq = () => (eq ? null : `No existe el equipo ${cmd.entidad}.`);

  switch (cmd.tipo) {
    case "crear": {
      if (eq) return fail("Ya existe un equipo con ese id.");
      const e = { ...(d["equipo"] as Equipo), id: cmd.entidad, fueraDeServicio: false, motivo: "", averiaAbierta: false };
      const errs = validarEquipo(e, eqs, hoy);
      if (errs.length) return fail(errs.join(" "));
      e.nombre = e.nombre.trim();
      eqs.push(e); nuevo = e; efecto = `Alta de "${e.nombre}"`;
      break;
    }
    case "editar": {
      const m = needEq(); if (m) return fail(m);
      const e = { ...eq!, ...(d["cambios"] as Partial<Equipo>), id: eq!.id };
      const errs = validarEquipo(e, eqs, hoy);
      if (errs.length) return fail(errs.join(" "));
      e.nombre = e.nombre.trim();
      eqs[idx] = e; nuevo = e; efecto = `Edición de "${e.nombre}"`;
      break;
    }
    case "borrar": {
      const m = needEq(); if (m) return fail(m);
      eqs.splice(idx, 1); nuevo = null; efecto = `Baja de "${eq!.nombre}"`;
      break;
    }
    case "registrarService": {
      const m = needEq(); if (m) return fail(m);
      const b = bloqueosService(eq!);
      if (b.length) return fail(`No se puede registrar service: ${b.join(" y ").toLowerCase()}.`);
      eq!.ultimoService = hoy; nuevo = clone(eq!); efecto = `Service registrado (${hoy})`;
      break;
    }
    case "marcarFuera": {
      const m = needEq(); if (m) return fail(m);
      if (eq!.fueraDeServicio) return fail("Ya está fuera de servicio.");
      if (!motivo.trim()) return fail("Contá el motivo para marcarlo fuera de servicio.");
      eq!.fueraDeServicio = true; eq!.motivo = motivo.trim(); nuevo = clone(eq!); efecto = "Marcado fuera de servicio";
      break;
    }
    case "desmarcarFuera": {
      const m = needEq(); if (m) return fail(m);
      if (!eq!.fueraDeServicio) return fail("No está fuera de servicio.");
      eq!.fueraDeServicio = false; eq!.motivo = ""; nuevo = clone(eq!); efecto = "Vuelve a servicio";
      break;
    }
    case "abrirAveria": {
      const m = needEq(); if (m) return fail(m);
      if (eq!.averiaAbierta) return fail("Ya tiene una avería abierta.");
      eq!.averiaAbierta = true; nuevo = clone(eq!); efecto = "Avería abierta";
      break;
    }
    case "cerrarAveria": {
      const m = needEq(); if (m) return fail(m);
      if (!eq!.averiaAbierta) return fail("No hay avería abierta.");
      eq!.averiaAbierta = false; nuevo = clone(eq!);
      efecto = eq!.fueraDeServicio ? "Avería cerrada (sigue bloqueado: fuera de servicio)" : "Avería cerrada";
      break;
    }
    case "proponer": {
      const m = needEq(); if (m) return fail(m);
      if (!motivo.trim()) return fail("La propuesta necesita un motivo.");
      const p: Propuesta = {
        id: String(d["propuestaId"]), registro: eq!.id, versionPartida: snap.revision,
        cambios: d["cambios"] as Partial<Equipo>, motivo, creador: cmd.actor.id, decision: "pendiente", decisor: null,
      };
      if (next.entidades.propuestas.some((x) => x.id === p.id)) return fail("Ya existe esa propuesta.");
      next.entidades.propuestas.push(p); anterior = null; nuevo = p; efecto = "Propuesta creada (no mueve el equipo)";
      break;
    }
    case "decidirPropuesta": {
      const p = next.entidades.propuestas.find((x) => x.id === cmd.entidad);
      if (!p) return fail("No existe la propuesta.");
      if (cmd.actor.perfil !== "Revisor") return fail("Solo el perfil Revisor decide propuestas.");
      if (p.creador === cmd.actor.id) return fail("No podés decidir una propuesta que creaste vos.");
      if (p.decision !== "pendiente") return fail("La propuesta ya fue decidida.");
      const decision = d["decision"] === "aprobada" ? "aprobada" : "rechazada";
      anterior = clone(p);
      if (decision === "aprobada") {
        const i = eqs.findIndex((e) => e.id === p.registro);
        if (i < 0) return fail("El equipo de la propuesta ya no existe.");
        const e = { ...eqs[i]!, ...p.cambios, id: eqs[i]!.id };
        const errs = validarEquipo(e, eqs, hoy);
        if (errs.length) return fail(errs.join(" "));
        eqs[i] = e;
      }
      p.decision = decision; p.decisor = cmd.actor.id; nuevo = clone(p);
      efecto = decision === "aprobada" ? "Propuesta aprobada y aplicada" : "Propuesta rechazada";
      break;
    }
    case "ajuste": {
      const ev = snap.eventos.find((e) => e.id === d["eventoId"]);
      if (!ev) return fail("El evento a corregir no existe.");
      const i = eqs.findIndex((e) => e.id === ev.registro);
      if (i < 0) return fail("El equipo del evento ya no existe.");
      if (!motivo.trim()) return fail("El ajuste necesita un motivo.");
      anterior = clone(eqs[i]!);
      const e = { ...eqs[i]!, ...(d["cambios"] as Partial<Equipo>), id: eqs[i]!.id };
      const errs = validarEquipo(e, eqs, hoy);
      if (errs.length) return fail(errs.join(" "));
      eqs[i] = e;
      next.entidades.ajustes.push({
        id: String(d["ajusteId"]), registro: e.id, eventoCorregido: ev.id, cambios: d["cambios"] as Partial<Equipo>,
        motivo, aplicado: true, valoresCongelados: clone(e),
      });
      nuevo = clone(e); efecto = `Ajuste vinculado a ${ev.id}`;
      break;
    }
    default: return fail("Comando desconocido.");
  }

  const evento: Evento = {
    id: `ev-${next.eventos.length + 1}-${cmd.id}`, comandoOrigen: cmd.id, registro: cmd.entidad,
    estadoAnterior: anterior, estadoNuevo: nuevo, efecto, motivo, revisionAnterior: snap.revision, revisionNueva: snap.revision + 1,
  };
  next.revision = snap.revision + 1;
  next.eventos.push(evento);
  next.comandosAplicados.push(clone(cmd));
  return { ok: true, snap: next, evento, duplicado: false };
}

// ---------- Conciliación ----------
export interface Diferencia { registro: string; detalle: string }
export function conciliar(snap: Snapshot, hoy: string) {
  const difs: Diferencia[] = [];
  const cmdIds = new Set(snap.comandosAplicados.map((c) => c.id));
  for (const ev of snap.eventos) if (!cmdIds.has(ev.comandoOrigen)) difs.push({ registro: ev.registro, detalle: `Evento ${ev.id} sin comando de origen` });
  const ultimo = new Map<string, Evento>();
  for (const ev of snap.eventos) {
    const esEquipo = !snap.entidades.propuestas.some((p) => p.id === ev.registro) && !String(ev.estadoNuevo && (ev.estadoNuevo as Propuesta).decision ?? "");
    if (esEquipo && ev.efecto.indexOf("Propuesta") !== 0) {
      const key = ev.efecto.startsWith("Ajuste") ? (ev.estadoNuevo as Equipo).id : ev.registro;
      ultimo.set(key, ev);
    }
  }
  // Estado reconstruido = entidades actuales con el último estado de cada evento por encima.
  const reconstruidos = new Map(snap.entidades.equipos.map((e) => [e.id, e] as const));
  for (const [id, ev] of ultimo) {
    const actual = snap.entidades.equipos.find((e) => e.id === id) ?? null;
    if (!igual(actual, ev.estadoNuevo)) difs.push({ registro: id, detalle: `El equipo no coincide con su último evento (${ev.id})` });
    if (ev.estadoNuevo) reconstruidos.set(id, ev.estadoNuevo as Equipo); else reconstruidos.delete(id);
  }
  const panel = contadores(snap.entidades.equipos, hoy);
  const eventos = contadores([...reconstruidos.values()], hoy);
  for (const k of Object.keys(panel) as (keyof Contadores)[])
    if (panel[k] !== eventos[k]) difs.push({ registro: "contadores", detalle: `${k}: panel ${panel[k]} vs eventos ${eventos[k]}` });
  return { panel, eventos, diferencias: difs };
}

// ---------- Validación / migración de copias ----------
export function validarSnapshot(raw: unknown): { ok: true; snap: Snapshot; migrado: boolean } | { ok: false; errores: string[] } {
  const errores: string[] = [];
  if (!raw || typeof raw !== "object") return { ok: false, errores: ["La copia no es un objeto JSON."] };
  let obj = raw as Record<string, unknown>;
  let migrado = false;
  if (obj["schemaVersion"] === 1) { const m = migrarV1(obj); if (!m.ok) return m; obj = m.snap as unknown as Record<string, unknown>; migrado = true; }
  if (obj["schemaVersion"] !== SCHEMA_VERSION) return { ok: false, errores: [`Versión de esquema no soportada: ${String(obj["schemaVersion"])}`] };
  const s = obj as unknown as Snapshot;
  if (!Number.isInteger(s.revision) || s.revision < 0) errores.push("Revisión inválida.");
  const ent = s.entidades;
  if (!ent || !Array.isArray(ent.equipos) || !Array.isArray(ent.propuestas) || !Array.isArray(ent.ajustes) || !Array.isArray(ent.cierres))
    return { ok: false, errores: ["Faltan colecciones de entidades (copia truncada)."] };
  if (!Array.isArray(s.eventos) || !Array.isArray(s.comandosAplicados) || !Array.isArray(s.comandosRechazados))
    return { ok: false, errores: ["Faltan eventos o comandos (copia truncada)."] };
  const dup = (arr: { id: string }[], n: string) => {
    const seen = new Set<string>();
    for (const x of arr) { if (typeof x?.id !== "string") errores.push(`${n}: elemento sin id.`); else if (seen.has(x.id)) errores.push(`${n}: id duplicado ${x.id}.`); seen.add(x?.id); }
    return seen;
  };
  const eqIds = dup(ent.equipos, "Equipos");
  dup(ent.propuestas, "Propuestas"); dup(ent.ajustes, "Ajustes"); dup(ent.cierres, "Cierres");
  const evIds = dup(s.eventos, "Eventos");
  const cmdIds = dup(s.comandosAplicados, "Comandos");
  const nombres = new Set<string>();
  for (const e of ent.equipos) {
    if (!SECTORES.includes(e.sector)) errores.push(`Equipo ${e.id}: sector inválido.`);
    if (!Number.isInteger(e.frecuenciaDias) || e.frecuenciaDias < 1) errores.push(`Equipo ${e.id}: frecuencia inválida.`);
    if (!esFecha(e.ultimoService) || !esFecha(e.fechaCompra)) errores.push(`Equipo ${e.id}: fechas inválidas.`);
    if (typeof e.fueraDeServicio !== "boolean" || typeof e.averiaAbierta !== "boolean") errores.push(`Equipo ${e.id}: banderas inválidas.`);
    const n = String(e.nombre ?? "").trim().toLowerCase();
    if (!n) errores.push(`Equipo ${e.id}: sin nombre.`); else if (nombres.has(n)) errores.push(`Nombre repetido: ${e.nombre}.`);
    nombres.add(n);
  }
  for (const ev of s.eventos) if (!cmdIds.has(ev.comandoOrigen)) errores.push(`Evento ${ev.id}: comando ${ev.comandoOrigen} inexistente.`);
  for (const p of ent.propuestas) if (!eqIds.has(p.registro)) errores.push(`Propuesta ${p.id}: equipo ${p.registro} inexistente.`);
  for (const a of ent.ajustes) if (!evIds.has(a.eventoCorregido)) errores.push(`Ajuste ${a.id}: evento ${a.eventoCorregido} inexistente.`);
  return errores.length ? { ok: false, errores } : { ok: true, snap: s, migrado };
}

// v1: { schemaVersion: 1, revision, equipos, eventos, comandos } — sin propuestas/ajustes/cierres.
export function migrarV1(v1: Record<string, unknown>): { ok: true; snap: Snapshot } | { ok: false; errores: string[] } {
  if (!Array.isArray(v1["equipos"]) || !Array.isArray(v1["eventos"]) || !Array.isArray(v1["comandos"]))
    return { ok: false, errores: ["Copia v1 truncada: faltan equipos, eventos o comandos."] };
  return {
    ok: true,
    snap: {
      schemaVersion: 2, revision: Number(v1["revision"] ?? 0),
      entidades: { equipos: v1["equipos"] as Equipo[], propuestas: [], ajustes: [], cierres: [] },
      eventos: v1["eventos"] as Evento[], comandosAplicados: v1["comandos"] as Comando[], comandosRechazados: [],
    },
  };
}

// ---------- Exportación ----------
export function filtrarEventos(snap: Snapshot, f: { registro?: string; desde?: string; hasta?: string }) {
  const cmds = new Map(snap.comandosAplicados.map((c) => [c.id, c] as const));
  return snap.eventos
    .map((ev) => ({ ev, cmd: cmds.get(ev.comandoOrigen)! }))
    .filter(({ ev, cmd }) => {
      if (f.registro && ev.registro !== f.registro) return false;
      const fecha = cmd?.instante.slice(0, 10) ?? "";
      if (f.desde && fecha < f.desde) return false;
      if (f.hasta && fecha > f.hasta) return false;
      return true;
    });
}
export function aCsv(filas: ReturnType<typeof filtrarEventos>): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["id_evento", "id_comando", "fecha", "perfil", "actor", "registro", "motivo", "revision_anterior", "revision_nueva", "efecto"];
  return [head.join(","), ...filas.map(({ ev, cmd }) =>
    [ev.id, ev.comandoOrigen, cmd?.instante, cmd?.actor.perfil, cmd?.actor.nombre, ev.registro, ev.motivo, ev.revisionAnterior, ev.revisionNueva, ev.efecto].map(esc).join(","))].join("\n");
}
