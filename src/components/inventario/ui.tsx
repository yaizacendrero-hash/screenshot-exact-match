import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Estado } from "@/lib/inventario/engine";

export const fmtFecha = (d: string) => (d ? d.split("-").reverse().join("/") : "—");
export const fmtInstante = (i: string) => `${fmtFecha(i.slice(0, 10))} ${i.slice(11, 16)}`;
export const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type Variante = "primario" | "secundario" | "suave";
export function Boton({ variante = "primario", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  const v = {
    primario: "bg-corteza text-crema hover:bg-corteza-suave",
    secundario: "border-2 border-corteza text-corteza bg-transparent hover:bg-masa",
    suave: "bg-masa text-corteza hover:bg-borde-masa",
  }[variante];
  return (
    <button type="button" {...p}
      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`} />
  );
}

export function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-corteza">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-corteza-suave">{ayuda}</span>}
    </label>
  );
}
export const entrada = "min-h-11 w-full rounded-lg border-2 border-borde-masa bg-crema px-3 py-2 text-base text-tinta focus:border-corteza focus:outline-none";

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border-2 border-borde-masa bg-masa/60 p-4 ${className}`}>{children}</section>;
}

// Rojo ladrillo SOLO para "Service vencido".
export function Insignia({ estado, fuera }: { estado: Estado; fuera?: boolean }) {
  if (fuera) return <span className="rounded-full bg-ceniza px-3 py-1 text-xs font-bold text-crema">Fuera de servicio</span>;
  const c = { "Al día": "bg-oliva", "Service en 15 días": "bg-ocre", "Service vencido": "bg-ladrillo" }[estado];
  return <span className={`rounded-full px-3 py-1 text-xs font-bold text-crema ${c}`}>{estado}</span>;
}

export function Confirmar({ titulo, texto, confirmar, onSi, onNo }: { titulo: string; texto: string; confirmar: string; onSi: () => void; onNo: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/50 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-xl border-2 border-corteza bg-crema p-5">
        <h2 className="font-pizarron text-xl font-bold text-corteza">{titulo}</h2>
        <p className="mt-2 text-sm text-tinta">{texto}</p>
        <div className="mt-4 flex gap-2">
          <Boton variante="secundario" className="flex-1" onClick={onNo}>Cancelar</Boton>
          <Boton className="flex-1" onClick={onSi}>{confirmar}</Boton>
        </div>
      </div>
    </div>
  );
}

export type Mensaje = { tipo: "ok" | "error"; texto: string } | null;
export function Aviso({ mensaje, onCerrar }: { mensaje: Mensaje; onCerrar: () => void }) {
  if (!mensaje) return null;
  const c = mensaje.tipo === "ok" ? "border-oliva text-oliva" : "border-corteza text-tinta";
  return (
    <div role="status" className={`mb-3 flex items-start justify-between gap-3 rounded-lg border-2 bg-crema p-3 text-sm font-semibold ${c}`}>
      <span>{mensaje.texto}</span>
      <button type="button" aria-label="Cerrar aviso" onClick={onCerrar} className="min-h-6 px-1 text-lg leading-none">×</button>
    </div>
  );
}
