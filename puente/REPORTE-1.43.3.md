# Vento 1.43.3 · La voz de los pagos vuelve a sonar siempre

El dueño: «La aplicación no está hablando cada vez que me llega la notificación… Las notificaciones ya están llegando,
ya está sirviendo muy bien. Solamente que ya no está hablando».

## Por qué
Vento queda prendida días de fondo y mantiene abierto su «motor de voz» (el TextToSpeech del celular) para decir los
pagos de una. Android a veces cierra ese motor sin avisar, sobre todo en Xiaomi y Redmi o después de horas.

Desde ahí cada «Recibiste … pesos» se mandaba a un motor cerrado. No sonaba nada y no quedaba ningún error. La
notificación y la ventana sí salían, porque van por otro camino.

## Arreglo (app 1.0.46)
- Después de cada «Recibiste …», Vento comprueba que la voz arrancó.
- Si a los 2,5 s no empezó a hablar (y no está hablando otra cosa), abre un motor de voz nuevo y la vuelve a decir.
- Si el motor ni responde, lo hace de una.
- Si tampoco suena, lo dice con la otra voz de la app (la de la página).
- No se repite dos veces la misma frase, y dos pagos seguidos se dicen los dos.
- El registro (Ajustes → Pagos y 🐞 Errores del panel, sin valores) dice «🔇 la voz no arrancó: se abrió un motor de voz
  nuevo y se volvió a decir». Así se sabe si pasa y en qué celular.
- No cambia nada más: notificaciones, ventana de 15 s, parlante y volumen siguen igual.

## Pruebas
- `javaavisos` 195, `pagosaviso` 92, `erroresreal` 22.
- Compila todo el código Android (con `android-all`).

## Lo que necesita el dueño
- La app 1.0.46 se instala sola, o con «Actualizar ahora» en la 🔔 campanita.
- Para comprobar: Ajustes → Pagos → «🧪 Prueba piloto» debe decir «Recibiste … pesos».
