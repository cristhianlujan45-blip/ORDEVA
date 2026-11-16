# ORDEVA 1.99.13 · Respaldos en la nube que no se pierden y que el administrador puede restaurar

**Pedido del dueño (16/11):** «no encuentro los datos de una cuenta… desaparecieron sus datos, el historial, todo de ventas».

## Lo que se revisó (sin tocar datos de nadie)
- Desde aquí no hay acceso a la base de producción: no se pudo ver cuál negocio ni cuándo pasó.
- Los cambios recientes del servidor (1.99.2, anuladas protegidas) **no pueden vaciar un negocio**: la columna de datos no
  acepta vacío y la protección del equipo solo devuelve lo que había. El filtro de ventas anuladas (1.99.1) solo quita
  ventas que tienen id y están anuladas.
- El servidor guarda un respaldo por hora de cada negocio, pero **solo los últimos 48 (≈ 2 días)**, y **la app no tenía
  ninguna pantalla para verlos ni restaurarlos** (la función existía pero nadie la llamaba).

## Qué cambia
1. **Respaldos que no se pierden** (`supabase/migrations/20261206000000_respaldos_diarios.sql`): el servidor ya no deja
   borrar el primer respaldo de cada día durante 60 días (≈ 108 copias por negocio como máximo). Si se borra el negocio
   entero, sus respaldos sí se van. Solo protege desde hoy: lo que ya se había borrado antes no vuelve.
2. **Panel del administrador → Negocios → (el negocio) → ☁️ Respaldos en la nube → Ver respaldos**: el estado de hoy y
   cada copia con cuántas ventas, productos, inventario, facturas y gastos tenía, y quién la guardó. Se resaltan las copias
   que tenían bastante más ventas o productos que la siguiente: ahí está lo que se perdió.
3. **↩️ Restaurar**: pide confirmar y escribir RESTAURAR. Lo de hoy queda primero como copia (se puede deshacer), queda en
   la auditoría del negocio y los celulares bajan los datos restaurados solos (comprobado en la revisión: un celular con
   cambios pendientes los mezcla sin borrar lo restaurado).
   Solo el administrador de ORDEVA (el servidor lo comprueba); el dueño ni el equipo pueden llamarlo.

## Revisión independiente (goldfish)
Sin bloqueantes ni mayores. Arreglado: si la auditoría falla, no se restaura. Notas que quedan:
- Ver respaldos puede tardar unos segundos en un negocio muy grande (hace el resumen de ~108 copias).
- Más espacio en la base (~2,25 veces lo de antes en respaldos).
- La protección que impide que un celular «vacío» suba encima de la nube mira las ventas, no los productos. Extenderla a
  productos podría devolver productos que el dueño borró a propósito (por ejemplo los de muestra): **se deja para decidir
  con el dueño**.

## Pruebas
- Nueva `pruebas/servidor/respaldosdiarios.test.js` 18/0 (70 días de respaldos, borrado del negocio, permisos, restaurar,
  otro negocio, auditoría, deshacer). `respaldos` 15/0 (ahora acepta 48 o 49: el primero del día se queda). Todas las del
  servidor sin fallas. `revisar-migraciones`: se puede desplegar.
- `adminsubreal` 42/0 con el panel real: ve una copia vieja de 7 ventas y 9 productos resaltada, la restaura (confirmar +
  RESTAURAR) y la base queda con esas ventas y productos; lo de antes queda como copia.

## No probado
La base de producción (no hay acceso desde aquí).
