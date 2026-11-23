// Capa de datos pura (sin React): semilla, persistencia en localStorage y ejecución de comandos.
import { ACTORES, STORAGE_KEY } from "./config";
import {
  SCHEMA_VERSION, aplicar, sumarDias, validarSnapshot,
  type Actor, type Comando, type Equipo, type Evento, type Sector, type Snapshot, type TipoComando,
} from "./engine";

export type Almacen = Pick<Storage, "getItem" | "setItem">;

export function hoyLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const instanteLocal = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${hoyLocal(d)}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// ---------- Semilla ----------
interface Base { n: string; nombre: string; sector: Sector; frec: number; restantes: number }
const BASE: Base[] = [
  { n: "01", nombre: "Horno de piso", sector: "Hornos", frec: 180, restantes: -12 },
  { n: "02", nombre: "Horno rotativo", sector: "Hornos", frec: 120, restantes: -3 },
  { n: "03", nombre: "Amasadora espiral", sector: "Amasado", frec: 90, restantes: 60 },
  { n: "04", nombre: "Batidora planetaria", sector: "Amasado", frec: 120, restantes: 40 },
  { n: "05", nombre: "Divisora de masa", sector: "Amasado", frec: 90, restantes: 10 },
  { n: "06", nombre: "Laminadora", sector: "Laminado y frío", frec: 90, restantes: 6 },
  { n: "07", nombre: "Cámara de fermentación", sector: "Laminado y frío", frec: 75, restantes: 30 },
  { n: "08", nombre: "Abatidor de temperatura", sector: "Pastelería", frec: 60, restantes: 14 },
  { n: "09", nombre: "Máquina de espresso", sector: "Cafetería", frec: 45, restantes: 20 },
];

export function crearSemilla(hoy: string): Snapshot {
  const equipos: Equipo[] = BASE.map((b, i) => ({
    id: `eq-${b.n}`, nombre: b.nombre, sector: b.sector, frecuenciaDias: b.frec,
    ultimoService: sumarDias(hoy, -(b.frec - b.restantes)),
    fechaCompra: sumarDias(hoy, -(1000 + i * 40)),
    fueraDeServicio: false, motivo: "", averiaAbierta: false,
  }));
  let snap: Snapshot = {
    schemaVersion: SCHEMA_VERSION, revision: 0,
    entidades: { equipos, propuestas: [], ajustes: [], cierres: [] },
    eventos: [], comandosAplicados: [], comandosRechazados: [],
  };
  const { Operación: ana, Revisor: bruno } = ACTORES;
  const mk = (i: number, tipo: TipoComando, entidad: string, actor: Actor, hora: string, datos: Record<string, unknown>): Comando => ({
    id: `cmd-seed-${i}`, tipo, entidad, actor, instante: `${hoy}T${hora}`, revisionEsperada: i - 1, datos,
  });
  const aplicados: Comando[] = [
    mk(1, "registrarService", "eq-05", ana, "07:10:00", {}),
    mk(2, "marcarFuera", "eq-04", ana, "07:25:00", { motivo: "Motor en reparación" }),
    mk(3, "abrirAveria", "eq-09", bruno, "08:05:00", { motivo: "Pierde presión en el grupo" }),
    mk(4, "editar", "eq-07", ana, "08:40:00", { cambios: { frecuenciaDias: 90 }, motivo: "Ajuste según manual" }),
    mk(5, "registrarService", "eq-02", bruno, "09:15:00", {}),
  ];
  for (const c of aplicados) {
    const r = aplicar(snap, c, hoy);
    if (!r.ok) throw new Error(`Semilla inválida: ${r.error}`);
    snap = r.snap;
  }
  const rech = mk(6, "registrarService", "eq-04", ana, "09:30:00", {});
  const rr = aplicar(snap, rech, hoy);
  if (rr.ok) throw new Error("Semilla inválida: el comando rechazado se aplicó.");
  snap.comandosRechazados.push({ comando: rech, error: rr.error });

  const evService02 = snap.eventos.find((e) => e.comandoOrigen === "cmd-seed-5")!;
  snap.entidades.propuestas.push(
    { id: "prop-1", registro: "eq-06", versionPartida: 2, cambios: { frecuenciaDias: 45 }, motivo: "Uso intensivo en temporada alta", creador: ana.id, decision: "pendiente", decisor: null },
    { id: "prop-2", registro: "eq-01", versionPartida: 1, cambios: { frecuenciaDias: 365 }, motivo: "Se usa poco", creador: ana.id, decision: "rechazada", decisor: bruno.id },
  );
  snap.entidades.cierres.push({
    id: "cierre-1", fecha: sumarDias(hoy, -7), actor: bruno.id,
    contadores: { alDia: 4, pronto: 3, vencido: 1, fuera: 1 },
  });
  snap.entidades.ajustes.push({
    id: "aj-1", registro: "eq-02", eventoCorregido: evService02.id, cambios: { ultimoService: sumarDias(hoy, -1) },
    motivo: "Se cargó con fecha equivocada (pendiente de aplicar)", aplicado: false, valoresCongelados: null,
  });
  return snap;
}

