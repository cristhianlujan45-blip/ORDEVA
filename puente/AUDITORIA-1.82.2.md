# ORDEVA 1.82.2 · Auditoría y mejoras

**Pedido del dueño:** «vuelve a hacer una auditoría, mira qué hay para mejorar y haz mejoras».

## 1. Error encontrado y arreglado

### 🔴 Dos equipos cerrando la caja a la vez dejaban DOS cierres con todas las ventas
- **Qué pasaba:** si el celular y el computador cerraban la caja casi al mismo tiempo, cada uno hacía su cierre con TODAS
  las ventas del día. Los dos quedaban con el mismo número Z, y lo vendido salía al doble en los cierres, el Excel de
  cierres y los informes ($48.000 en vez de $24.000 en la prueba).
- **Arreglo** (`app/04g-productos-historial-caja.js`, `juntarCierresRepetidos`): dos cierres que empiezan en el mismo punto
  (el mismo cierre anterior y la misma caja) son el mismo cierre, hecho dos veces. Se juntan en uno:
  - con los totales recalculados de las ventas de los dos equipos;
  - con el número Z más bajo;
  - con el arqueo que sí se contó;
  - con los dos que cerraron («ana y luis»).

  Se hace al abrir ORDEVA y cada vez que llegan datos de otro equipo. Sale igual en los dos, así que no pelean al
  sincronizar.
- **Con «varias cajas»:** cada caja sigue con su cierre aparte, porque la caja es parte del punto de partida.
- **Prueba nueva `doscierres`:** con la versión anterior falla 3 (dos cierres Z 1 de $24.000 cada uno). Ahora queda un
  solo cierre con las 6 ventas en los dos equipos, y el siguiente cierre trae solo la venta nueva.

## 2. Mejoras
### 🖨️ La comanda sale sola con los pedidos del QR y de los meseros
- **Antes:** la comanda impresa solo salía al tocar «🍳 Enviar a cocina».
- **Ahora:** con «🍳 Comanda impresa» prendida, sale solo, en la cocina y en la barra:
  - **un pedido del QR,** que dice «QR» en el papel;
  - **un pedido de la app de meseros,** con el nombre del mesero («Mesero Juan»).
- **Sin repetidos:** sale solo en el equipo que pone el pedido en la cuenta. «Enviar a cocina» tampoco lo vuelve a
  mandar, porque ya está en preparación.
- **Prueba:** `comandaimpresa` tiene 2 revisiones nuevas (14 en total).

### 🤖 Las pruebas de los avisos de pago de Android corren también en GitHub
- **Antes:** la lectura completa de los avisos y SMS de Android (`EscuchaPrueba`) y los pagos entre equipos
  (`CrucePrueba`) solo corrían en el equipo del desarrollador. Por eso nadie notó que desde la 1.72.6 ni compilaban.
- **Ahora:**
  - `pruebas-app.yml` baja la librería de Android 14 (Robolectric `android-all`), revisa su huella SHA1 y la guarda en
    caché;
  - las pruebas también corren cuando cambia el código de Android (`android/app/src/main/java/**`).

## 3. Pruebas
RESULTADOS_AQUI

## 4. Lo que queda por mejorar
1. **Factura electrónica DIAN con INC** para restaurantes: hoy sale con IVA. Hay que cambiarlo en el servidor de
   facturación y probarlo con el proveedor.
2. **Estado de resultados del mes en Excel para el contador.**
3. **Comisiones de Booking y Airbnb** en la ganancia de cada reserva.
4. **Domicilios con estados** (recibido → en camino → entregado) y aviso por WhatsApp.
5. **Hoteles:** tarifas por temporada; IVA exento para extranjeros y FONTUR.
6. **Tiendas:**
   - stock bajo en la caja, con «pedir al proveedor»;
   - productos por vencer en el inicio.
7. **Primera carga más rápida en 4G.**
8. **Pruebas con equipos de verdad:** celulares, lectores, impresoras y TVs.
