package co.vento.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import java.util.ArrayList;

/**
 * La ventana de Vento. Muestra el «motor» (VentoApp.web), que sigue vivo aunque esta ventana se
 * cierre: así los pedidos y la música siguen funcionando de fondo con el servicio (VentoServicio).
 */
public class MainActivity extends Activity {

    private static final int RC_ARCHIVO = 11;
    private static final int RC_PERM_VOZ = 21;
    private static final int RC_PERM_WEB = 22;
    private static final int RC_PERM_ARCHIVO = 23;
    private static final int RC_PERM_AVISOS = 24;
    private static final int RC_PERM_INICIO = 25;

    private WebView web;
    private ValueCallback<Uri[]> archivoCb;
    private WebChromeClient.FileChooserParams archivoParams;
    private Uri camaraUri;
    // 1.65.7: las peticiones de cámara/micrófono de la página que esperan la respuesta de Android, EN FILA. Antes se guardaba
    // una sola: al tocar «Escanear» dos veces, la primera quedaba colgada para siempre (la cámara nunca abría) y la segunda
    // recibía una respuesta «cancelada» que se tomaba como «no»: «No se pudo abrir la cámara».
    private final java.util.ArrayList<PermissionRequest> permisosWeb = new java.util.ArrayList<>();

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        VentoApp.ventana = this;
        // Pantalla prendida mientras la ventana esté abierta (con la ventana cerrada sigue el servicio de fondo).
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = VentoApp.motor(this);
        if (web.getParent() instanceof ViewGroup) ((ViewGroup) web.getParent()).removeView(web);
        setContentView(web);

        abrirEnlace(getIntent());

