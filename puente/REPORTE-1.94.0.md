# ORDEVA 1.94.0 · ✈️ El agente para agencias de viajes

**Pedido del dueño:** «continúa» (después de la 1.93.0 y el reenvío de la dirección vieja).

**Por qué esto:** se revisó la lista de lo que faltaba.
- **Ya estaba hecho** casi todo lo de las auditorías:
  - el cierre repetido en dos equipos;
  - el Excel para el contador;
  - los platos más rentables;
  - la comanda del QR y de los meseros;
  - pagar desde el QR de la mesa;
  - las pruebas de Android en GitHub;
  - la factura DIAN con impuesto al consumo.
- **Lo que faltaba** para uno de los tipos de negocio del dueño: el agente de chat estaba apagado para las agencias de
  viajes.

## Qué hace
- **Encenderlo:** Inicio → 🤖 Agente → «✈️ Recibir solicitudes de planes». Sale el mismo link de siempre para WhatsApp,
  Instagram o Google.
- **El cliente abre el link y toca «✈️ Ver planes»:**
  - de cada plan ve el destino, la salida, la duración, lo que incluye y el precio, por persona o «por 2 personas»;
  - ve también los cupos que quedan;
  - el plan sin cupos sale «Sin cupos» y no se puede pedir.
- **También escribiendo:** «quiero ir a Cartagena con mi esposa» → la IA entiende el plan y las personas.
  - Los precios y los cupos los pone el sistema, nunca la IA.
- **La solicitud:** el cliente pone las personas, su nombre, su celular y una nota.
  - Si pide más personas que cupos, no deja enviar.
  - Ve un valor aproximado y el aviso «el valor final, el abono y tu cupo los confirma la agencia».
- **A la agencia le llega** «✈️ 1 solicitud nueva del agente» arriba de las cuentas, en todos los equipos, con aviso y voz.
  - **📲 WhatsApp:** abre el chat con el cliente y un mensaje listo.
  - **✅ Crear la cuenta:** crea la cuenta del cliente («Ana · 3001112233») con el plan, los viajeros (el primero con su
    nombre) y la nota. Desde ahí siguen los abonos y el voucher de siempre.
  - **Descartar.**
- **Los cupos se apartan al crear la cuenta**, como cualquier cuenta abierta, y el agente ya muestra los que quedan.
- **El agente no confirma ni cobra:** la agencia decide.
- **Una solicitud que llega dos veces** (el mismo mensaje en otro equipo) queda una sola.

## Cómo está hecho
- `lib/vento-agencia.js`:
  - `paraCarta()`: los planes viajan con la carta en el campo `ag`;
  - `recibir()`, `crearCuenta()`, `descartar()`, `panel()` y el aviso `#spBarra`;
  - las solicitudes quedan en `data.solicitudesPlan`, con el id del mensaje del canal.
- `app/09-cuentas-mesa-modulo.js`:
  - la carta lleva `ag` y, si no cabe, se recorta igual que las opciones;
  - el canal entiende `PLAN: nombre | celular | plan | personas | fecha | nota`.
- `lib/vento-reservas.js`: el agente se puede usar en agencias, con la opción «✈️ Recibir solicitudes de planes»
  (`reglas.planes`).
- `agente.html`:
  - «✈️ Ver planes» y la tarjeta de la solicitud;
  - la IA conoce los planes y entiende la intención «plan».
- **Sin migraciones:** el servidor ya guardaba las reglas tal cual.

## Pruebas
- **Nuevas:**
  - `v194` (26): la app de la agencia con su cuenta en la nube y el agente de verdad, contra el servidor de pruebas. La IA
    se simula; la carta, los cupos y el canal son reales.
  - `reenvio` (9): ahora también corre en GitHub.
- **Resultados:**
  - lista completa: 118 pruebas, 2.647 revisiones, 0 fallas;
  - servidor: 29 de 29; las 60 migraciones se aplican sobre una base vacía;
  - Android (Java): 328 de 328.
- **No se probó con celulares ni con clientes de verdad.**

## Lo que queda
- **Hoteles:** IVA exento para extranjeros no residentes. Requiere revisar la norma con el contador antes de hacerlo.
- **Apartados (plan separe)** para tiendas de ropa.
- **Primera carga más rápida en 4G.**
- **Varias sedes de un mismo dueño.**
- **Pruebas con equipos de verdad.**
