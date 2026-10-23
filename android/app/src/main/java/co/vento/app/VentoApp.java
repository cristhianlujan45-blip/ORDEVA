package co.vento.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Application;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.MutableContextWrapper;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Locale;

/**
 * El «motor» de Vento: una sola página de Vento que vive mientras viva la app (no la ventana).
 * La ventana (MainActivity) solo la muestra; si la ventana se cierra o la app se quita de
 * recientes, el motor sigue corriendo con el servicio de fondo (VentoServicio): siguen llegando
 * los pedidos y siguen sonando las canciones en el TV.
 */
public class VentoApp extends Application {

    static final String URL_VENTO = "https://cristhianlujan45-blip.github.io/ORDEVA/";   // 1.55.2: el repositorio ahora es ORDEVA (antes …/cuentas/)
    static final String HOST_VENTO = "cristhianlujan45-blip.github.io";

    static VentoApp app;
    static WebView web;                         // la página de Vento (una sola, para que nada se duplique)
    static MutableContextWrapper envoltura;     // la página usa la ventana cuando hay, o la app cuando no
    static volatile boolean alFrente = false;   // la ventana de Vento se está viendo ahora
    static volatile long ultimoPago = 0;         // cuándo se dijo el último pago (la actualización automática no lo interrumpe)
    static int avisoN = 100;
    static MainActivity ventana;                // la ventana abierta (null si está cerrada)
    static final Handler ui = new Handler(Looper.getMainLooper());

    private SpeechRecognizer voz;
    private String vozIdioma = "es-CO";
    private boolean vozParcial = true;
    boolean vozPendiente = false;
    private TextToSpeech tts;
    private boolean ttsListo = false;
    private final ArrayList<Runnable> hablarFila = new ArrayList<>();
    private boolean vozMuda = false;

    @Override
    public void onCreate() {
        super.onCreate();
        app = this;
        crearCanales();
        Guardia.programar(this);                 // 🛡️ si la marca del celular cierra Vento, se vuelve a prender sola
    }

