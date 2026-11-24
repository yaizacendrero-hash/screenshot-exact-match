import { describe, expect, it } from "vitest";
import { ACTORES } from "./config";
import {
  aCsv, aplicar, bloqueosService, conciliar, contadores, diasRestantes, estadoDe, filtrarEventos, porcentaje, validarSnapshot,
  type Comando, type Equipo, type Snapshot, type TipoComando,
} from "./engine";
import { cargar, crearSemilla, ejecutar, exportarJson, restaurar, type Almacen } from "./store";

const HOY = "2026-06-15"; // reloj fijo
const ana = ACTORES["Operación"], bruno = ACTORES["Revisor"], carla = ACTORES["Auditor"];
let n = 0;
const cmd = (tipo: TipoComando, entidad: string, snap: Snapshot, datos: Record<string, unknown> = {}, actor = ana, id?: string): Comando =>
  ({ id: id ?? `t-${++n}`, tipo, entidad, actor, instante: `${HOY}T10:00:00`, revisionEsperada: snap.revision, datos });
const eq = (s: Snapshot, id: string) => s.entidades.equipos.find((e) => e.id === id)!;
const ok = (s: Snapshot, c: Comando) => { const r = aplicar(s, c, HOY); if (!r.ok) throw new Error(r.error); return r.snap; };
const memoria = (fallaSet = false): Almacen & { datos: Map<string, string> } => {
  const datos = new Map<string, string>();
  return { datos, getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => { if (fallaSet) throw new Error("QuotaExceededError"); datos.set(k, v); } };
};
const base = (): Equipo => ({ id: "x", nombre: "X", sector: "Hornos", frecuenciaDias: 30, ultimoService: HOY, fechaCompra: "2020-01-01", fueraDeServicio: false, motivo: "", averiaAbierta: false });

describe("estado derivado (límites inclusivos)", () => {
  const e = (dias: number) => ({ ...base(), frecuenciaDias: 100, ultimoService: `2026-03-${String(100 - dias).padStart(2, "0")}` });
  it("16 → Al día, 15 → en 15 días, 1 → en 15 días, 0 → vencido, -1 → vencido", () => {
    const mk = (restantes: number) => { const x = base(); x.frecuenciaDias = 30; x.ultimoService = new Date(Date.UTC(2026, 5, 15) - (30 - restantes) * 86400000).toISOString().slice(0, 10); return x; };
    expect(estadoDe(mk(16), HOY)).toBe("Al día");
    expect(estadoDe(mk(15), HOY)).toBe("Service en 15 días");
    expect(estadoDe(mk(1), HOY)).toBe("Service en 15 días");
    expect(estadoDe(mk(0), HOY)).toBe("Service vencido");
    expect(estadoDe(mk(-1), HOY)).toBe("Service vencido");
    expect(diasRestantes(mk(6), HOY)).toBe(6);
    void e;
  });
  it("porcentaje: Sin datos si el denominador es 0", () => {
    expect(porcentaje(0, 0)).toBe("Sin datos");
    expect(porcentaje(1, 4)).toBe("25%");
  });
});

describe("semilla", () => {
  const s = crearSemilla(HOY);
  it("9 equipos, 5 aplicados consecutivos y 1 rechazado sin evento", () => {
    expect(s.entidades.equipos).toHaveLength(9);
    expect(s.comandosAplicados.map((c) => c.revisionEsperada)).toEqual([0, 1, 2, 3, 4]);
    expect(s.revision).toBe(5);
    expect(s.eventos).toHaveLength(5);
    expect(s.comandosRechazados).toHaveLength(1);
    expect(s.entidades.propuestas.map((p) => p.decision)).toEqual(["pendiente", "rechazada"]);
    expect(s.entidades.cierres).toHaveLength(1);
    expect(s.entidades.ajustes[0]!.aplicado).toBe(false);
  });
  it("contadores: 5 al día, 2 pronto, 1 vencido, 1 fuera; Laminadora a 6 días; Horno de piso vencido", () => {
    expect(contadores(s.entidades.equipos, HOY)).toEqual({ alDia: 5, pronto: 2, vencido: 1, fuera: 1 });
    expect(diasRestantes(eq(s, "eq-06"), HOY)).toBe(6);
    expect(estadoDe(eq(s, "eq-01"), HOY)).toBe("Service vencido");
  });
  it("concilia sin diferencias y es una copia válida", () => {
    expect(conciliar(s, HOY).diferencias).toEqual([]);
    expect(validarSnapshot(JSON.parse(exportarJson(s))).ok).toBe(true);
  });
  it("solo siembra si no existe la clave", () => {
    const alm = memoria();
    const a = cargar(alm, HOY); expect(a.ok && a.sembrada).toBe(true);
    const b = cargar(alm, HOY); expect(b.ok && b.sembrada).toBe(false);
  });
});

