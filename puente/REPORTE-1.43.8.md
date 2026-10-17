# Vento 1.43.8 · La tarjeta «🧠 Vento» va a la campanita, Nequi sin perderse con el celular en uso y «🧓 Modo fácil» en Ajustes

El dueño pidió tres cosas:
- que la tarjeta «Llegó $200 por Nequi y no está registrado en ninguna cuenta» no salga en la pantalla principal, sino
  en la campanita;
- que no se pierdan avisos de Nequi y de Bre-B con el celular desbloqueado;
- que el modo fácil esté en Ajustes, fácil de encontrar.

«Lo demás déjalo igual».

## 1. 🧠 La tarjeta de Vento, a la campanita
La tarjeta «🧠 Vento» del inicio (pagos que llegaron y no están en ninguna cuenta, lo que se acaba…) ahora está en la
🔔 campanita, en «📣 Avisos de Vento». Conserva sus mismos botones («Elegir la mesa», «✕»…). La campanita cuenta cada
aviso de la tarjeta. El «✕» de un aviso no cierra la campanita. Su lógica no cambia.

## 2. Nequi y Bre-B con el celular en uso
Con el celular desbloqueado, Android (sobre todo Xiaomi) a veces deja de pasarle a Vento los avisos nuevos sin decir
que se desconectó: el pago quedaba en la barra y no sonaba.

**Ahora** Vento revisa la barra de avisos cada 10 s:
- El aviso de un banco que no le había llegado lo toma de una, con voz si es de hace menos de 3 min.
- Lo ya visto no se repite: cada aviso tiene su huella.
- Si Android no deja leer la barra, la conexión está caída y se pide reconectar de una.
- Queda en el registro: «🧹 1 aviso tomado de la barra: Android no se lo había pasado a Vento».

## 3. «🧓 Modo fácil» con su propio botón en Ajustes
Antes estaba dentro de Ajustes → 🎨 Apariencia. Ahora tiene su botón propio arriba en Ajustes. «Abre modo fácil» por
voz lleva ahí, y al salir del modo fácil Vento dice dónde se vuelve a prender.

## Demora con el celular bloqueado (no se cambió código)
En Ajustes → Pagos, el registro de cada aviso dice de dónde viene una demora:
- «⏱ el banco lo mandó N s tarde» → la demora viene de Nequi.
- «⏱ Vento lo leyó N s después» → la demora viene de Vento.
- Sin ninguna de las dos → Android le entregó tarde el aviso a la app de Nequi.

Con el celular bloqueado, Android retrasa los avisos de las apps con ahorro de batería. El arreglo es en Nequi:
**Batería → Sin restricciones** y, en Xiaomi, **Inicio automático** prendido. Vento ya lo pide en la 🔔 campanita.

## Pruebas
- `herramientas` 28 (nuevas: la tarjeta en la campanita y el botón «🧓 Modo fácil»).
- `facil` 47, `ajustesorden` 17, `guia` 47, `pagosaviso` 92, `subbarra` 16.
- `javaavisos` 215.
- Compila todo el código Android (con `android-all`).
