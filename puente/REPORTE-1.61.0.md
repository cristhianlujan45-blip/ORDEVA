# ORDEVA 1.61.0 · Abre al instante · Archivo principal partido · Cerrar sesión en todos los equipos · Resumen diario de errores

## 1. ⚡ Abre al instante (y sin internet no sale la página de error)
**Antes:**
- Cada vez que se abría ORDEVA se bajaban otra vez los archivos de la app, unos 3 MB.
- Sin internet salía la página de error del navegador.

**Ahora** ORDEVA queda guardada en el equipo (`sw.js`):
- **La página siempre se pide primero a internet.** Con internet, siempre abre la versión de hoy: nadie se queda con
  una vieja. Si internet no responde en 3,5 segundos o no hay, abre la última copia.
- **Los archivos de la app llevan su versión en la dirección** (`app/…js?v=1.61.0`, y ahora también los de `lib/` y
  `nube/`).
  - Salen del equipo al instante: cada vez que abre solo se pide la página (391 KB) en vez de los ~3 MB.
  - Una versión nueva trae otra dirección: nunca se mezclan archivos viejos con nuevos.
  - Al guardar la versión nueva, la vieja se borra.
- **No se guarda:** `version.txt` (el aviso «Hay una versión nueva» sigue igual) ni nada del servidor de ORDEVA, Google o
  los CDN.
- **Sin internet se respeta tu regla de «siempre conectada»:** abre la app, pero con «📡 Sin conexión con ORDEVA»
  pasados 60 s, y vuelve sola al reconectar. Esa regla no la cambié.
- **Funciona igual en Android, iPhone (agregada a la pantalla de inicio), Windows y Mac:** los programas abren la
  misma página web.

**Prueba nueva `abririnstante` (11/11, navegador de verdad):**
- se guarda la primera vez;
- los archivos salen del equipo;
- con internet la página es siempre la de internet, también cuando cambia;
- sin internet abre la última copia, se puede entrar y usar;
- la versión nueva reemplaza la vieja;
- `version.txt` nunca se guarda.

## 2. 🧩 El archivo principal, partido en 8
`app/04-principal.js` (970 KB, 15.200 líneas) quedó en 8 archivos de 76 a 152 KB, por secciones:

| Archivo | Qué tiene |
|---|---|
| `04a-inicio-cuentas-clientes.js` | fondo, sonidos, confirmaciones, cuentas por persona, clientes frecuentes, atención |
| `04b-mesas-voz-cocina.js` | cambiar de mesa, «Hola ORDEVA», menú, cocina, mesas y mapa del local |
| `04c-personas-voz-ia.js` | cuenta aparte por persona, productos por voz y por foto con IA |
| `04d-combos-estadisticas-carta.js` | combos, idiomas, estadísticas, Excel, carta, escanear facturas |
| `04e-facturas-mostrador-domicilios.js` | factura por foto, precio y margen, venta de mostrador, domicilios |
| `04f-pedidos-escritos-categorias.js` | pedidos por WhatsApp/web con IA, categorías, comandos |
| `04g-productos-historial-caja.js` | productos, etiquetas, escáner, historial, cierre de caja |
| `04h-comprobantes-acceso-negocio.js` | comprobantes, colores, entrar y usuarios, palabras de cada negocio, tutorial |

**Sin cambiar lo que hace:**
- Las 8 partes juntas tienen exactamente las mismas 1.234 sentencias del original. Lo comprobé con el analizador de
  JavaScript (acorn).
- Se cargan en el mismo lugar y orden.

**El cuidado con los cortes:**
- En un solo archivo, una función existe desde que el archivo empieza; al partirlo, una parte no ve las funciones de
  las que todavía no cargaron.
- `puente/partir-archivo.js` revisa lo que corre al abrir la app: también promesas y temporizadores cortos, que
  alcanzan a correr entre un archivo y otro. Solo corta donde nada usa algo de más abajo.
