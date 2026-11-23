# Fuerza Madre — Inventario de mantenimiento

App interna para la panadería de masa madre **Fuerza Madre**: muestra qué equipos del obrador
(hornos, amasadoras, laminado y frío, pastelería, cafetería) están al día, vencen pronto,
tienen el service vencido o están parados.

> **Demo con datos sintéticos.** El acceso es local y **no verifica identidad**: la "clave del panel"
> y el selector de perfil son un aviso de buenas costumbres, no seguridad. Todo vive en `localStorage`
> de este navegador.

## Cómo ejecutarla

```bash
npm install
npm run dev      # servidor local
npm test         # pruebas del motor de reglas (reloj fijo)
npm run build
```

En Lovable alcanza con abrir la URL de previsualización. Clave inicial: **`madre2026`**.

## Cambiar la clave

Editá `CLAVE_PANEL` en `src/lib/inventario/config.ts`. Está escrita en el código del navegador,
así que cualquiera que abra las herramientas de desarrollo puede leerla.

## Datos sintéticos

- La primera vez que se abre (cuando **no existe** la clave `fuerza-madre:inventario` en `localStorage`)
  se siembran 9 equipos, 6 comandos (5 aplicados con revisiones consecutivas y 1 rechazado sin evento),
  2 propuestas (1 pendiente, 1 rechazada), 1 cierre y 1 ajuste no aplicado, con dos actores
  sintéticos (Ana y Bruno). Las fechas se calculan respecto del día de hoy.
- Para **empezar de cero**: borrá la clave `fuerza-madre:inventario` en las herramientas de desarrollo
  (Application → Local Storage) y recargá. La semilla se genera en `crearSemilla()` (`src/lib/inventario/store.ts`).
- Si lo guardado está dañado, la app **no resiembra ni pisa nada**: muestra el error y deja restaurar
  una copia válida.

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `src/lib/inventario/engine.ts` | Motor de reglas (sin React): estados, comandos, propuestas, conciliación, validación y migración v1→v2, CSV. |
| `src/lib/inventario/store.ts` | Semilla, persistencia en `localStorage`, ejecución de comandos. |
| `src/lib/inventario/useInventario.ts` | Hook de React: carga, envío de comandos y reintento con el mismo id. |
| `src/components/inventario/` | Pantallas: Entrada, Panel, Ficha, FormEquipo, Historial, Control. |
| `src/lib/inventario/inventario.test.ts` | Pruebas de los criterios de aceptación. |

## Reglas principales

- El estado sale **solo** de frecuencia + último service: más de 15 días restantes "Al día",
  de 15 a 1 "Service en 15 días", 0 o menos "Service vencido". Nunca se elige a mano.
- Un equipo fuera de servicio no suma contadores ni acepta "Registrar service".
- Una avería abierta bloquea el service aunque el vencimiento esté en orden; cerrarla lo habilita
  solo si no queda otro bloqueo.
- Cada acción es un comando con id: repetir el mismo id con los mismos datos no duplica el efecto;
  con datos distintos se rechaza sin escribir. Una revisión desactualizada conserva el estado y dice qué falló.
- Se persiste **antes** de mostrar éxito. Si `setItem` falla, el estado queda igual y el reintento usa el mismo id.
- Las propuestas no mueven nada hasta que un **Revisor distinto del creador** las aprueba.
  El **Auditor** solo consulta. Las restricciones están en el motor, no solo en los botones.
- Las correcciones crean un **ajuste vinculado**; los eventos originales no se reescriben.
