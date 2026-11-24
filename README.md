# Fuerza Madre — Inventario de mantenimiento

App interna de la panadería de masa madre "Fuerza Madre": controla hornos, amasadoras y equipos del obrador, y muestra cuáles están al día, vencen pronto o están parados. Es una demo con datos sintéticos y acceso local, **sin verificación de identidad real**.

## Cómo ejecutar el proyecto

En Lovable no hace falta instalar nada: se usa la previsualización (o **Publish** para una dirección `.lovable.app`).

En un ordenador con Node.js:

```bash
npm install
npm run dev      # servidor local
npm test         # pruebas del motor de reglas
npm run build
```

Abrí la dirección que muestra la terminal.

Para entrar: clave del panel **madre2026** y un perfil (Operación, Revisor o Auditor). Es una clave de demostración, no es seguridad real.

- **Operación:** registra services, averías, fuera de servicio, altas, ediciones y bajas, y puede enviar propuestas.
- **Revisor:** aprueba o rechaza propuestas, pero no las que creó él mismo.
- **Auditor:** solo consulta.

## Cambiar la clave

La clave está en `src/lib/inventario/config.ts`, en la constante `CLAVE_PANEL`. Cambiá su valor, guardá y recargá la app. Está escrita en el código del navegador, así que cualquiera que abra las herramientas de desarrollo puede leerla.

## Reglas del dominio

- El estado sale solo de la frecuencia y el último service: más de 15 días restantes es "Al día", de 15 a 1 es "Service en 15 días", y 0 o menos es "Service vencido". Nunca se elige a mano.
- Un equipo fuera de servicio no suma a los contadores de estado ni acepta "Registrar service".
- La avería es independiente del vencimiento y también bloquea el service.
- Cada acción es un comando con id: repetirlo con los mismos datos no duplica el efecto, con datos distintos se rechaza sin escribir, y una revisión desactualizada se rechaza explicando qué falló.
- Las propuestas no cambian nada hasta que las aprueba un Revisor distinto del creador. Estas restricciones están en el motor (`src/lib/inventario/engine.ts`), no solo en los botones.
- Las correcciones crean un ajuste vinculado; los eventos originales no se reescriben.

## Recorrido: Mantenimiento con causas concurrentes

Caso: un equipo con el service vencido al que se le suman una avería y un fuera de servicio. El service solo se puede registrar cuando no queda ninguna causa de bloqueo. Se prueba con el **Horno de piso**, que viene con el service vencido en los datos de ejemplo.

1. Entrá con la clave y el perfil **Operación**.
2. En el Panel, buscá "Horno de piso": figura como **Service vencido**, con días restantes negativos. Su botón "Registrar service" está habilitado, porque estar vencido no bloquea.
3. Abrí la ficha y pulsá **Abrir avería**. El service queda deshabilitado y la ficha indica que hay una avería abierta. El estado sigue siendo "Service vencido".
4. Tildá **Fuera de servicio**, escribí un motivo y pulsá **Confirmar**. Ahora hay dos causas y la ficha las lista a las dos.
5. Pulsá **Cerrar avería**. El service sigue bloqueado por el fuera de servicio, y el historial de la ficha lo registra.
6. Destildá **Fuera de servicio**. Recién ahora "Registrar service" se habilita.
7. Pulsá **Registrar service**: el equipo pasa a **Al día** con su frecuencia completa de días restantes, y el contador "Service vencido" del Panel baja en 1.
8. Entrá en **Control**: la conciliación debe decir que todo concilia. En **Historial** están todos los movimientos con id de evento, id de comando, perfil, motivo y versión anterior y nueva.

Este mismo caso está automatizado en la prueba "Mantenimiento con causas concurrentes".

## Recorrido: persistencia

Los datos se guardan en el `localStorage` del navegador, en la clave `fuerza-madre:inventario`, como una instantánea versionada. Primero se guarda y recién después se muestra el éxito.

