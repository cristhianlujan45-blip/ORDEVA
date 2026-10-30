# ORDEVA 1.67 · Auditoría integral, plan por fases y primer avance

Auditoría hecha sobre el repositorio real (rama de producción `claude/precio-margen-productos-tabla-mioclt`, versión
**v1.66.6** al empezar; esta entrega es la **v1.67.0**). Cada estado sale del código y de las pruebas, no de documentos
viejos.

**Leyenda de estados**

| Marca | Significado |
|---|---|
| ✅ | Implementada y con prueba automática |
| 🟡 | Parcial |
| ⚠️ | Existe, pero con errores |
| 🎨 | Solo interfaz |
| ❌ | No existe |
| ❔ | No se pudo verificar |

---

## 1. Estado inicial y arquitectura encontrada

| Pieza | Qué es (verificado) |
|---|---|
| **App web (PWA)** | `index.html` (5.473 líneas) + 31 módulos en `app/` (~28.700 líneas) + 26 en `lib/` (~7.000). JavaScript sin framework. Service worker (`sw.js`) para abrir sin internet. |
| **Datos del negocio** | Un documento JSON por negocio (`data`): en el equipo (localStorage + IndexedDB) y en Supabase (`guardar_datos` con versión y fusión de 3 vías, `nube/vento-nube.js`). |
| **Tablas relacionales** | 56 tablas en 49 migraciones. RLS activado en las 56. 245 funciones `security definer`. Hay tablas que se llenan solas desde el documento (fase A, 1.52). |
| **Servidor** | Supabase (PostgreSQL 16, Auth, Realtime, Storage) + 3 Edge Functions: `vento-pagos` (Nequi, DaviPlata, Wompi, DIAN, push), `vento-suscripciones` y `vento-ia`. |
| **Android** | WebView nativa (`android/`, Java): lee avisos de pago del banco, voz, impresora, balanza, cajón y actualización sola. Carga la misma página web. |
| **Escritorio** | Electron (`pc/`), con `electron-updater`. Carga la misma página. |
| **Otras páginas** | `admin.html` (ORDEVA Admin: licencias y suscripciones), `mesero.html`, `pedido.html` (QR del cliente), `preparacion.html` (cocina), `tv.html`, `lector.html`. |
| **IA (Laya)** | Gemini y Claude con la llave del negocio cifrada en el servidor (D6) y límites en el servidor. |
| **Pruebas** | 119 pruebas de navegador (Playwright) y 22 de servidor (PostgreSQL real). Java para los avisos de Android. CI en `.github/workflows/pruebas-app.yml`, con una lista crítica. |

**Conservación:** no hace falta reemplazar ninguna tecnología. La arquitectura (documento por negocio + tablas
relacionales que se llenan solas + RLS) sirve, y la transición a registros relacionales debe seguir siendo gradual
(punto 15).

## 2. Funciones verificadas por área

### Ventas y punto de venta

| Función | Estado | Detalle |
|---|---|---|
| Búsqueda por nombre y código | ✅ | `lib/vento-pos.js` |
| Lector de código de barras (teclado y cámara) | ✅ | `cajapos`, `escanear`, `lectorcel` |
| Celular como lector | ✅ | `lectorcel` |
| Categorías y favoritos | ✅ | |
| Cantidades, quitar, vaciar con «Deshacer» | ✅ | |
| Doble toque en COBRAR | ✅ | Bloqueado: `quietoHasta` y un solo cobro abierto |
| Venta por peso (balanza) | ✅ | `equipos` |
| Pago mixto | ✅ | |
| QR de pago | ✅ | `cajaqr` |
| Fiado | ✅ | |
| Factura DIAN | ✅ | `dian` |
| Devoluciones | ✅ | `lib/vento-inventario.js` |
| Descuento en la caja | ❌ | No existe en la Caja (sí en otras partes de la app) |
| Notas por venta | ❌ | |
| Suspender y recuperar ventas | ❌ | |
| Repetir pedido | ❌ | |
| Anular con permiso | 🟡 | Corregir, liberar o borrar con la clave del dueño (`app/28`) |

### Cobro, efectivo y vueltas