describe("registrar service y bloqueos", () => {
  it("laminadora de 6 a 90 días y vuelve a Al día", () => {
    const s0 = crearSemilla(HOY);
    const s1 = ok(s0, cmd("registrarService", "eq-06", s0));
    expect(diasRestantes(eq(s1, "eq-06"), HOY)).toBe(90);
    expect(estadoDe(eq(s1, "eq-06"), HOY)).toBe("Al día");
  });
  it("fuera de servicio no acepta service ni suma contadores; desmarcar lo habilita", () => {
    let s = crearSemilla(HOY);
    const r = aplicar(s, cmd("registrarService", "eq-04", s), HOY);
    expect(r.ok).toBe(false);
    expect(contadores(s.entidades.equipos, HOY).fuera).toBe(1);
    s = ok(s, cmd("desmarcarFuera", "eq-04", s));
    s = ok(s, cmd("registrarService", "eq-04", s));
    expect(eq(s, "eq-04").ultimoService).toBe(HOY);
  });
  it("vencido + avería mantiene el bloqueo; cerrar avería habilita solo si no queda otro", () => {
    let s = crearSemilla(HOY);
    s = ok(s, cmd("abrirAveria", "eq-01", s));
    expect(aplicar(s, cmd("registrarService", "eq-01", s), HOY).ok).toBe(false);
    s = ok(s, cmd("marcarFuera", "eq-01", s, { motivo: "Parado" }));
    s = ok(s, cmd("cerrarAveria", "eq-01", s));
    expect(aplicar(s, cmd("registrarService", "eq-01", s), HOY).ok).toBe(false); // sigue fuera de servicio
    s = ok(s, cmd("desmarcarFuera", "eq-01", s));
    expect(aplicar(s, cmd("registrarService", "eq-01", s), HOY).ok).toBe(true);
  });
  it("marcar fuera exige motivo", () => {
    const s = crearSemilla(HOY);
    expect(aplicar(s, cmd("marcarFuera", "eq-03", s, { motivo: "  " }), HOY).ok).toBe(false);
  });
});

describe("alta y edición", () => {
  const alta = (s: Snapshot, e: Partial<Equipo>) => aplicar(s, cmd("crear", "eq-nuevo", s, { equipo: { ...base(), ...e } }), HOY);
  it("rechaza nombre repetido (sin distinguir mayúsculas), fecha futura y service anterior a la compra", () => {
    const s = crearSemilla(HOY);
    expect(alta(s, { nombre: "laminadora" }).ok).toBe(false);
    expect(alta(s, { nombre: "Nueva", ultimoService: "2026-06-16" }).ok).toBe(false);
    expect(alta(s, { nombre: "Nueva", fechaCompra: "2026-06-16", ultimoService: "2026-06-10" }).ok).toBe(false);
    expect(alta(s, { nombre: "Nueva", fechaCompra: "2026-06-10", ultimoService: "2026-06-01" }).ok).toBe(false);
    expect(alta(s, { nombre: "Nueva" }).ok).toBe(true);
  });
  it("rechaza frecuencia no entera", () => {
    const s = crearSemilla(HOY);
    expect(alta(s, { nombre: "N1", frecuenciaDias: 2.5 }).ok).toBe(false);
    expect(alta(s, { nombre: "N2", frecuenciaDias: NaN }).ok).toBe(false);
  });
  it("borrar elimina del panel y la copia sigue siendo válida aunque tuviera propuestas", () => {
    let s = crearSemilla(HOY);
    s = ok(s, cmd("borrar", "eq-06", s));
    expect(s.entidades.equipos.find((e) => e.id === "eq-06")).toBeUndefined();
    expect(validarSnapshot(JSON.parse(exportarJson(s))).ok).toBe(true);
    expect(conciliar(s, HOY).diferencias).toEqual([]);
  });
});

describe("idempotencia y revisión", () => {
  it("mismo id y mismos datos: un solo efecto; datos distintos: rechazo sin escritura", () => {
    const s0 = crearSemilla(HOY);
    const c = cmd("marcarFuera", "eq-03", s0, { motivo: "Limpieza" }, ana, "dup-1");
    const r1 = aplicar(s0, c, HOY); if (!r1.ok) throw new Error(r1.error);
    const r2 = aplicar(r1.snap, c, HOY);
    expect(r2.ok && r2.duplicado).toBe(true);
    expect(r2.snap.revision).toBe(r1.snap.revision);
    expect(r2.snap.eventos).toHaveLength(r1.snap.eventos.length);
    const r3 = aplicar(r1.snap, { ...c, datos: { motivo: "Otro" } }, HOY);
    expect(r3.ok).toBe(false);
    expect(r3.snap).toBe(r1.snap);
  });
  it("revisión desactualizada conserva el estado y dice qué falló", () => {
    const s = crearSemilla(HOY);
    const r = aplicar(s, { ...cmd("abrirAveria", "eq-03", s), revisionEsperada: 2 }, HOY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Revisión desactualizada.*2.*5/);
    expect(r.snap).toBe(s);
  });
});

