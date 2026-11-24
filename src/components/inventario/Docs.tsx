import type { ReactNode } from "react";
import readme from "../../../README.md?raw";
import { Boton } from "./ui";

// Mini-renderizador de Markdown (títulos, listas, código, citas, negrita, código en línea, enlaces).
// La documentación se lee del mismo README.md del repo: una sola fuente.
function enLinea(t: string, k: string): ReactNode[] {
  return t.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean).map((p, i) => {
    if (p.startsWith("`")) return <code key={`${k}${i}`} className="rounded bg-masa px-1 py-0.5 font-mono text-[0.9em] text-corteza">{p.slice(1, -1)}</code>;
    if (p.startsWith("**")) return <strong key={`${k}${i}`}>{p.slice(2, -2)}</strong>;
    const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p);
    if (m) return <a key={`${k}${i}`} href={m[2]} className="underline">{m[1]}</a>;
    return p;
  });
}

function bloques(md: string): ReactNode[] {
  const lineas = md.split("\n"); const out: ReactNode[] = []; let i = 0; let n = 0;
  while (i < lineas.length) {
    const l = lineas[i] ?? "";
    if (l.startsWith("```")) {
      const cod: string[] = []; i++;
      while (i < lineas.length && !(lineas[i] ?? "").startsWith("```")) cod.push(lineas[i++] ?? "");
      i++;
      out.push(<pre key={n++} className="overflow-x-auto rounded-lg bg-tinta p-3 text-xs text-crema"><code>{cod.join("\n")}</code></pre>);
    } else if (/^#{1,3} /.test(l)) {
      const nivel = (/^#+/.exec(l)?.[0].length ?? 1); const txt = l.replace(/^#+ /, "");
      const cls = nivel === 1 ? "text-3xl" : nivel === 2 ? "mt-6 text-2xl" : "mt-4 text-xl";
      out.push(<div key={n++} role="heading" aria-level={nivel} className={`font-pizarron font-bold text-corteza ${cls}`}>{enLinea(txt, `h${n}`)}</div>); i++;
    } else if (/^\s*([-*]|\d+\.) /.test(l)) {
      const ord = /^\s*\d+\. /.test(l); const items: ReactNode[] = [];
      while (i < lineas.length && /^\s*([-*]|\d+\.) /.test(lineas[i] ?? "")) {
        const sub = /^\s{2,}/.test(lineas[i] ?? "");
        items.push(<li key={i} className={sub ? "ml-5" : ""}>{enLinea((lineas[i] ?? "").replace(/^\s*([-*]|\d+\.) /, ""), `l${i}`)}</li>); i++;
      }
      out.push(ord ? <ol key={n++} className="list-decimal space-y-1 pl-6">{items}</ol> : <ul key={n++} className="list-disc space-y-1 pl-6">{items}</ul>);
    } else if (l.startsWith("> ")) {
      const q: string[] = [];
      while (i < lineas.length && (lineas[i] ?? "").startsWith("> ")) q.push((lineas[i++] ?? "").slice(2));
      out.push(<blockquote key={n++} className="rounded-lg border-l-4 border-corteza bg-masa p-3 text-sm">{enLinea(q.join(" "), `q${n}`)}</blockquote>);
    } else if (l.trim() === "") { i++; }
    else {
      const p: string[] = [];
      while (i < lineas.length && (lineas[i] ?? "").trim() !== "" && !/^(```|#{1,3} |> |\s*([-*]|\d+\.) )/.test(lineas[i] ?? "")) p.push(lineas[i++] ?? "");
      out.push(<p key={n++}>{enLinea(p.join(" "), `p${n}`)}</p>);
    }
  }
  return out;
}

export function Docs({ onVolver }: { onVolver: () => void }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-3 bg-crema px-4 py-6 text-tinta">
      <Boton variante="suave" onClick={onVolver}>← Volver</Boton>
      <article className="space-y-3 text-base leading-relaxed">{bloques(readme)}</article>
    </main>
  );
}
