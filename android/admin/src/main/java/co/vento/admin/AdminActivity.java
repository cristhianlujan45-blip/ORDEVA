package co.vento.admin;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.pm.PackageManager;
import android.os.PowerManager;
import android.provider.Settings;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Message;
import android.provider.MediaStore;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.lang.ref.WeakReference;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Vento Admin: la app del proveedor. Abre el panel de administración (admin.html), que sigue pidiendo el
 * código personal para entrar. Lo que no es el panel (WhatsApp, GitHub, la APK) se abre con su propia app.
 */
public class AdminActivity extends Activity {

    static final String URL_ADMIN = "https://cristhianlujan45-blip.github.io/cuentas/admin.html";
    static final String HOST = "cristhianlujan45-blip.github.io";
    private static final int RC_ARCHIVO = 31;

    private WebView web;
    private ValueCallback<Uri[]> archivoCb;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0B0A12);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " VentoAdmin/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        web.addJavascriptInterface(new Puente(), "VentoAdmin");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return abrirFuera(r.getUrl()); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (archivoCb != null) archivoCb.onReceiveValue(null);
                archivoCb = cb;
                Intent i;
                try { i = p.createIntent(); } catch (Exception e) { i = new Intent(Intent.ACTION_GET_CONTENT).setType("*/*"); }
                i.addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(Intent.createChooser(i, "Elegir archivo"), RC_ARCHIVO); }
                catch (Exception e) { archivoCb.onReceiveValue(null); archivoCb = null; }
                return true;
            }

            // window.open(...) → afuera con su app (WhatsApp, GitHub…)
            @Override
            public boolean onCreateWindow(WebView v, boolean dialogo, boolean gesto, Message msg) {
                WebView temp = new WebView(v.getContext());
                temp.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView vv, WebResourceRequest r) {
                        Uri u = r.getUrl();
                        if (!abrirFuera(u)) web.loadUrl(u.toString());
                        vv.destroy();
                        return true;
                    }
                });
                WebView.WebViewTransport t = (WebView.WebViewTransport) msg.obj;
                t.setWebView(temp);
                msg.sendToTarget();
                return true;
            }
        });
        setContentView(web);
        if (estado != null) web.restoreState(estado);
        else web.loadUrl(URL_ADMIN);
        // Conectado siempre (pantalla bloqueada o app de fondo): servicio en primer plano + avisos del celular.
        AdminServicio.pagina = new WeakReference<>(web);
        if (getSharedPreferences("vento_admin", MODE_PRIVATE).getBoolean("fondo", true)) AdminServicio.arrancar(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41);
        pedirSinAhorroBateria();
    }

    /** Sin el ahorro de batería, Android no duerme el panel (los avisos llegan con el celular bloqueado). Se pide una vez. */
    private void pedirSinAhorroBateria() {
        if (Build.VERSION.SDK_INT < 23) return;
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null || pm.isIgnoringBatteryOptimizations(getPackageName())) return;
            if (getSharedPreferences("vento_admin", MODE_PRIVATE).getBoolean("pidio_bateria", false)) return;
            getSharedPreferences("vento_admin", MODE_PRIVATE).edit().putBoolean("pidio_bateria", true).apply();
            startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
        } catch (Exception ignorado) { }
    }

    static volatile boolean alFrente = false;   // el panel se está viendo (la actualización automática espera)

    @Override
    protected void onResume() {
        super.onResume();
        alFrente = true;
        try { Actualizador.revisar(this, false); } catch (Throwable ignorado) { }
        pedirPermisoActualizar();
    }

    /** 🔄 Para actualizarse sola, Android pide una vez «Instalar apps desconocidas» para Vento Admin. Se explica y se abre. */
    private void pedirPermisoActualizar() {
        if (Build.VERSION.SDK_INT < 26 || Actualizador.permiso(this)) return;
        android.content.SharedPreferences p = getSharedPreferences("vento_admin", MODE_PRIVATE);
        if (System.currentTimeMillis() - p.getLong("pidio_actualizar", 0) < 3 * 86400_000L) return;
        p.edit().putLong("pidio_actualizar", System.currentTimeMillis()).apply();
        try {
            new android.app.AlertDialog.Builder(this).setTitle("🔄 Que Vento Admin se actualice sola")
                    .setMessage("Dale un permiso una sola vez y Vento Admin se actualiza sola, sin descargar ni instalar a mano.\n\nEn la pantalla que se abre, activa «Permitir de esta fuente» y vuelve.")
                    .setPositiveButton("Dar el permiso", (d, w) -> { try { startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))); } catch (Exception ignorado) { } })
                    .setNegativeButton("Luego", null).show();
        } catch (Exception ignorado) { }
    }

    // OJO: no se llama web.onPause() / pauseTimers(): con eso el panel dejaría de recibir avisos de fondo.
    @Override
    protected void onPause() { alFrente = false; super.onPause(); }

    @Override
    protected void onDestroy() {
        if (AdminServicio.pagina.get() == web) AdminServicio.pagina = new WeakReference<>(null);
        super.onDestroy();
    }

    @Override
    protected void onSaveInstanceState(Bundle b) {
        super.onSaveInstanceState(b);
        web.saveState(b);
    }

    /** Solo el panel (…/cuentas/admin.html) se queda adentro; lo demás se abre con su app. */
    private boolean abrirFuera(Uri u) {
        if (u == null) return false;
        String esq = u.getScheme() == null ? "" : u.getScheme();
        if (("https".equals(esq) || "http".equals(esq)) && HOST.equalsIgnoreCase(u.getHost())
                && u.getPath() != null && u.getPath().startsWith("/cuentas/admin")) return false;
        try {
            Intent i = "intent".equals(esq) ? Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, u);
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            i.setComponent(null);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No hay una app para abrir ese enlace.", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "No pude abrir ese enlace.", Toast.LENGTH_LONG).show();
        }
        return true;
    }

    @Override
    protected void onActivityResult(int rc, int resultado, Intent datos) {
        super.onActivityResult(rc, resultado, datos);
        if (rc != RC_ARCHIVO || archivoCb == null) return;
        Uri[] res = null;
        if (resultado == RESULT_OK && datos != null && datos.getData() != null) res = new Uri[]{datos.getData()};
        archivoCb.onReceiveValue(res);
        archivoCb = null;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    /** window.VentoAdmin: guardar respaldos y CSV en Descargas/Vento (el navegador de la app no descarga «blob:»)
     *  y notificaciones del celular (soporte nuevo, pagos por revisar) aunque esté bloqueado. */
    class Puente {
        @JavascriptInterface
        public void notificar(final String titulo, final String cuerpo, final String tag) {
            try {
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm == null) return;
                String canal = "vento_admin_avisos";
                if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(canal) == null) {
                    NotificationChannel ch = new NotificationChannel(canal, "Soporte y pagos", NotificationManager.IMPORTANCE_HIGH);
                    ch.setDescription("Mensajes de soporte de los clientes y pagos por revisar.");
                    ch.enableVibration(true);
                    ch.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
                    nm.createNotificationChannel(ch);
                }
                int flagsPi = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
                Intent abrir = new Intent(AdminActivity.this, AdminActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                PendingIntent pi = PendingIntent.getActivity(AdminActivity.this, 2, abrir, flagsPi);
                Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(AdminActivity.this, canal) : new Notification.Builder(AdminActivity.this);
                String t = titulo == null ? "Vento Admin" : (titulo.length() > 80 ? titulo.substring(0, 80) : titulo);
                String c = cuerpo == null ? "" : (cuerpo.length() > 300 ? cuerpo.substring(0, 300) : cuerpo);
                b.setSmallIcon(android.R.drawable.stat_notify_chat).setContentTitle(t).setContentText(c)
                        .setStyle(new Notification.BigTextStyle().bigText(c)).setAutoCancel(true).setContentIntent(pi);
                if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
                nm.notify(tag == null || tag.isEmpty() ? "vento" : tag, 1, b.build());
            } catch (Exception ignorado) { }
        }

        @JavascriptInterface
        public void guardar(final String nombre, final String tipo, final String texto) {
            new Thread(() -> {
                String n = (nombre == null || nombre.isEmpty()) ? ("vento-admin-" + System.currentTimeMillis()) : nombre.replaceAll("[\\\\/:*?\"<>|]", "-");
                byte[] datos = (texto == null ? "" : texto).getBytes(StandardCharsets.UTF_8);
                try {
                    if (Build.VERSION.SDK_INT >= 29) {
                        ContentValues cv = new ContentValues();
                        cv.put(MediaStore.Downloads.DISPLAY_NAME, n);
                        cv.put(MediaStore.Downloads.MIME_TYPE, tipo == null || tipo.isEmpty() ? "application/octet-stream" : tipo);
                        cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Vento");
                        Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                        if (u == null) throw new Exception("sin destino");
                        try (OutputStream o = getContentResolver().openOutputStream(u)) { o.write(datos); }
                    } else {
                        File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Vento");
                        if (!dir.exists()) dir.mkdirs();
                        try (FileOutputStream o = new FileOutputStream(new File(dir, n))) { o.write(datos); }
                    }
                    runOnUiThread(() -> Toast.makeText(AdminActivity.this, "Guardado en Descargas/Vento: " + n, Toast.LENGTH_LONG).show());
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(AdminActivity.this, "No pude guardar el archivo.", Toast.LENGTH_LONG).show());
                }
            }).start();
        }
    }
}
