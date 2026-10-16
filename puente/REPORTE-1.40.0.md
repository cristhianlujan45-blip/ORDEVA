# Vento 1.40.0 — Licencias únicas y un negocio por cuenta, plan gratis al vencer, soporte con fotos, conexión siempre viva y revisión de seguridad

## 1. Licencias y suscripciones: varios equipos sí, otro negocio no
- **La suscripción o licencia sirve en TODOS los equipos del negocio a la vez** (computador, tablet, celular…).
- **Una licencia = un cliente y un negocio:** un solo uso y máximo un correo. Las licencias viejas con varios usos
  quedaron con los usos que ya tuvieron.
- **No se puede tener otro negocio u otra sede con la misma cuenta:**
  - el servidor no deja crear un segundo negocio a una cuenta que ya es dueña de uno;
  - no deja pasar un negocio a una cuenta que ya tiene el suyo;
  - la licencia vigente de un correo no se activa en otro negocio;
  - en la app, «Agregar sede» con cuenta de Vento dice que otra sede necesita otra cuenta con su propia suscripción.
  Las cuentas que ya tenían varios negocios los conservan.

## 1b. Tipo de negocio fijo (cambiarlo necesita permiso del administrador) y tipos nuevos
- **Al elegir el tipo** (registro y asistente): «⚠️ Elige bien: después, el tipo de negocio solo se puede cambiar con
  permiso del administrador de Vento».
- **Después,** en Ajustes o en el asistente, elegir otro tipo NO lo cambia: pide confirmación y manda una
  **solicitud** al administrador, que le llega con notificación. En **🎧 Soporte → 🏷️ Cambios de tipo de negocio**
  se aprueba o se rechaza (con motivo). Aprobada, la app del negocio cambia sola en todos sus equipos; rechazada, le
  avisa el motivo. Los negocios que ya tenían su tipo también quedaron fijos. El equipo del proveedor lo cambia siempre.
- **Ropa, sin tipos repetidos y con barra opcional** (hay tiendas que venden tragos o hacen eventos):
  - **👕 Tienda de ropa / Boutique** (ropa nueva): tallas, colores y marca. Ahora trae la música de los clientes
    prendida, y en el asistente se puede elegir «Las dos» (caja y mesas) para tener barra.
  - **🧥 Segunda Vuelta · Ropa de segunda** (nuevo): paca, americana o vintage, cada prenda con talla, estado y
    marca. Arranca con caja y mesas (barra) y música; su carta de ejemplo trae prendas y tragos.
  Si algún negocio quedó con el tipo duplicado de una prueba anterior, pasa solo a la Boutique.
- Migración `20261023000000_cambio_tipo_negocio` y rutas `/tipo-pedir`, `/admin/tipos`, `/admin/tipo_resolver`.

## 1c. Equipo: empleados según el negocio, permisos del dueño, segundo administrador y actividad
- **Rol «empleado»** además de mesero y cajero. Se llama según el negocio: en una tienda de ropa «Asesor de ventas»,
  en un consultorio «Médico», en una barbería «Barbero», en un salón «Estilista», en un taller «Mecánico», etc.
- **El equipo (empleado, cajero, mesero) no ve lo del negocio:** estadísticas, contabilidad, historial, productos,
  inventario ni ajustes. Vende y atiende. El dueño (o el segundo administrador) decide qué más puede hacer cada rol
  en **Ajustes → Negocio → 👥 Permisos del equipo**, y le llega al instante a sus celulares.
- **Ventas del día para el equipo:** en el Historial el empleado ve solo las ventas de HOY (para revisar si se
  equivocó), sin totales, gráficas, cierres de caja ni lo de la semana. El historial completo es un permiso aparte.
