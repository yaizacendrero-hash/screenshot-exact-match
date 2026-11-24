import { useEffect, useState } from "react";
import { ACTORES, AVISO_ACCESO } from "@/lib/inventario/config";
import type { Perfil, TipoComando } from "@/lib/inventario/engine";
import { useInventario } from "@/lib/inventario/useInventario";
import { Control } from "./Control";
import { Docs } from "./Docs";
import { Entrada } from "./Entrada";
import { Ficha } from "./Ficha";
import { FormEquipo } from "./FormEquipo";
import { Historial } from "./Historial";
import { Panel } from "./Panel";
import type { Filtro, Vista } from "./tipos";
import { Aviso, Boton, type Mensaje } from "./ui";

const CLAVE_SESION = "fuerza-madre:perfil";

export function App() {
  const inv = useInventario();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [vista, setVista] = useState<Vista>({ t: "panel" });
  const [filtro, setFiltro] = useState<Filtro>({ registro: "", desde: "", hasta: "" });
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [verDocs, setVerDocs] = useState(false);

  // La documentación se abre sin clave; "#docs" en la dirección lleva directo a ella.
  useEffect(() => { if (window.location.hash === "#docs") setVerDocs(true); }, []);
  const abrirDocs = (abrir: boolean) => {
    setVerDocs(abrir);
    try { history.replaceState(null, "", abrir ? "#docs" : window.location.pathname + window.location.search); } catch { /* ok */ }
  };

  useEffect(() => {
    try { const p = sessionStorage.getItem(CLAVE_SESION) as Perfil | null; if (p && p in ACTORES) setPerfil(p); } catch { /* sin sessionStorage */ }
  }, []);
  const entrar = (p: Perfil) => { setPerfil(p); try { sessionStorage.setItem(CLAVE_SESION, p); } catch { /* ok */ } };
  const salir = () => { setPerfil(null); setVista({ t: "panel" }); setMensaje(null); try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* ok */ } };

  // La pantalla de entrada no necesita los datos: se pinta de inmediato (también en el HTML del servidor)
  // en vez de esperar a que cargue localStorage. Mejora el primer contenido visible.
  if (verDocs) return <Docs onVolver={() => abrirDocs(false)} />;
  if (!perfil) return <div className="bg-crema text-tinta"><Entrada onEntrar={entrar} onDocs={() => abrirDocs(true)} /></div>;

  if (!inv.listo) return <main className="grid min-h-screen place-items-center bg-crema text-corteza">Cargando el pizarrón…</main>;

  if (!inv.snap) return (
    <main className="mx-auto min-h-screen max-w-md bg-crema px-4 py-8 text-tinta">
      <h1 className="font-pizarron text-2xl font-bold text-corteza">No se pudieron cargar los datos</h1>
      <ul className="mt-3 list-disc pl-5 text-sm">{inv.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
      <p className="mt-3 text-sm">No se borró ni se resembró nada. Podés volver a intentar o restaurar una copia válida.</p>
      <Boton className="mt-4" onClick={inv.recargar}>Reintentar</Boton>
    </main>
  );

  const snap = inv.snap;
  const actor = ACTORES[perfil];
  const puedeEscribir = perfil !== "Auditor";
  const act = (tipo: TipoComando, entidad: string, datos: Record<string, unknown>, okTexto: string) => {
    const r = inv.enviar(tipo, entidad, datos, actor);
    setMensaje(r.ok ? { tipo: "ok", texto: r.duplicado ? "Ya estaba aplicado: no se repite." : okTexto } : { tipo: "error", texto: r.error });
    return r.ok;
  };
  const ir = (v: Vista, conservarAviso = false) => { setVista(v); if (!conservarAviso) setMensaje(null); window.scrollTo?.({ top: 0 }); };
  const props = { snap, hoy: inv.hoy, actor, puedeEscribir, act, ir };
  const pestanas: { t: Vista["t"]; n: string }[] = [{ t: "panel", n: "Panel" }, { t: "historial", n: "Historial" }, { t: "control", n: "Control" }];

  return (
    <div className="min-h-screen bg-crema pb-12 text-tinta">
      <header className="border-b-4 border-corteza bg-masa">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="font-pizarron text-2xl font-bold text-corteza">Fuerza Madre</h1>
            <div className="flex items-center gap-2 text-right text-xs text-corteza"><span>{actor.nombre}<br />{perfil}</span><Boton variante="secundario" className="min-h-9 px-3 py-1 text-xs" onClick={salir}>Salir</Boton></div>
          </div>
          <p className="mt-1 text-xs text-corteza-suave">{AVISO_ACCESO}.</p>
          <nav className="mt-2 flex gap-2" aria-label="Secciones">
            {pestanas.map((p) => <Boton key={p.t} variante={vista.t === p.t ? "primario" : "suave"} className="flex-1" aria-current={vista.t === p.t ? "page" : undefined} onClick={() => ir({ t: p.t } as Vista)}>{p.n}</Boton>)}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4">
        {inv.aviso && <Aviso mensaje={{ tipo: "error", texto: inv.aviso }} onCerrar={() => undefined} />}
        {!puedeEscribir && <p className="mb-3 rounded-lg border-2 border-dashed border-corteza-suave p-2 text-sm text-corteza">Perfil Auditor: solo consulta.</p>}
        <Aviso mensaje={mensaje} onCerrar={() => setMensaje(null)} />
        {vista.t === "panel" && <Panel {...props} />}
        {vista.t === "ficha" && <Ficha {...props} id={vista.id} />}
        {vista.t === "form" && <FormEquipo {...props} id={vista.id} />}
        {vista.t === "historial" && <Historial {...props} filtro={filtro} setFiltro={setFiltro} />}
        {vista.t === "control" && <Control {...props} filtro={filtro} restaurar={inv.restaurar} avisar={setMensaje} />}
      </main>
    </div>
  );
}
