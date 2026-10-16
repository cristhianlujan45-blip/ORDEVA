# Vento 1.40.6 · DaviPlata y Nequi sin ahorro de batería

Con ahorro de batería («Optimizada»), Android retrasa los avisos de pago de DaviPlata y Nequi: llegan tarde o al prender
la pantalla, y Vento los dice tarde. Ninguna app puede cambiar ese ajuste por otra; lo elige el dueño con un toque.

## Arreglo
- La app Android revisa las apps de banco instaladas (DaviPlata, Nequi, Bancolombia, Davivienda) y si tienen ahorro de
  batería (`bancosBateria`).
- **Aviso fijo** en el celular del dueño o del administrador: «🔋 DaviPlata y Nequi tienen ahorro de batería: Android
  puede retrasar sus avisos de pago».
  - «🔋 Arreglar DaviPlata» abre el ajuste de esa app (`bancoAjustes`, solo apps de banco de la lista) y explica
    Batería → Sin restricciones.
  - Al volver, el aviso pasa a la siguiente app.
  - «Luego» lo deja quieto 3 días.
- **Ajustes → 💜 Pagos y el paso a paso (paso 4)** muestran cada app con ✅ sin restricciones o ⚠️ con ahorro de batería
  y su botón.
- Se reporta a 🐞 Errores del panel, una vez al día, qué apps de banco tienen ahorro de batería.

## Pruebas
`pagosaviso` 69: 5 nuevas (aviso fijo, botón que abre el ajuste, pasa a la siguiente app, «Luego», Ajustes y paso
a paso).