- **Corregir, liberar o borrar una venta** (botones en cada venta del Historial): el dueño y el administrador lo hacen
  directo; el equipo solo con la **🔑 clave de autorización** que el dueño pone en «Permisos del equipo» y que se
  escribe en el celular del empleado en ese momento (se guarda cifrada; 5 claves malas = 5 minutos de espera).
  Corregir cambia cantidades o el medio de pago (total e inventario se ajustan); liberar devuelve la venta a su
  mesa para cobrarla bien; borrar la saca y devuelve lo vendido al inventario. Todo queda en la actividad, con
  «autorizado con la clave del dueño».
- **Segundo administrador:** solo lo nombra el dueño. Maneja el negocio, pero no puede nombrar a otro administrador.
- **📜 Actividad del equipo** (Ajustes → Negocio, SOLO el dueño): cada venta, venta borrada o cambiada, producto
  creado o borrado, cambio de precio, costo, nombre o inventario, lo que se pide o se quita de una cuenta, permisos,
  reinicios… de cada persona, con su cuenta, su rol y la hora, filtrable por persona. Queda en el servidor: nadie la
  puede cambiar ni borrar, y el segundo administrador no la puede ver (ni tapar lo suyo). Sin internet queda en cola.
- Migración `20261024000000_equipo_actividad` (rol empleado, `actividad_registrar`, `actividad_ver`).

## 1d. Sin «nube» para los clientes
- Al crear la cuenta de Vento (correo y contraseña) los datos ya se guardan solos en la cuenta y se ven en todos los
  celulares: ya no hay «Vento Nube» aparte. La entrada tiene «👥 Me invitaron a un negocio (tengo un código)» y
  Ajustes tiene **👥 Mi cuenta y mi equipo** (invitar, roles, quitar, cerrar sesión). Sincronizar, respaldos y la base
  de datos quedan solo para el administrador de Vento.

## 2. Plan vencido → modo gratis; cancelada → solo pagar
- **Vencida, pago rechazado, sin pagar o pago en revisión:** la app sigue en el plan **Gratis** con sus funciones
  limitadas (vender, mesas, inventario y gastos, según el plan Gratis del panel). Las PRO piden el plan.
- **Cancelada por el administrador:** bloqueada con «💳 Pagar para reactivar» y «🚪 Cerrar sesión» (para entrar con
  otra cuenta). En los avisos de plan vencido o sin aprobar también está «🚪 Cerrar sesión».
- **Activar desde Vento Admin llega en menos de 3 s:** por el canal en tiempo real (≈1 s) y, si ese canal se cayó, la
  app que espera la activación (cancelada o pago en revisión) pregunta cada 2 s.

## 3. Soporte con fotos y pantallazos, y avisos al administrador
- **En la app** (Ajustes → Guía y soporte): «📎 Agregar fotos o pantallazos» (hasta 3) al escribir y «📎 Foto» al
  responder. Se achican en el celular (JPEG, máx. 1600 px) y las sube el servidor a un almacenamiento **privado**.
- **En el panel (🎧 Soporte):** «🖼 Ver imagen» en cada mensaje, con un enlace firmado que vence en 10 minutos.
- **Avisos al instante:** cada mensaje o foto nueva llega al panel en tiempo real, con notificación:
  - en la **app Android de Administrador**, como notificación del celular, también bloqueado;
  - en el **navegador**, con 🔔 («Recibir notificaciones en este equipo»), por push aunque el panel esté cerrado.
  También avisa cada **pago nuevo para revisar**. Como mucho un aviso cada 20 s por caso.

## 4. Conexión siempre viva
- **Vento Admin (Android):** servicio en primer plano («Vento Admin conectado») con el procesador y el wifi
  despiertos. Despierta el panel cada 10 s, pide quitar el ahorro de batería y el tiempo real se reconecta solo.
- **Vento (Android):** ya tenía su servicio de fondo (pedidos, música y pagos con la pantalla bloqueada).
- **Mesero, pantalla de preparación y TV (navegador):** la pantalla no se apaga mientras están abiertas y, si el
  sistema las congela, al despertar se ponen al día al instante. Los mensajes se guardan 8 días, no se pierde nada.
