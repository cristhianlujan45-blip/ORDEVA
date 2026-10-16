# Vento 1.40.3 · Los códigos de error solo los ve el administrador

## Antes
La app le mostraba al cliente códigos de error («Algo falló (E-1K9Z)», «Error al guardar (E-…)») y el asistente le
decía «escribe a soporte con el código». El cliente tenía que copiarlo y mandarlo.

## Ahora
- **El cliente no ve ningún código.** Ve un mensaje sencillo («Algo falló · Toca y lo arreglo», «El detalle ya le llegó
  a Vento»). El asistente explica qué pasó sin códigos ni palabras técnicas.
- **Cada error llega solo al administrador** (Vento Admin → 🐞 Errores) con su código E-XXXX, también los que la app
  registra por su cuenta, como guardar o imprimir. Se puede buscar por código.
- **Cada reporte de soporte lleva pegado el diagnóstico del equipo**, sin que el cliente lo vea. Incluye:
  - los últimos errores con su código, qué pasó, dónde, cuántas veces y cuándo;
  - la versión, si es la app o la web, la pantalla y el celular.
- En **Vento Admin → Soporte**, cada caso muestra «🐞 Diagnóstico del equipo · solo tú lo ves», con el botón
  «📋 Copiar diagnóstico».
- Cuando el cliente vuelve a escribir en el caso, el diagnóstico se pone al día.
- Nunca van ventas, productos, clientes ni contraseñas.
- Migración `20261026000000_soporte_diagnostico`:
  - columna `soporte_casos.diagnostico`;
  - `soporte_crear` la guarda (máx. 12 KB);
  - `soporte_diagnostico` la actualiza con la clave del caso;
  - `soporte_caso_pub` la muestra solo al administrador.

## Pruebas
- `servidor/admin` 142: el cliente no recibe el diagnóstico, el administrador sí, no se cambia sin la clave, uno
  enorme no se guarda.
- `cuentacliente` 39:
  - el código del error va en el reporte y en 🐞 Errores;
  - el cliente nunca lo ve en pantalla.
- `appoweb`, `erroresreal`, `facturascan`, `adminreal`, `adminsubreal` y `adminversion` en verde.
