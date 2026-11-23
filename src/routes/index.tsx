import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/components/inventario/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fuerza Madre — Inventario de mantenimiento" },
      { name: "description", content: "Qué equipos del obrador están al día, vencen pronto o están parados." },
    ],
  }),
  component: App,
});