1. **Recarga:** registrá un service a cualquier equipo, recargá la página (F5) y comprobá que el cambio sigue ahí.
2. **Dos pestañas:** abrí la app en dos pestañas. En la primera registrá un service. En la segunda, sin recargar, probá otra acción: debe aparecer un aviso de revisión desactualizada y el estado no cambia.
3. **Fallo al guardar:** con la app abierta, pulsá F12, abrí **Console** y pegá la línea siguiente. Después hacé cualquier acción: el aviso dice que no se pudo guardar y el cambio no se aplica. Al recargar la página vuelve a funcionar.

   ```js
   Storage.prototype.setItem = () => { throw new Error("QuotaExceededError") }
   ```

4. **Copia inválida:** en **Control**, pegá en el cuadro de restaurar un JSON incompleto y pulsá **Validar antes de restaurar**. Debe aparecer "Copia rechazada", el botón **Restaurar** queda deshabilitado y los datos actuales no se tocan.
5. **Copia válida:** **Exportar JSON versionado** descarga una copia. Pegala en el cuadro, validá y pulsá **Restaurar**, que pide confirmación.

## Suite de pruebas

```bash
npm test
```

Ejecuta Vitest. Las pruebas del inventario están en `src/lib/inventario/inventario.test.ts` y usan un reloj fijo (`2026-06-15`), así que no dependen del día en que se corren. Cubren:

- Estado derivado con límites inclusivos (16, 15, 1, 0 y −1 días) y "Sin datos" cuando el denominador es 0.
- Los datos de ejemplo: 9 equipos, comandos aplicados con revisiones consecutivas, uno rechazado sin evento, y conciliación sin diferencias.
- Registrar service, fuera de servicio y avería.
- **Mantenimiento con causas concurrentes** (el recorrido de arriba).
- Alta y edición: nombre repetido, fecha futura, último service anterior a la compra.
- Idempotencia de comandos y revisión desactualizada.
- Persistencia: fallo de `setItem` con reintento del mismo id.
- Migración v1 a v2 y rechazo de copias inválidas (ids duplicados, referencias inexistentes, truncadas) sin restauración parcial ni resiembra.
- Propuestas y perfiles: el creador no aprueba la suya, el Auditor solo consulta, y los ajustes quedan vinculados sin reescribir el historial.
- Exportación: el CSV del filtro concilia con los eventos de origen.

## Datos sintéticos

Qué está simulado:

- **El acceso:** la clave está escrita en el código y los perfiles son usuarios de ejemplo. No hay verificación de identidad.
- **Los datos:** equipos, historial, propuestas, cierres y ajustes son de ejemplo, no reales.
- **El guardado:** es `localStorage`. No hay servidor ni base de datos, y los datos no se comparten entre navegadores ni dispositivos.

La primera vez que se abre la app, y solo si no existe la clave `fuerza-madre:inventario`, se siembran 9 equipos, 6 comandos (5 aplicados con revisiones consecutivas y 1 rechazado sin evento), 2 propuestas (1 pendiente y 1 rechazada), 1 cierre y 1 ajuste no aplicado. La definición está en `crearSemilla()` (`src/lib/inventario/store.ts`) y las fechas se calculan respecto del día en que se crean.

Para reiniciarlos, abrí la app, pulsá F12, entrá en **Console**, pegá esta línea y pulsá Enter:

```js
localStorage.removeItem("fuerza-madre:inventario"); location.reload();
```

También se pueden restaurar desde **Control → Restaurar copia** con un archivo exportado antes. Si lo guardado está dañado, la app no resiembra ni pisa nada: muestra el error y deja restaurar una copia válida.

## Estructura

| Archivo                                 | Qué hace                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/lib/inventario/engine.ts`          | Motor de reglas (sin React): estados, comandos, propuestas, conciliación, validación y migración v1→v2, CSV. |
| `src/lib/inventario/store.ts`           | Semilla, persistencia en `localStorage`, ejecución de comandos.                                              |
| `src/lib/inventario/useInventario.ts`   | Hook de React: carga, envío de comandos y reintento con el mismo id.                                         |
| `src/components/inventario/`            | Pantallas: Entrada, Panel, Ficha, FormEquipo, Historial, Control.                                            |
| `src/lib/inventario/inventario.test.ts` | Pruebas de los criterios de aceptación.                                                                      |
