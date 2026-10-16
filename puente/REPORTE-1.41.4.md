# Vento 1.41.4 · La ventana del pago se abre siempre

El dueño: «Ahora sí me sale el aviso de Nequi, pero no me abre el cuadro emergente. Que siempre me abra las ventanas
emergentes de cualquier transacción».

## Por qué no se abría
- **Usando otra app sin el permiso «Aparecer encima de otras apps»:** no se intentaba nada. Solo salía la notificación.
- **Con el celular bloqueado:** la ventana dependía de la notificación de «pantalla completa». Algunos celulares, como
  Xiaomi, no la abren. La ventana directa solo se intentaba con el permiso de encima de otras apps.
- **Xiaomi / Redmi / POCO (MIUI, HyperOS):** tienen dos permisos propios que vienen apagados: «Mostrar ventanas
  emergentes mientras se ejecuta en segundo plano» y «Mostrar en pantalla de bloqueo». Sin ellos, la ventana no sale
  aunque Android tenga los demás permisos.

## Arreglo
- La ventana se intenta abrir **siempre**, en cada pago:
  - encima de la otra app si hay permiso; si no, como pantalla propia;
  - con el celular bloqueado, la notificación de pantalla completa y además la ventana directo.
- **Xiaomi:** Vento lee esos dos permisos.
  - Si faltan, sale el aviso «🪟 Para que la ventana… se abra sola, en Xiaomi activa…» con «📱 Abrir permisos», que
    lleva a «Otros permisos» de Vento.
  - Lo mismo en Ajustes → 💜 Pagos → «🪟 Ventana emergente con el valor».

## Pruebas
- `pagosaviso` 88, con el aviso de Xiaomi: sale, abre «Otros permisos» y con los dos permisos no sale.
- `javaavisos` 171.
- Pasan `pagosguia`, `avisosandroid` y `parlante`; compila todo el código Android.
