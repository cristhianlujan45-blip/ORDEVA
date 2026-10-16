package co.vento.app;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.os.Build;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 🔄 La app se actualiza SOLA (sin descargar ni instalar a mano cada vez).
 *  • Revisa cada 30 min (y al abrir Vento) el archivo version.json de la publicación «android».
 *  • Si hay una versión nueva, baja el APK y lo instala con el instalador de Android. Lo hace cuando Vento NO se está
 *    usando (para no cortar nada); al terminar, Android vuelve a prender Vento de fondo (Arranque, MY_PACKAGE_REPLACED).
 *  • La primera vez Android pide un permiso («Instalar apps desconocidas» para Vento) y confirmar una vez. Desde ahí
 *    (Android 12 o más nuevo) se instala sin preguntar: Vento queda como quien instala sus propias actualizaciones.
 *  • Solo se instala una actualización firmada con la MISMA llave de Vento (Android rechaza cualquier otra).
 */
final class Actualizador {
    private Actualizador() { }
    static final String BASE = "https://github.com/cristhianlujan45-blip/cuentas/releases/latest/download/";
    static final String ACCION = "co.vento.app.ACTUALIZACION";
    static final String P_REV = "actRevisado", P_NUEVA = "actNueva", P_NOMBRE = "actNuevaNombre", P_ESTADO = "actEstado", P_INTENTOS = "actIntentos", P_AUTO = "actAuto";
    // Cada 30 min (antes 3 h: si se publicaban varias versiones seguidas, el celular se quedaba atrás horas).
    private static final long CADA = 30 * 60_000L;
    private static volatile boolean trabajando = false;

    private static SharedPreferences sp(Context c) { return c.getSharedPreferences("vento", Context.MODE_PRIVATE); }
    static int actual() { return BuildConfig.VERSION_CODE; }
    static boolean auto(Context c) { return sp(c).getBoolean(P_AUTO, true); }

    /** ¿Android deja que Vento instale sus actualizaciones? («Instalar apps desconocidas» para Vento) */
    static boolean permiso(Context c) {
        if (Build.VERSION.SDK_INT < 26) return true;
        try { return c.getPackageManager().canRequestPackageInstalls(); } catch (Throwable e) { return false; }
    }

    static void estado(Context c, String e) { sp(c).edit().putString(P_ESTADO, e).apply(); }

    static String estadoJson(Context c) {
        try {
            SharedPreferences p = sp(c);
            return new JSONObject().put("codigo", actual()).put("nombre", BuildConfig.VERSION_NAME).put("nueva", p.getInt(P_NUEVA, 0))
                    .put("nuevaNombre", p.getString(P_NOMBRE, "")).put("estado", p.getString(P_ESTADO, "")).put("permiso", permiso(c))
                    .put("revisado", p.getLong(P_REV, 0)).put("auto", auto(c)).put("silenciosa", Build.VERSION.SDK_INT >= 31).toString();
        } catch (Exception e) { return "{}"; }
    }

    /** Revisa si hay versión nueva y, si es buen momento, la instala. «ahora»: la pidió la persona (no espera). */
    static void revisar(final Context c, final boolean ahora) {
        if (trabajando) return;
        final SharedPreferences p = sp(c);
        if (!ahora && System.currentTimeMillis() - p.getLong(P_REV, 0) < CADA && p.getInt(P_NUEVA, 0) <= actual()) return;
        trabajando = true;
        new Thread(() -> {
            try {
                JSONObject v = new JSONObject(leer(BASE + "version.json"));
                int nueva = v.optInt("codigo", 0);
                p.edit().putLong(P_REV, System.currentTimeMillis()).putInt(P_NUEVA, nueva).putString(P_NOMBRE, v.optString("nombre", "")).apply();
                if (nueva <= actual()) { estado(c, "al día"); return; }
                if (!ahora && !auto(c)) { estado(c, "hay una nueva (automática apagada)"); return; }
                if (!permiso(c)) { estado(c, "falta el permiso"); return; }
                // Buen momento: Vento no se está usando y no acaba de llegar un pago (instalar cierra la app un momento).
                if (!ahora && (VentoApp.alFrente || System.currentTimeMillis() - VentoApp.ultimoPago < 60_000L)) { estado(c, "esperando a que no estés usando Vento"); return; }
                // Máximo 3 intentos por versión (si algo falla, no baja el archivo una y otra vez).
                String clave = "v" + nueva;
                JSONObject in = new JSONObject(p.getString(P_INTENTOS, "{}"));
                if (!ahora && in.optInt(clave, 0) >= 3) { estado(c, "no se pudo instalar la " + v.optString("nombre", "nueva")); return; }
                in = new JSONObject().put(clave, in.optInt(clave, 0) + 1);
                p.edit().putString(P_INTENTOS, in.toString()).apply();
                estado(c, "descargando la " + v.optString("nombre", "nueva"));
                File f = new File(c.getCacheDir(), "vento-nueva.apk");
                bajar(BASE + v.optString("apk", "vento.apk"), f);
                estado(c, "instalando la " + v.optString("nombre", "nueva"));
                instalar(c, f);
            } catch (Throwable e) {
                estado(c, "error: " + String.valueOf(e.getMessage()).replaceAll("\\s+", " ").trim());
            } finally { trabajando = false; }
        }, "vento-actualizar").start();
    }

