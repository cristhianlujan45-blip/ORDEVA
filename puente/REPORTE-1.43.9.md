# Vento 1.43.9 · La voz de los pagos suena en Xiaomi (y en todo tipo de celular y tablet)

El dueño: «El probador de voz ya no está funcionando y la voz a veces no suena (en el Xiaomi). La ventana sí se abre
bien en los dos. En el Samsung ya está sin problema… Quiero que funcione en todo tipo de celular y de tablet».

## Por qué fallaba en el Xiaomi
Con el volumen de los pagos por encima de 100 %, la frase primero se grababa en un archivo, se reforzaba y después se
tocaba:
- **Con el motor de voz de Google o el de Samsung, grabar a archivo funciona.** Por eso el Samsung andaba bien.
- **Con otros motores** (Xiaomi, Huawei, OPPO, Vivo…) a veces no termina, deja un archivo vacío o uno que no se puede
  tocar.
- **Si el archivo no se podía tocar, Vento no decía nada:** no volvía a la voz normal. El probador («▶ Probar la voz»)
  usa el mismo camino, por eso tampoco sonaba.

## Arreglo (solo la voz; la ventana, las notificaciones y lo demás no cambian)
- **Nueva pieza `PlanVoz`**, igual que `PlanVentana` para la ventana, decide por dónde sale la voz:
  - parlante de avisos conectado → se graba y se toca en el parlante;
  - volumen de 100 % o menos → **directo** en todas las marcas (lo que siempre funcionó);
  - más de 100 % → reforzado (archivo) **solo** con los motores que graban bien (Google y Samsung). Con cualquier otro
    habla **directo**, con el volumen de la alarma al máximo.
- **Si grabar o tocar el archivo falla por cualquier motivo**, la frase se dice de una con la voz normal: archivo vacío
  (menos de 2 KB) o error del reproductor. Nunca se queda callado.
- Se mantiene lo de antes: si el motor de voz no responde, se abre uno nuevo y se vuelve a decir.

## Pruebas
- `PlanVozPrueba` (nueva): 13 tipos de celular y tablet × 6 volúmenes × con y sin parlante = 156 combinaciones.
  - Equipos: Samsung, Samsung con voz de Google, Xiaomi/Redmi/POCO, Xiaomi con Google, Motorola, Huawei/Honor,
    OPPO/Realme/OnePlus, Vivo, Tecno/Infinix, tablet Lenovo, tablet Amazon Fire, motor desconocido y sin motor.
  - En todas la voz tiene por dónde salir. Xiaomi a 150 % habla directo. Samsung a 150 % sigue reforzado.
- `javaavisos` 232. Compila todo el código Android (con `android-all`).
- Ojo: es una simulación de cada combinación. No hay celulares físicos de cada marca para probar.

## Lo que necesita el dueño
- App 1.0.52: se actualiza sola.
- Para probar en el Xiaomi: Ajustes → 💜 Pagos → «▶ Probar la voz».
