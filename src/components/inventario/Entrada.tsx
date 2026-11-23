import { useState } from "react";
import { ACTORES, AVISO_ACCESO, CLAVE_PANEL, PERFILES } from "@/lib/inventario/config";
import type { Perfil } from "@/lib/inventario/engine";
import { Boton, Campo, entrada } from "./ui";

export function Entrada({ onEntrar }: { onEntrar: (p: Perfil) => void }) {
  const [clave, setClave] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("Operación");
  const [error, setError] = useState("");
  const entrar = () => {
    if (clave !== CLAVE_PANEL) { setError("Clave incorrecta. Probá de nuevo."); return; }
    onEntrar(perfil);
  };
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <h1 className="font-pizarron text-4xl font-bold text-corteza">Fuerza Madre</h1>
      <p className="mt-1 text-lg text-corteza-suave">Inventario de mantenimiento del obrador</p>
      <div className="mt-6 space-y-4 rounded-xl border-2 border-borde-masa bg-masa/60 p-4">
        <Campo etiqueta="Clave del panel">
          <input type="password" className={entrada} value={clave} autoComplete="off"
            onChange={(e) => { setClave(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && entrar()} />
        </Campo>
        <Campo etiqueta="Perfil" ayuda={perfil === "Auditor" ? "Solo consultás: no podés cambiar nada." : perfil === "Revisor" ? "Aprobás o rechazás propuestas de otros." : "Registrás services, averías y cambios."}>
          <select className={entrada} value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
            {PERFILES.map((p) => <option key={p} value={p}>{p} — {ACTORES[p].nombre}</option>)}
          </select>
        </Campo>
        {error && <p role="alert" className="text-sm font-semibold text-tinta">{error}</p>}
        <Boton className="w-full" onClick={entrar}>Entrar</Boton>
      </div>
      <p className="mt-4 rounded-lg border-2 border-dashed border-corteza-suave p-3 text-sm text-corteza">{AVISO_ACCESO}.</p>
    </main>
  );
}
