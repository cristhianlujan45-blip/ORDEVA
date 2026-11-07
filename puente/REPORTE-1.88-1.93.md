# ORDEVA 1.88 a 1.93 · Igual en todos los celulares, modo demo, menús, dólares, menú del día, asistencia y bonos

**Pedidos del dueño:**
- «haz todo lo que falta»;
- «mira cómo mejoras el orden de los menús… hay celulares que le aumentan el zoom… que esa configuración no afecte
  ORDEVA… la de meseros, la de órdenes y la de administrador de cuentas, que también pueda dar el modo demo».

## 1.88 · 📱 Igual en todos los celulares, 🎬 modo demo y «Dar prueba»
- **La letra del celular:**
  - la app de Android ya no sigue el «tamaño de fuente» del celular (`WebView.setTextZoom(100)`);
  - en las páginas tampoco cambia: todas tienen `text-size-adjust: 100%`.
- **El zoom de pantalla del celular:**
  - dentro de la app de Android, ORDEVA pide el ancho que tendría con el tamaño normal (`lib/vento-igual.js` +
    `escalaPantalla()` en la app). Se ve igual que en cualquier otro celular: en la app principal, en la de meseros y en
    las demás páginas.
  - **Límite:** en el navegador, fuera de la app, el zoom de pantalla no se puede quitar.
  - Hace falta la APK nueva, que GitHub arma al publicar.
- **🎬 Links de demo en ORDEVA Admin:**
  - se elige el tipo de negocio y se copia, se manda por WhatsApp o se abre;
  - el link abre ORDEVA con un negocio de ejemplo: productos, mesas abiertas y ventas de la semana. Se puede vender y
    cobrar;
  - no se guarda nada en el equipo ni en ninguna cuenta: todo vive en la memoria de esa pestaña. La prueba revisa que
    los datos reales del equipo queden intactos.
- **🎬 «Dar prueba» en cada negocio de Suscripciones:**
  - da de 1 a 90 días con un plan completo, como la prueba gratis;
  - no pisa un plan pagado vigente;
  - en el servidor: migración `20261130000000_prueba_admin.sql` (solo agrega) y la ruta `/admin/prueba`.

## 1.89 · 🧭 Los menús en el orden en que se usan
- **Ajustes:** primero Negocio, Mi cuenta y mi equipo, Pedidos y caja, Pagos e Impresora. Luego los avisos, el modo
  fácil y cómo se ve y suena. Al final IA, Datos, Guía y Zona de riesgo. Antes empezaba por «ORDEVA IA» y «Modo fácil».
- **«Más»:** Inicio, Historial, Estadísticas, Contabilidad, Libreta, Pagos, Carta, Música…
- **Contabilidad** ahora tiene 💰; antes tenía el mismo ícono que Libreta.
- **Revisados sin cambios:**
  - la app de meseros: sin link solo explica cómo pedirlo;
  - la página de pedidos del cliente: está clara y ya trae «Letra grande».

## 1.90 · 💵 Cobrar en dólares (turistas)
- **Dónde:** Ajustes → Pagos → «Cobrar en dólares», con la tasa del día.
- **Al cobrar:**
  - sale el total en dólares (redondeado hacia arriba al medio dólar), con billetes de 1 a 100;
  - si no alcanza, no deja cobrar;
  - las vueltas salen en pesos.
- **Cómo queda la venta:** en pesos, con el pago «usd» (dólares, tasa y vueltas).
- **El arqueo y el cierre:**
  - restan las vueltas en pesos, porque salieron de la caja;
  - los dólares salen aparte en el cierre, el corte X y Caja de hoy.
- También funciona en la cuenta de una mesa.

## 1.91 · 🍲 Menú del día (restaurantes)
- **Dónde:** una tarjeta arriba de las mesas.
- **Qué se pone:** precio, porciones, sopa, principio, proteínas, bebida y postre. «Igual que el último» lo llena.
- **Dónde sale:** queda como el producto «🍲 Menú del día» en la caja, las mesas y la carta del QR, con lo que trae.
- **Proteínas:** se eligen como variantes.
- **Porciones:** se descuentan al vender y, al acabarse, sale «Agotado».
- **Al otro día** no se vende el de ayer: sus porciones quedan en 0.

## 1.92 · 🕒 Asistencia del personal
- **Dónde:** «Más → 🕒 Asistencia».
- **Para cada persona:** marca entrada y salida con un toque. No se deja marcar dos entradas seguidas.
- **El dueño:**
  - ve quién está trabajando;
  - ve las horas de hoy, la semana, la quincena o el mes, con los días;
  - puede marcar por alguien sin usuario;
  - puede copiar el resumen.
- **El registro:** cada marca queda con la hora y quién la hizo. Se sincroniza y no se borra.

## 1.93 · 🎁 Bonos y tarjetas de regalo
- **Dónde vive el saldo:** en el servidor. Migración `20261201000000_bonos.sql` (solo agrega dos tablas y sus funciones;
  sin acceso directo a las tablas).
- **Sin cobrar dos veces:**
  - dos cajas no gastan el mismo bono: se probó con 5 cajas a la vez;
  - una venta descuenta una sola vez aunque se toque dos veces.
- **Vender un bono:** en «Más → 🎁 Bonos de regalo», con código para entregar o mandar por WhatsApp. Si se paga en
  efectivo, entra a la caja como entrada. **No es venta** hasta que el cliente lo usa.
- **Al cobrar:** «🎁 Pagar con bono» paga todo o lo que alcance, y el resto se paga con otro medio.
- **Si se deshace la venta,** el saldo vuelve al bono.
- **Límites:**
  - necesita la cuenta en la nube e internet;
  - una devolución parcial (no deshacer toda la venta) no devuelve el saldo al bono: se devuelve el dinero como siempre.

## Pruebas
- **Nuevas:**
  - `v188` (12): zoom, demo y admin;
  - `v189` (7): menús;
  - `v190` (10): dólares;
  - `v191` (9): menú del día;
  - `v192` (7): asistencia;
  - `v193` (10): bonos de punta a punta contra el servidor de pruebas.
- **Del servidor:**
  - `bonos` (14);
  - `suscripciones` (160, +6 de «Dar prueba»).
- **Arreglo de pruebas:** `cocinatiempo` y `cajamas` ya no fallan entre las 12 y la 1 de la madrugada (la página arranca
  a mediodía).
- RESULTADOS_AQUI
- **No se probó con equipos de verdad** (celulares con zoom, impresoras ni la APK nueva).

## Lo que queda
- **El reenvío de la dirección vieja** (`…/cuentas/` → `…/ORDEVA/`). Necesita un repositorio aparte en GitHub; lo hago
  si el dueño lo autoriza.
- **Apartados (plan separe):** quedan para después; los negocios actuales casi no los usan.
- **Pruebas con equipos de verdad:** celulares, lectores e impresoras.