    private static HttpURLConnection abrir(String u) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(u).openConnection();
        h.setConnectTimeout(15000); h.setReadTimeout(60000); h.setInstanceFollowRedirects(true);
        h.setRequestProperty("Cache-Control", "no-cache");
        // GitHub manda a otro servidor (objects.githubusercontent.com): se sigue a mano si Java no lo hizo.
        for (int i = 0; i < 5; i++) {
            int r = h.getResponseCode();
            if (r >= 300 && r < 400 && h.getHeaderField("Location") != null) { String l = h.getHeaderField("Location"); h.disconnect(); h = (HttpURLConnection) new URL(new URL(u), l).openConnection(); h.setConnectTimeout(15000); h.setReadTimeout(60000); continue; }
            if (r != 200) throw new Exception("HTTP " + r);
            return h;
        }
        throw new Exception("demasiadas redirecciones");
    }

    private static String leer(String u) throws Exception {
        HttpURLConnection h = abrir(u + "?t=" + System.currentTimeMillis());
        try (InputStream in = h.getInputStream()) {
            java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream(); byte[] x = new byte[8192]; int n;
            while ((n = in.read(x)) > 0) { b.write(x, 0, n); if (b.size() > 65536) break; }
            return b.toString("UTF-8");
        } finally { h.disconnect(); }
    }

    private static void bajar(String u, File f) throws Exception {
        HttpURLConnection h = abrir(u);
        try (InputStream in = h.getInputStream(); OutputStream o = new FileOutputStream(f)) {
            byte[] x = new byte[65536]; int n; long t = 0;
            while ((n = in.read(x)) > 0) { o.write(x, 0, n); t += n; if (t > 80L * 1024 * 1024) throw new Exception("archivo demasiado grande"); }
        } finally { h.disconnect(); }
        if (f.length() < 100_000) throw new Exception("archivo incompleto");
    }

    private static void instalar(Context c, File f) throws Exception {
        PackageInstaller pi = c.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        sp.setAppPackageName(c.getPackageName());
        if (Build.VERSION.SDK_INT >= 31) sp.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int id = pi.createSession(sp);
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (OutputStream o = s.openWrite("vento.apk", 0, f.length()); InputStream in = new FileInputStream(f)) {
                byte[] x = new byte[65536]; int n;
                while ((n = in.read(x)) > 0) o.write(x, 0, n);
                s.fsync(o);
            }
            Intent i = new Intent(c, Receptor.class).setAction(ACCION);
            int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            s.commit(PendingIntent.getBroadcast(c, 4401, i, fl).getIntentSender());
        }
    }

    /** Lo que responde el instalador de Android. */
    public static class Receptor extends BroadcastReceiver {
        @Override
        public void onReceive(Context c, Intent i) {
            int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
            if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                // La primera vez Android pide confirmar: si Vento está abierta se muestra ya; si no, un aviso para tocar.
                Intent confirmar = i.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirmar == null) return;
                confirmar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                estado(c, "esperando que confirmes «Actualizar»");
                if (VentoApp.alFrente) { try { c.startActivity(confirmar); return; } catch (Throwable ignorado) { } }
                try {
                    android.app.NotificationManager nm = (android.app.NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
                    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel("vento_avisos2") == null)
                        nm.createNotificationChannel(new android.app.NotificationChannel("vento_avisos2", "Avisos de Vento (IA y soporte)", android.app.NotificationManager.IMPORTANCE_DEFAULT));
                    android.app.Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new android.app.Notification.Builder(c, "vento_avisos2") : new android.app.Notification.Builder(c);
                    b.setSmallIcon(android.R.drawable.stat_sys_download_done).setContentTitle("🔄 Vento tiene una actualización")
                            .setContentText("Toca «Actualizar». Después Vento se actualiza sola.").setAutoCancel(true)
                            .setContentIntent(PendingIntent.getActivity(c, 4402, confirmar, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)));
                    nm.notify(4402, b.build());
                } catch (Throwable ignorado) { }
            } else if (st == PackageInstaller.STATUS_SUCCESS) {
                estado(c, "actualizada");
            } else {
                String m = i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
                estado(c, "no se pudo instalar" + (m != null ? ": " + m : ""));
            }
        }
    }
}
