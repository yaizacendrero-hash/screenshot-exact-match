import { useCallback, useEffect, useRef, useState } from "react";
import type { Actor, Comando, Snapshot, TipoComando } from "./engine";
import {
  cargar, ejecutar, firmaComando, hoyLocal, nuevoComando, restaurar as restaurarCopia,
  type Ejecucion,
} from "./store";

interface Estado { listo: boolean; snap: Snapshot | null; errores: string[]; aviso?: string }

export function useInventario(hoyFijo?: string) {
  const [estado, setEstado] = useState<Estado>({ listo: false, snap: null, errores: [] });
  // Borrador: si setItem falla, el reintento reutiliza el MISMO id de comando.
  const borrador = useRef<Comando | null>(null);
  const hoy = hoyFijo ?? hoyLocal();

  const recargar = useCallback(() => {
    borrador.current = null;
    const c = cargar(window.localStorage, hoyFijo ?? hoyLocal());
    setEstado(c.ok ? { listo: true, snap: c.snap, errores: [], aviso: c.aviso } : { listo: true, snap: null, errores: c.errores });
  }, [hoyFijo]);

  useEffect(() => { recargar(); }, [recargar]);

  const enviar = useCallback((tipo: TipoComando, entidad: string, datos: Record<string, unknown>, actor: Actor): Ejecucion => {
    if (!estado.snap) return { ok: false, tipo: "regla", error: "No hay datos cargados." };
    let cmd = nuevoComando(tipo, entidad, actor, estado.snap.revision, datos);
    const previo = borrador.current;
    if (previo && firmaComando(previo) === firmaComando(cmd)) cmd = { ...cmd, id: previo.id, revisionEsperada: previo.revisionEsperada, instante: previo.instante };
    const r = ejecutar(window.localStorage, estado.snap, cmd, hoy);
    if (r.ok) { borrador.current = null; setEstado({ listo: true, snap: r.snap, errores: [] }); }
    else borrador.current = r.tipo === "almacenamiento" ? cmd : null;
    return r;
  }, [estado.snap, hoy]);

  const restaurar = useCallback((texto: string) => {
    const r = restaurarCopia(window.localStorage, texto);
    if (r.ok) { borrador.current = null; setEstado({ listo: true, snap: r.snap, errores: [] }); }
    return r;
  }, []);

  return { ...estado, hoy, enviar, restaurar, recargar };
}
export type Inventario = ReturnType<typeof useInventario>;