describe("persistencia", () => {
  it("si setItem falla conserva lo guardado y reintentar con el mismo id funciona", () => {
    const buena = memoria(); cargar(buena, HOY);
    const antes = [...buena.datos.values()][0]!;
    const s = JSON.parse(antes) as Snapshot;
    const c = cmd("abrirAveria", "eq-03", s, {}, ana, "reintento-1");
    const mala: Almacen = { getItem: (k) => buena.getItem(k), setItem: () => { throw new Error("QuotaExceededError"); } };
    const r = ejecutar(mala, s, c, HOY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.tipo).toBe("almacenamiento");
    expect([...buena.datos.values()][0]).toBe(antes);
    const r2 = ejecutar(buena, s, c, HOY);
    expect(r2.ok && !r2.duplicado).toBe(true);
    expect(eq((r2 as { snap: Snapshot }).snap, "eq-03").averiaAbierta).toBe(true);
  });
  it("una pestaña desactualizada falla por revisión (se aplica sobre lo persistido)", () => {
    const alm = memoria(); const c0 = cargar(alm, HOY); if (!c0.ok) throw new Error("carga");
    const vieja = c0.snap;
    const r1 = ejecutar(alm, vieja, cmd("abrirAveria", "eq-03", vieja), HOY); expect(r1.ok).toBe(true);
    const r2 = ejecutar(alm, vieja, cmd("abrirAveria", "eq-05", vieja), HOY);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toMatch(/Revisión desactualizada/);
  });
});

describe("migración y copias inválidas", () => {
  const s = crearSemilla(HOY);
  const v1 = { schemaVersion: 1, revision: s.revision, equipos: s.entidades.equipos, eventos: s.eventos, comandos: s.comandosAplicados };
  it("v1 → v2 preserva ids y cantidades", () => {
    const r = validarSnapshot(v1);
    expect(r.ok && r.migrado).toBe(true);
    if (r.ok) {
      expect(r.snap.schemaVersion).toBe(2);
      expect(r.snap.entidades.equipos.map((e) => e.id)).toEqual(s.entidades.equipos.map((e) => e.id));
      expect(r.snap.eventos).toHaveLength(5);
      expect(r.snap.comandosAplicados).toHaveLength(5);
    }
  });
  const casos: [string, (x: Snapshot) => unknown][] = [
    ["ids duplicados", (x) => { x.entidades.equipos.push({ ...x.entidades.equipos[0]! }); return x; }],
    ["referencia inexistente", (x) => { x.entidades.propuestas[0]!.registro = "no-existe"; return x; }],
    ["evento sin comando", (x) => { x.eventos[0]!.comandoOrigen = "fantasma"; return x; }],
    ["truncada", (x) => { const { eventos: _e, ...resto } = x; return resto; }],
  ];
  for (const [nombre, rompe] of casos) {
    it(`rechaza copia inválida (${nombre}) sin restaurar ni resembrar`, () => {
      const alm = memoria(); const c = cargar(alm, HOY); if (!c.ok) throw new Error("carga");
      const antes = [...alm.datos.values()][0];
      const r = restaurar(alm, JSON.stringify(rompe(JSON.parse(exportarJson(s)))));
      expect(r.ok).toBe(false);
      expect([...alm.datos.values()][0]).toBe(antes);
    });
  }
  it("una copia guardada corrupta no se resiembra", () => {
    const alm = memoria(); alm.datos.set("fuerza-madre:inventario", "{roto");
    const r = cargar(alm, HOY);
    expect(r.ok).toBe(false);
    expect(alm.datos.get("fuerza-madre:inventario")).toBe("{roto");
  });
  it("JSON exportado se puede restaurar", () => {
    const alm = memoria(); cargar(alm, HOY);
    const r = restaurar(alm, exportarJson(s)); expect(r.ok).toBe(true);
  });
});

