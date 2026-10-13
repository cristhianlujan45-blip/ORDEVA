# Vento 1.31.0 — Cuentas con correo en todos los celulares, facturas más rápidas avisos de DaviPlata en el celular y YouTube sin límite de búsquedas

## Qué cambió

- **Cuentas con correo = una sola cuenta en todos los celulares.**
  - Antes, el correo de la pantalla de entrada se guardaba solo en ese celular. Otro celular podía crear otra cuenta con el
    mismo correo, y cada uno quedaba con datos distintos.
  - Ahora la cuenta vive en Vento Nube:
    - Un correo ya usado no deja crear otra cuenta. Con su contraseña, entra a la cuenta que ya existe.
    - En un celular nuevo: **«¿Ya tienes cuenta? Entra con tu correo»** → se bajan los mismos datos.
    - Lo que cambia un celular le llega a los otros.
    - Las cuentas viejas con correo que solo estaban en un celular se suben solas a la nube al entrar.
    - Si en un celular hay dos cuentas, cada una sincroniza solo con su propio negocio.
    - Cambiar la contraseña (Ajustes → Usuarios o «Olvidé mi contraseña» por correo) la cambia en todos los celulares.
  - Los usuarios sin correo (ej. «mesero1») siguen siendo de ese celular, como siempre.
- **Lectura de facturas más rápida.** Hoy Google tiene saturados los modelos «lite» de Gemini (responden 503). Antes la
  app reintentaba el mismo modelo con esperas: 20–30 s, o terminaba en «tardó demasiado».
  - Ahora salta de una vez a otro modelo y recuerda unos minutos cuál estaba saturado.
  - La factura se lee «en carrera»: si el modelo principal no responde en 3 s, arranca otro en paralelo y gana el primero.
  - Medido con la clave real: ~10 s el primer intento con Google saturado (antes 20–28 s o error); ~6 s los siguientes.
  - Si la IA agrega basura al final del JSON o lo corta en una factura larga, se leen igual los renglones completos.
  - Lo mismo aplica a todo lo que usa la IA (foto de producto, voz, asistente): ya no se queda esperando un modelo saturado.
- **Confirmaciones de DaviPlata en el celular.** Hay dos caminos, porque DaviPlata **no tiene webhook** para las
  transferencias normales a tu número:
  1. **Transferencia normal a tu número de DaviPlata o Nequi (sin convenio):**
     - La app Android de Vento lee ella misma el aviso «¡Recibiste plata!» de la app DaviPlata/Nequi de ese celular.
       Ya no hace falta MacroDroid.
     - Se activa en Ajustes → Negocio → Verificar pagos → **📲 Leer los avisos de ESTE celular**, más el permiso
       «Acceso a notificaciones» (el mismo que usa la música).
     - Solo toma avisos de plata RECIBIDA de apps de bancos y billeteras. Nunca toma códigos, claves, compras ni plata que
       sale, y de las demás apps nada.
     - El pago sale con voz en la mesa que debe ese valor, y por el Servidor Vento llega a los demás celulares del negocio.
  2. **Cobro con código («Pago con DaviPlata», API oficial):**
     - En la mesa: «🔐 DaviPlata con código» → al cliente le llega el código → «✅ Pago aprobado · N.º de aprobación».
     - Necesita el convenio con DaviPlata: credenciales, idComercio, idTerminal y certificado.
  - En los dos casos, cada pago que llega suena como **aviso del celular «💜 Llegó un pago»** en la app Android, aunque
    Vento esté cerrada o la pantalla apagada. En el navegador lo hace el push que ya existía.

- **Buscar canciones en YouTube sin límite.** YouTube decía «se alcanzó el límite» porque cada búsqueda desde el QR de las
  mesas gastaba 200 de las 10.000 unidades diarias de la API de YouTube (canciones + artistas). Con unas 50 búsquedas al
  día ya no aparecía nada, en todos los negocios.
  - Ahora el Servidor Vento lee la página pública de resultados de YouTube (`vento-ia/yt/buscar`), igual que la app Android:
    no tiene cupo. Además guarda en memoria las búsquedas repetidas y responde en ~0,5 s.
  - Lo usan el QR de las mesas (canciones, artistas y lo más pedido de cada artista) y la app, al buscar el video de cada
    canción pedida. La API de YouTube queda solo de respaldo.
  - El límite de 10 canciones por mesa cada 15 minutos sigue igual.
  - Lo único que todavía usa el cupo de Google es **agregar** canciones a la lista de YouTube Music con la cuenta conectada
    (50 unidades por canción). Si se acaba, la app lo dice claro y ofrece «🔗 Vincular con código de TV», que manda las
    canciones directo al TV sin cupo.

## Para el administrador

- Al publicar, el «Servidor Vento» despliega la búsqueda de YouTube sin cupo (función `vento-ia`).
- Al publicar, el «Servidor Vento» deja las cuentas confirmadas solas si no hay correo propio (SMTP). Sin correo propio, el
  mensaje de confirmación no le llega a nadie.

## Pruebas

| Prueba | Resultado |
|---|---|
| cuentas (PostgreSQL real, 6 celulares) | 43 |
| facturarapida (Gemini simulado: saturado, lento, basura, cortado, clave mala) | 9 |
| avisosandroid (puente Android simulado) | 10 |
| youtubesincupo (API de YouTube respondiendo «quotaExceeded») | 12 |

La app Android cambió (VentoEscucha): hay que compilar y publicar el APK nuevo. Se publica solo cuando están los secretos
de la llave de firma (ver `android/LEEME.md`).
