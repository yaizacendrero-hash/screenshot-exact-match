import { useState } from "react";
import { bloqueosService, diasRestantes, estadoDe } from "@/lib/inventario/engine";
import { nuevoId } from "@/lib/inventario/store";
import type { Props } from "./tipos";
import { Boton, Campo, Confirmar, Insignia, Tarjeta, entrada, fmtFecha, fmtInstante } from "./ui";

const ETIQUETA: Record<string, string> = { nombre: "Nombre", sector: "Sector", frecuenciaDias: "Frecuencia (días)", ultimoService: "Último service", fechaCompra: "Fecha de compra" };
const valor = (k: string, v: unknown) => (k === "ultimoService" || k === "fechaCompra" ? fmtFecha(String(v)) : String(v));

export function Ficha({ snap, hoy, actor, puedeEscribir, act, ir, id }: Props & { id: string }) {
  const e = snap.entidades.equipos.find((x) => x.id === id);
  const [motivo, setMotivo] = useState("");
  const [pidiendo, setPidiendo] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  const [cFrec, setCFrec] = useState("");
  const [cUlt, setCUlt] = useState("");
  const [cMotivo, setCMotivo] = useState("");
  const [ajusteId] = useState(() => nuevoId("aj"));

  if (!e) return <Tarjeta>Ese equipo ya no existe. <Boton variante="suave" onClick={() => ir({ t: "panel" })}>Volver al panel</Boton></Tarjeta>;

  const bloq = bloqueosService(e);
  const cmds = new Map(snap.comandosAplicados.map((c) => [c.id, c] as const));
  const eventos = snap.eventos.filter((v) => v.registro === e.id).slice().reverse();
  const props = snap.entidades.propuestas.filter((p) => p.registro === e.id);
  const ajustes = snap.entidades.ajustes.filter((a) => a.registro === e.id);
  const d = diasRestantes(e, hoy);

  const dato = (k: string, v: string) => <div><dt className="text-xs font-semibold text-corteza-suave">{k}</dt><dd className="text-base text-tinta">{v}</dd></div>;

  return (
    <div className="space-y-4">
      <Boton variante="suave" onClick={() => ir({ t: "panel" })}>← Volver al panel</Boton>
      <Tarjeta>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-pizarron text-3xl font-bold text-corteza">{e.nombre}</h2>
            <div className="mt-2 flex flex-wrap gap-1"><Insignia estado={estadoDe(e, hoy)} fuera={e.fueraDeServicio} />{e.averiaAbierta && <span className="rounded-full border-2 border-corteza px-3 py-0.5 text-xs font-bold text-corteza">Avería abierta</span>}</div>
          </div>
          <div className="text-right"><div className="font-pizarron text-5xl font-bold leading-none text-corteza">{d}</div><div className="text-xs text-corteza-suave">días restantes</div></div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {dato("Sector", e.sector)}{dato("Frecuencia", `${e.frecuenciaDias} días`)}
          {dato("Último service", fmtFecha(e.ultimoService))}{dato("Fecha de compra", fmtFecha(e.fechaCompra))}
          {dato("Estado por fecha", estadoDe(e, hoy))}{dato("Fuera de servicio", e.fueraDeServicio ? `Sí — ${e.motivo}` : "No")}
        </dl>
      </Tarjeta>

      {puedeEscribir && (
        <Tarjeta className="space-y-3">
          <label className="flex min-h-11 items-center gap-3 font-semibold text-corteza">
            <input type="checkbox" className="size-6 accent-corteza" checked={e.fueraDeServicio || pidiendo}
              onChange={(x) => { if (!x.target.checked) { if (e.fueraDeServicio) act("desmarcarFuera", e.id, {}, `${e.nombre}: vuelve a servicio.`); setPidiendo(false); } else { setPidiendo(true); } }} />
            Fuera de servicio
          </label>
          {pidiendo && !e.fueraDeServicio && (
            <div className="space-y-2">
              <Campo etiqueta="Motivo"><input className={entrada} value={motivo} onChange={(x) => setMotivo(x.target.value)} /></Campo>
              <div className="flex gap-2">
                <Boton variante="secundario" className="flex-1" onClick={() => setPidiendo(false)}>Cancelar</Boton>
                <Boton className="flex-1" disabled={!motivo.trim()} onClick={() => { if (act("marcarFuera", e.id, { motivo }, `${e.nombre}: fuera de servicio.`)) { setPidiendo(false); setMotivo(""); } }}>Confirmar</Boton>
              </div>
            </div>
          )}
          <p className="text-sm text-corteza-suave">La avería se maneja aparte: sigue abierta aunque el service no esté vencido.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Boton disabled={bloq.length > 0} onClick={() => act("registrarService", e.id, {}, `Service registrado: ${e.nombre} vuelve a contar desde hoy.`)}>Registrar service</Boton>
            {e.averiaAbierta
              ? <Boton variante="secundario" onClick={() => act("cerrarAveria", e.id, {}, "Avería cerrada.")}>Cerrar avería</Boton>
              : <Boton variante="secundario" onClick={() => act("abrirAveria", e.id, {}, "Avería abierta.")}>Abrir avería</Boton>}
          </div>
          {bloq.length > 0 && <p className="text-sm font-semibold text-tinta">No se puede registrar service: {bloq.join(" ")}</p>}
          <div className="flex gap-2 border-t-2 border-borde-masa pt-3">
            <Boton variante="suave" className="flex-1" onClick={() => ir({ t: "form", id: e.id })}>Editar</Boton>
            <Boton variante="secundario" className="flex-1" onClick={() => setBorrando(true)}>Eliminar</Boton>
          </div>
        </Tarjeta>
      )}

      {props.length > 0 && (
        <Tarjeta>
          <h3 className="font-pizarron text-xl font-bold text-corteza">Propuestas</h3>
          <ul className="mt-2 space-y-3">
            {props.map((p) => (
              <li key={p.id} className="rounded-lg bg-crema p-3 text-sm">
                <div className="font-semibold text-corteza">{p.decision === "pendiente" ? "Pendiente" : p.decision === "aprobada" ? "Aprobada" : "Rechazada"} — {p.motivo || "sin motivo"}</div>
                <div className="text-corteza-suave">Cambios: {Object.entries(p.cambios).map(([k, v]) => `${ETIQUETA[k] ?? k} → ${valor(k, v)}`).join(", ") || "ninguno"}</div>
                {p.decision === "pendiente" && (actor.perfil === "Revisor") && (
                  <div className="mt-2 flex gap-2">
                    <Boton className="flex-1" onClick={() => act("decidirPropuesta", p.id, { decision: "aprobada" }, "Propuesta aprobada y aplicada.")}>Aprobar</Boton>
                    <Boton variante="secundario" className="flex-1" onClick={() => act("decidirPropuesta", p.id, { decision: "rechazada" }, "Propuesta rechazada.")}>Rechazar</Boton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <Tarjeta>
        <h3 className="font-pizarron text-xl font-bold text-corteza">Historial</h3>
        <p className="text-xs text-corteza-suave">No se puede borrar. Si algo está mal, se corrige con un ajuste vinculado.</p>
        <ul className="mt-3 space-y-3">
          {eventos.length === 0 && <li className="text-sm text-corteza-suave">Todavía no hay movimientos.</li>}
          {eventos.map((v) => {
            const c = cmds.get(v.comandoOrigen);
            return (
              <li key={v.id} className="rounded-lg bg-crema p-3 text-sm">
                <div className="font-semibold text-corteza">{v.efecto}</div>
                <div className="text-corteza-suave">{c ? `${fmtInstante(c.instante)} · ${c.actor.nombre} (${c.actor.perfil})` : "—"} · rev. {v.revisionAnterior} → {v.revisionNueva}</div>
                {v.motivo && <div className="text-tinta">Motivo: {v.motivo}</div>}
                {puedeEscribir && corrigiendo !== v.id && <Boton variante="suave" className="mt-2" onClick={() => { setCorrigiendo(v.id); setCFrec(String(e.frecuenciaDias)); setCUlt(e.ultimoService); setCMotivo(""); }}>Corregir con ajuste</Boton>}
                {corrigiendo === v.id && (
                  <div className="mt-2 space-y-2">
                    <Campo etiqueta="Frecuencia (días)"><input className={entrada} inputMode="numeric" value={cFrec} onChange={(x) => setCFrec(x.target.value)} /></Campo>
                    <Campo etiqueta="Último service"><input type="date" max={hoy} className={entrada} value={cUlt} onChange={(x) => setCUlt(x.target.value)} /></Campo>
                    <Campo etiqueta="Motivo de la corrección"><input className={entrada} value={cMotivo} onChange={(x) => setCMotivo(x.target.value)} /></Campo>
                    <div className="flex gap-2">
                      <Boton variante="secundario" className="flex-1" onClick={() => setCorrigiendo(null)}>Cancelar</Boton>
                      <Boton className="flex-1" disabled={!cMotivo.trim()} onClick={() => { if (act("ajuste", e.id, { eventoId: v.id, ajusteId, cambios: { frecuenciaDias: cFrec.trim() === "" ? NaN : Number(cFrec), ultimoService: cUlt }, motivo: cMotivo.trim() }, "Ajuste registrado: el movimiento original queda como estaba.")) setCorrigiendo(null); }}>Guardar ajuste</Boton>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {ajustes.length > 0 && (
          <div className="mt-3 border-t-2 border-borde-masa pt-3 text-sm">
            <div className="font-semibold text-corteza">Ajustes vinculados</div>
            <ul className="mt-1 list-disc pl-5 text-tinta">{ajustes.map((a) => <li key={a.id}>{a.aplicado ? "Aplicado" : "No aplicado"} — {a.motivo} (sobre {a.eventoCorregido})</li>)}</ul>
          </div>
        )}
      </Tarjeta>

      {borrando && <Confirmar titulo="¿Eliminar este equipo?" texto={`${e.nombre} sale del panel. Su historial queda registrado.`} confirmar="Sí, eliminar"
        onNo={() => setBorrando(false)} onSi={() => { setBorrando(false); if (act("borrar", e.id, {}, `${e.nombre}: eliminado del panel.`)) ir({ t: "panel" }, true); }} />}
    </div>
  );
}
