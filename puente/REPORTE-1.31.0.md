# Vento 1.31.0 — Cuentas con correo en todos los celulares, facturas más rápidas y DaviPlata oficial

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
  - Los usuarios sin correo (ej. «mesero1») siguen siendo de ese celular, como siempre.
- **Lectura de facturas más rápida.** Hoy Google tiene saturados los modelos «lite» de Gemini (responden 503). Antes la
  app reintentaba el mismo modelo con esperas: 20–30 s, o terminaba en «tardó demasiado».
  - Ahora salta de una vez a otro modelo y recuerda unos minutos cuál estaba saturado.
  - La factura se lee «en carrera»: si el modelo principal no responde en 3 s, arranca otro en paralelo y gana el primero.
  - Medido con la clave real: ~10 s el primer intento con Google saturado (antes 20–28 s o error); ~6 s los siguientes.
  - Si la IA agrega basura al final del JSON o lo corta en una factura larga, se leen igual los renglones completos.
  - Lo mismo aplica a todo lo que usa la IA (foto de producto, voz, asistente): ya no se queda esperando un modelo saturado.
- **DaviPlata oficial** («Pago con DaviPlata»: compra con código OTP y confirmación). Queda listo para cuando DaviPlata
  entregue las credenciales y el certificado.

## Para el administrador

- Al publicar, el «Servidor Vento» deja las cuentas confirmadas solas si no hay correo propio (SMTP). Sin correo propio, el
  mensaje de confirmación no le llega a nadie.

## Pruebas

| Prueba | Resultado |
|---|---|
| cuentas (PostgreSQL real, 6 celulares) | 39 |
| facturarapida (Gemini simulado: saturado, lento, basura, cortado, clave mala) | 9 |
