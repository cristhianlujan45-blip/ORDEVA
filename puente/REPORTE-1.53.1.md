# Vento 1.53.1 · Los repasos automáticos corren dentro de Supabase cada 5 minutos

## El problema (visto en producción)
- El **repaso automático** del Servidor Vento hace cuatro trabajos:
  - consultar los cobros de Wompi y Nequi que siguen pendientes;
  - reintentar las facturas DIAN;
  - vencer las suscripciones;
  - copiar las ventas a las tablas (1.52.1).
- Lo disparaba GitHub «cada 10 minutos», pero GitHub lo corre cuando puede. El 23 de octubre pasaron **5 horas y media**
  entre uno y otro (02:20 → 07:52 UTC).
- Mientras tanto, esos cobros solo se confirmaban por el aviso del banco o con un celular abierto.

## El arreglo
- **Supabase dispara los repasos solo, cada 5 minutos** (`pg_cron` y `pg_net`, que vienen en Supabase):
  - **la copia a tablas** corre dentro de la base de datos, sin salir de ella y sin ninguna clave;
  - **cobros, DIAN y suscripciones:** la base llama al Servidor Vento. La dirección y el secreto los deja el propio
    servidor la primera vez que recibe un repaso autorizado, en una tabla que ningún celular puede leer. No están en el
    código ni en GitHub;
  - cada día se limpia la bitácora de esos repasos y se guarda solo la última semana.
- **Al desplegar** se hace un primer repaso, que deja todo listo.
- **GitHub queda de respaldo:** su repaso sigue igual.
- **Si Supabase no tuviera `pg_cron`**, la migración no falla: todo sigue como antes, con GitHub.
- **Herramienta de Supabase fija** en la versión 2.121.0, la última que desplegó bien. Antes se usaba siempre la más
  nueva («latest»), y una versión con fallas podía romper el despliegue sin aviso.

Archivos:
- `supabase/migrations/20261102000000_repasos_supabase.sql`: `vento_repaso()`, `srv_repaso_config()` y la programación;
- `supabase/functions/vento-pagos/app.ts`: servidor 1.22.0;
- `.github/workflows/servidor-vento.yml` y `comprobar-servidor.yml`.

## Verificado en producción antes de esta versión
- El repaso de las 07:52 UTC copió los **3 negocios** a las tablas en 0,4 s, sin fallas ni pendientes.
- La base de datos pesa **28 MB** (el tope del seguro de espacio es 400).

## Pruebas
- **Nueva, `servidor/repasos`:** 18 comprobaciones, con imitaciones de `pg_cron` y `pg_net` con la misma firma que en
  Supabase. Los pedidos que haría `pg_net` se hacen de verdad.
  - Sin `pg_cron`, la migración no falla.
  - Solo un repaso autorizado deja la configuración.
  - Quedan programados los tres trabajos, sin duplicarse.
  - `/sync` y `/vencer` responden con el secreto.
  - Ningún cliente puede leer el secreto, disparar el repaso ni cambiar a dónde va.
- **Siguen pasando todas las pruebas del servidor:** `admin` 142, `avisos` 27, `bloqueos` 18, `daviplata` 101, `dian` 69,
  `errores` 30, `iaclave` 34, `proyeccion` 66 y `suscripciones` 154.
- `revisar-migraciones`: no borra datos y las 27 migraciones se aplican con RLS en todas las tablas.
