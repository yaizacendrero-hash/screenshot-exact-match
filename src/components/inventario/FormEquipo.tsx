import { useState } from "react";
import { SECTORES, type Sector } from "@/lib/inventario/engine";
import { nuevoId } from "@/lib/inventario/store";
import type { Props } from "./tipos";
import { Boton, Campo, Tarjeta, entrada } from "./ui";

export function FormEquipo({ snap, hoy, id, act, ir }: Props & { id?: string }) {
  const previo = id ? snap.entidades.equipos.find((e) => e.id === id) : undefined;
  const [nombre, setNombre] = useState(previo?.nombre ?? "");
  const [sector, setSector] = useState<Sector>(previo?.sector ?? "Hornos");
  const [frec, setFrec] = useState(String(previo?.frecuenciaDias ?? 90));
  const [ultimo, setUltimo] = useState(previo?.ultimoService ?? hoy);
  const [compra, setCompra] = useState(previo?.fechaCompra ?? "");
  const [motivo, setMotivo] = useState("");
  const [nuevo] = useState(() => nuevoId("eq"));
  const [propuestaId] = useState(() => nuevoId("prop"));

  const campos = () => ({ nombre: nombre.trim(), sector, frecuenciaDias: frec.trim() === "" ? NaN : Number(frec), ultimoService: ultimo, fechaCompra: compra });

  const guardar = () => {
    const ok = previo
      ? act("editar", previo.id, { cambios: campos(), motivo: motivo.trim() || "Edición desde la ficha" }, `${nombre.trim()}: cambios guardados.`)
      : act("crear", nuevo, { equipo: { ...campos(), id: nuevo, fueraDeServicio: false, motivo: "", averiaAbierta: false } }, `${nombre.trim()}: equipo agregado.`);
    if (ok) ir(previo ? { t: "ficha", id: previo.id } : { t: "panel" }, true);
  };
  const proponer = () => {
    const c = campos();
    const cambios = Object.fromEntries(Object.entries(c).filter(([k, v]) => previo && (previo as unknown as Record<string, unknown>)[k] !== v));
    if (act("proponer", previo!.id, { propuestaId, cambios, motivo: motivo.trim() }, "Propuesta enviada: un revisor tiene que aprobarla.")) ir({ t: "ficha", id: previo!.id }, true);
  };

  return (
    <Tarjeta>
      <h2 className="font-pizarron text-2xl font-bold text-corteza">{previo ? `Editar ${previo.nombre}` : "Nuevo equipo"}</h2>
      <div className="mt-4 space-y-4">
        <Campo etiqueta="Nombre"><input className={entrada} value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
        <Campo etiqueta="Sector">
          <select className={entrada} value={sector} onChange={(e) => setSector(e.target.value as Sector)}>
            {SECTORES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Frecuencia (días)"><input className={entrada} inputMode="numeric" value={frec} onChange={(e) => setFrec(e.target.value)} /></Campo>
        <Campo etiqueta="Último service (fecha)"><input type="date" max={hoy} className={entrada} value={ultimo} onChange={(e) => setUltimo(e.target.value)} /></Campo>
        <Campo etiqueta="Fecha de compra"><input type="date" max={hoy} className={entrada} value={compra} onChange={(e) => setCompra(e.target.value)} /></Campo>
        {previo && <Campo etiqueta="Motivo del cambio" ayuda="Obligatorio si lo mandás como propuesta."><input className={entrada} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>}
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Boton className="sm:flex-1" onClick={guardar}>Guardar</Boton>
        {previo && <Boton variante="suave" className="sm:flex-1" onClick={proponer}>Proponer en vez de guardar</Boton>}
        <Boton variante="secundario" className="sm:flex-1" onClick={() => ir(previo ? { t: "ficha", id: previo.id } : { t: "panel" })}>Cancelar</Boton>
      </div>
    </Tarjeta>
  );
}