    /**
     * Las categorías de notificaciones de Vento se crean apenas abre la app (antes se creaban con el primer aviso:
     * «Canciones pedidas» no existía hasta que pedían una canción y no se podía prender en el celular).
     */
    void crearCanales() {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm == null) return;
            String[][] cs = {
                {"vento_pedidos2", "Pedidos y cuentas", "alto"},
                {"vento_musica2", "Canciones pedidas", "alto"},
                {"vento_avisos2", "Avisos de ORDEVA (IA y soporte)", "normal"},
                {"vento_pagos", "💜 Pagos que te llegan", "alto"}};
            for (String[] c : cs) {
                if (nm.getNotificationChannel(c[0]) != null) continue;
                android.app.NotificationChannel ch = new android.app.NotificationChannel(c[0], c[1],
                        "alto".equals(c[2]) ? android.app.NotificationManager.IMPORTANCE_HIGH : android.app.NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("Suena aunque ORDEVA esté cerrada.");
                ch.enableVibration("alto".equals(c[2]));
                ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                if ("vento_pagos".equals(c[0])) {
                    // Los pagos suenan aunque el celular esté bloqueado o en silencio de notificaciones del resto.
                    ch.setDescription("«Pago confirmado»: suena aunque la pantalla esté bloqueada o ORDEVA cerrada.");
                    ch.setVibrationPattern(new long[]{0, 250, 120, 250});
                    ch.setBypassDnd(true);
                }
                nm.createNotificationChannel(ch);
            }
        } catch (Exception e) { /* sin notificaciones no pasa nada */ }
    }

    /** Crea la página de Vento si todavía no existe. Siempre en el hilo principal. */
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    static WebView motor(Context base) {
        if (web != null) {
            if (base != null) envoltura.setBaseContext(base);
            return web;
        }
        envoltura = new MutableContextWrapper(base != null ? base : app);
        // La página siempre se da por «visible»: con Vento minimizada o la pantalla apagada YouTube no pausa la
        // música y los relojes de la página no se frenan (la música sigue sola, una canción tras otra).
        web = new WebView(envoltura) {
            @Override protected void onWindowVisibilityChanged(int visibility) { super.onWindowVisibilityChanged(android.view.View.VISIBLE); }
        };
        web.setBackgroundColor(0xFF0B0A12);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setAllowFileAccess(false);
        s.setOffscreenPreRaster(true);          // sigue trabajando aunque no se esté mostrando
        s.setUserAgentString(s.getUserAgentString() + " VentoAndroid/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.addJavascriptInterface(app.new Puente(), "VentoAndroid");
        web.addJavascriptInterface(new Equipos(app), "VentoEquipos");   // 🔌 balanza, impresora de facturas y cajón
        web.setWebViewClient(new Clientes.Navegacion());
        web.setWebChromeClient(new Clientes.Cromo());
        // De fondo, Android baja la prioridad de la página y a veces la cierra: así sigue como «importante».
        if (Build.VERSION.SDK_INT >= 26) {
            try { web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false); } catch (Exception ignorado) { }
        }
        web.loadUrl(URL_VENTO);
        return web;
    }

    static void js(final String codigo) {
        ui.post(() -> { if (web != null) web.evaluateJavascript(codigo, null); });
    }

    static String q(String s) { return JSONObject.quote(s == null ? "" : s); }

    /** Llegó plata (aviso de DaviPlata, Nequi…): se dice en voz alta YA desde Android —también con Vento minimizada o la
     *  pantalla apagada— «Pago confirmado. 200 pesos desde DaviPlata.» y, si Vento no se está viendo, sale el aviso del
     *  celular «💜 Pagaron $200 por DaviPlata». La página lo registra después (sin volver a decirlo). */
    static void anunciarPago(String appBanco, long monto, boolean notif) { anunciarPago(appBanco, monto, notif, null); }

    /** Con el texto del aviso: si llegó por la llave Bre-B, la voz y el aviso lo dicen. */
    static void anunciarPago(String appBanco, long monto, boolean notif, String texto) {
        if (app == null || monto <= 0) return;
        String frase = AvisoPago.frase(appBanco, monto, texto);
        decirPago(frase);
        if (notif) notificarPago("💜 Recibiste " + AvisoPago.plata(monto) + (AvisoPago.esBreB(texto) ? " por Bre-B en " : " por ") + AvisoPago.nombreApp(appBanco), frase, texto,
                AvisoPago.plata(monto), (AvisoPago.esBreB(texto) ? "Bre-B en " : "") + AvisoPago.nombreApp(appBanco), "ok");
    }

    /**
     * Notificación de cada pago: sale SIEMPRE, con Vento abierta, cerrada o el celular bloqueado (antes, con Vento abierta
     * no salía). Título con el valor («💜 Recibiste $20.000 por Nequi») y el texto: la frase y lo que dijo el banco. Se ve
     * completa en la pantalla de bloqueo, y prende la pantalla unos segundos para que se vea sin tocar el celular.
     */
    static void notificarPago(String titulo, String frase, String original) { notificarPago(titulo, frase, original, "", "", "ok"); }

    /** Además, la 💜 ventana emergente con el valor (VentanaPago): encima de la pantalla de bloqueo si está bloqueado, o
     *  encima de la app que se esté usando. tipo: ok · sinvalor · revisar · falso. */
    static void notificarPago(String titulo, String frase, String original, String valor, String banco, String tipo) {
        if (app == null) return;
        String o = original == null ? "" : original.replaceAll("\\s+", " ").trim();
        if (o.length() > 220) o = o.substring(0, 220) + "…";
        String txt = (frase == null ? "" : frase) + (o.isEmpty() ? "" : "\n«" + o + "»");
        boolean ventana = VentanaPago.prendida(app), bloqueado = VentanaPago.bloqueado(app);
        // Cómo se abre la ventana en ESTE celular (ver PlanVentana: el mismo plan para Samsung, Xiaomi y todos los demás).
        PlanVentana plan = ventana ? PlanVentana.de(Build.VERSION.SDK_INT, bloqueado, alFrente, VentanaPago.puedeEncima(app), VentanaPago.puedePantallaCompleta(app),
                VentanaPago.esXiaomi(), VentanaPago.xiaomiPermiso(app, 10021), VentanaPago.xiaomiPermiso(app, 10020)) : new PlanVentana();
        Intent vi = VentanaPago.intent(app, valor, banco, frase, o, tipo);
        final long desde = System.currentTimeMillis();
        // Primero se prende la pantalla y DESPUÉS se abre la ventana: con la pantalla apagada varios celulares no dejan
        // abrir una pantalla (antes se prendía al final).
        prenderPantalla();
        try { app.new Puente().publicar(titulo, txt, "pagos", true, plan.pantallaCompleta ? vi : null); } catch (Exception ignorado) { }
        if (plan.encima) VentanaPago.mostrarEncima(app, valor, banco, frase, o, tipo);
        if (plan.directo) { if (plan.ancla) VentanaPago.ancla(app); VentanaPago.abrirPantalla(app, vi); }
        // 🪟 ¿Se VIO la ventana? Si no, se vuelve a intentar a los 1,5 s y a los 4 s. DaviPlata avisa dos veces (la app y el
        // SMS del 85888, segundos después) y su segundo aviso la abría aunque el primero fallara mientras el celular se
        // despertaba. Nequi avisa UNA sola vez: si ese intento fallaba, no salía nunca. Ahora todos tienen sus intentos.
        if (ventana && (plan.pantallaCompleta || plan.directo || plan.encima)) {
            final PlanVentana pl = plan; final String t0 = titulo, v0 = valor, b0 = banco, f0 = frase, o0 = o, ti0 = tipo;
            ui.postDelayed(() -> asegurarVentana(desde, pl, vi, t0, v0, b0, f0, o0, ti0, 1), 1500);
        }
    }

    /** ¿La ventana del pago quedó a la vista? Si no (y Vento no se está viendo), se intenta otra vez con el celular ya
     *  despierto; al final queda en el registro (Ajustes → Pagos y 🐞 Errores del panel) si se vio y en qué intento. */
    // onResume (no onCreate): una ventana creada DETRÁS de la pantalla de bloqueo no cuenta como vista.
    private static boolean seVio(long desde) { return PagoActivity.vista >= desde || VentanaPago.mostrandoEncima(); }
    static void asegurarVentana(long desde, PlanVentana pl, Intent vi, String titulo, String valor, String banco, String frase, String o, String tipo, int intento) {
        try {
            if (app == null) return;
            boolean visto = seVio(desde), encima = VentanaPago.puedeEncima(app);
            String otra = PlanVentana.reintento(visto, alFrente, VentanaPago.prendida(app), intento, VentanaPago.bloqueado(app), encima);
            if (!otra.isEmpty()) {
                prenderPantalla();
                if ("encima".equals(otra)) VentanaPago.mostrarEncima(app, valor, banco, frase, o, tipo);
                else { if (encima && Build.VERSION.SDK_INT >= 29) VentanaPago.ancla(app); VentanaPago.abrirPantalla(app, vi); }
                ui.postDelayed(() -> asegurarVentana(desde, pl, vi, titulo, valor, banco, frase, o, tipo, intento + 1), intento == 1 ? 2500 : 2000);
                return;
            }
            boolean bl = VentanaPago.bloqueado(app);
            String r = visto ? "🪟 ventana abierta" + (intento > 1 ? " (al intento " + intento + ")" : "")
                    : alFrente ? "🪟 ventana: Vento ya estaba a la vista"
                    : "🪟 la ventana no se abrió (" + (bl ? "celular bloqueado" : "usando otra app") + ", " + Build.MANUFACTURER + " Android " + Build.VERSION.RELEASE
                    + (pl.falta.isEmpty() ? "" : ", falta el permiso: " + pl.falta) + ", 3 intentos)";
            VentoEscucha.traza(app.getSharedPreferences("vento", MODE_PRIVATE), "Vento", titulo, r);
        } catch (Throwable ignorado) { }
    }

    /** Prende la pantalla unos segundos (si estaba apagada) para que se vea la notificación del pago. */
    @SuppressWarnings("deprecation")
    static void prenderPantalla() {
        try {
            android.os.PowerManager pm = (android.os.PowerManager) app.getSystemService(Context.POWER_SERVICE);
            if (pm == null || pm.isInteractive()) return;
            android.os.PowerManager.WakeLock w = pm.newWakeLock(android.os.PowerManager.SCREEN_BRIGHT_WAKE_LOCK
                    | android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP | android.os.PowerManager.ON_AFTER_RELEASE, "vento:pantalla");
            w.acquire(6000L);
        } catch (Throwable ignorado) { }
    }

    /** Aviso del celular de un pago confirmado (sin la voz, que ya se dijo). */
    static void anunciarPagoAviso(String banco, long monto) { anunciarPagoAviso(banco, monto, null); }
    static void anunciarPagoAviso(String banco, long monto, String texto) {
        if (app == null || monto <= 0) return;
        notificarPago("💜 Recibiste " + AvisoPago.plata(monto) + " por " + AvisoPago.nombreApp(banco), AvisoPago.frase(banco, monto, texto), texto,
                AvisoPago.plata(monto), (AvisoPago.esBreB(texto) ? "Bre-B en " : "") + AvisoPago.nombreApp(banco), "ok");
    }

    // ---------------------------------------------------------------- Voz de los pagos
    // Su propia voz: la de la página se calla cada vez que la página va a decir otra cosa (y cortaba el «Pago confirmado»).
    // Los pagos que llegan mientras la voz se prepara quedan en fila (antes el segundo se perdía) y, mientras habla, la
    // música baja un momento para que se oiga en el negocio.
    // Volumen propio (Ajustes → Pagos → «Volumen de la voz de los pagos»): suena por el canal de la ALARMA, al nivel elegido
    // (no depende de qué tan alta esté la música) y luego deja el volumen del celular como estaba. Más de 100 % = al máximo
    // y reforzada (LoudnessEnhancer): más fuerte de lo normal.
    private static TextToSpeech ttsPago;
    private static boolean ttsPagoListo = false;
    private static final ArrayList<String> pagosEnFila = new ArrayList<>();
    private static int pagosHablando = 0;
    private static Object focoPago;
    private static int volGuardado = -1;
    private static final java.util.HashMap<String, Object[]> archivosPago = new java.util.HashMap<>();
    private static final ArrayList<Object[]> porTocar = new ArrayList<>();
    private static boolean tocando = false;
    static final String PREF_VOL = "pagosVolumen";

    static int volPagos() {
        try { return AvisoPago.volumen(app.getSharedPreferences("vento", MODE_PRIVATE).getInt(PREF_VOL, 100)); } catch (Exception e) { return 100; }   // de fábrica 100 % (la alarma al máximo, dicha directo)
    }

    private static android.media.AudioAttributes atributosPago() {
        return new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_ALARM)
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH).build();
    }

    // Con la pantalla bloqueada, Android congela la app apenas termina de leer el aviso del banco: el procesador se
    // mantiene despierto mientras se prepara y se dice la voz (máximo 45 s).
    private static android.os.PowerManager.WakeLock despierto;

    static void mantenerDespierto() {
        try {
            if (despierto == null) {
                android.os.PowerManager pm = (android.os.PowerManager) app.getSystemService(Context.POWER_SERVICE);
                despierto = pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "vento:pago");
                despierto.setReferenceCounted(false);
            }
            despierto.acquire(45_000L);
        } catch (Throwable ignorado) { }
    }

    private static void soltarDespierto() {
        try { if (despierto != null && despierto.isHeld()) despierto.release(); } catch (Throwable ignorado) { }
    }

    // Marca de «va al parlante de avisos» (ver Parlante): la frase viaja por la misma fila de la voz de los pagos.
    static final String AL_PARLANTE = "\u0001";

    /** El aviso que leyó este celular, al Servidor Vento de una (Cruce): les llega ya a los demás equipos del negocio. */
    static void reenviarPago(String id, String txt, String revisar, boolean smsOk) { if (app != null) Cruce.reenviar(app, id, txt, revisar, smsOk); }

    /** «🔊 Decir los pagos en voz alta» (Ajustes → Pagos). Apagado: los pagos llegan con su notificación y su ventana, sin voz. */
    static boolean vozPagosOn() { return app == null || app.getSharedPreferences("vento", MODE_PRIVATE).getBoolean("pagosVoz", true); }
    static void decirPago(final String frase) {
        if (!vozPagosOn()) return;
        decirPagoSiempre(frase);
    }
    static void decirPagoSiempre(final String frase) {
        ultimoPago = System.currentTimeMillis();
        decirVoz(Parlante.usa(app, "pagos") ? AL_PARLANTE + frase : frase);
    }

    /** Un aviso (pedido, piden la cuenta, domicilio…) dicho SOLO en el parlante de avisos. Sin parlante conectado no suena
     *  (la notificación del celular ya salió). */
    static void decirAviso(final String frase) {
        if (app == null || frase == null || frase.isEmpty() || Parlante.elegido(app) == null) return;
        decirVoz(AL_PARLANTE + frase);
    }

    private static void decirVoz(final String frase) {
        mantenerDespierto();
        ui.post(() -> {
            if (ttsPago != null && ttsPagoListo) { hablarPago(frase); return; }
            pagosEnFila.add(frase);
            if (ttsPago != null) return;                        // ya se está preparando: la dice apenas quede lista
            crearVoz();
        });
    }

    /** Deja el motor de voz de los pagos listo de antemano (al arrancar Vento y cada rato): así el primer «Recibiste…» sale
     *  de una, sin esperar a que el motor arranque (en Xiaomi tarda segundos). */
    static void prepararVozPagos() {
        if (app == null) return;
        ui.post(() -> { if (ttsPago == null) crearVoz(); });
    }

    // ---------- Qué motor de voz usar (1.52.0) ----------
    // En Samsung el motor de fábrica («Samsung TTS») muchas veces NO trae la voz en español: el pago se mandaba a decir
    // y no sonaba nada; el reintento usaba el mismo motor y la voz de respaldo también. En Xiaomi casi siempre está el
    // de Google y sí sonaba. Ahora: el motor de Google («Servicios de voz de Google», que viene en casi todos los
    // Android, también en Samsung) y, si no está, no habla español o no responde, el otro. Los reintentos alternan.
    static final String GOOGLE_TTS = "com.google.android.tts";
    private static String motorForzado = null;     // null: automático · "": el del celular · paquete: ese
    static String motorPago = "";                  // el que quedó hablando (para el chequeo)
    static boolean motorInstalado(Context c, String pkg) {
        try {
            for (android.content.pm.ResolveInfo r : c.getPackageManager().queryIntentServices(new Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE), 0))
                if (r.serviceInfo != null && pkg.equals(r.serviceInfo.packageName)) return true;
        } catch (Throwable ignorado) { }
        return false;
    }
    /** El paquete del motor a usar; null = el del celular. */
    static String motorElegido(Context c) {
        if (motorForzado != null) return motorForzado.isEmpty() ? null : motorForzado;
        return motorInstalado(c, GOOGLE_TTS) ? GOOGLE_TTS : null;
    }
    /** El otro motor (para cuando el elegido no sirvió); null si no hay otro. */
    private static String otroMotor(String usado) {
        if (usado != null) return "";                                                   // falló Google: el del celular
        return motorInstalado(app, GOOGLE_TTS) ? GOOGLE_TTS : null;                     // falló el del celular: Google
    }
    static TextToSpeech nuevoMotor(Context c, TextToSpeech.OnInitListener l, String motor) {
        return motor != null ? new TextToSpeech(c, l, motor) : new TextToSpeech(c, l);
    }
    /** Pone el español (de Colombia o el que tenga). false si este motor no tiene voz en español. */
    static boolean ponerEspanol(TextToSpeech t) {
        try {
            int r = t.setLanguage(Locale.forLanguageTag("es-CO"));
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) r = t.setLanguage(new Locale("es", "US"));
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) r = t.setLanguage(new Locale("es"));
            return r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
        } catch (Throwable e) { return false; }
    }

    private static void crearVoz() { crearVoz(false); }
    private static void crearVoz(final boolean segundo) {
        final String motor = motorElegido(app);
        try {
            ttsPago = nuevoMotor(app, st -> ui.post(() -> {
                boolean listo = st == TextToSpeech.SUCCESS && ttsPago != null;
                boolean espanol = listo && ponerEspanol(ttsPago);
                if (!(listo && espanol) && !segundo) {
                    // Este motor no arrancó o no habla español: se prueba el otro (los pagos en fila esperan).
                    String otro = otroMotor(motor);
                    if (otro != null) {
                        VentoEscucha.traza(app.getSharedPreferences("vento", MODE_PRIVATE), "Vento", "Voz de los pagos",
                                "🔇 el motor de voz " + (motor == null ? "del celular" : motor) + (listo ? " no tiene voz en español" : " no arrancó") + ": se usa " + (otro.isEmpty() ? "el del celular" : otro));
                        try { if (ttsPago != null) ttsPago.shutdown(); } catch (Exception ignorado) { }
                        ttsPago = null; ttsPagoListo = false;
                        motorForzado = otro;
                        crearVoz(true);
                        return;
                    }
                }
                ttsPagoListo = listo;
                ArrayList<String> fila = new ArrayList<>(pagosEnFila);
                pagosEnFila.clear();
                if (!ttsPagoListo) {                       // sin voz propia: la de siempre
                    try { if (ttsPago != null) ttsPago.shutdown(); } catch (Exception ignorado) { }
                    ttsPago = null;
                    for (String f : fila) try { app.new Puente().hablar(AvisoPago.pausado(f.startsWith(AL_PARLANTE) ? f.substring(1) : f), "es-CO", AvisoPago.VELOCIDAD); } catch (Exception ignorado) { }
                    return;
                }
                motorPago = motor == null ? "" : motor;
                try { if (motorPago.isEmpty()) motorPago = "sistema:" + ttsPago.getDefaultEngine(); } catch (Exception ignorado) { }
                try { ttsPago.setAudioAttributes(atributosPago()); } catch (Exception ignorado) { }
                try { ttsPago.setSpeechRate(AvisoPago.VELOCIDAD); } catch (Exception ignorado) { }
                ttsPago.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String u) { vozEmpezo = System.currentTimeMillis(); }
                    @Override public void onDone(String u) { vozEmpezo = System.currentTimeMillis(); ui.post(() -> terminoVoz(u, true)); }
                    @Override public void onError(String u) { vozEmpezo = System.currentTimeMillis(); ui.post(() -> terminoVoz(u, false)); }
                });
                for (String f : fila) hablarPago(f);
            }), motor);
        } catch (Exception e) {
            ttsPago = null;
            for (String f : new ArrayList<>(pagosEnFila)) try { app.new Puente().hablar(AvisoPago.pausado(f.startsWith(AL_PARLANTE) ? f.substring(1) : f), "es-CO", AvisoPago.VELOCIDAD); } catch (Exception ignorado) { }
            pagosEnFila.clear();
        }
    }

    private static void hablarPago(String frase0) {
        final boolean alParlante = frase0 != null && frase0.startsWith(AL_PARLANTE) && Parlante.elegido(app) != null;
        // Con pausas cortas («Recibiste, 20000 pesos, por Nequi.») y más despacio: que se entienda el valor (1.43.4).
        final String frase = AvisoPago.pausado(frase0 != null && frase0.startsWith(AL_PARLANTE) ? frase0.substring(1) : frase0);
        try {
            ponerEspanol(ttsPago);
            ttsPago.setSpeechRate(AvisoPago.VELOCIDAD);
            // En el parlante de avisos no se toca la música del celular (va por otro lado) ni el volumen de la alarma.
            if (!alParlante) { bajarMusica(); ponerVolumen(); }
            pagosHablando++;
            // Por si el motor de voz nunca avisa que terminó: la música y el volumen vuelven solos.
            ui.postDelayed(() -> { if (pagosHablando > 0) { pagosHablando = 0; subirMusica(); } }, 25000);
            // Lo de siempre (lo que funcionó en todas las versiones hasta la 1.39): se dice DIRECTO con el motor de voz,
            // con un silencio corto antes para que la salida despierte y no empiece bajito. Solo se graba y se toca desde un
            // archivo cuando hace falta: volumen por encima de 100 % (ganancia fija, AvisoPago.vozPareja) o el parlante de
            // avisos (Parlante). En la 1.40.0 TODO pasaba por el archivo y en algunos celulares el pago no sonaba.
            // Por dónde sale (PlanVoz): grabar a archivo solo con el parlante o con motores de voz que lo hacen bien.
            String motor = null; try { motor = ttsPago.getDefaultEngine(); } catch (Exception ignorado) { }
            if (!"directo".equals(PlanVoz.camino(alParlante, volPagos(), motor))) {
                java.io.File f = new java.io.File(app.getCacheDir(), "pago" + System.nanoTime() + ".wav");
                String id = "arch" + System.nanoTime();
                archivosPago.put(id, new Object[]{f, frase, alParlante});
                if (ttsPago.synthesizeToFile(frase, null, f, id) == TextToSpeech.SUCCESS) {
                    // Hay motores de voz que graban pero nunca avisan que terminaron: el pago se quedaba sin sonar.
                    // Si en 6 s no avisó, se dice directo (sin esperar más).
                    ui.postDelayed(() -> { if (archivosPago.remove(id) != null) decirDirecto(frase); }, 3000);
                    return;
                }
                archivosPago.remove(id);
            }
            decirDirecto(frase);
        } catch (Exception e) {
            pagoTermino();
            try { app.new Puente().hablar(frase, "es-CO", AvisoPago.VELOCIDAD); } catch (Exception ignorado) { }
        }
    }

    // ¿La voz SÍ arrancó? Vento queda prendida días de fondo con su motor de voz abierto, y Android a veces cierra ese motor
    // sin avisar: desde ahí cada «Recibiste…» se mandaba a un motor muerto y no sonaba nada. Si el motor no responde (error
    // al hablar) se abre uno nuevo y se dice otra vez; si tampoco, con la voz de la página.
    // 1.43.4: en la 1.43.3 se esperaban solo 2,5 s a que empezara: el motor de voz de Xiaomi tarda más en arrancar, Vento
    // creía que estaba muerto, lo cerraba EN MEDIO de la frase y la voz se cortaba o no salía. Ahora se esperan 9 s y basta
    // cualquier señal del motor (empezó, terminó o falló); y por esa vía nunca se dice con una segunda voz encima.
    private static volatile long vozEmpezo = 0;
    private static final java.util.HashMap<String, Long> vozReintentada = new java.util.HashMap<>();

    private static void decirDirecto(String frase) {
        // Silencio corto antes: la salida de audio ya está despierta en la primera palabra (no empieza bajito).
        final long pedido = System.currentTimeMillis();
        try { if (ttsPago != null && Build.VERSION.SDK_INT >= 21) ttsPago.playSilentUtterance(200, TextToSpeech.QUEUE_ADD, "sil" + System.nanoTime()); } catch (Exception ignorado) { }
        int r;
        try { r = ttsPago == null ? TextToSpeech.ERROR : ttsPago.speak(frase, TextToSpeech.QUEUE_ADD, paramsVoz(), "pago" + System.nanoTime()); } catch (Exception e) { r = TextToSpeech.ERROR; }
        if (r != TextToSpeech.SUCCESS) { pagoTermino(); vozDeNuevo(frase, "el motor de voz no respondió", true); return; }
        ui.postDelayed(() -> {
            boolean habla = false; try { habla = ttsPago != null && ttsPago.isSpeaking(); } catch (Exception ignorado) { }
            if (vozEmpezo < pedido && !habla) { pagoTermino(); vozDeNuevo(frase, "el motor de voz no dio señales en 9 s", false); }
        }, 9000);
    }

    // Más de 100 % (Ajustes → Pagos): el refuerzo va sobre la MISMA voz dicha directo (su sesión de audio con un
    // LoudnessEnhancer de ganancia fija), sin grabarla antes a un archivo. Con 100 % o menos no se toca nada.
    private static android.media.audiofx.LoudnessEnhancer realce;
    private static int realceSesion = 0;
    static android.os.Bundle paramsVoz() {
        android.os.Bundle b = new android.os.Bundle();
        // Por la alarma y a todo volumen también así: hay motores que no leen setAudioAttributes y salían por la
        // música (bajita o en silencio en el negocio).
        b.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, android.media.AudioManager.STREAM_ALARM);
        b.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1f);
        int g = AvisoPago.refuerzo(volPagos());
        if (g <= 0 || Build.VERSION.SDK_INT < 21 || app == null) return b;
        try {
            if (realce == null) {
                android.media.AudioManager am = (android.media.AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
                if (am == null) return b;
                realceSesion = am.generateAudioSessionId();
                realce = new android.media.audiofx.LoudnessEnhancer(realceSesion);
            }
            realce.setTargetGain(g);
            realce.setEnabled(true);
            b.putInt(TextToSpeech.Engine.KEY_PARAM_SESSION_ID, realceSesion);
        } catch (Throwable e) {
            try { if (realce != null) realce.release(); } catch (Throwable ignorado) { }
            realce = null; realceSesion = 0;                       // sin refuerzo: igual suena a lo más alto de la alarma
        }
        return b;
    }

    /** La voz del pago no sonó: motor de voz nuevo y se dice otra vez (una vez); si ya se intentó, con la voz de la página. */
    private static void vozDeNuevo(String frase, String porQue, boolean otraVoz) {
        long ahora = System.currentTimeMillis();
        vozReintentada.values().removeIf(t -> ahora - t > 30_000L);
        android.content.SharedPreferences sp = app.getSharedPreferences("vento", MODE_PRIVATE);
        if (vozReintentada.containsKey(frase)) {
            VentoEscucha.traza(sp, "Vento", frase, "🔇 la voz del pago no sonó otra vez (" + porQue + ")" + (otraVoz ? ": se dijo con la voz de la página" : ""));
            if (otraVoz) try { app.new Puente().hablar(frase, "es-CO", AvisoPago.VELOCIDAD); } catch (Exception ignorado) { }
            return;
        }
        vozReintentada.put(frase, ahora);
        // El reintento va con el OTRO motor (Google ↔ el del celular): con el mismo, en Samsung tampoco sonaba.
        String usado = motorPago.isEmpty() || motorPago.startsWith("sistema:") ? null : motorPago, otro = otroMotor(usado);
        if (otro != null) motorForzado = otro;
        VentoEscucha.traza(sp, "Vento", frase, "🔇 " + porQue + ": se volvió a decir con " + (otro == null ? "un motor de voz nuevo" : otro.isEmpty() ? "el motor de voz del celular" : "el motor de voz de Google"));
        try { if (ttsPago != null) ttsPago.shutdown(); } catch (Exception ignorado) { }
        ttsPago = null; ttsPagoListo = false;
        decirVoz(frase);
    }

    /** Lee el WAV grabado y lo deja con el volumen parejo (null si no se pudo: se toca tal cual). */
    private static boolean emparejar(java.io.File f) {
        try {
            byte[] b = new byte[(int) f.length()];
            try (java.io.FileInputStream in = new java.io.FileInputStream(f)) { int n = 0; while (n < b.length) { int r = in.read(b, n, b.length - n); if (r < 0) break; n += r; } }
            byte[] p = AvisoPago.vozPareja(b, volPagos(), 400);
            if (p == null) return false;
            try (java.io.FileOutputStream o = new java.io.FileOutputStream(f)) { o.write(p); }
            return true;
        } catch (Throwable e) { return false; }
    }

    private static void terminoVoz(String u, boolean bien) {
        if (u != null && u.startsWith("sil")) return;              // el silencio de antes de hablar no es el final del pago
        if (u != null && u.startsWith("arch")) {
            Object[] o = archivosPago.remove(u);
            if (o == null) return;
            // Grabado pero vacío o casi (hay motores que «terminan» sin escribir nada): se dice normal.
            java.io.File f0 = (java.io.File) o[0];
            if (bien && (f0 == null || !f0.exists() || f0.length() < 2000)) { try { if (f0 != null) f0.delete(); } catch (Throwable ignorado) { } bien = false; }
            if (bien) { porTocar.add(o); if (!tocando) siguienteArchivo(); }
            else decirDirecto((String) o[1]);                  // no se pudo grabar: se dice normal
            return;
        }
        pagoTermino();
    }

    private static void siguienteArchivo() {
        if (porTocar.isEmpty()) { tocando = false; return; }
        tocando = true;
        Object[] o = porTocar.remove(0);
        final java.io.File f = (java.io.File) o[0];
        final String frase = (String) o[1];
        final boolean alParlante = o.length > 2 && Boolean.TRUE.equals(o[2]);
        android.media.MediaPlayer mp = null;
        try {
            boolean parejo = emparejar(f);
            if (alParlante && parejo) {
                // Directo al parlante de avisos (Bluetooth o cable), sin pasar por donde suena la música.
                byte[] b = new byte[(int) f.length()];
                try (java.io.FileInputStream in = new java.io.FileInputStream(f)) { int n = 0; while (n < b.length) { int r = in.read(b, n, b.length - n); if (r < 0) break; n += r; } }
                if (Parlante.tocar(app, b, () -> { try { f.delete(); } catch (Throwable ignorado) { } pagoTermino(); siguienteArchivo(); })) return;
            }
            mp = new android.media.MediaPlayer();
            mp.setAudioAttributes(atributosPago());
            mp.setDataSource(f.getPath());
            mp.prepare();
            mp.setVolume(1f, 1f);
            // Sin compresor (subía la ganancia de a poco): el refuerzo ya va fijo en el audio. Solo si no se pudo
            // emparejar el archivo y se pidió más de 100 %, se usa el refuerzo del sistema como antes.
            android.media.audiofx.LoudnessEnhancer le = null;
            if (!parejo && AvisoPago.refuerzo(volPagos()) > 0) {
                try {
                    le = new android.media.audiofx.LoudnessEnhancer(mp.getAudioSessionId());
                    le.setTargetGain(AvisoPago.refuerzo(volPagos()));
                    le.setEnabled(true);
                } catch (Throwable ignorado) { }
            }
            final android.media.audiofx.LoudnessEnhancer refuerzo = le;
            final android.media.MediaPlayer jugador = mp;
            Runnable fin = () -> {
                try { if (refuerzo != null) refuerzo.release(); } catch (Throwable ignorado) { }
                try { jugador.release(); } catch (Throwable ignorado) { }
                try { f.delete(); } catch (Throwable ignorado) { }
                pagoTermino();
                siguienteArchivo();
            };
            mp.setOnCompletionListener(m -> fin.run());
            // Si el archivo no se pudo tocar, el pago se dice con la voz normal (antes quedaba callado).
            mp.setOnErrorListener((m, w, e) -> {
                try { if (refuerzo != null) refuerzo.release(); } catch (Throwable ignorado) { }
                try { jugador.release(); } catch (Throwable ignorado) { }
                try { f.delete(); } catch (Throwable ignorado) { }
                decirDirecto(frase);
                siguienteArchivo();
                return true;
            });
            mp.start();
        } catch (Exception e) {
            try { if (mp != null) mp.release(); } catch (Throwable ignorado) { }
            try { f.delete(); } catch (Throwable ignorado) { }
            decirDirecto(frase);                               // no se pudo tocar reforzada: se dice normal
            siguienteArchivo();
        }
    }

    /** El volumen de la alarma al nivel elegido para los pagos (se guarda el que tenía para devolverlo). */
    private static void ponerVolumen() {
        try {
            android.media.AudioManager am = (android.media.AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            int max = am.getStreamMaxVolume(android.media.AudioManager.STREAM_ALARM);
            if (volGuardado < 0) volGuardado = am.getStreamVolume(android.media.AudioManager.STREAM_ALARM);
            am.setStreamVolume(android.media.AudioManager.STREAM_ALARM, AvisoPago.nivel(volPagos(), max), 0);
        } catch (Exception ignorado) { }
    }

    private static void devolverVolumen() {
        try {
            if (volGuardado < 0) return;
            int v = volGuardado;
            volGuardado = -1;
            android.media.AudioManager am = (android.media.AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
            if (am != null) am.setStreamVolume(android.media.AudioManager.STREAM_ALARM, v, 0);
        } catch (Exception ignorado) { }
    }

    private static void pagoTermino() {
        if (pagosHablando > 0) pagosHablando--;
        if (pagosHablando == 0) subirMusica();
    }

    private static void bajarMusica() {
        try {
            if (focoPago != null) return;
            android.media.AudioManager am = (android.media.AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            if (Build.VERSION.SDK_INT >= 26) {
                android.media.AudioFocusRequest f = new android.media.AudioFocusRequest.Builder(android.media.AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                        .setAudioAttributes(new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_ASSISTANT)
                                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH).build())
                        .setOnAudioFocusChangeListener(c -> { }).build();
                am.requestAudioFocus(f);
                focoPago = f;
            } else {
                android.media.AudioManager.OnAudioFocusChangeListener l = c -> { };
                am.requestAudioFocus(l, android.media.AudioManager.STREAM_MUSIC, android.media.AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
                focoPago = l;
            }
        } catch (Exception ignorado) { }
    }

    private static void subirMusica() {
        devolverVolumen();
        soltarDespierto();
        try {
            Object f = focoPago;
            focoPago = null;
            if (f == null) return;
            android.media.AudioManager am = (android.media.AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            if (Build.VERSION.SDK_INT >= 26 && f instanceof android.media.AudioFocusRequest) am.abandonAudioFocusRequest((android.media.AudioFocusRequest) f);
            else if (f instanceof android.media.AudioManager.OnAudioFocusChangeListener) am.abandonAudioFocus((android.media.AudioManager.OnAudioFocusChangeListener) f);
        } catch (Exception ignorado) { }
    }

    /** ¿Hay una sesión de YouTube en las cookies de la app? (las del reproductor de Vento) */
    static boolean youtubeSesion() {
        try {
            String c = CookieManager.getInstance().getCookie("https://www.youtube.com");
            return c != null && (c.contains("LOGIN_INFO=") || c.contains("SAPISID=") || c.contains("__Secure-3PAPISID="));
        } catch (Exception e) { return false; }
    }

    static boolean tiene(String permiso) {
        return Build.VERSION.SDK_INT < 23 || app.checkSelfPermission(permiso) == PackageManager.PERMISSION_GRANTED;
    }

    static void aviso(String t) { ui.post(() -> Toast.makeText(app, t, Toast.LENGTH_LONG).show()); }

    // ---------------------------------------------------------------- Voz (dictado) con el reconocedor de Android
    // Dictado: el reconocedor se REUSA (crearlo cada vez hacía que la primera escucha fallara al instante en muchos
    // celulares: «ocupado» / «no te entendí» sin dejarte hablar). Si falla apenas empieza o antes de oírte, se vuelve a
    // poner a escuchar solo (hasta 2 veces), sin que tengas que tocar el micrófono otra vez.
    private long vozInicio = 0;
    private boolean vozHablo = false;
    private int vozReintentos = 0;
    // Cada escucha lleva su número: los avisos tardíos de una escucha ya cancelada (llegan después de abrir la
    // siguiente) se ignoran. Antes uno de esos «error» tardíos se tomaba como fallo de la escucha NUEVA y la app
    // reintentaba con espera: era parte de la demora de «Abriendo el micrófono…».
    private int vozSesion = 0;
    private boolean vozActiva = false;      // hay una escucha abierta en el reconocedor
    // La página pidió terminar (silencio después del pedido): el «no te entendí» que llega después NO es un tropiezo al
    // abrir y no se vuelve a escuchar. Antes se reabría sola: otro pitido y varios segundos más escuchando.
    private boolean vozDetenida = false;

    void iniciarVoz() {
        vozPendiente = false;
        vozReintentos = 0;
        vozDetenida = false;
        escucharVoz(false);
    }

    private void escucharVoz(boolean nuevo) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            js("window.__ventoVoz&&window.__ventoVoz('error',{error:'service-not-allowed'});window.__ventoVoz&&window.__ventoVoz('end',{})");
            return;
        }
        if (nuevo || voz == null) {
            try { if (voz != null) voz.destroy(); } catch (Exception ignorado) { }
            voz = SpeechRecognizer.createSpeechRecognizer(this);
        } else if (vozActiva) {
            // Solo se cancela si de verdad hay una escucha abierta: cancelar justo antes de volver a escuchar
            // es lo que hace que Android responda «ocupado».
            try { voz.cancel(); } catch (Exception ignorado) { }
        }
        vozActiva = false;
        final int sesion = ++vozSesion;
        vozInicio = System.currentTimeMillis();
        vozHablo = false;
        voz.setRecognitionListener(new RecognitionListener() {
            private boolean vieja() { return sesion != vozSesion; }
            @Override public void onReadyForSpeech(android.os.Bundle b) { if (vieja()) return; js("window.__ventoVoz&&window.__ventoVoz('start',{})"); }
            @Override public void onBeginningOfSpeech() { if (vieja()) return; vozHablo = true; }
            @Override public void onRmsChanged(float v) { }
            @Override public void onBufferReceived(byte[] b) { }
            @Override public void onEndOfSpeech() { }
            @Override public void onEvent(int t, android.os.Bundle b) { }

            @Override
            public void onError(int error) {
                if (vieja()) return;
                vozActiva = false;
                long dura = System.currentTimeMillis() - vozInicio;
                boolean arranque = dura < 2500 && error != SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS;
                boolean sinOir = !vozHablo && (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_CLIENT || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY);
                if (!vozDetenida && vozReintentos < 2 && (arranque || sinOir) && dura < 9000) {
                    vozReintentos++;
                    // Primer tropiezo: se vuelve a pedir con el MISMO reconocedor (crearlo de nuevo es lo que tarda y
                    // hace perder lo que se dice); solo si vuelve a fallar se crea uno nuevo. «Ocupado» se vuelve a
                    // intentar enseguida (150 ms; antes 450): Android suele liberarse en menos de eso.
                    final boolean recrear = vozReintentos >= 2 && (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_CLIENT || error == SpeechRecognizer.ERROR_SERVER);
                    ui.postDelayed(() -> { if (sesion == vozSesion) escucharVoz(recrear); }, error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ? 150 : 120);
                    return;
                }
                String e;
                switch (error) {
                    case SpeechRecognizer.ERROR_NO_MATCH:
                    case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: e = "no-speech"; break;
                    case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: e = "not-allowed"; break;
                    case SpeechRecognizer.ERROR_NETWORK:
                    case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: e = "network"; break;
                    case SpeechRecognizer.ERROR_AUDIO: e = "audio-capture"; break;
                    default: e = "aborted";
                }
                if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_CLIENT) {
                    try { voz.destroy(); } catch (Exception ignorado) { } voz = null;     // la próxima vez arranca uno limpio
                }
                js("window.__ventoVoz&&window.__ventoVoz('error',{error:" + q(e) + "});window.__ventoVoz&&window.__ventoVoz('end',{})");
            }

            @Override public void onPartialResults(android.os.Bundle b) { if (vieja()) return; vozHablo = true; mandarResultados(b, false); }

            @Override
            public void onResults(android.os.Bundle b) {
                if (vieja()) return;
                vozActiva = false;
                mandarResultados(b, true);
                js("window.__ventoVoz&&window.__ventoVoz('end',{})");
            }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, vozIdioma);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, vozParcial);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        // Un poco más de paciencia para terminar la frase (pedidos largos: «dos poker y una picada para la mesa 3»).
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1200L);
        try { voz.startListening(i); vozActiva = true; }
        catch (Exception e) {
            if (vozReintentos < 2) { vozReintentos++; ui.postDelayed(() -> { if (sesion == vozSesion) escucharVoz(true); }, 200); return; }
            js("window.__ventoVoz&&window.__ventoVoz('error',{error:'aborted'});window.__ventoVoz&&window.__ventoVoz('end',{})");
        }
    }

    /** Deja el reconocedor creado y listo (al abrir la app), para que la primera vez que se toque el micrófono ya escuche. */
    void prepararVoz() {
        try {
            if (voz == null && tiene(Manifest.permission.RECORD_AUDIO) && SpeechRecognizer.isRecognitionAvailable(this))
                voz = SpeechRecognizer.createSpeechRecognizer(this);
        } catch (Exception ignorado) { }
    }

    void vozNegada() {
        vozPendiente = false;
        js("window.__ventoVoz&&window.__ventoVoz('error',{error:'not-allowed'});window.__ventoVoz&&window.__ventoVoz('end',{})");
    }

    private void mandarResultados(android.os.Bundle b, boolean esFinal) {
        try {
            ArrayList<String> textos = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            float[] conf = b.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
            if (textos == null || textos.isEmpty()) return;
            JSONArray alts = new JSONArray();
            for (int k = 0; k < textos.size(); k++) {
                JSONObject a = new JSONObject();
                a.put("t", textos.get(k));
                a.put("c", conf != null && k < conf.length && conf[k] >= 0 ? conf[k] : (k == 0 ? 0.9 : 0.5));
                alts.put(a);
            }
            JSONObject d = new JSONObject();
            d.put("alts", alts);
            d.put("final", esFinal);
            js("window.__ventoVoz&&window.__ventoVoz('result'," + d + ")");
        } catch (Exception ignorado) { }
    }

    // ---------------------------------------------------------------- Puente con la página (window.VentoAndroid)
    class Puente {
        private Thread escucha;
        private java.net.HttpURLConnection escuchaCon;

        @JavascriptInterface
        public String info() {
            try {
                JSONObject o = new JSONObject();
                o.put("version", BuildConfig.VERSION_NAME);
                o.put("codigo", BuildConfig.VERSION_CODE);
                o.put("android", Build.VERSION.SDK_INT);
                o.put("tv", true);
                o.put("puente", true);
                o.put("fondo", VentoServicio.activo);
                o.put("ventana", ventana != null);
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        /** Busca los TV del wifi. Cada uno llega a window.__ventoTV(tv); al final window.__ventoTVfin(n). */
        @JavascriptInterface
        public void buscarTVs() {
            new BuscadorTV(VentoApp.this).buscar(new BuscadorTV.Oyente() {
                @Override public void encontrado(JSONObject tv) { js("window.__ventoTV&&window.__ventoTV(" + tv + ")"); }
                @Override public void terminado(int n) { js("window.__ventoTVfin&&window.__ventoTVfin(" + n + "," + BuscadorTV.diagnostico() + ")"); }
            });
        }

        /** Abre YouTube en ese TV con el código de vinculación. Respuesta: window.__ventoCb(id, {status}). */
        @JavascriptInterface
        public void abrirYouTube(final String id, final String appUrl, final String codigo) {
            new Thread(() -> {
                int st = BuscadorTV.abrirYouTube(appUrl, codigo);
                js("window.__ventoCb&&window.__ventoCb(" + q(id) + ",{status:" + st + "})");
            }).start();
        }

        /**
         * Estado de YouTube en un TV del wifi (DIAL GET, como hace la app de YouTube y ytcast): {status, state, screenId}.
         * Si YouTube ya está abierto —aunque otro celular esté conectado— el TV da su screenId y Vento se une a esa
         * misma sesión sin volver a abrir YouTube. Respuesta: window.__ventoCb(id, {status, text: JSON}).
         */
        @JavascriptInterface
        public void infoYouTube(final String id, final String appUrl) {
            new Thread(() -> {
                String txt = BuscadorTV.infoYouTube(appUrl).toString();
                js("window.__ventoCb&&window.__ventoCb(" + q(id) + ",{status:200,text:" + q(txt) + "})");
            }).start();
        }

        /**
         * Puente del «YouTube del TV» DENTRO de la app: reenvía la llamada a www.youtube.com/api/lounge/…
         * (lo mismo que hace el puente de Cloudflare). Una app instalada no tiene el bloqueo del navegador,
         * así que no hace falta crear ni configurar el puente. Respuesta: window.__ventoCb(id, {status, text}).
         */
        @JavascriptInterface
        public void lounge(final String id, final String ruta, final String query, final String cuerpo, final String token) {
            new Thread(() -> {
                int st = -1; String txt = "";
                java.net.HttpURLConnection c = null;
                try {
                    if (ruta == null || !ruta.matches("[a-z_/]+")) throw new IllegalArgumentException("ruta");
                    String u = "https://www.youtube.com/api/lounge/" + ruta + (query == null || query.isEmpty() ? "" : "?" + query);
                    byte[] b = (cuerpo == null ? "" : cuerpo).getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    c = (java.net.HttpURLConnection) new java.net.URL(u).openConnection();
                    c.setConnectTimeout(12000);
                    c.setReadTimeout(15000);
                    c.setRequestMethod("POST");
                    c.setDoOutput(true);
                    c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                    if (token != null && !token.isEmpty()) c.setRequestProperty("X-YouTube-LoungeId-Token", token);
                    c.setFixedLengthStreamingMode(b.length);
                    try (OutputStream o = c.getOutputStream()) { o.write(b); }
                    st = c.getResponseCode();
                    java.io.InputStream in = st >= 400 ? c.getErrorStream() : c.getInputStream();
                    if (in != null) {
                        try (java.io.InputStream i = in; java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
                            byte[] buf = new byte[8192]; int n;
                            while ((n = i.read(buf)) > 0 && out.size() < 2_000_000) out.write(buf, 0, n);
                            txt = out.toString("UTF-8");
                        }
                    }
                } catch (Exception e) {
                    st = -1; txt = String.valueOf(e.getMessage());
                } finally {
                    if (c != null) c.disconnect();
                }
                js("window.__ventoCb&&window.__ventoCb(" + q(id) + ",{status:" + st + ",text:" + q(txt) + "})");
            }).start();
        }

        /**
         * Buscar una canción en YouTube sin gastar el cupo de la clave compartida: se abre la página pública de
         * resultados de www.youtube.com (la misma que ve cualquiera en el navegador) y se sacan los primeros videos
         * (id, título, canal y duración). Responde por window.__ventoCb(id, {status, text}) con un JSON
         * [{v,t,c,d}] en text. Solo lectura; no usa cuentas ni claves.
         */
        @JavascriptInterface
        public void buscarYT(final String id, final String consulta) {
            new Thread(() -> {
                int st = -1; String txt = "";
                java.net.HttpURLConnection c = null;
                try {
                    String u = "https://www.youtube.com/results?hl=es&gl=CO&search_query=" + java.net.URLEncoder.encode(consulta == null ? "" : consulta, "UTF-8");
                    c = (java.net.HttpURLConnection) new java.net.URL(u).openConnection();
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(10000);
                    c.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36");
                    c.setRequestProperty("Accept-Language", "es-CO,es;q=0.9");
                    c.setRequestProperty("Cookie", "CONSENT=YES+1");
                    st = c.getResponseCode();
                    String html = "";
                    java.io.InputStream in = st >= 400 ? c.getErrorStream() : c.getInputStream();
                    if (in != null) {
                        try (java.io.InputStream i = in; java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
                            byte[] buf = new byte[16384]; int n;
                            while ((n = i.read(buf)) > 0 && out.size() < 3_000_000) out.write(buf, 0, n);
                            html = out.toString("UTF-8");
                        }
                    }
                    org.json.JSONArray arr = new org.json.JSONArray();
                    java.util.HashSet<String> vistos = new java.util.HashSet<>();
                    java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"videoRenderer\":\\{\"videoId\":\"([\\w-]{11})\"").matcher(html);
                    while (m.find() && arr.length() < 10) {
                        String vid = m.group(1);
                        if (!vistos.add(vid)) continue;
                        String trozo = html.substring(m.start(), Math.min(html.length(), m.start() + 6000));
                        org.json.JSONObject o = new org.json.JSONObject();
                        o.put("v", vid);
                        o.put("t", sacar(trozo, "\"title\":\\{\"runs\":\\[\\{\"text\":\"((?:[^\"\\\\]|\\\\.)*)\""));
                        o.put("c", sacar(trozo, "\"ownerText\":\\{\"runs\":\\[\\{\"text\":\"((?:[^\"\\\\]|\\\\.)*)\""));
                        o.put("d", sacar(trozo, "\"lengthText\":\\{.{0,400}?\"simpleText\":\"([0-9:]+)\""));
                        arr.put(o);
                    }
                    txt = arr.toString();
                    if (st < 400 && arr.length() == 0) st = 204;
                } catch (Exception e) {
                    st = -1; txt = String.valueOf(e.getMessage());
                } finally {
                    if (c != null) c.disconnect();
                }
                js("window.__ventoCb&&window.__ventoCb(" + q(id) + ",{status:" + st + ",text:" + q(txt) + "})");
            }).start();
        }

        private String sacar(String texto, String patron) {
            try {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile(patron).matcher(texto);
                if (!m.find()) return "";
                String r = m.group(1);
                try { r = new org.json.JSONObject("{\"x\":\"" + r + "\"}").getString("x"); } catch (Exception ignored) {}
                return r;
            } catch (Exception e) { return ""; }
        }

        /**
         * Escuchar al TV en vivo: el canal de vuelta del «YouTube del TV» (GET bc/bind con RID=rpc), el mismo que
         * usa la app de YouTube. Queda abierto y el TV va contando al instante qué suena, si pausó, si cambió de
         * canción o de lista. Cada trozo llega a window.__ventoTVev(id, texto); al cerrarse, window.__ventoTVcerro(id, código).
         * Hay un solo canal a la vez: abrir uno nuevo cierra el anterior.
         */
        @JavascriptInterface
        public void escucharTV(final String id, final String query, final String token) {
            pararTV(null);
            final Thread t = new Thread(() -> {
                int st = -1;
                java.net.HttpURLConnection c = null;
                try {
                    String base = System.getProperty("vento.lounge", "https://www.youtube.com/api/lounge/");
                    c = (java.net.HttpURLConnection) new java.net.URL(base + "bc/bind?" + (query == null ? "" : query)).openConnection();
                    synchronized (Puente.class) { escuchaCon = c; }
                    c.setConnectTimeout(12000);
                    c.setReadTimeout(90000);                    // el TV manda «noop» cada medio minuto más o menos
                    if (token != null && !token.isEmpty()) c.setRequestProperty("X-YouTube-LoungeId-Token", token);
                    st = c.getResponseCode();
                    if (st >= 200 && st < 300) {
                        try (java.io.InputStream in = c.getInputStream()) {
                            byte[] buf = new byte[16384]; int n;
                            while (!Thread.currentThread().isInterrupted() && (n = in.read(buf)) > 0) {
                                js("window.__ventoTVev&&window.__ventoTVev(" + q(id) + "," + q(new String(buf, 0, n, java.nio.charset.StandardCharsets.UTF_8)) + ")");
                            }
                        }
                    }
                } catch (Exception e) {
                    if (st < 0) st = -1;
                } finally {
                    if (c != null) c.disconnect();
                    synchronized (Puente.class) { if (escuchaCon == c) escuchaCon = null; }
                }
                js("window.__ventoTVcerro&&window.__ventoTVcerro(" + q(id) + "," + st + ")");
            });
            synchronized (Puente.class) { escucha = t; }
            t.start();
        }

        /** Cierra el canal en vivo con el TV (si id es null, cierra el que haya). */
        @JavascriptInterface
        public void pararTV(String id) {
            Thread t; java.net.HttpURLConnection c;
            synchronized (Puente.class) { t = escucha; c = escuchaCon; escucha = null; escuchaCon = null; }
            if (t != null) t.interrupt();
            if (c != null) new Thread(c::disconnect).start();
        }

        /**
         * Aviso del celular (con sonido) aunque Vento esté cerrada o la pantalla apagada: pedido nuevo, piden la
         * cuenta, canción pedida… Si la ventana de Vento se está viendo, no hace falta (ya sale en pantalla),
         * salvo que se pida «siempre». canal: pedidos | musica | avisos.
         */
        @JavascriptInterface
        public boolean notificar(String titulo, String texto, String canal, boolean siempre) { return publicar(titulo, texto, canal, siempre, null); }

        /** «pantallaCompleta»: con el celular bloqueado, la notificación abre esa ventana encima de la pantalla de bloqueo. */
        boolean publicar(String titulo, String texto, String canal, boolean siempre, Intent pantallaCompleta) {
            try {
                if (alFrente && !siempre) return false;
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm == null) return false;
                if (Build.VERSION.SDK_INT >= 33 && !tiene("android.permission.POST_NOTIFICATIONS")) return false;
                String id = "musica".equals(canal) ? "vento_musica2" : "avisos".equals(canal) ? "vento_avisos2" : "pagos".equals(canal) ? "vento_pagos" : "vento_pedidos2";
                crearCanales();
                int flags = Build.VERSION.SDK_INT >= 23 ? android.app.PendingIntent.FLAG_IMMUTABLE : 0;
                android.app.PendingIntent abrir = android.app.PendingIntent.getActivity(VentoApp.this, 2,
                        new Intent(VentoApp.this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK), flags);
                android.app.Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new android.app.Notification.Builder(VentoApp.this, id) : new android.app.Notification.Builder(VentoApp.this);
                b.setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle(titulo == null ? "ORDEVA" : titulo)
                        .setContentText(texto == null ? "" : texto)
                        .setStyle(new android.app.Notification.BigTextStyle().bigText(texto == null ? "" : texto))
                        .setAutoCancel(true)
                        .setContentIntent(abrir)
                        .setWhen(System.currentTimeMillis()).setShowWhen(true);
                if (Build.VERSION.SDK_INT < 26) b.setDefaults(android.app.Notification.DEFAULT_ALL).setPriority(android.app.Notification.PRIORITY_HIGH);
                if (Build.VERSION.SDK_INT >= 21) b.setCategory("musica".equals(canal) ? android.app.Notification.CATEGORY_EVENT : android.app.Notification.CATEGORY_MESSAGE);
                if ("pagos".equals(canal)) {
                    // En la pantalla de bloqueo se ve completa (el valor y el texto), aunque el celular oculte el contenido.
                    b.setVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                    if (Build.VERSION.SDK_INT >= 21) {
                        android.app.Notification.Builder pub = Build.VERSION.SDK_INT >= 26 ? new android.app.Notification.Builder(VentoApp.this, id) : new android.app.Notification.Builder(VentoApp.this);
                        pub.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(titulo == null ? "ORDEVA" : titulo).setContentText(texto == null ? "" : texto)
                                .setStyle(new android.app.Notification.BigTextStyle().bigText(texto == null ? "" : texto)).setColor(0xFF8B5CF6);
                        b.setPublicVersion(pub.build()).setColor(0xFF8B5CF6);
                    }
                }
                if (pantallaCompleta != null) {
                    b.setFullScreenIntent(android.app.PendingIntent.getActivity(VentoApp.this, 7000 + (avisoN % 1000), pantallaCompleta,
                            flags | android.app.PendingIntent.FLAG_UPDATE_CURRENT), true);
                    if (Build.VERSION.SDK_INT >= 21) b.setCategory(android.app.Notification.CATEGORY_ALARM);
                }
                nm.notify(avisoN++, b.build());
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** Estado de los avisos del celular: si están prendidos, si falta el permiso y cómo está cada canal. */
        @JavascriptInterface
        public String avisosEstado() {
            try {
                JSONObject o = new JSONObject();
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                boolean on = nm != null && (Build.VERSION.SDK_INT < 24 || nm.areNotificationsEnabled());
                o.put("prendidos", on);
                o.put("permiso", Build.VERSION.SDK_INT < 33 || tiene("android.permission.POST_NOTIFICATIONS"));
                JSONObject ch = new JSONObject();
                if (nm != null && Build.VERSION.SDK_INT >= 26) {
                    for (String id : new String[]{"vento_pedidos2", "vento_musica2", "vento_avisos2"}) {
                        android.app.NotificationChannel c = nm.getNotificationChannel(id);
                        if (c != null) ch.put(id, new JSONObject().put("importancia", c.getImportance()).put("bloqueo", c.getLockscreenVisibility()).put("sonido", c.getSound() != null).put("vibra", c.shouldVibrate()));
                    }
                }
                o.put("canales", ch);
                o.put("escucha", escuchaPermitida());
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        /** Prender los avisos: pide el permiso (Android 13+) o abre la pantalla de notificaciones de Vento. */
        @JavascriptInterface
        public void avisosActivar() {
            ui.post(() -> {
                MainActivity a = ventana;
                if (Build.VERSION.SDK_INT >= 33 && !tiene("android.permission.POST_NOTIFICATIONS") && a != null && !a.shouldShowRequestPermissionRationale("android.permission.POST_NOTIFICATIONS")
                        && !getSharedPreferences("vento", MODE_PRIVATE).getBoolean("avisosPedidos", false)) {
                    getSharedPreferences("vento", MODE_PRIVATE).edit().putBoolean("avisosPedidos", true).apply();
                    a.pedirPermisoAvisos();
                    return;
                }
                avisosAjustesAbrir();
            });
        }

        @JavascriptInterface
        public void avisosAjustes() { ui.post(this::avisosAjustesAbrir); }

        private void avisosAjustesAbrir() {
            Context x = ventana != null ? ventana : VentoApp.this;
            try {
                Intent i = new Intent(Build.VERSION.SDK_INT >= 26 ? android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS : android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                if (Build.VERSION.SDK_INT >= 26) i.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                else i.setData(Uri.parse("package:" + getPackageName()));
                if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                x.startActivity(i);
            } catch (Exception e) {
                try { Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())); if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); x.startActivity(i); } catch (Exception ignorado) { }
            }
        }

        // ---------------------------------------------------------------- Música que ya suena desde el celular
        private boolean escuchaPermitida() {
            try {
                String s = android.provider.Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
                return s != null && s.contains(getPackageName());
            } catch (Exception e) { return false; }
        }

        // ---------------------------------------------------------------- Avisos de pagos (DaviPlata, Nequi…)
        /** Prende o apaga, en ESTE celular, la lectura de los avisos de plata recibida (ver VentoEscucha). */
        @JavascriptInterface
        public void pagosAvisos(boolean on) {
            getSharedPreferences("vento", MODE_PRIVATE).edit().putBoolean(VentoEscucha.PREF_ON, on).apply();
        }

        /** {on, permiso}: si está prendido aquí y si Vento tiene el «Acceso a notificaciones». */
        @JavascriptInterface
        public String pagosAvisosEstado() {
            try {
                boolean permiso = escuchaPermitida();
                // Con permiso pero sin estar escuchando (Android la desconectó): se le pide que vuelva a conectarla.
                if (permiso && VentoEscucha.activa == null && android.os.Build.VERSION.SDK_INT >= 24)
                    try { android.service.notification.NotificationListenerService.requestRebind(new android.content.ComponentName(VentoApp.this, VentoEscucha.class)); } catch (Throwable ignorado) { }
                return new JSONObject().put("on", getSharedPreferences("vento", MODE_PRIVATE).getBoolean(VentoEscucha.PREF_ON, false))
                        .put("permiso", permiso).put("vivo", VentoEscucha.activa != null).toString();
            } catch (Exception e) { return "{}"; }
        }

        /** Ajustes → Notificaciones → «💜 Pagos que te llegan»: si sale (o no) el aviso del celular de cada pago. */
        @JavascriptInterface
        public void pagosNotif(boolean si) { getSharedPreferences("vento", MODE_PRIVATE).edit().putBoolean(VentoEscucha.PREF_NOTIF, si).apply(); }

        // ---------------------------------------------------------------- Parlante de avisos (Bluetooth o cable)
        /** Salidas de sonido conectadas: [{id, nombre, clase}] */
        @JavascriptInterface
        public String parlantes() { return Parlante.lista(VentoApp.this); }

        /** Elige el parlante de avisos (0 = ninguno: todo suena en el celular como siempre). */
        @JavascriptInterface
        public void parlanteElegir(int id) { Parlante.elegir(VentoApp.this, id); }

        /** {nombre, conectado, tipos, clase} */
        @JavascriptInterface
        public String parlanteEstado() { return Parlante.estado(VentoApp.this); }

        /** Qué avisos van al parlante: «pagos,pedidos,cuenta,domicilios…» */
        @JavascriptInterface
        public void parlanteTipos(String csv) { Parlante.tipos(VentoApp.this, csv); }

        /** Dice un aviso SOLO en el parlante (si está conectado). */
        @JavascriptInterface
        public boolean parlanteDecir(String frase) {
            if (Parlante.elegido(VentoApp.this) == null) return false;
            decirAviso(frase);
            return true;
        }

        /** Prueba piloto de un aviso de pago (como si llegara de verdad, sin registrarlo): {ok, r} */
        @JavascriptInterface
        public String pagosPrueba(String app, String titulo, String texto, boolean sms) {
            return VentoEscucha.probar(getSharedPreferences("vento", MODE_PRIVATE), app, titulo, texto, sms);
        }

        /** Versión de la lectura de avisos de pagos: 2 = también pasa a la página los avisos del banco que no entendió
         *  (la página los revisa con sus reglas, que se actualizan solas). La página avisa si la app es más vieja. */
        @JavascriptInterface
        public int pagosLectura() { return 2; }

        /** Las apps de bancos instaladas y si tienen ahorro de batería: [{pkg, nombre, sinRestriccion}]. Con ahorro de
         *  batería («Optimizada»), Android retrasa sus avisos de pago y Vento los dice tarde (o cuando se prende la pantalla). */
        @JavascriptInterface
        public String bancosBateria() {
            JSONArray l = new JSONArray();
            try {
                android.os.PowerManager pw = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                for (String[] o : AvisoPago.OFICIALES) {
                    try { getPackageManager().getApplicationInfo(o[0], 0); } catch (Exception noEsta) { continue; }
                    boolean libre = Build.VERSION.SDK_INT < 23 || (pw != null && pw.isIgnoringBatteryOptimizations(o[0]));
                    l.put(new JSONObject().put("pkg", o[0]).put("nombre", o[1]).put("sinRestriccion", libre));
                }
            } catch (Exception ignorado) { }
            return l.toString();
        }

        /** Abre los ajustes de la app de ese banco (solo las de la lista oficial): ahí se elige Batería → Sin restricciones. */
        @JavascriptInterface
        public boolean bancoAjustes(String pkg) {
            if (!AvisoPago.paqueteOficial(pkg)) return false;
            ui.post(() -> {
                Context x = ventana != null ? ventana : VentoApp.this;
                try {
                    Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
                    if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    x.startActivity(i);
                } catch (Exception ignorado) { }
            });
            return true;
        }

        // ---------------------------------------------------------------- 💜 Ventana emergente de cada pago
        /** {on, encima, completa}: si está prendida, si puede salir encima de otras apps y encima de la pantalla de bloqueo. */
        @JavascriptInterface
        public String ventanaPagoEstado() {
            try {
                JSONObject o = new JSONObject().put("on", VentanaPago.prendida(VentoApp.this)).put("encima", VentanaPago.puedeEncima(VentoApp.this))
                        .put("completa", VentanaPago.puedePantallaCompleta(VentoApp.this)).put("xiaomi", VentanaPago.esXiaomi());
                Boolean fondo = VentanaPago.xiaomiPermiso(VentoApp.this, 10021), bloqueo = VentanaPago.xiaomiPermiso(VentoApp.this, 10020);
                if (fondo != null) o.put("segundoPlano", fondo);
                if (bloqueo != null) o.put("bloqueo", bloqueo);
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        // ---------------------------------------------------------------- 🔄 Actualización automática de la app
        /** {codigo, nombre, nueva, nuevaNombre, estado, permiso, revisado, auto, silenciosa} */
        @JavascriptInterface
        public String actualizacionEstado() { return Actualizador.estadoJson(VentoApp.this); }

        /** Revisa ya (y si hay una nueva, la instala ahora: Vento se cierra un momento y vuelve). */
        @JavascriptInterface
        public void actualizarAhora() { Actualizador.revisar(VentoApp.this, true); }

        @JavascriptInterface
        public void actualizacionAuto(boolean on) { getSharedPreferences("vento", MODE_PRIVATE).edit().putBoolean(Actualizador.P_AUTO, on).apply(); }

        /** Abre el permiso «Instalar apps desconocidas» para Vento (una sola vez). */
        @JavascriptInterface
        public void actualizacionPermiso() {
            ui.post(() -> {
                Context x = ventana != null ? ventana : VentoApp.this;
                try {
                    Intent i = Build.VERSION.SDK_INT >= 26 ? new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))
                            : new Intent(android.provider.Settings.ACTION_SECURITY_SETTINGS);
                    if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    x.startActivity(i);
                } catch (Exception ignorado) { }
            });
        }

        /** ¿Vento se está viendo ahora? (la página de fondo sigue «visible» aunque la app esté minimizada) */
        @JavascriptInterface
        public boolean alFrente() { return VentoApp.alFrente; }

        /** Un pago que entendió la PÁGINA (formato nuevo, frase del administrador…): el mismo camino que los de la app —
         *  notificación, ventana encima (también con el celular bloqueado) y pantalla prendida. Antes la página solo sacaba
         *  la notificación y la ventana no se abría fuera de Vento. tipo: ok · sinvalor · revisar · falso. */
        @JavascriptInterface
        public void pagoNotificar(String titulo, String frase, String original, String valor, String banco, String tipo) {
            ui.post(() -> notificarPago(titulo, frase, original, valor, banco, tipo));
        }

        @JavascriptInterface
        public void ventanaPagoOn(boolean on) { getSharedPreferences("vento", MODE_PRIVATE).edit().putBoolean(VentanaPago.PREF, on).apply(); }

        /** Abre el permiso «Aparecer encima de otras apps» (o «pantalla completa» con «completa»). */
        @JavascriptInterface
        public void ventanaPagoPermiso(String cual) {
            ui.post(() -> {
                Context x = ventana != null ? ventana : VentoApp.this;
                try {
                    Intent i;
                    if ("xiaomi".equals(cual)) { VentanaPago.abrirPermisosXiaomi(x); return; }
                    if ("completa".equals(cual) && Build.VERSION.SDK_INT >= 34) i = new Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getPackageName()));
                    else i = new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
                    if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    x.startActivity(i);
                } catch (Exception e) {
                    try { Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())); if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); x.startActivity(i); } catch (Exception ignorado) { }
                }
            });
        }

        /** «▶ Probar»: la ventana de un pago de prueba encima de otras apps (en 3 s, para salir de Vento y verla). */
        @JavascriptInterface
        public void ventanaPagoProbar() {
            // El MISMO camino que un pago de verdad (notificación, pantalla completa, ventana directo / encima).
            ui.postDelayed(() -> { if (!VentoApp.alFrente) notificarPago("🧪 Prueba: Recibiste $20.000 por Nequi", "Recibiste 20000 pesos por Nequi.", "Prueba de Vento", "$20.000", "Nequi", "ok"); }, 3000);
        }

        /** Avisos de banco que hablaban de plata pero no se tomaron como pago (sin datos), para revisarlos. */
        @JavascriptInterface
        public String pagosAvisosDiag() { return VentoEscucha.diag(getSharedPreferences("vento", MODE_PRIVATE)); }

        /** Los avisos que llegaron y la página todavía no ha tomado: [{id, txt, t, voz}]. */
        @JavascriptInterface
        public String pagosAvisosTomar() { return VentoEscucha.tomar(getSharedPreferences("vento", MODE_PRIVATE)); }

        /** YouTube Premium en el reproductor de Vento: abre la página de Google para entrar con la cuenta (dentro de la app). */
        @JavascriptInterface
        public void youtubeEntrar() {
            ui.post(() -> {
                Context x = ventana != null ? ventana : VentoApp.this;
                try { Intent i = new Intent(x, EntrarYouTube.class); if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); x.startActivity(i); } catch (Exception ignorado) { }
            });
        }

        /** ¿Ya entró a YouTube dentro de la app? */
        @JavascriptInterface
        public boolean youtubeSesion() { return VentoApp.youtubeSesion(); }

        /** Abre el permiso «Acceso a notificaciones» para Vento. */
        @JavascriptInterface
        public void mediosPermiso() {
            ui.post(() -> {
                Context x = ventana != null ? ventana : VentoApp.this;
                try {
                    Intent i;
                    if (Build.VERSION.SDK_INT >= 30) {
                        i = new Intent(android.provider.Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
                        i.putExtra(android.provider.Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, new android.content.ComponentName(VentoApp.this, VentoEscucha.class).flattenToString());
                    } else i = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
                    if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    x.startActivity(i);
                } catch (Exception e) {
                    try { Intent i = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"); if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); x.startActivity(i); } catch (Exception ignorado) { }
                }
            });
        }

        private java.util.List<android.media.session.MediaController> controles() {
            android.media.session.MediaSessionManager msm = (android.media.session.MediaSessionManager) getSystemService(MEDIA_SESSION_SERVICE);
            return msm.getActiveSessions(new android.content.ComponentName(VentoApp.this, VentoEscucha.class));
        }

        /**
         * Lo que suena ahora desde el celular: por cada reproductor (YouTube Music, YouTube, Spotify…) su canción, si
         * suena o está en pausa, si suena en OTRO aparato (TV, Chromecast…) y el nombre de ese aparato tal como lo
         * muestra la app en su aviso («YouTube on TV», «Sala familiar»…). JSON: {permiso, lista:[…]}.
         */
        @JavascriptInterface
        public String medios() {
            JSONObject o = new JSONObject();
            try {
                boolean ok = escuchaPermitida();
                o.put("permiso", ok);
                JSONArray l = new JSONArray();
                if (ok) {
                    android.service.notification.StatusBarNotification[] avisos = null;
                    try { VentoEscucha e = VentoEscucha.activa; if (e != null) avisos = e.getActiveNotifications(); } catch (Exception ignorado) { }
                    for (android.media.session.MediaController c : controles()) {
                        String pkg = c.getPackageName();
                        if (getPackageName().equals(pkg)) continue;
                        JSONObject m = new JSONObject();
                        m.put("app", pkg);
                        try { m.put("nombreApp", String.valueOf(getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(pkg, 0)))); } catch (Exception ignorado) { m.put("nombreApp", pkg); }
                        android.media.MediaMetadata md = c.getMetadata();
                        if (md != null) {
                            m.put("titulo", String.valueOf(md.getString(android.media.MediaMetadata.METADATA_KEY_TITLE)));
                            String ar = md.getString(android.media.MediaMetadata.METADATA_KEY_ARTIST);
                            if (ar == null) ar = md.getString(android.media.MediaMetadata.METADATA_KEY_ALBUM_ARTIST);
                            m.put("artista", ar == null ? "" : ar);
                            m.put("dur", md.getLong(android.media.MediaMetadata.METADATA_KEY_DURATION));
                        }
                        android.media.session.PlaybackState ps = c.getPlaybackState();
                        if (ps != null) { m.put("estado", ps.getState()); m.put("pos", ps.getPosition()); m.put("vel", ps.getPlaybackSpeed()); m.put("act", ps.getLastPositionUpdateTime()); }
                        android.media.session.MediaController.PlaybackInfo pi = c.getPlaybackInfo();
                        m.put("remoto", pi != null && pi.getPlaybackType() == android.media.session.MediaController.PlaybackInfo.PLAYBACK_TYPE_REMOTE);
                        // Nombre del aparato: lo que la app pone en su aviso («Reproduciendo en …» o el texto pequeño).
                        if (avisos != null) for (android.service.notification.StatusBarNotification sb : avisos) {
                            if (!pkg.equals(sb.getPackageName())) continue;
                            android.os.Bundle ex = sb.getNotification().extras;
                            if (ex == null || ex.get(android.app.Notification.EXTRA_MEDIA_SESSION) == null) continue;
                            CharSequence sub = ex.getCharSequence(android.app.Notification.EXTRA_SUB_TEXT);
                            if (sub != null && sub.length() > 0) m.put("donde", sub.toString());
                            break;
                        }
                        l.put(m);
                    }
                }
                o.put("lista", l);
            } catch (Exception e) {
                try { o.put("error", String.valueOf(e.getMessage())); } catch (Exception ignorado) { }
            }
            return o.toString();
        }

        /** Pausar / seguir / siguiente / anterior en el reproductor de esa app (lo que suena en el TV también). */
        @JavascriptInterface
        public boolean medioAccion(String pkg, String accion) {
            try {
                for (android.media.session.MediaController c : controles()) {
                    if (!c.getPackageName().equals(pkg)) continue;
                    android.media.session.MediaController.TransportControls t = c.getTransportControls();
                    if ("play".equals(accion)) t.play(); else if ("pause".equals(accion)) t.pause();
                    else if ("next".equals(accion)) t.skipToNext(); else if ("prev".equals(accion)) t.skipToPrevious();
                    return true;
                }
            } catch (Exception ignorado) { }
            return false;
        }

        /** Abre el permiso de «inicio automático» de cada marca (Xiaomi, Huawei, Oppo, Vivo…) para que Android no cierre Vento. */
        @JavascriptInterface
        public void ajustesInicio() {
            ui.post(() -> {
                String[][] c = {
                        {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                        {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
                        {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                        {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
                        {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                        {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                        {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
                        {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                        {"com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"},
                        {"com.asus.mobilemanager", "com.asus.mobilemanager.MainActivity"}};
                Context x = ventana != null ? ventana : VentoApp.this;
                for (String[] k : c) {
                    try {
                        Intent i = new Intent().setComponent(new android.content.ComponentName(k[0], k[1]));
                        if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        if (getPackageManager().resolveActivity(i, 0) != null) { x.startActivity(i); return; }
                    } catch (Exception ignorado) { }
                }
                try {
                    Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                    if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    x.startActivity(i);
                } catch (Exception ignorado) { }
            });
        }

        @JavascriptInterface
        public void vozIniciar(final String idioma, final boolean parcial, final boolean continuo) {
            ui.post(() -> {
                vozIdioma = (idioma == null || idioma.isEmpty()) ? "es-CO" : idioma;
                vozParcial = parcial;
                if (!tiene(Manifest.permission.RECORD_AUDIO)) {
                    if (ventana != null && Build.VERSION.SDK_INT >= 23) { vozPendiente = true; ventana.pedirPermisoVoz(); }
                    else vozNegada();
                    return;
                }
                iniciarVoz();
            });
        }

        @JavascriptInterface
        public void vozPreparar() { ui.post(() -> prepararVoz()); }

        @JavascriptInterface
        public void vozParar() { ui.post(() -> { vozDetenida = true; try { if (voz != null) voz.stopListening(); } catch (Exception ignorado) { } }); }

        @JavascriptInterface
        public void vozCancelar() {
            ui.post(() -> {
                // La escucha cancelada ya no avisa nada (ni reintenta): su único «terminé» es este.
                vozSesion++;
                try { if (voz != null && vozActiva) voz.cancel(); } catch (Exception ignorado) { }
                vozActiva = false;
                js("window.__ventoVoz&&window.__ventoVoz('end',{})");
            });
        }

        /** Voz de Laya (lee en voz alta). Al terminar: window.__ventoHabla('end'). */
        @JavascriptInterface
        public void hablar(final String texto, final String idioma, final float velocidad) {
            ui.post(() -> {
                Runnable decir = () -> {
                    try {
                        if (idioma == null || idioma.isEmpty() || idioma.toLowerCase(Locale.ROOT).startsWith("es")) ponerEspanol(tts);
                        else tts.setLanguage(Locale.forLanguageTag(idioma));
                        tts.setSpeechRate(velocidad > 0 ? velocidad : 1f);
                        tts.speak(texto, TextToSpeech.QUEUE_ADD, null, "v" + System.nanoTime());
                    } catch (Exception e) { js("window.__ventoHabla&&window.__ventoHabla('end')"); }
                };
                if (tts != null && ttsListo) { decir.run(); return; }
                // Mientras la voz se prepara, lo que llegue queda en fila (antes se creaba otra voz y lo primero se perdía).
                hablarFila.add(decir);
                if (tts != null) return;
                tts = nuevoMotor(VentoApp.this, st -> ui.post(() -> {
                    ttsListo = st == TextToSpeech.SUCCESS;
                    ArrayList<Runnable> fila = new ArrayList<>(hablarFila);
                    hablarFila.clear();
                    if (!ttsListo) { tts = null; js("window.__ventoHabla&&window.__ventoHabla('end')"); return; }
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override public void onStart(String u) { js("window.__ventoHabla&&window.__ventoHabla('start')"); }
                        @Override public void onDone(String u) { js("window.__ventoHabla&&window.__ventoHabla('end')"); }
                        @Override public void onError(String u) { js("window.__ventoHabla&&window.__ventoHabla('end')"); }
                    });
                    for (Runnable r : fila) r.run();
                }), motorElegido(VentoApp.this));
            });
        }

        /** Marca del celular (Xiaomi, Samsung, OPPO…): para dar los pasos de «que no la cierre» de esa marca. */
        @JavascriptInterface
        public String fabricante() { return (Build.MANUFACTURER == null ? "" : Build.MANUFACTURER) + "|" + (Build.BRAND == null ? "" : Build.BRAND); }

        /** «Inicio automático» de la marca (Xiaomi, OPPO, vivo, Huawei, Honor…): sin él, esas marcas cierran Vento y los
         *  avisos de pagos dejan de sonar con la app cerrada. Si la marca no lo tiene, abre la información de la app. */
        @JavascriptInterface
        public boolean abrirInicioAutomatico() {
            String[][] pantallas = {
                    {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                    {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                    {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
                    {"com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity"},
                    {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                    {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                    {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
                    {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                    {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
                    {"com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                    {"com.asus.mobilemanager", "com.asus.mobilemanager.powersaver.PowerSaverSettings"},
                    {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
                    {"com.transsion.phonemanager", "com.itel.autobootmanager.activity.AutoBootMgrActivity"}};
            android.content.Context c = ventana != null ? ventana : VentoApp.this;
            for (String[] x : pantallas) {
                try {
                    Intent i = new Intent().setComponent(new android.content.ComponentName(x[0], x[1]));
                    if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    if (i.resolveActivity(getPackageManager()) == null) continue;
                    c.startActivity(i);
                    return true;
                } catch (Exception ignorado) { }
            }
            try {
                Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                if (ventana == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
            } catch (Exception ignorado) { }
            return false;
        }

        /** Volumen de la voz de los pagos (10 a 150 %; más de 100 % = más fuerte de lo normal). */
        @JavascriptInterface
        public void pagosVolumen(int v) { getSharedPreferences("vento", MODE_PRIVATE).edit().putInt(PREF_VOL, AvisoPago.volumen(v)).apply(); }

        @JavascriptInterface
        public int pagosVolumenActual() { return volPagos(); }

        /** Confirmar también los SMS del banco (desde su código corto). Apagado = «revísalo». */
        @JavascriptInterface
        public void pagosSmsConfiar(boolean si) { getSharedPreferences("vento", MODE_PRIVATE).edit().putBoolean(VentoEscucha.PREF_SMS_OK, si).apply(); }

        @JavascriptInterface
        public boolean pagosSmsConfiarActual() { return getSharedPreferences("vento", MODE_PRIVATE).getBoolean(VentoEscucha.PREF_SMS_OK, false); }

        /** Un aviso de pago que llega por otro camino (otro celular, el Servidor Vento, MacroDroid): con la voz de los pagos. */
        @JavascriptInterface
        public void pagosDecir(String frase) { if (frase != null && !frase.isEmpty()) decirPago(frase); }

        /** «▶ Probar»: dice un pago de prueba con el volumen elegido. */
        @JavascriptInterface
        public void pagosProbarVoz() { decirPagoSiempre("Llegaron 200 pesos por DaviPlata."); }

        /** «🔊 Decir los pagos en voz alta»: prendido (de fábrica) o apagado. */
        @JavascriptInterface
        public void pagosVozOn(boolean on) { getSharedPreferences("vento", MODE_PRIVATE).edit().putBoolean("pagosVoz", on).apply(); }
        @JavascriptInterface
        public boolean pagosVozEstado() { return vozPagosOn(); }
        /** Para el 🩺 chequeo: el motor de voz que dice los pagos («com.google.android.tts», «sistema:com.samsung.SMT»…). */
        @JavascriptInterface
        public String pagosMotorVoz() { return motorPago == null || motorPago.isEmpty() ? (ttsPago == null ? "" : "?") : motorPago; }

        /** Los pagos de los otros equipos desde Android (Cruce): dirección, llave pública, token del celular. Vacío = apagar. */
        @JavascriptInterface
        public void pagosCruce(String json) { Cruce.configurar(VentoApp.this, json); }
        @JavascriptInterface
        public String pagosCruceEstado() { return getSharedPreferences("vento", MODE_PRIVATE).getString(Cruce.PREF_ESTADO, "{}"); }
        /** true = este pago todavía no se había avisado aquí (y queda reclamado); false = ya lo avisó Android. */
        @JavascriptInterface
        public boolean pagoReclamar(String id) { return Cruce.reclamar(VentoApp.this, id); }

        @JavascriptInterface
        public void callar() { ui.post(() -> { try { if (tts != null) tts.stop(); } catch (Exception ignorado) { } }); }

        /** Guarda un archivo (respaldo, reporte, foto) en Descargas. */
        @JavascriptInterface
        public void guardarArchivo(final String nombre, final String tipo, final String base64) {
            new Thread(() -> {
                String n = (nombre == null || nombre.isEmpty()) ? ("vento-" + System.currentTimeMillis()) : nombre.replaceAll("[\\\\/:*?\"<>|]", "-");
                try {
                    byte[] datos = Base64.decode(base64, Base64.DEFAULT);
                    if (Build.VERSION.SDK_INT >= 29) {
                        ContentValues cv = new ContentValues();
                        cv.put(MediaStore.Downloads.DISPLAY_NAME, n);
                        cv.put(MediaStore.Downloads.MIME_TYPE, tipo == null || tipo.isEmpty() ? "application/octet-stream" : tipo);
                        cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Vento");
                        Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                        if (u == null) throw new Exception("sin espacio");
                        try (OutputStream o = getContentResolver().openOutputStream(u)) { if (o == null) throw new Exception("no abre"); o.write(datos); }
                    } else {
                        File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                        try (FileOutputStream o = new FileOutputStream(new File(dir, n))) { o.write(datos); }
                    }
                    aviso("✅ Guardado en Descargas/Vento: " + n);
                } catch (Exception e) {
                    aviso("No pude guardar el archivo.");
                }
            }).start();
        }

        /** Trabajar de fondo (pedidos y música con la app cerrada): estado y prender/apagar. */
        @JavascriptInterface
        public boolean fondo() { return VentoServicio.activo; }

        @JavascriptInterface
        public void fondoActivar(final boolean si) {
            ui.post(() -> {
                getSharedPreferences("vento", MODE_PRIVATE).edit().putBoolean("fondo", si).apply();
                if (si) VentoServicio.arrancar(VentoApp.this);
                else VentoServicio.detener(VentoApp.this);
            });
        }

        /** Permisos del celular: estado ({microfono, camara, avisos, bateria, fondo}) y pedirlos otra vez. */
        @JavascriptInterface
        public String permisos() {
            try {
                JSONObject o = new JSONObject();
                o.put("microfono", tiene(Manifest.permission.RECORD_AUDIO));
                o.put("camara", tiene(Manifest.permission.CAMERA));
                o.put("avisos", Build.VERSION.SDK_INT < 33 || tiene(Manifest.permission.POST_NOTIFICATIONS));
                boolean bat = true;
                if (Build.VERSION.SDK_INT >= 23) {
                    android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                    bat = pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
                }
                o.put("bateria", bat);
                o.put("fondo", VentoServicio.activo);
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface
        public void pedirPermisos() {
            ui.post(() -> {
                if (ventana == null) return;
                if (!ventana.pedirPermisosInicio(true)) ventana.pedirSinAhorroBateria(true);
            });
        }

        /** «Hola Vento»: mientras escucha sola, se silencia el pitido que hace Android cada vez que abre el micrófono. */
        @JavascriptInterface
        public void vozSilencio(final boolean si) {
            ui.post(() -> {
                try {
                    android.media.AudioManager am = (android.media.AudioManager) getSystemService(AUDIO_SERVICE);
                    if (am == null || Build.VERSION.SDK_INT < 23) return;
                    if (si == vozMuda) return;
                    vozMuda = si;
                    int d = si ? android.media.AudioManager.ADJUST_MUTE : android.media.AudioManager.ADJUST_UNMUTE;
                    am.adjustStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION, d, 0);
                    am.adjustStreamVolume(android.media.AudioManager.STREAM_SYSTEM, d, 0);
                } catch (Exception ignorado) { }
            });
        }

        /** Ajustes del celular para que Android no duerma a Vento (ahorro de batería). */
        @JavascriptInterface
        public void ajustesBateria() { ui.post(() -> { if (ventana != null) ventana.pedirSinAhorroBateria(true); }); }
    }
}