- Para poder cortar, 4 funciones de vocabulario y módulos (`vocabTexto`, `vocabCambiar`, `modsNegocio`,
  `prepNombreDefecto`) pasaron al principio de la primera parte. Hacen exactamente lo mismo: una función ya existía
  desde que abre el archivo, esté arriba o abajo.

**Para qué sirve:**
- Cada cosa queda en su lugar: los arreglos son más seguros y se revisan más fácil.
- Con lo de la sección 1, cada parte se guarda en el equipo por separado.

## 3. 🚪 Cerrar sesión en todos los equipos (sin cambiar la contraseña)
- **ORDEVA Admin → la cuenta → «🚪 Cerrar sesión en todos sus equipos»** (pide confirmar).
  - En cada equipo donde estaba adentro con esa cuenta, guarda todo y sale: «🚪 Se cerró la sesión… Tu contraseña es la
    misma: entra otra vez (con internet)».
  - Pasa al instante con internet, o apenas se conecte.
  - La de otro administrador no se cierra desde ahí.
- **En la app, para el cliente: Ajustes → Cuenta → «🚪 Cerrar sesión en mis otros equipos».** Es para cuando pierde o le
  roban un celular. Ese equipo sigue adentro.
- **En la ficha de la cuenta, cada equipo muestra quién lo usa** (👤 juan en Bar X), su versión y la última vez.
- **Igual que el cierre de 1.60.0 al cambiar la contraseña:** solo sale quien entró con esa cuenta. El celular de la barra
  donde entra juan sigue funcionando.

**Pruebas:**
- `cuentacliente` 57/57: el Admin la cierra → el celular sale → entra otra vez con la misma contraseña. Desde otro
  celular el cliente cierra los demás → el primero sale y el que lo pidió sigue adentro.
- `adminreal` 50/50: el botón del panel.
- `servidor/admin` 157/157: permisos.

## 4. 🐞 Resumen diario de errores en tu celular
- **Cada día desde las 8:00 a. m. (hora de Colombia)** te llega una notificación al celular donde activaste 🔔 en
  ORDEVA Admin → Soporte. Ejemplo: «🐞 ORDEVA: 3 errores nuevos y 1 que se repite (24 h)» y «1 pasa en varios negocios ·
  El más visto: «…» (4 equipos) · 12 sin resolver en total. Toca para verlos».
  - Lo dispara el repaso automático que ya corre cada 5 minutos dentro del servidor.
  - Llega UNA vez al día, aunque lleguen dos repasos juntos.
  - Sin errores en las últimas 24 horas no llega nada.
- **🐞 Errores → «📨 Resumen de hoy»:** lo muestra en el panel cuando quieras y lo manda ya a tus equipos con 🔔.
- **Solo lleva el error y en cuántos equipos y negocios pasó:** nunca ventas ni datos de clientes.

**Pruebas:**
- `servidor/errores` 37/37:
  - a las 7:30 a. m. todavía no, a las 8:05 sí;
  - ese día ya no otra vez, al día siguiente sí;
  - un cliente no lo puede pedir.
- `erroresreal` 31/31: el botón del panel.

## Base de datos (sin borrar nada)
- `20261112000000_cerrar_sesiones.sql`:
  - columna nueva `perfiles.sesiones_cerradas_en`;
  - `perfil_yo` y `perfil_guardar` (opción `cerrar_sesiones`);
  - `srv_cerrar_sesiones` (solo el servidor).
- `20261113000000_resumen_errores.sql`: `srv_resumen_errores` (solo el servidor).

## Lo que no se pudo probar aquí
- **La notificación llegando a un celular de verdad.** La prueba revisa el texto y que se mande una vez al día; el envío
  usa el mismo camino de las notificaciones de soporte y pagos, que ya funcionan.
- **El aviso en vivo de Supabase (Realtime)** para cerrar sesión: en las pruebas se simula. Si no llegara, el equipo lo
  revisa cada 3 minutos y al volver a la app.
