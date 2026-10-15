# Vento 1.38.0 — Comerciales y canciones «bloqueadas», canciones por QR sin límite y tu YouTube Premium

## 1. Canciones que salían «bloqueadas por el sello» sin estarlo
- **Qué pasaba:**
  - Mientras YouTube pasaba un comercial, el video no arrancaba.
  - A los **7 segundos** Vento creía que estaba bloqueado: cambiaba de versión, decía «bloqueada por el sello» y dejaba
    la versión buena en la lista negra para siempre.
  - Por eso cada vez salían más canciones «bloqueadas».
- **Ahora:**
  - Espera el comercial. A los 12 s le da play una vez, por si quedó en pausa.
  - Solo si a los **60 s** sigue quieta, prueba otra versión, y **sin** marcarla como mala.
  - Solo cuando YouTube dice de verdad que esa versión no se deja poner fuera de YouTube (error 100, 101 o 150), va a la
    lista negra y se pone otra versión.
- **La lista negra vieja**, con canciones buenas marcadas por error, **se limpia sola una vez**.
- **El título ya no repite el artista** («Wiz Khalifa - Wiz Khalifa - Yiccen…» → «Wiz Khalifa - Yiccen…»).

## 2. Canciones por QR sin límite
- **Ajustes → Negocio → Música → «Canciones que puede pedir cada mesa por QR»:** Sin límite (así viene), 3, 5, 10, 15
  o 20 cada 15 minutos.
- **Sin límite:** las mesas piden las que quieran y suenan por turnos justos entre ellas. El QR dice «Pide las canciones
  que quieras».
- **El QR de las mesas se entera solo:** el límite viaja con la carta y con la cuenta en vivo de la mesa.

## 3. Comerciales con YouTube Premium
- **Por qué salen:**
  - El reproductor que va dentro de Vento (como en cualquier app o página) es el de YouTube para otras páginas.
  - **Google no deja iniciar sesión con la cuenta dentro de apps**: lo bloquea por seguridad desde 2021, así que ese
    reproductor no sabe que tienes Premium.
  - No se puede saltar ese bloqueo sin ir contra las reglas de Google (podrían bloquear la cuenta).
- **La solución que sí funciona: el YouTube de tu TV, vinculado con Vento.**
  - En el TV entras a YouTube con tu cuenta Premium y lo vinculas con Vento una sola vez («📡 Buscar mi TV» o con el
    código del TV).
  - Desde ahí las canciones de las mesas y las tuyas suenan allá, **sin comerciales y sin límite**: no gasta el cupo de
    Google.
- **Guía «🚫 Sin comerciales con tu YouTube Premium»:**
  - **Dónde está:**
    - en el panel de YouTube, cuando suena en el reproductor de Vento: «¿Salen comerciales? Usa tu YouTube Premium en
      el TV»;
    - en Música;
    - con el asistente, preguntando por «comerciales», «anuncios» o «Premium».
  - **Qué tiene:** los pasos y los botones para buscar el TV, vincularlo con el código y conectar la cuenta de YouTube
    (para las listas, «Me gusta» y suscripciones; queda vinculada para siempre).
- **Sin TV:** se puede usar YouTube Music con Premium y un parlante Bluetooth. Esa forma tiene un tope diario de
  Google; al llenarse, Vento sigue con su reproductor (con comerciales).

## Pruebas
- **Nueva:** `musicaanuncios`, 17 comprobaciones: comercial que no se toma como bloqueo, video quieto de verdad, error
  real de YouTube, limpieza de la lista negra, título, guía y asistente.
- **Actualizada:** `cancionesmesa`, 17 comprobaciones; ahora también prueba el modo «Sin límite».
