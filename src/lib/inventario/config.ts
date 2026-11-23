import type { Actor, Perfil } from "./engine";

// Clave simple del panel. NO es seguridad real: vive en el código del navegador.
// Para cambiarla, editá esta constante (ver README).
export const CLAVE_PANEL = "madre2026";

// Clave propia de localStorage para la instantánea versionada.
export const STORAGE_KEY = "fuerza-madre:inventario";

export const AVISO_ACCESO =
  "Acceso local, sin verificación de identidad. Demo con datos sintéticos en este navegador";

// Actores sintéticos (uno por perfil). La semilla usa Ana y Bruno.
export const ACTORES: Record<Perfil, Actor> = {
  Operación: { id: "act-ana", nombre: "Ana (demo)", perfil: "Operación" },
  Revisor: { id: "act-bruno", nombre: "Bruno (demo)", perfil: "Revisor" },
  Auditor: { id: "act-carla", nombre: "Carla (demo)", perfil: "Auditor" },
};
export const PERFILES: Perfil[] = ["Operación", "Revisor", "Auditor"];
