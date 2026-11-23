import { useMemo, useState } from "react";
import { SECTORES, bloqueosService, contadores, diasRestantes, estadoDe, porcentaje, type Equipo } from "@/lib/inventario/engine";
import type { Props } from "./tipos";
import { Boton, Insignia, Tarjeta, entrada, norm } from "./ui";

export function Panel({ snap, hoy, puedeEscribir, act, ir }: Props) {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [fueraDe, setFueraDe] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const equipos = snap.entidades.equipos;
  const c = contadores(equipos, hoy);

  const lista = useMemo(() => equipos
    .filter((e) => (!q.trim() || norm(e.nombre).includes(norm(q.trim()))) && (!sector || e.sector === sector))
    .sort((a, b) => Number(a.fueraDeServicio) - Number(b.fueraDeServicio) || diasRestantes(a, hoy) - diasRestantes(b, hoy)),
    [equipos, q, sector, hoy]);

  const tarjetas: { k: keyof typeof c; t: string; col: string }[] = [
    { k: "alDia", t: "Al día", col: "text-oliva" },
    { k: "pronto", t: "Service en 15 días", col: "text-ocre" },
    { k: "vencido", t: "Service vencido", col: "text-ladrillo" },
    { k: "fuera", t: "Fuera de servicio", col: "text-ceniza" },
  ];

  const marcar = (e: Equipo) => {
    if (act("marcarFuera", e.id, { motivo }, `${e.nombre}: fuera de servicio.`)) { setFueraDe(null); setMotivo(""); }
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tarjetas.map((t) => (
          <Tarjeta key={t.k} className="text-center">
            <div className={`font-pizarron text-5xl font-bold ${t.col}`}>{c[t.k]}</div>
            <div className="mt-1 text-sm font-semibold text-corteza">{t.t}</div>
          </Tarjeta>
        ))}
      </div>
      <p className="mt-2 text-sm text-corteza-suave">
        Equipos al día: {porcentaje(c.alDia, c.alDia + c.pronto + c.vencido)} (sin contar los parados)
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input className={entrada} type="search" placeholder="Buscar por nombre" aria-label="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={entrada} aria-label="Filtrar por sector" value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">Todos los sectores</option>
          {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {puedeEscribir && <Boton className="mt-3 w-full sm:w-auto" onClick={() => ir({ t: "form" })}>+ Nuevo equipo</Boton>}

      <ul className="mt-4 space-y-3">
        {lista.length === 0 && <li className="rounded-xl border-2 border-dashed border-borde-masa p-6 text-center text-corteza-suave">No hay equipos con ese filtro.</li>}
        {lista.map((e) => {
          const d = diasRestantes(e, hoy);
          const bloq = bloqueosService(e);
          return (
            <li key={e.id}>
              <Tarjeta>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button type="button" onClick={() => ir({ t: "ficha", id: e.id })} className="text-left font-pizarron text-xl font-bold text-corteza underline decoration-borde-masa underline-offset-4">{e.nombre}</button>
                    <div className="text-sm text-corteza-suave">{e.sector}</div>
                    <div className="mt-2 flex flex-wrap gap-1"><Insignia estado={estadoDe(e, hoy)} fuera={e.fueraDeServicio} />{e.averiaAbierta && <span className="rounded-full border-2 border-corteza px-3 py-0.5 text-xs font-bold text-corteza">Avería abierta</span>}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`font-pizarron text-5xl font-bold leading-none ${e.fueraDeServicio ? "text-ceniza" : "text-corteza"}`}>{d}</div>
                    <div className="text-xs text-corteza-suave">{Math.abs(d) === 1 ? "día" : "días"}{e.fueraDeServicio ? " (parado)" : ""}</div>
                  </div>
                </div>
                {puedeEscribir && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Boton disabled={bloq.length > 0} title={bloq.join(" ")}
                      onClick={() => act("registrarService", e.id, {}, `Service registrado: ${e.nombre} vuelve a contar desde hoy.`)}>Registrar service</Boton>
                    {e.fueraDeServicio
                      ? <Boton variante="secundario" onClick={() => act("desmarcarFuera", e.id, {}, `${e.nombre}: vuelve a servicio.`)}>Volver a servicio</Boton>
                      : <Boton variante="secundario" onClick={() => { setFueraDe(e.id); setMotivo(""); }}>Marcar fuera de servicio</Boton>}
                  </div>
                )}
                {bloq.length > 0 && puedeEscribir && <p className="mt-2 text-xs text-corteza-suave">{bloq.join(" ")}</p>}
                {fueraDe === e.id && (
                  <div className="mt-3 space-y-2 rounded-lg bg-crema p-3">
                    <input className={entrada} placeholder="Motivo (obligatorio)" aria-label="Motivo" value={motivo} onChange={(x) => setMotivo(x.target.value)} />
                    <div className="flex gap-2">
                      <Boton variante="secundario" className="flex-1" onClick={() => setFueraDe(null)}>Cancelar</Boton>
                      <Boton className="flex-1" disabled={!motivo.trim()} onClick={() => marcar(e)}>Confirmar</Boton>
                    </div>
                  </div>
                )}
              </Tarjeta>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