| Función | Estado al empezar | Detalle |
|---|---|---|
| «¿Con cuánto paga?» en la Caja | ⚠️ | Estaba **plegado** dentro de un desplegable |
| Efectivo menor al total | ⚠️ | **Se registraba como venta pagada** |
| Recibido y vueltas en la venta | ❌ | No se guardaban: solo salían en el aviso |
| Cuentas (mesas): efectivo de más | ⚠️ | **Se anotaba todo lo recibido como pago** ($50.000 para $37.500), así que lo cobrado quedaba inflado |

**Todo esto se corrige en la 1.67.0** (ver la sección 9).

### Motor financiero

| Función | Estado | Detalle |
|---|---|---|
| Margen sobre el precio y recargo sobre el costo, por separado | ✅ | `cuentasProducto`, `app/04g` |
| Utilidad, plata invertida, ganancia potencial | ✅ | |
| IVA responsable / no responsable | ✅ | Con IVA por producto |
| Fórmula del margen en un solo sitio | ⚠️ | **Repetida en 7 lugares**: `04d` ×3, `04e` ×4, `04f`, `23`. Todas dan el mismo resultado, pero hay riesgo de que se separen |
| Precio sugerido (no perder / margen objetivo / comercial) | 🟡 | Solo en la revisión de facturas |
| IVA: excluidos, exentos, descontables y retenciones parametrizables | 🟡 | Hay IVA por producto y si el negocio es responsable. Lo demás no |

### Compras e inventario

| Función | Estado | Detalle |
|---|---|---|
| Facturas escaneadas (IA y sin internet) | ✅ | Con categorías solas y PDF (`facturascan`, `facturacategorias`, `facturapdf`) |
| Historial de costos por producto | ✅ | |
| Movimientos de inventario con quién y motivo | ✅ | `lib/vento-inventario.js` |
| Toma de inventario | ✅ | |
| Recetas que descuentan insumos | ✅ | `recetas` |
| Costo promedio ponderado | ❌ | Se usa el último costo |
| Lotes, vencimientos y traslados | ❌ | |
| Sucursales | ❌ | Por diseño hay un negocio por licencia (1.6x) |

### Facturas y OCR

| Función | Estado | Detalle |
|---|---|---|
| Reconocimiento (IA + Tesseract) | ✅ | |
| Pantalla de revisión antes de guardar | ✅ | |
| Conservar la imagen | ✅ | |
| Bordes, esquinas, perspectiva y enderezado | ❌ | No hay corrección de perspectiva (no existe en `lib/vento-ocr.js` ni en `app/04e`) |

### Gastos y caja

| Función | Estado | Detalle |
|---|---|---|
| Contabilidad: gastos y otros ingresos | ✅ | Categorías por tipo de negocio, recibos adjuntos y servicios públicos recurrentes |
| La factura escaneada no se cuenta dos veces | ✅ | `libreta` |
| Salidas de Nequi y DaviPlata por clasificar | ✅ | 1.66.5 |
| Clasificar gastos en directos, operativos, administrativos y financieros | ❌ | |
| Apertura con base, entradas y salidas | ✅ | `lib/vento-turno.js` |
| Arqueo con billetes y monedas | ✅ | |
| Clave para cerrar la caja | ✅ | |
| Historial de cierres | ✅ | |
| Vueltas en el cierre | ✅ | Desde la 1.67.0 el efectivo de la venta es lo aplicado; las vueltas no suman |

### Laya, clientes y suscripciones

| Área | Estado | Detalle |
|---|---|---|
| Laya | ✅ / 🟡 | Consulta ventas, productos, inventario y facturas. Hace acciones con confirmación. «Laya no inventa cifras». Faltan las preguntas financieras de margen por categoría y de gastos que subieron (🟡). |
| Clientes y fiados | ✅ | Libreta: fiados, abonos y proveedores (`libreta`, `cuentacliente`) |
| Fecha de vencimiento y recordatorio de deudas | ❌ | |
| Suscripciones | ✅ | Planes, comprobantes, aprobación en Admin, idempotencia y licencias por servidor (`adminsub`, `adminsubreal`, `suscripnube`, `flujocompleto`) |
| Pagos con Wompi | ❔ | Existe (`supabase/functions/vento-pagos/wompi.ts`). No se puede verificar sin llaves |

### Seguridad, sincronización y otros