        // Trabajar de fondo: prendido por defecto (se puede apagar desde Vento).
        if (getSharedPreferences("vento", MODE_PRIVATE).getBoolean("fondo", true)) VentoServicio.arrancar(this);
        // Primera vez: pide de una vez todo lo que Vento usa (micrófono para «Hola Vento» y los pedidos por voz,
        // cámara para facturas y códigos, avisos para los pedidos). Después, lo de la batería.
        if (!pedirPermisosInicio(false)) pedirSinAhorroBateria(false);
    }

    /** Los permisos que Vento necesita y todavía no tiene. */
    static ArrayList<String> permisosFaltantes() {
        ArrayList<String> f = new ArrayList<>();
        if (!VentoApp.tiene(Manifest.permission.RECORD_AUDIO)) f.add(Manifest.permission.RECORD_AUDIO);
        if (!VentoApp.tiene(Manifest.permission.CAMERA)) f.add(Manifest.permission.CAMERA);
        if (Build.VERSION.SDK_INT >= 33 && !VentoApp.tiene(Manifest.permission.POST_NOTIFICATIONS)) f.add(Manifest.permission.POST_NOTIFICATIONS);
        return f;
    }

    /** Pide los permisos que falten (la primera vez sola; luego, cuando se toca en Vento). Devuelve true si preguntó. */
    boolean pedirPermisosInicio(boolean siempre) {
        if (Build.VERSION.SDK_INT < 23) return false;
        android.content.SharedPreferences p = getSharedPreferences("vento", MODE_PRIVATE);
        ArrayList<String> faltan = permisosFaltantes();
        if (faltan.isEmpty()) return false;
        if (!siempre && p.getBoolean("permisosPedidos", false)) return false;
        boolean yaPreguntado = p.getBoolean("permisosPedidos", false);
        p.edit().putBoolean("permisosPedidos", true).apply();
        // Si Android ya no deja volver a preguntar («no volver a preguntar»), se abren los ajustes de la app.
        boolean bloqueado = yaPreguntado;
        for (String x : faltan) if (shouldShowRequestPermissionRationale(x)) bloqueado = false;
        if (siempre && bloqueado) {
            try {
                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
                VentoApp.aviso("Toca «Permisos» y activa Micrófono, Cámara y Notificaciones para ORDEVA.");
            } catch (Exception ignorado) { }
            return true;
        }
        requestPermissions(faltan.toArray(new String[0]), RC_PERM_INICIO);
        return true;
    }

    /** Pone una página nueva en la ventana (cuando Android cerró la anterior). */
    void mostrar(WebView w) {
        web = w;
        if (w.getParent() instanceof ViewGroup) ((ViewGroup) w.getParent()).removeView(w);
        setContentView(w);
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        abrirEnlace(i);
    }

    /** «vento://abrir?…#…» → abre esa misma dirección dentro de Vento (con sus datos, p. ej. el enlace del correo). */
    private void abrirEnlace(Intent i) {
        try {
            Uri u = i == null ? null : i.getData();
            if (u == null || !"vento".equals(u.getScheme())) return;
            String q = u.getEncodedQuery(), f = u.getEncodedFragment();
            String url = VentoApp.URL_VENTO + (q == null || q.isEmpty() ? "" : "?" + q) + (f == null || f.isEmpty() ? "" : "#" + f);
            if (web != null) web.loadUrl(url);
        } catch (Exception ignorado) { }
    }

    @Override
    protected void onResume() {
        super.onResume();
        VentoApp.ventana = this;
        VentoApp.alFrente = true;
        VentoApp.motor(this);
        try { web.onResume(); } catch (Exception ignorado) { }
        try { Actualizador.revisar(this, false); } catch (Throwable ignorado) { }   // ¿hay versión nueva? (cada 30 min)
        VentoApp.js("try{window.__ventoAlFrente=true;document.dispatchEvent(new Event('visibilitychange'))}catch(e){}");
    }

    @Override
    protected void onPause() {
        // OJO: no se llama web.onPause(): con eso la página dejaría de trabajar de fondo.
        VentoApp.alFrente = false;
        VentoApp.js("try{window.__ventoAlFrente=false}catch(e){}");   // la música sabe que está minimizada (no confunde una pausa del celular con una de la persona)
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (VentoApp.ventana == this) VentoApp.ventana = null;
        // La página NO se destruye: se suelta de esta ventana y queda viva con el servicio de fondo.
        try {
            if (web != null && web.getParent() instanceof ViewGroup) ((ViewGroup) web.getParent()).removeView(web);
            VentoApp.envoltura.setBaseContext(getApplicationContext());
        } catch (Exception ignorado) { }
        if (!VentoServicio.activo) {
            // Sin servicio de fondo no tiene sentido mantenerla: se libera.
            try { VentoApp.web.destroy(); } catch (Exception ignorado) { }
            VentoApp.web = null;
        }
        super.onDestroy();
    }

    /** Atrás: primero cierra la ventana abierta en Vento; si no hay ninguna, vuelve; si no, a segundo plano. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("(function(){try{return !!(window.ventoAtras&&window.ventoAtras());}catch(e){return false;}})()", r -> {
            if ("true".equals(r)) return;
            if (web.canGoBack()) web.goBack();
            else moveTaskToBack(true);          // sigue trabajando de fondo
        });
    }

    // ---------------------------------------------------------------- Permisos de fondo
    void pedirPermisoAvisos() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, RC_PERM_AVISOS);
        }
    }

    /** Pide que Android no «duerma» a Vento por ahorro de batería (una vez, o cuando se toca en Vento). */
    void pedirSinAhorroBateria(boolean siempre) {
        if (Build.VERSION.SDK_INT < 23) return;
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && pm.isIgnoringBatteryOptimizations(getPackageName())) return;
            android.content.SharedPreferences p = getSharedPreferences("vento", MODE_PRIVATE);
            if (!siempre && p.getBoolean("bateriaPedida", false)) return;
            p.edit().putBoolean("bateriaPedida", true).apply();
            @SuppressLint("BatteryLife")
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()));
            startActivity(i);
        } catch (Exception e) {
            try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); } catch (Exception ignorado) { }
        }
    }

    void pedirPermisoVoz() {
        if (Build.VERSION.SDK_INT >= 23) requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, RC_PERM_VOZ);
    }

    void pedirPermisosWeb(PermissionRequest req, ArrayList<String> faltan) {
        boolean yaPreguntando = !permisosWeb.isEmpty();
        permisosWeb.add(req);
        if (yaPreguntando) return;                      // se responde junto con la que ya está preguntando
        if (faltan.contains(Manifest.permission.CAMERA)) getSharedPreferences("vento", MODE_PRIVATE).edit().putBoolean("camaraPreguntada", true).apply();
        if (Build.VERSION.SDK_INT >= 23) requestPermissions(faltan.toArray(new String[0]), RC_PERM_WEB);
    }

    // ---------------------------------------------------------------- Cámara y galería
    boolean elegirArchivo(ValueCallback<Uri[]> cb, WebChromeClient.FileChooserParams p) {
        if (archivoCb != null) archivoCb.onReceiveValue(null);
        archivoCb = cb;
        archivoParams = p;
        boolean quiereFoto = false;
        for (String t : p.getAcceptTypes()) if (t != null && t.startsWith("image")) quiereFoto = true;
        if (quiereFoto && p.isCaptureEnabled() && !VentoApp.tiene(Manifest.permission.CAMERA) && Build.VERSION.SDK_INT >= 23) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, RC_PERM_ARCHIVO);
            return true;
        }
        abrirSelector();
        return true;
    }

    private void abrirSelector() {
        WebChromeClient.FileChooserParams p = archivoParams;
        Intent galeria;
        try {
            galeria = p != null ? p.createIntent() : new Intent(Intent.ACTION_GET_CONTENT).setType("*/*");
        } catch (Exception e) {
            galeria = new Intent(Intent.ACTION_GET_CONTENT).setType("*/*");
        }
        galeria.addCategory(Intent.CATEGORY_OPENABLE);
        if (p != null && p.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) galeria.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);

        boolean quiereFoto = false;
        if (p != null) for (String t : p.getAcceptTypes()) if (t != null && (t.startsWith("image") || t.isEmpty())) quiereFoto = true;
        Intent camara = null;
        camaraUri = null;
        if (quiereFoto && VentoApp.tiene(Manifest.permission.CAMERA)) {
            try {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Images.Media.DISPLAY_NAME, "vento-" + System.currentTimeMillis() + ".jpg");
                cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                camaraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                if (camaraUri != null) {
                    camara = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    camara.putExtra(MediaStore.EXTRA_OUTPUT, camaraUri);
                    camara.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }
            } catch (Exception e) {
                camara = null;
            }
        }
        Intent elegir;
        if (camara != null && p != null && p.isCaptureEnabled()) {
            elegir = camara;                                   // botón «Cámara» de Vento: directo a la cámara
        } else {
            elegir = Intent.createChooser(galeria, "Elegir archivo");
            if (camara != null) elegir.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camara});
        }
        try {
            startActivityForResult(elegir, RC_ARCHIVO);
        } catch (Exception e) {
            if (archivoCb != null) archivoCb.onReceiveValue(null);
            archivoCb = null;
        }
    }

    @Override
    protected void onActivityResult(int rc, int resultado, Intent datos) {
        super.onActivityResult(rc, resultado, datos);
        if (rc != RC_ARCHIVO || archivoCb == null) return;
        Uri[] res = null;
        if (resultado == RESULT_OK) {
            if (datos != null && datos.getClipData() != null) {
                int n = datos.getClipData().getItemCount();
                res = new Uri[n];
                for (int i = 0; i < n; i++) res[i] = datos.getClipData().getItemAt(i).getUri();
            } else if (datos != null && datos.getData() != null) {
                res = new Uri[]{datos.getData()};
            } else if (camaraUri != null) {
                res = new Uri[]{camaraUri};
            }
        } else if (camaraUri != null) {
            try { getContentResolver().delete(camaraUri, null, null); } catch (Exception ignorado) { }
        }
        // 1.65.7: se le pasa a la página una COPIA del archivo dentro de ORDEVA (con su tamaño y su nombre de verdad), no la
        // dirección de la app de donde vino. Con WhatsApp, Drive, Descargas y otros, el visor web de Android leía el PDF
        // como «vacío (0 bytes)» y la factura no se podía leer. La foto recién tomada con la cámara ya es de ORDEVA.
        final ValueCallback<Uri[]> cb = archivoCb;
        final Uri[] originales = res;
        final Uri propia = camaraUri;
        archivoCb = null;
        camaraUri = null;
        if (originales == null) { cb.onReceiveValue(null); return; }
        new Thread(() -> {
            Uri[] copias = new Uri[originales.length];
            for (int i = 0; i < originales.length; i++) copias[i] = originales[i] != null && !originales[i].equals(propia) ? copiaPropia(originales[i]) : originales[i];
            VentoApp.ui.post(() -> cb.onReceiveValue(copias));
        }, "vento-archivo").start();
    }

    /** Copia lo elegido a la caché de ORDEVA («elegidos/», se borra a la hora) y devuelve su dirección propia. Si no se pudo
     *  copiar, la de antes. */
    private Uri copiaPropia(Uri u) {
        try {
            java.io.File dir = new java.io.File(getCacheDir(), "elegidos");
            if (!dir.exists()) dir.mkdirs();
            java.io.File[] viejos = dir.listFiles();
            if (viejos != null) for (java.io.File f : viejos) if (System.currentTimeMillis() - f.lastModified() > 3600_000L) f.delete();
            String nombre = null;
            try (android.database.Cursor c = getContentResolver().query(u, new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst()) nombre = c.getString(0);
            } catch (Exception ignorado) { }
            if (nombre == null || nombre.trim().isEmpty()) nombre = u.getLastPathSegment();
            nombre = (nombre == null ? "archivo" : nombre).replaceAll("[^A-Za-z0-9._ ()-]", "_");
            if (!nombre.contains(".")) {
                String ext = android.webkit.MimeTypeMap.getSingleton().getExtensionFromMimeType(getContentResolver().getType(u));
                if (ext != null) nombre += "." + ext;
            }
            java.io.File sub = new java.io.File(dir, Long.toString(System.nanoTime(), 36));
            sub.mkdirs();
            java.io.File f = new java.io.File(sub, nombre);
            long n = 0;
            try (java.io.InputStream in = getContentResolver().openInputStream(u); java.io.OutputStream out = new java.io.FileOutputStream(f)) {
                if (in == null) return u;
                byte[] b = new byte[64 * 1024]; int r;
                while ((r = in.read(b)) > 0) { out.write(b, 0, r); n += r; }
            }
            if (n <= 0) return u;
            return androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".archivos", f);
        } catch (Throwable e) {
            return u;
        }
    }

    @Override
    public void onRequestPermissionsResult(int rc, String[] permisos, int[] resultados) {
        super.onRequestPermissionsResult(rc, permisos, resultados);
        boolean ok = resultados.length > 0;
        for (int r : resultados) if (r != PackageManager.PERMISSION_GRANTED) ok = false;
        if (rc == Equipos.RC_BT) { Equipos.permisoBluetooth(ok); return; }   // impresora o balanza Bluetooth
        if (rc == RC_PERM_WEB) {
            // Se mira el permiso de VERDAD (no la respuesta, que llega vacía si se canceló por otra pregunta encima).
            for (PermissionRequest r : new java.util.ArrayList<>(permisosWeb)) {
                boolean todos = true;
                for (String x : r.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(x) && !VentoApp.tiene(Manifest.permission.CAMERA)) todos = false;
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(x) && !VentoApp.tiene(Manifest.permission.RECORD_AUDIO)) todos = false;
                }
                try { if (todos) r.grant(r.getResources()); else r.deny(); } catch (Exception ignorado) { }
            }
            permisosWeb.clear();
        } else if (rc == RC_PERM_ARCHIVO) {
            abrirSelector();
        } else if (rc == RC_PERM_INICIO) {
            if (VentoApp.tiene(Manifest.permission.RECORD_AUDIO)) VentoApp.app.prepararVoz();
            VentoApp.js("try{window.ventoPermisosCambio&&window.ventoPermisosCambio();window.ventoHola&&window.ventoHola.arrancar()}catch(e){}");
            pedirSinAhorroBateria(false);
        } else if (rc == RC_PERM_VOZ) {
            if (ok && VentoApp.app.vozPendiente) VentoApp.app.iniciarVoz();
            else VentoApp.app.vozNegada();
        }
    }
}