- Un navegador web normal no puede seguir trabajando con el celular bloqueado. Para eso está la app Android:
  meseros y caja pueden usar Vento (APK) con su cuenta.

## 4b. Voz de los pagos con volumen parejo (app Android)
- **Qué pasaba:** al llegar un pago, la voz empezaba bajito y después subía. El refuerzo de volumen era un compresor
  (LoudnessEnhancer) que sube la ganancia de a poco, y la salida de audio (parlante o Bluetooth) tardaba en despertar.
- **Ahora:** la frase se graba y se toca con el volumen **parejo de principio a fin** (`AvisoPago.vozPareja`):
  - 0,4 s de silencio antes de hablar, para que la salida ya esté despierta en la primera palabra;
  - todas las frases al mismo nivel;
  - por encima de 100 %, una ganancia fija con tope suave (sin chasquidos), sin compresor.
  Así «Pago confirmado. 1.200 pesos…» suena igual de fuerte de la primera a la última palabra. Si el celular no
  puede grabar la frase, se dice normal con el mismo silencio de arranque.
- Prueba `pruebas/java/AvisoPagoPrueba` (90): misma ganancia en toda la frase, silencio inicial, 100 % al mismo
  nivel, 150 % más fuerte sin pasarse del tope.

## 5. Vento Admin se actualiza solo
- Revisa `version.txt` al abrir, cada 2 minutos y al volver. Con versión nueva: si está libre se recarga sin caché;
  si estás escribiendo, muestra «🔄 Actualizar ahora». Sin bucles.

## 6. Revisión de seguridad
- **Base de datos:**
  - las tablas del negocio no aceptan escrituras directas de nadie de afuera, y sin cuenta no se pueden ni leer;
  - `admin_correos` con RLS;
  - las funciones del servidor no se pueden llamar desde la app, y todas las privilegiadas fijan su `search_path`.
- **Administrador amarrado a su cuenta:** como las cuentas se confirman solas (sin correo SMTP), cualquiera podía crear
  una cuenta con un correo de administrador no registrado y entrar al panel. Ahora la primera vez que el administrador
  entra, su cuenta queda amarrada; otra cuenta con ese correo, aunque la borren y la vuelvan a crear, no entra.
- **Topes globales contra abuso sin cuenta:**
  - canales en vivo: 6.000 mensajes por minuto en todo Vento;
  - soporte sin cuenta: 300 casos y 300 imágenes por hora;
  - equipos nuevos sin cuenta: 500 por hora.
- **CORS de producción:** solo el sitio de Vento; se quitó `localhost`.
- **Ataque real por el QR:** HTML/JS malicioso en pedidos, canciones, domicilios y «pide la cuenta» no se ejecuta ni en
  la app del negocio ni en la pantalla de preparación (prueba `seguridadqr`).
- **Pendiente (recomendado):** el puente de la app Android (`VentoAndroid`) también lo pueden usar los iframes de la
  página, como el reproductor de YouTube. Cerrarlo bien requiere pasar a `WebViewCompat.addWebMessageListener`
  restringido al sitio de Vento. Es un cambio grande, no se hizo a la carrera.

## Servidor y migraciones
- `20261018000000_suscripciones_tiempo_real` (ya aplicada), `20261019000000_suscripciones_reactivar` (ya aplicada),
  `20261020000000_licencias_un_negocio`, `20261021000000_soporte_fotos_avisos`, `20261022000000_seguridad`,
  `20261023000000_cambio_tipo_negocio`, `20261024000000_equipo_actividad`.
- Rutas nuevas: `/soporte-adjunto`, `/soporte-avisar`, `/admin/soporte_imagen`, `/admin/push_guardar`, `/admin/push_clave`.

## Pruebas
- `equipoactividad` 32 (nueva), `servidor/admin` 130, `servidor/suscripciones` 154, `adminsubreal` 35, `adminreal` 44, `cuentacliente` 35,
  `puertaytiemporeal` 34, `adminversion` 7, `seguridadqr` 6 (nueva) y el resto de la suite.
