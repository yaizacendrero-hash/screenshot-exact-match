import { useRef, useState } from "react";
import { aCsv, conciliar, filtrarEventos } from "@/lib/inventario/engine";
import { exportarJson, validarCopia } from "@/lib/inventario/store";
import type { Inventario } from "@/lib/inventario/useInventario";
import type { Filtro, Props } from "./tipos";
import { Boton, Confirmar, Tarjeta, entrada, fmtFecha, type Mensaje } from "./ui";

function descargar(nombre: string, contenido: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: mime }));
  const a = document.createElement("a"); a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Control({ snap, hoy, puedeEscribir, filtro, restaurar, avisar }:
  Props & { filtro: Filtro; restaurar: Inventario["restaurar"]; avisar: (m: Mensaje) => void }) {
  const con = conciliar(snap, hoy);
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<{ ok: boolean; lineas: string[] } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const filas = filtrarEventos(snap, filtro);
  const nombres = new Map(snap.entidades.equipos.map((e) => [e.id, e.nombre] as const));
  const filtroTxt = [filtro.registro && `registro: ${nombres.get(filtro.registro) ?? filtro.registro}`, filtro.desde && `desde ${fmtFecha(filtro.desde)}`, filtro.hasta && `hasta ${fmtFecha(filtro.hasta)}`].filter(Boolean).join(" · ") || "sin filtro (todos los movimientos)";
  const stamp = hoy.replace(/-/g, "");

  const validar = () => {
    const v = validarCopia(texto);
    setResultado(v.ok
      ? { ok: true, lineas: [`Copia válida: versión ${v.snap.schemaVersion}, revisión ${v.snap.revision}, ${v.snap.entidades.equipos.length} equipos, ${v.snap.eventos.length} eventos.`, ...(v.migrado ? ["Es una copia v1: se migra a v2 conservando ids y cantidades."] : [])] }
      : { ok: false, lineas: ["Copia rechazada. No se restauró nada:", ...v.errores] });
  };
  const leer = async (f?: File) => { if (!f) return; setTexto(await f.text()); setResultado(null); };

  const filasConc: [string, number, number][] = [
    ["Al día", con.panel.alDia, con.eventos.alDia], ["Service en 15 días", con.panel.pronto, con.eventos.pronto],
    ["Service vencido", con.panel.vencido, con.eventos.vencido], ["Fuera de servicio", con.panel.fuera, con.eventos.fuera],
  ];

  return (
    <div className="space-y-4">
      <Tarjeta>
        <h2 className="font-pizarron text-2xl font-bold text-corteza">Conciliación</h2>
        <p className="text-sm text-corteza-suave">Contadores del panel contra lo que dicen los eventos.</p>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-corteza-suave"><th className="py-1">Contador</th><th>Panel</th><th>Eventos</th></tr></thead>
          <tbody>{filasConc.map(([n, a, b]) => <tr key={n} className="border-t border-borde-masa"><td className="py-1">{n}</td><td className="font-bold">{a}</td><td className="font-bold">{b}</td></tr>)}</tbody>
        </table>
        {con.diferencias.length === 0
          ? <p className="mt-3 font-semibold text-oliva">Todo concilia: no hay diferencias.</p>
          : <div className="mt-3"><p className="font-semibold text-tinta">{con.diferencias.length} {con.diferencias.length === 1 ? "diferencia" : "diferencias"}:</p><ul className="list-disc pl-5 text-sm">{con.diferencias.map((d, i) => <li key={i}>{d.registro}: {d.detalle}</li>)}</ul></div>}
      </Tarjeta>

      <Tarjeta>
        <h2 className="font-pizarron text-2xl font-bold text-corteza">Exportar</h2>
        <p className="text-sm text-corteza-suave">Filtro actual del historial: {filtroTxt} ({filas.length} {filas.length === 1 ? "movimiento" : "movimientos"}).</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Boton onClick={() => descargar(`movimientos-${stamp}.csv`, aCsv(filas), "text/csv;charset=utf-8")}>Exportar CSV del filtro</Boton>
          <Boton variante="secundario" onClick={() => descargar(`inventario-v${snap.schemaVersion}-rev${snap.revision}-${stamp}.json`, exportarJson(snap), "application/json")}>Exportar JSON versionado</Boton>
        </div>
      </Tarjeta>

      {puedeEscribir && (
        <Tarjeta>
          <h2 className="font-pizarron text-2xl font-bold text-corteza">Restaurar copia</h2>
          <p className="text-sm text-corteza-suave">Primero validá. Si la copia no pasa todas las pruebas, no se toca nada.</p>
          <input ref={archivo} type="file" accept="application/json,.json" aria-label="Archivo de copia" className="mt-3 block w-full text-sm" onChange={(e) => leer(e.target.files?.[0])} />
          <textarea className={`${entrada} mt-3 min-h-28 font-mono text-xs`} placeholder="…o pegá acá el JSON de la copia" aria-label="JSON de la copia" value={texto} onChange={(e) => { setTexto(e.target.value); setResultado(null); }} />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Boton variante="secundario" disabled={!texto.trim()} onClick={validar}>Validar antes de restaurar</Boton>
            <Boton disabled={!resultado?.ok} onClick={() => setConfirmando(true)}>Restaurar</Boton>
          </div>
          {resultado && <ul role="status" className={`mt-3 list-disc pl-5 text-sm ${resultado.ok ? "text-oliva" : "text-tinta"} font-semibold`}>{resultado.lineas.map((l, i) => <li key={i}>{l}</li>)}</ul>}
        </Tarjeta>
      )}

      <Tarjeta>
        <h2 className="font-pizarron text-2xl font-bold text-corteza">Cierres</h2>
        <ul className="mt-2 space-y-1 text-sm">{snap.entidades.cierres.map((c) => <li key={c.id}>{fmtFecha(c.fecha)} — al día {c.contadores.alDia}, en 15 días {c.contadores.pronto}, vencido {c.contadores.vencido}, parados {c.contadores.fuera}</li>)}</ul>
      </Tarjeta>

      {confirmando && <Confirmar titulo="¿Restaurar esta copia?" texto="Reemplaza todos los datos actuales de este navegador por los de la copia." confirmar="Sí, restaurar"
        onNo={() => setConfirmando(false)}
        onSi={() => { setConfirmando(false); const r = restaurar(texto); if (r.ok) { avisar({ tipo: "ok", texto: "Copia restaurada." }); setTexto(""); setResultado(null); } else setResultado({ ok: false, lineas: ["No se restauró nada:", ...r.errores] }); }} />}
    </div>
  );
}