| Área | Estado | Detalle |
|---|---|---|
| Aislamiento entre negocios | ✅ | RLS en las 56 tablas, pruebas negativas del servidor (`pruebas/servidor/*`) y canales firmados (`canalseguro`, `qrprivado`, `seguridadqr`) |
| Sincronización | ✅ | Versión, fusión, IndexedDB y destrabe por tiempo (1.65.10, `nubetrabada`) |
| Ventas sin internet | ✅ | Se sincronizan al volver |
| Sincronización incremental | ❌ | Se envía el documento completo en cada cambio |
| Dashboard | ✅ | Inicio ORDEVA 2.0 y Estadísticas con datos reales (`ordeva2`, `tablero`) |
| Inventario valorizado | 🟡 | |
| Filtro por categoría | ❌ | |
| Filtro por sucursal | ❌ | |
| Diseño | ✅ | Sistema ORDEVA 2.0 (`lib/ordeva2.css`): Inicio, Caja, Productos, Cuentas, Cocina, Estadísticas, Contabilidad, celular y Admin. Modo claro/oscuro con 14 apariencias que se guardan |
| Diseño de Compras, Clientes y Laya | 🟡 | Todavía con el estilo anterior |

## 3. Problemas encontrados

| # | Problema | Archivo | Gravedad | Estado |
|---|---|---|---|---|
| P1 | La venta en efectivo incompleta quedaba como pagada | `lib/vento-pos.js` | **Alta** (integridad financiera) | ✅ Corregido en 1.67.0 |
| P2 | En las cuentas, el efectivo de más se anotaba como cobrado | `app/04c-personas-voz-ia.js` | **Alta** | ✅ Corregido en 1.67.0 |
| P3 | «¿Con cuánto paga?» estaba escondido | `lib/vento-pos.js` | Media (operación) | ✅ Corregido en 1.67.0 |
| P4 | Lo recibido y las vueltas no quedaban en la venta | `app/04f`, `app/04a` | Media (trazabilidad) | ✅ Corregido en 1.67.0 |
| P5 | Fórmula del margen repetida en 7 sitios | `app/04d`, `04e`, `04f`, `23` | Baja | 🟡 Motor único creado; la ficha ya lo usa. Faltan las demás pantallas |
| P6 | Sin costo promedio ponderado: el último costo pisa al anterior | `app/04e` | Media | Pendiente (fase 5) |
| P7 | Sincronización del documento completo en cada cambio | `nube/vento-nube.js` | Media (rendimiento con negocios grandes) | Pendiente (fase 10) |
| P8 | `javaavisos`: la revisión del servicio de fondo y `Cruce.java` no compilan en la prueba | `pruebas/javaavisos.test.js` | Baja (solo la prueba) | Viene de antes (M1). Pendiente |
| P9 | `equiposprobar` falló una vez en GitHub sin el resultado final; aquí pasa siempre | | Baja | Ahora el registro de pruebas muestra la causa si se repite |

## 4. Riesgos de seguridad
- **Sin hallazgos nuevos.** Siguen vigentes las correcciones de las auditorías E4, E7 y D2:
  - RLS en todas las tablas;
  - canales firmados;
  - el equipo no reescribe precios ni permisos en el servidor;
  - la llave de IA está cifrada en el servidor;
  - `service_role` no aparece en el frontend.
- Los resultados de las pruebas negativas del servidor están en la sección 10.
- **Residuales:**
  - la firma del APK con la llave de siempre: la 2.0 F8 no está en producción porque necesita los secretos del dueño;
  - las pruebas de Wompi, DaviPlata y Nequi reales necesitan las llaves de producción.

## 5. Problemas financieros
P1, P2, P4 y P6, de la sección 3. Además, desde la 1.67.0 el cierre cuenta en efectivo solo lo aplicado a cada venta.
Las vueltas nunca suman como venta ni como gasto (comprobado en la prueba `vueltas`, partes 5 y 7).

## 6. Plan por fases (orden pedido)

