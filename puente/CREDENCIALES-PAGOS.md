# Cómo tener credenciales oficiales de pagos (Nequi y DaviPlata confirmados por el servidor)

La app **ya trae las integraciones oficiales hechas** (`supabase/functions/vento-pagos`). Solo faltan las credenciales
del negocio. Se ingresan en la app: **Ajustes → 💜 Pagos → Conectar**. Se guardan **cifradas en el servidor** y
nunca en la página ni en el celular.

## ¿Qué cambia con credenciales?
| | Leer el aviso de Nequi en el celular (hoy) | Wompi o Nequi Conecta (con credenciales) |
|---|---|---|
| **Quién confirma** | La notificación de la app de Nequi en el celular del negocio | **El servidor de Wompi o de Nequi**, con firma o consulta oficial |
| **Para qué pagos** | Cualquier transferencia a su Nequi (número, llave, QR fijo, recarga desde Bancolombia) | Los cobros que **arma Vento**: link o QR de Wompi, cobro push al Nequi del cliente o QR dinámico de Nequi |
| **Con el celular bloqueado** | Depende de que Nequi mande su aviso a tiempo y de Android | **No depende del celular**: el servidor lo confirma y avisa a todos los equipos |
| **Costo** | Gratis | Comisión por transacción de la pasarela (ver la tarifa vigente en la página de cada una) |

**Las dos formas conviven.** La lectura del aviso **no se quita**: sigue siendo la que avisa las transferencias que
el cliente hace por su cuenta (a su número o llave). Con credenciales, los cobros que se hacen desde la mesa quedan
**confirmados por el servidor** en segundos, sin depender del celular.

## Opción 1 — Wompi (la más rápida: se hace en línea, sin esperar a un asesor)
Wompi es la pasarela de Bancolombia. Acepta **Nequi**, DaviPlata, tarjetas, PSE y botón Bancolombia.
1. Regístrese en **comercios.wompi.co**.
   - **«Independiente»** si recibe pagos con RUT o cédula.
   - **«Empresa»** si tiene NIT.
   - Le piden los datos personales o de la empresa, el RUT y una cuenta bancaria para los abonos.
2. En el Dashboard de Wompi copie las **cuatro llaves** de **Producción**:
   - llave pública `pub_prod_…`;
   - llave privada `prv_prod_…`;
   - secreto de eventos `prod_events_…`;
   - secreto de integridad `prod_integrity_…`.

   Para practicar sin plata real, use primero las de **Sandbox** (`pub_test_…`…).
3. En la app: **Ajustes → 💜 Pagos → Conectar → Wompi**. Pegue las cuatro llaves. La app las verifica con Wompi.
4. La app le muestra la **URL de eventos**. Péguela en el Dashboard de Wompi, en la sección de eventos.
   - Wompi avisa ahí cada pago aprobado o rechazado.
   - Si la URL no responde, Wompi reintenta 3 veces en 24 h, y además el servidor de Vento consulta solo los
     pendientes.
   - Va una URL para cada ambiente (Sandbox y Producción).

## Opción 2 — Nequi Conecta (la API directa de Nequi)
1. Pida el acceso a Nequi en **nequi.com.co/negocios**, en el formulario «Completa tus datos».
   - Elija «Recibir los pagos de mi Negocio».
   - En los medios para cobrar elija «Físico / tienda» y «App» o «Sistemas internos».
   - Nequi lo contacta. Es un proceso comercial con Nequi.
2. Nequi le entrega cuatro datos:
   - **Client ID**;
   - **Client Secret**;
   - **API Key**;
   - el **código de comercio**.

   Normalmente entregan primero los de **pruebas (sandbox)** y luego los de producción.
3. En la app: **Ajustes → 💜 Pagos → Conectar → Nequi Conecta**. Ingrese los cuatro datos y la app los verifica con
   Nequi.
4. Desde la cuenta de una mesa: **«💜 Cobrar Nequi»**.
   - **Push:** el cliente recibe la solicitud en su app Nequi.
   - **QR dinámico:** el cliente lo escanea.
   - En los dos casos, el servidor confirma con Nequi (estado «35» = pagado) y la mesa queda pagada sola.

## DaviPlata
- **Por Wompi** (método DaviPlata, con código OTP en la página de Wompi). Basta con la opción 1.
- **Por la API «Pago con DaviPlata»** de Davivienda (conectesunegocio.daviplata.com). Requiere un convenio con
  Davivienda y un certificado. La app ya la tiene: Ajustes → 💜 Pagos → Conectar → DaviPlata.

## Lo que no se puede
- **Ninguna API oficial avisa las transferencias que un cliente hace por su cuenta a un número o llave de Nequi
  personal.** Para esas sigue sirviendo la lectura del aviso de Nequi en el celular. Por eso se mantiene y se
  mejoró (1.55.4).
- **Ni Vento ni nadie puede conseguir las credenciales por el negocio:** las da Wompi o Nequi a nombre del titular,
  con su RUT o cédula.

Fuentes: documentación oficial de Wompi (docs.wompi.co → «Ambientes y llaves», «Eventos») y el formulario de Nequi
Negocios (nequi.com.co/negocios), revisados el 23 de octubre de 2026.
