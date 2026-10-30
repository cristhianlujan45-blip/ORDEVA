# ORDEVA 1.66.0 · ◐ Diseño ORDEVA 2.0 en la app (el de la imagen de referencia)

## Qué quedó
- **Apariencia «◐ ORDEVA 2.0»**:
  - blanco, negro y grises; el color solo dice algo: verde bien o pagado, rojo error, naranja pendiente, azul
    información;
  - es la predeterminada. Quien tenía la de fábrica (Noche violeta) pasa una vez; otro diseño elegido se respeta;
  - todas las demás siguen en Ajustes → Apariencia;
  - la página de pedidos QR también la conoce.
- **Navegación lateral oscura en el computador**:
  - logo, todas las secciones y «Mi negocio» abajo;
  - en el celular sigue la barra de abajo;
  - se puede apagar en Ajustes → Apariencia → «◐ ORDEVA 2.0».
- **🏠 Inicio con datos reales** (hoy, 7 días, mes o fechas):
  - ventas con el cambio contra el período anterior, efectivo en caja, por cobrar en cuentas abiertas y gastos;
  - resultado con vendido, cobrado, costo, gastos y utilidad estimada;
  - ventas por día, más vendidos, alertas (existencias bajas, pedidos por aceptar o listos) y últimas ventas;
  - lo ve el dueño, el administrador o quien tenga permiso de estadísticas;
  - opción «Abrir en Inicio».
- **«Reportar un problema»**: el pantallazo ya no falla con las apariencias claras.
- **Seguridad**: sin la clave de YouTube escrita en el código. La búsqueda va por el Servidor ORDEVA; la clave propia
  del negocio se pone en Ajustes.
- Las pruebas de GitHub ahora también corren con cambios en `app/**`.

## Pruebas
Todas en verde:
- `ordeva2` (21) y `apariencias` (16);
- `tablero`, `vistasencilla`, `tvocupado`, `playlists`;
- `erroresreal` (33), `youtubesincupo`, `pedidomusica`, `qrprivado`, `seguridadqr`;
- `hola`, `autoactualiza`, `facil`, `cajapos`, `codigoproducto`, `nubetrabada`;
- `modulos`, `modulosnegocio`, `mejoras`, `cuentacliente`, `dian`, `iphone`.

## Lo que sigue (del diseño de referencia)
- Punto de venta con fotos.
- Inventario en tabla con margen y estado.
- Mesas y pedidos, cocina por estados, contabilidad y reportes.
- Administración y la app Android.
