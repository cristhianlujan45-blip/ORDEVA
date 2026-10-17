# Vento 1.43.4 · Voz de los pagos: suena en Xiaomi y Samsung, se entiende y va más despacio

El dueño: «Ya está sonando en el Samsung, pero en el Xiaomi deja de sonar: cuando arreglas uno, deja de sonar en el
otro. Y corrígeme el audio, está sonando horrible, casi no se le entiende. Y haz que sea más pausado, que se demore más
diciendo el precio».

## 1. Xiaomi dejó de hablar con la 1.43.3
La 1.43.3 revisaba a los 2,5 s si la voz había empezado. Si no, creía que el motor de voz estaba muerto: lo cerraba y
volvía a decir la frase, y otra vez con una segunda voz.

El motor de voz de Xiaomi tarda más en arrancar, y más cuando lleva rato sin usarse. Vento lo cerraba en medio de la
frase: la voz se cortaba, se encimaba o no salía. En Samsung arranca rápido y por eso allá sí funcionaba.

**Ahora:**
- Si el motor responde con error al hablar (motor cerrado), se abre uno nuevo de una, como en la 1.43.3. Eso es lo
  que arregló el Samsung.
- Si no responde con error, se esperan **9 s** y basta cualquier señal del motor (empezó, terminó o falló). Así un
  motor lento nunca se corta.
- Por esta vía ya no se dice con una segunda voz encima.

## 2. El audio sonaba horrible
Con el volumen de los pagos por encima de 100 %, la voz se llevaba al máximo y después se multiplicaba hasta ×4, con
un tope que recortaba las ondas. Quedaba rasposa y distorsionada, y casi no se entendía. Lo mismo pasaba en el parlante
de avisos.

**Ahora:** un nivelador suave.
- Sube parejo las sílabas bajitas (hasta ×2,5).
- Baja la ganancia antes de cada pico (mira 5 ms adelante), así nada pasa del tope.
- La forma de la voz se conserva: más fuerte, pero limpia.
- A 100 % queda como estaba.

## 3. Más pausada
- Velocidad **0,85**, antes 1.
- Pausas cortas en la frase: «Recibiste**,** 20000 pesos**,** por Nequi.» y «Recibiste, 65000 pesos, por Bre-B, en
  DaviPlata». Lo que se muestra en pantalla no cambia.
- Aplica a la voz del celular, al parlante de avisos y a la voz de respaldo.

## Pruebas
- `AvisoPagoPrueba`: 7 nuevas.
  - A 150 % la parte fuerte queda igual que a 100 % (sin recortar).
  - La parte bajita sube ×2,5 igual en cada punto (sin deformar).
  - Nunca pasa del tope.
  - Velocidad 0,85.
  - Pausas, también con Bre-B, y repetirlas no agrega más comas.
- `javaavisos` 202 en total. Compila todo el código Android (con `android-all`).

## Lo que necesita el dueño
- App 1.0.47: se instala sola, con «Actualizar ahora» en la 🔔 campanita, o desde
  https://github.com/cristhianlujan45-blip/cuentas/releases/latest/download/vento.apk
- Para probar en los dos celulares: Ajustes → Pagos → «🧪 Prueba piloto».
