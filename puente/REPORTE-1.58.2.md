# ORDEVA 1.58.2 · Bre-B a DaviPlata en todos los equipos + la pantalla ya no «se devuelve»

Incluye la 1.58.1 (toques al instante: ver `REPORTE-1.58.1.md`).

## 1. Los pagos por la llave Bre-B a DaviPlata suenan también en el computador
- **Qué pasaba:**
  - Cuando pagan a DaviPlata por la llave (desde Nequi u otro banco), la app de DaviPlata avisa «Recibiste plata de otra
    entidad usando Llaves» **sin el valor**. El valor llega después por el SMS 85888.
  - El celular decía «Llegó plata por Bre-B, en DaviPlata».
  - El servidor solo guarda pagos **con valor**, así que el computador y las tablets no se enteraban de ese aviso.
  - Si el SMS no llegaba, llegaba tarde o el celular no lee SMS, en el computador no sonaba nada.
- **Qué cambia:**
  - El celular que lo leyó (y lo dijo) lo manda también por el canal de pagos del negocio.
  - Los demás equipos dicen **«Llegó plata por Bre-B, en DaviPlata. Mira el valor en la aplicación.»** con su ventana.
  - Solo el dueño y los administradores.
  - Cada equipo lo dice una vez. Lo de hace más de 3 minutos no se repite al reconectarse.
  - Cuando llega el valor (SMS), llega como siempre por el servidor: «Llegaron 65000 pesos por DaviPlata».
- **Probado de punta a punta** (`pagosequipos`, servidor y base de datos reales, celular + tablet + computador):
  - llave + SMS juntados: el servidor recibe $65.000 confirmado, y el computador muestra la ventana y lo **dice**; la
    tablet también;
  - primero el SMS 85888 y luego la llave: confirmado (85888 es el número oficial de DaviPlata) y el computador lo dice;
  - **solo la llave, sin SMS:** el computador dice «Llegó plata por Bre-B, en DaviPlata». Esto antes no sonaba; la
    prueba fallaba antes del arreglo.

## 2. La pantalla de la mesa ya no se «devuelve» al desplazarse
- **Qué pasaba:**
  - Con una mesa abierta había **dos desplazamientos uno dentro del otro**: la ventana de la mesa y, detrás, el fondo.
  - Un selector escondido del medio de pago colgaba por fuera de la ventana y hacía que el fondo también se desplazara
    (842 px de más).
  - En el celular, el dedo pasaba de un desplazamiento al otro: la pantalla parecía devolverse o pegarse.
- **Qué cambia:** el selector escondido queda arriba a la izquierda (sigue invisible y funcionando). Ahora solo se
  desplaza la ventana de la mesa.
- **Revisión de todas las ventanas** de la app (24 fijas, más mesa abierta, cobrar y el paso a paso de pagos), en celular
  y computador: ninguna tiene doble desplazamiento. El asistente mueve su fondo 3–10 px, sin nada adentro que se
  desplace, así que no es doble desplazamiento.
- **También comprobado (no se movía):**
  - en las vistas (mesas, inventario, historial, carta, música, ajustes) y con la mesa abierta, cuando llegan datos de
    otro equipo o se refresca algo solo, el desplazamiento se queda donde iba;
  - al tocar + abajo en la lista, la ventana no vuelve arriba.
- **Además**, para que el dedo no espere:
  - **la 1.58.1** quitó lo que trababa cada toque: el guardado, la actividad del equipo y la lluvia del fondo;
  - **la app Android 1.0.62** quitó las revisiones que corrían en el hilo de la pantalla cada 5 s.

## 3. Todo se llama ORDEVA, también el programa de PC
- **Programa de PC:** en Windows ahora se llama **ORDEVA**: acceso directo, menú Inicio, ventana, avisos, menú junto al
  reloj y la publicación «ORDEVA para PC».
  - **Sin perder nada:** sus datos siguen en la MISMA carpeta de antes. Con otro nombre, Electron habría buscado una
    carpeta nueva y vacía.
  - **El archivo del programa** (`Vento.exe`) y el instalador (`Vento-Setup.exe`) no cambian de nombre, para que los
    accesos directos que ya existen y la actualización automática no se rompan. El navegador ya lo descarga como
    «ORDEVA-Setup.exe».
  - Probado con Electron de verdad (`pc` 14/14), con la comprobación nueva de la carpeta de datos.
- **Página de dirección equivocada (404):** «Abriendo ORDEVA…».
- **Apps comprobadas de punta a punta** con el servidor real (`canalvivo` 17/17):
  - el QR del cliente (la carta, el pedido llega y el estado vuelve);
  - la app de meseros (recibe las mesas y su pedido entra a la mesa);
  - la pantalla de preparación;
  - el TV;
  - los avisos por MacroDroid.
- **Flujo completo:** `flujocompleto` 87/87 y `cajaqr` 13/13.
