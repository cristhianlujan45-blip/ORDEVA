# Vento 1.38.0 — Comerciales, canciones «bloqueadas», búsqueda sin el límite de Google y tu YouTube Premium en la app

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

## 2. Buscar música sin los límites de Google
- **Cómo se busca:** las búsquedas (en el QR de las mesas y en la app) van por el **Servidor Vento**, que no usa el cupo
  diario de Google.
- **Ahora es más firme:**
  - **Si YouTube bloquea un rato la página de resultados,** busca por un segundo camino: el mismo servicio interno con el
    que youtube.com carga más resultados, que tampoco usa cupo de Google.
  - **Si los dos fallan,** responde lo último encontrado para esa búsqueda en vez de dejar al cliente sin nada.
- **QR → «Lo más pedido del artista»:** antes usaba primero la API de Google (con cupo). Ahora va primero por el
  Servidor Vento, y la API solo queda de último respaldo.
- **Las 10 canciones por mesa siguen igual** (así viene).
  - Se puede cambiar en Ajustes → Negocio → Música → «Canciones que puede pedir cada mesa por QR».
  - Opciones: 3, 5, 10, 15, 20 o sin límite.

## 3. Comerciales dentro de la app: entrar con tu YouTube Premium
- **Por qué salen:** YouTube solo quita los comerciales cuando sabe que eres tú, con tu cuenta Premium iniciada en el
  mismo reproductor. El de la app no tenía tu sesión.
- **Nuevo en la app Android: «🔑 Entrar con mi YouTube Premium».**
  - Abre la página de inicio de sesión de Google de verdad, **dentro de la app**, sin trucos.
  - Entras con tu cuenta Premium (Vento no ve la contraseña) y la sesión queda guardada en la app.
  - Es la misma sesión que usa el reproductor de Vento, así que desde la próxima canción YouTube sabe que tienes Premium.
- **Dónde está:**
  - en la guía «🚫 Sin comerciales con tu YouTube Premium», como primer paso;
  - en el panel de YouTube: «¿Salen comerciales? Entra con tu YouTube Premium»;
  - en Música;
  - con el asistente.

  Cuando ya entraste, dice «✅ Ya entraste».
- **Si Google no deja entrar desde la app:** Google bloquea iniciar sesión dentro de apps en algunos celulares («Este
  navegador o app no es seguro»). En ese caso Vento lo dice claro y ofrece el **YouTube del TV**, donde Premium siempre
  funciona: sin comerciales y sin límite.
- **En el computador:** basta con entrar a youtube.com con tu cuenta Premium en el mismo navegador.
- **Hay que instalar la app de Android nueva** para tener el botón de entrar.

## Pruebas
- **Nuevas:**
  - `musicaanuncios`, 22 comprobaciones: comercial que no se toma como bloqueo, video quieto de verdad, error real de
    YouTube, lista negra, título, guía, asistente, y entrar con Premium en la app (bien y cuando Google no deja).
- **Actualizadas:**
  - `youtubesincupo`, 14 comprobaciones: la búsqueda sigue si YouTube bloquea la página de resultados, y con YouTube
    caído responde lo último encontrado;
  - `cancionesmesa`, 17 comprobaciones: 10 por defecto y la opción sin límite.