describe("propuestas, perfiles y ajustes", () => {
  it("la propuesta no mueve el equipo; el creador no la aprueba; el Revisor sí", () => {
    let s = crearSemilla(HOY);
    const antes = JSON.stringify(eq(s, "eq-03"));
    s = ok(s, cmd("proponer", "eq-03", s, { propuestaId: "p-9", cambios: { frecuenciaDias: 30 }, motivo: "Más uso" }, ana));
    expect(JSON.stringify(eq(s, "eq-03"))).toBe(antes);
    expect(aplicar(s, cmd("decidirPropuesta", "p-9", s, { decision: "aprobada" }, ana), HOY).ok).toBe(false);
    expect(aplicar(s, cmd("decidirPropuesta", "p-9", s, { decision: "aprobada" }, carla), HOY).ok).toBe(false);
    s = ok(s, cmd("decidirPropuesta", "p-9", s, { decision: "aprobada" }, bruno));
    expect(eq(s, "eq-03").frecuenciaDias).toBe(30);
    expect(conciliar(s, HOY).diferencias).toEqual([]);
  });
  it("creador distinto: un Revisor que propuso no se auto-aprueba", () => {
    let s = crearSemilla(HOY);
    s = ok(s, cmd("proponer", "eq-03", s, { propuestaId: "p-8", cambios: { frecuenciaDias: 30 }, motivo: "m" }, bruno));
    expect(aplicar(s, cmd("decidirPropuesta", "p-8", s, { decision: "aprobada" }, bruno), HOY).ok).toBe(false);
  });
  it("Auditor solo consulta (el motor lo impide)", () => {
    const s = crearSemilla(HOY);
    for (const t of ["registrarService", "abrirAveria", "borrar"] as TipoComando[])
      expect(aplicar(s, cmd(t, "eq-03", s, {}, carla), HOY).ok).toBe(false);
  });
  it("el ajuste queda vinculado, congela valores y no reescribe el evento original", () => {
    let s = crearSemilla(HOY);
    const evOriginal = JSON.stringify(s.eventos[4]);
    s = ok(s, cmd("ajuste", "eq-02", s, { eventoId: s.eventos[4]!.id, ajusteId: "aj-9", cambios: { frecuenciaDias: 100 }, motivo: "Corrección" }));
    const a = s.entidades.ajustes.find((x) => x.id === "aj-9")!;
    expect(a.eventoCorregido).toBe(crearSemilla(HOY).eventos[4]!.id);
    expect(a.aplicado).toBe(true);
    expect(a.valoresCongelados?.frecuenciaDias).toBe(100);
    expect(JSON.stringify(s.eventos[4])).toBe(evOriginal);
    expect(s.eventos).toHaveLength(6);
  });
});

describe("exportación", () => {
  it("el CSV del filtro concilia con los eventos de origen", () => {
    const s = crearSemilla(HOY);
    const filas = filtrarEventos(s, { registro: "eq-04" });
    const csv = aCsv(filas).split("\n");
    expect(csv).toHaveLength(filas.length + 1);
    for (const { ev } of filas) expect(csv.join("\n")).toContain(ev.id);
    expect(aCsv(filtrarEventos(s, {})).split("\n")).toHaveLength(s.eventos.length + 1);
    expect(filtrarEventos(s, { desde: "2099-01-01" })).toHaveLength(0);
  });
});

describe("Mantenimiento con causas concurrentes", () => {
  // Horno de piso: service vencido (-12 días). Se le suman una avería y un fuera de servicio.
  it("vencido + avería + fuera de servicio: el service queda bloqueado hasta que no quede NINGUNA causa", () => {
    let s = crearSemilla(HOY);
    const horno = () => eq(s, "eq-01");
    expect(estadoDe(horno(), HOY)).toBe("Service vencido");
    expect(bloqueosService(horno())).toEqual([]); // vencido solo NO bloquea: es lo que el service resuelve

    s = ok(s, cmd("abrirAveria", "eq-01", s));
    expect(bloqueosService(horno())).toEqual(["Tiene una avería abierta"]);
    expect(estadoDe(horno(), HOY)).toBe("Service vencido"); // la avería es independiente del vencimiento
    expect(aplicar(s, cmd("registrarService", "eq-01", s), HOY).ok).toBe(false);

    s = ok(s, cmd("marcarFuera", "eq-01", s, { motivo: "Parado por la avería" }));
    expect(bloqueosService(horno())).toEqual(["Está fuera de servicio", "Tiene una avería abierta"]);

    s = ok(s, cmd("cerrarAveria", "eq-01", s));
    expect(s.eventos[s.eventos.length - 1]!.efecto).toBe("Avería cerrada (sigue bloqueado: fuera de servicio)");
    expect(bloqueosService(horno())).toEqual(["Está fuera de servicio"]);
    expect(aplicar(s, cmd("registrarService", "eq-01", s), HOY).ok).toBe(false);

    s = ok(s, cmd("desmarcarFuera", "eq-01", s));
    expect(bloqueosService(horno())).toEqual([]);
    s = ok(s, cmd("registrarService", "eq-01", s));
    expect(estadoDe(horno(), HOY)).toBe("Al día");
    expect(diasRestantes(horno(), HOY)).toBe(180);
    expect(conciliar(s, HOY).diferencias).toEqual([]);
  });
});