| Fase | Qué | Estado |
|---|---|---|
| 1. Seguridad y estabilidad | Revisar RLS, funciones y canales con las pruebas negativas. Arreglar P8. Diagnóstico de P9 | 🟡 Sin hallazgos nuevos; P8 y P9 abiertos |
| 2. Motor financiero | Motor único (`lib/vento-finanzas.js`): margen, recargo, precio para no perder, para el margen objetivo y comercial. Llevarlo a facturas, Laya y estadísticas. Alertas de pérdida y de costo que sube | 🟡 Motor y ficha del producto hechos |
| 3. Diseño | Terminar ORDEVA 2.0 en Compras/Facturas, Clientes/Libreta, Laya y Ajustes | Pendiente |
| 4. Cobro y vueltas | Campo siempre visible, billetes, pago exacto, mixto, sin pago incompleto, guardar recibido y vueltas, cuentas | ✅ Hecho (1.67.0) |
| 5. Inventario y compras | Costo promedio ponderado (configurable), variación entre compras, comparación de proveedores, lotes y vencimientos | Pendiente |
| 6. Facturas y OCR | Detección de bordes y corrección de perspectiva antes del reconocimiento | Pendiente |
| 7. Caja y gastos | Tipos de gasto (directo / operativo / administrativo / financiero), comparación de períodos, vueltas en el arqueo | Pendiente |
| 8. Laya | Preguntas financieras con el motor (margen por categoría, gastos que subieron) | Pendiente |
| 9. Suscripciones | Conciliación y recuperación de pagos aprobados (revisar `vento-suscripciones`) | Pendiente |
| 10. Rendimiento | Sincronización incremental; paginación del historial | Pendiente |
| 11–12. Pruebas integrales y publicación | | Por versión |

Suspender y recuperar ventas, descuentos autorizados y notas en la Caja van en la fase 4b, después del motor
financiero.

## 7. Mejoras de diseño (en la 1.67.0)
- El cobro de la Caja ahora tiene el bloque **«¿CON CUÁNTO PAGA EL CLIENTE?»** siempre a la vista:
  - campo grande;
  - «Pago exacto», billetes de $2.000 a $100.000 que se suman, y ↺ para borrar;
  - el resultado en grande: «Cambio que debe devolver $X», «✅ PAGO EXACTO» o «Faltan $X».
- En las cuentas (mesas y por persona), al escribir con cuánto paga sale el cambio o lo que queda por pagar.
- En la ficha del producto, «💡 Precio sugerido» con el margen objetivo editable y el botón «Usar».

## 8. Mejoras de funcionamiento
Las de la sección 9. Enter en el campo de lo recibido cobra en efectivo.

## 9. Funciones nuevas o corregidas en la 1.67.0

| Función | Dónde |
|---|---|
| Cambio = efectivo recibido − total en efectivo. Las vueltas nunca salen de transferencias ni de tarjeta | `lib/vento-pos.js` (`cambio`) |
| Billetes rápidos de pesos colombianos; se pueden cambiar con `data.cajaBilletes` | `billetesCaja` |
| El efectivo incompleto no cobra: avisa cuánto falta y abre el pago mixto con lo recibido | `elegirPago` |
| La venta guarda `efectivoRecibido` y `vueltas`, y el pago en efectivo lleva `recibido` y `vueltas`. El ingreso sigue siendo lo aplicado | `qsRegistrarVenta` |
| Cuentas: el efectivo de más se anota por el saldo y se dice el cambio. Por transferencia de más pregunta. Al cerrar, el historial conserva recibido y vueltas | `pagoAjustarAlSaldo`, `closeTableToHistory` |
| Motor financiero único (`utilidad`, `margen`, `recargo`, `precioParaMargen`, `precioParaRecargo`, `redondeoComercial`, `separarIva`, `preciosSugeridos`). La ficha lo usa y muestra «Margen bruto (sobre el precio)» y «Recargo sobre el costo» | `lib/vento-finanzas.js` |
| Precios sugeridos con margen objetivo (`data.margenObjetivo`, 30 % si no hay). Nunca cambia un precio solo | Ficha del producto |

## 10. Pruebas
- **Nueva: `pruebas/vueltas.test.js` (25 ✅), en CI.** Cubre:
  - pago exacto, superior e inferior;
  - escribir a mano y billetes;
  - pago mixto con y sin vueltas;
  - que el pago incompleto no se registre;
  - que el cierre cuente solo lo aplicado;
  - cuentas con efectivo y con transferencia de más;
  - que el historial guarde lo recibido;
  - margen vs. recargo y precios sugeridos;
  - que «Usar» no cambie el precio guardado.
