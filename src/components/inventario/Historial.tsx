import { filtrarEventos } from "@/lib/inventario/engine";
import type { Filtro, Props } from "./tipos";
import { Boton, Campo, Tarjeta, entrada, fmtInstante } from "./ui";

export function Historial({ snap, filtro, setFiltro }: Props & { filtro: Filtro; setFiltro: (f: Filtro) => void }) {
  const nombres = new Map(snap.entidades.equipos.map((e) => [e.id, e.nombre] as const));
  const registros = [...new Set(snap.eventos.map((e) => e.registro))];
  const filas = filtrarEventos(snap, filtro).slice().reverse();
  return (
    <div className="space-y-4">
      <Tarjeta>
        <h2 className="font-pizarron text-2xl font-bold text-corteza">Historial de movimientos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Registro">
            <select className={entrada} value={filtro.registro} onChange={(e) => setFiltro({ ...filtro, registro: e.target.value })}>
              <option value="">Todos</option>
              {registros.map((r) => <option key={r} value={r}>{nombres.get(r) ?? `${r} (dado de baja)`}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Desde"><input type="date" className={entrada} value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} /></Campo>
          <Campo etiqueta="Hasta"><input type="date" className={entrada} value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} /></Campo>
        </div>
        <Boton variante="suave" className="mt-3" onClick={() => setFiltro({ registro: "", desde: "", hasta: "" })}>Limpiar filtro</Boton>
      </Tarjeta>
      <p className="text-sm text-corteza-suave">{filas.length} {filas.length === 1 ? "movimiento" : "movimientos"}</p>
      <ul className="space-y-3">
        {filas.map(({ ev, cmd }) => (
          <li key={ev.id}>
            <Tarjeta>
              <div className="font-semibold text-corteza">{ev.efecto}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-corteza-suave">Id evento</dt><dd className="break-all text-tinta">{ev.id}</dd>
                <dt className="text-corteza-suave">Id comando</dt><dd className="break-all text-tinta">{ev.comandoOrigen}</dd>
                <dt className="text-corteza-suave">Fecha</dt><dd className="text-tinta">{cmd ? fmtInstante(cmd.instante) : "—"}</dd>
                <dt className="text-corteza-suave">Perfil demo</dt><dd className="text-tinta">{cmd ? `${cmd.actor.perfil} · ${cmd.actor.nombre}` : "—"}</dd>
                <dt className="text-corteza-suave">Registro</dt><dd className="text-tinta">{nombres.get(ev.registro) ?? ev.registro}</dd>
                <dt className="text-corteza-suave">Motivo</dt><dd className="text-tinta">{ev.motivo || "—"}</dd>
                <dt className="text-corteza-suave">Versión</dt><dd className="text-tinta">{ev.revisionAnterior} → {ev.revisionNueva}</dd>
              </dl>
            </Tarjeta>
          </li>
        ))}
      </ul>
    </div>
  );
}
