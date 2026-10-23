# Vento 1.52.1 · Las ventas, los productos y el inventario ya quedan en tablas de verdad en el servidor

Es el primer paso de la arquitectura de datos («Fase A»), autorizado por el dueño: «si has todo».

## Qué cambia
- **Antes:** cada negocio era un solo documento grande en la nube.
- **Ahora:** el Servidor Vento lo copia solo a tablas ordenadas:
  - productos, categorías y costos;
  - ventas, con lo que se vendió, el precio de ese día y cómo se pagó;
  - movimientos de inventario;
  - cierres de caja.
- **Para qué sirve:**
  - reportes rápidos y exactos desde el servidor;
  - historial que no se pierde: el inventario que el celular recorta, aquí se queda;
  - cifras reales para Laya;
  - la base para lo que sigue: que cada venta se registre una sola vez aunque se mande dos veces.
- **Las apps no cambian nada.** Vento, Vento Admin y la página de pedidos guardan y sincronizan igual que antes.

## Seguridad
- **Cada quien ve solo lo de su negocio y según su rol:**
  - el mesero ve el catálogo, pero no ventas, pagos ni costos;
  - el cajero ve ventas y caja, pero no costos;
  - dueño y administrador ven todo.
- Nadie puede escribir directo en estas tablas: solo el servidor las llena.
- Ningún dato se borra: lo que se deshace en la app queda marcado como eliminado, con fecha.

## Sin riesgo para la operación
- El guardado de la app no se toca. El servidor copia solo los negocios que cambiaron, en tandas cortas, en cada
  repaso automático (GitHub lo corre cada 1 a 3 horas, aunque está pedido cada 10 minutos).
- Si un negocio tiene un dato raro, se anota y los demás siguen.
- **Seguro de espacio:** si la base de datos se acerca al límite del plan, la copia se detiene sola para que la app
  siga guardando.
- Para apagarlo basta con quitar una línea del servidor. Detalle técnico en `puente/ARQUITECTURA-DATOS-FASE-A.md`.

## Pruebas (PostgreSQL real)
- **Nueva, `proyeccion`:** 66 comprobaciones.
  - **Lo que se copia:** las tablas reflejan exactamente el documento, con precios y costos históricos, venta por peso,
    pago mixto y cuadre de ventas contra pagos.
  - **Sin duplicar ni perder:**
    - copiar dos veces no duplica;
    - corregir, deshacer y volver a tener una venta se refleja;
    - un producto borrado queda marcado.
  - **Permisos:** dueño, administrador, cajero, mesero, empleado, otro negocio y sin sesión.
  - **Fallas:** errores aislados, seguro de espacio y negocio de 8000 ventas por tandas (las restantes en 1,3 s; con
    cambios, 0,1 s).
- **Siguen pasando:**
  - pruebas del servidor: `admin` 142, `avisos` 27, `bloqueos` 18, `daviplata` 101, `dian` 69, `errores` 30 y
    `suscripciones` 154;
  - pruebas de la app con la nube: `sincroniza`, `cuentas`, `pagosequipos` y `flujocompleto` (este solo falló con la
    máquina cargada y solo pasa 87 de 87).
- `revisar-migraciones`: la migración nueva no borra datos y todas las tablas tienen RLS.
