import type { Actor, Snapshot, TipoComando } from "@/lib/inventario/engine";

export type Vista =
  | { t: "panel" } | { t: "ficha"; id: string } | { t: "form"; id?: string }
  | { t: "historial" } | { t: "control" };
export type Filtro = { registro: string; desde: string; hasta: string };
export type Act = (tipo: TipoComando, entidad: string, datos: Record<string, unknown>, ok: string) => boolean;
export interface Props {
  snap: Snapshot; hoy: string; actor: Actor; puedeEscribir: boolean; act: Act; ir: (v: Vista, conservarAviso?: boolean) => void;
}