- Los resultados de la suite y del servidor de esta versión están en el mensaje de publicación (`REPORTE-1.67.0.md`).
### Resultados reales de esta versión (30-oct-2026)
- **Navegador (33 pruebas):** 32 pasaron completas a la primera.
  - `mesapersonas` falló 4 de 22 por un error de la 1.67.0: lo que una persona paga de más dejaba de cubrir a los
    demás. Se corrigió (las vueltas cuentan solo sobre el saldo de toda la mesa) y ahora da 22 ✅.
  - `safari` no corre en este equipo (0 de 0): no queda verificada.
  - Las 31 restantes:

    | Prueba | ✅ | Prueba | ✅ | Prueba | ✅ |
    |---|---|---|---|---|---|
    | vueltas | 25 | cajapos | 27 | cajaqr | 13 |
    | confirmapago | 61 | dian | 29 | equipos | 35 |
    | escanear | 13 | facil | 47 | facilpantallas | 28 |
    | herramientas | 28 | lectorcel | 24 | mejoras | 32 |
    | modos | 55 | divtest | 6 | practica | 25 |
    | cerrarcaja | 26 | apariencias | 16 | ordeva2 | 30 |
    | ordeva2pantallas | 17 | vistasencilla | 45 | codigoproducto | 22 |
    | facturascan | 33 | facturacategorias | 11 | salidas | 19 |
    | libreta | 24 | recetas | 21 | entrar | 35 |
    | iphone | 9 | erroresreal | 33 | tablero | 26 |

- **Servidor, PostgreSQL real (22 pruebas, 916 revisiones, 0 fallas):**

  | Prueba | ✅ | Prueba | ✅ | Prueba | ✅ |
  |---|---|---|---|---|---|
  | admin | 169 | aislamiento | 9 | avisos | 34 |
  | bloqueos | 18 | canallimite | 5 | canalprivado | 17 |
  | catalogo | 12 | daviplata | 102 | dian | 69 |
  | equiponoreescribe | 29 | errores | 37 | iaclave | 34 |
  | iacupo | 6 | nequiconecta | 16 | pagosprivados | 42 |
  | permisos | 19 | proyeccion | 66 | repasos | 20 |
  | respaldos | 15 | suscripciones | 154 | usuariosequipo | 25 |
  | wompi | 18 (simulado) | | | | |

- **Conclusión de la fase 1:** el aislamiento entre negocios y las pruebas negativas (otro negocio, empleado sin
  permiso, QR sin código) siguen bien. No hay hallazgos nuevos.
- **No probado aquí** (necesita equipos o llaves reales):
  - Wompi, Nequi y DaviPlata reales;
  - impresora y cajón físicos;
  - la app de escritorio Electron;
  - un celular Android real.

## 11. Archivos modificados en la 1.67.0
- `lib/vento-pos.js`
- `lib/vento-finanzas.js` (nuevo)
- `app/04a-inicio-cuentas-clientes.js`
- `app/04c-personas-voz-ia.js`
- `app/04f-pedidos-escritos-categorias.js`
- `app/04g-productos-historial-caja.js`
- `index.html`
- `pruebas/vueltas.test.js` (nuevo)
- `.github/workflows/pruebas-app.yml`
- `puente/`

**Migraciones:** ninguna. No se tocó la base de datos de producción.

## 12. Compatibilidad
- Los datos de antes siguen funcionando:
  - los pagos viejos no tienen `recibido`, y todo lo que lo usa es opcional;
  - el campo de lo recibido es opcional (vacío = pago exacto, como antes);
  - el pago mixto y el fiado siguen igual.
- Web, Android y escritorio cargan la misma página: el cambio les llega sin reinstalar.

## 13. Cómo probar
- **Una prueba:**

  ```
  PLAYWRIGHT_PATH=/ruta/playwright bash pruebas/correr.sh vueltas
  ```

- **Toda la lista de CI:** la del archivo `.github/workflows/pruebas-app.yml`.
- **En la app:**
  1. Caja → agregar un producto → COBRAR.
  2. Escribir o tocar billetes en «¿CON CUÁNTO PAGA EL CLIENTE?».
  3. Tocar Efectivo.

## 14. Riesgos residuales y pendientes
Los de las secciones 3 a 6 marcados como pendientes, en el orden de fases de arriba.