// ---------- Persistencia ----------
export type Guardado = { ok: true } | { ok: false; error: string };
export function guardar(alm: Almacen, snap: Snapshot): Guardado {
  try {
    alm.setItem(STORAGE_KEY, JSON.stringify(snap));
    return { ok: true };
  } catch (e) {
    const det = e instanceof Error ? e.message : "error desconocido";
    return { ok: false, error: `No se pudo guardar en el navegador (${det}). No se aplicó el cambio: reintentá.` };
  }
}

export type Carga =
  | { ok: true; snap: Snapshot; sembrada: boolean; migrado: boolean; aviso?: string }
  | { ok: false; errores: string[] };

// Lee lo guardado. Si no hay nada, siembra. Si hay algo inválido, lo rechaza SIN resembrar ni pisar.
export function cargar(alm: Almacen, hoy: string): Carga {
  let raw: string | null;
  try { raw = alm.getItem(STORAGE_KEY); } catch { return { ok: false, errores: ["No se pudo leer el almacenamiento del navegador."] }; }
  if (raw === null) {
    const snap = crearSemilla(hoy);
    const g = guardar(alm, snap);
    return { ok: true, snap, sembrada: true, migrado: false, ...(g.ok ? {} : { aviso: g.error }) };
  }
  const v = validarCopia(raw);
  if (!v.ok) return { ok: false, errores: ["La copia guardada no es válida; no se tocó nada.", ...v.errores] };
  if (v.migrado) {
    const g = guardar(alm, v.snap);
    return { ok: true, snap: v.snap, sembrada: false, migrado: true, ...(g.ok ? {} : { aviso: g.error }) };
  }
  return { ok: true, snap: v.snap, sembrada: false, migrado: false };
}

export function validarCopia(texto: string): { ok: true; snap: Snapshot; migrado: boolean } | { ok: false; errores: string[] } {
  let parsed: unknown;
  try { parsed = JSON.parse(texto); } catch { return { ok: false, errores: ["No es un JSON válido (¿copia truncada?)."] }; }
  return validarSnapshot(parsed);
}

// Restaurar: valida completo y recién después escribe. Si algo falla, no queda nada a medias.
export function restaurar(alm: Almacen, texto: string): { ok: true; snap: Snapshot; migrado: boolean } | { ok: false; errores: string[] } {
  const v = validarCopia(texto);
  if (!v.ok) return v;
  const g = guardar(alm, v.snap);
  if (!g.ok) return { ok: false, errores: [g.error] };
  return v;
}

export const exportarJson = (snap: Snapshot) => JSON.stringify(snap, null, 2);

// ---------- Ejecución de comandos ----------
export type Ejecucion =
  | { ok: true; snap: Snapshot; evento: Evento | null; duplicado: boolean }
  | { ok: false; error: string; tipo: "regla" | "almacenamiento" };

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const nuevoId = uid;

export function nuevoComando(tipo: TipoComando, entidad: string, actor: Actor, revisionEsperada: number, datos: Record<string, unknown>): Comando {
  return { id: uid("cmd"), tipo, entidad, actor, instante: instanteLocal(), revisionEsperada, datos };
}

// Aplica sobre lo PERSISTIDO (no solo lo que ve la pantalla): así una pestaña desactualizada falla
// por revisión. Persiste antes de devolver éxito. Si setItem falla, no cambia nada.
export function ejecutar(alm: Almacen, enMemoria: Snapshot, cmd: Comando, hoy: string): Ejecucion {
  let base = enMemoria;
  try {
    const raw = alm.getItem(STORAGE_KEY);
    if (raw !== null) {
      const v = validarCopia(raw);
      if (!v.ok) return { ok: false, tipo: "regla", error: `La copia guardada no es válida: ${v.errores.join(" ")}` };
      base = v.snap;
    }
  } catch { /* si no se puede leer, seguimos con lo que hay en memoria */ }
  const r = aplicar(base, cmd, hoy);
  if (!r.ok) return { ok: false, tipo: "regla", error: r.error };
  if (r.duplicado) return { ok: true, snap: r.snap, evento: r.evento, duplicado: true };
  const g = guardar(alm, r.snap);
  if (!g.ok) return { ok: false, tipo: "almacenamiento", error: g.error };
  return { ok: true, snap: r.snap, evento: r.evento, duplicado: false };
}

export const firmaComando = (c: Pick<Comando, "tipo" | "entidad" | "actor" | "datos">) =>
  JSON.stringify({ t: c.tipo, e: c.entidad, a: c.actor.id, d: c.datos });
export { clone };
