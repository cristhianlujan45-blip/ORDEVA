# Prueba física de las alertas de pago (celular real)

Las pruebas automáticas simulan el celular. Esto **solo se puede comprobar en un celular de verdad**: hazla una vez con
cada celular nuevo, después de cada actualización grande de Android o de la app, y si un pago no sonó.

Necesitas: el celular del negocio con la app ORDEVA (vento.apk) y Nequi o DaviPlata, y otra persona que te mande $1.000.

## 1. Antes de empezar (2 minutos)

1. Abre la app → **Ajustes → 💜 Pagos**. Arriba está **🚨 ALERTAS DE PAGOS**.
2. Toca **🔧** en cada línea con ⚠️ hasta que diga **🟢 Todo listo**:
   - Lectura de avisos y permiso «Acceso a notificaciones».
   - Notificaciones de la app permitidas.
   - Batería de la app **Sin restricciones** y «trabajando de fondo».
   - Batería de **Nequi** y **DaviPlata** **Sin restricciones** (si no, Android retrasa sus avisos).
   - Voz de los pagos prendida.
   - Conectado con los demás equipos.
3. Toca **🎵 Elegir el sonido y la vibración** → «💜 Pagos que te llegan»: sonido, vibración y «mostrar en pantalla de
   bloqueo» prendidos.

## 2. Pruebas

Anota el resultado de cada una (✅ / ❌ y cuántos segundos tardó).

| # | Cómo | Qué debe pasar |
|---|------|----------------|
| 1 | Pantalla prendida, app abierta: **▶ Probar el sonido** | Dice «Llegaron 200 pesos por DaviPlata» al volumen elegido. |
| 2 | **📳 Probar la alerta completa** y **bloquea el celular** de inmediato | En unos segundos: la voz con los 2.500 pesos por Nequi, el aviso y la vibración. No queda como pago. |
| 3 | App abierta: que te manden **$1.000 por Nequi** | Voz con el valor, ventana con el valor y el pago en «Últimos pagos que llegaron». |
| 4 | **Celular bloqueado** 5 minutos, luego que te manden $1.000 | Igual que la 3, con la pantalla apagada. |
| 5 | App **cerrada** (quitada de recientes), celular bloqueado, $1.000 | Igual: el servicio de fondo la despierta. |
| 6 | Modo **No molestar** prendido, $1.000 | Suena igual (el canal de pagos pasa por encima de No molestar). |
| 7 | **Sin internet** (apaga los datos y el wifi), $1.000 | Este celular lo dice; los demás equipos lo reciben al volver el internet. |
| 8 | Otro equipo de la cuenta (caja o computador) abierto | El pago de la prueba 3 llega también allá. |
| 9 | Después de **reiniciar el celular**, sin abrir la app, $1.000 | Suena (la app arranca sola). Si no, revisa «Inicio automático» en Xiaomi/Huawei/Oppo. |
| 10 | Una **Recarga desde Bancolombia** a tu Nequi | Se dice como plata recibida. |

## 3. Si algo falla

- Abre **Ajustes → 💜 Pagos → 📋 Últimos avisos del banco y qué hizo Vento**: ahí dice qué llegó y por qué no sonó.
- Las demoras y los avisos que no se tomaron se reportan solos (sin valores ni nombres) a 🐞 Errores del panel de
  administrador.
- Escribe a soporte con el número de la prueba que falló, la marca y modelo del celular y la hora.
