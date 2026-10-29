package co.vento.app;

import android.app.Notification;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;


/**
 * Permiso «Acceso a notificaciones» (lo da el dueño en Ajustes del celular). Con él Vento puede:
 *  • ver la música que ya está sonando desde el celular (YouTube Music, YouTube, Spotify…) y en qué aparato suena,
 *    y pausarla o pasar a la siguiente;
 *  • SOLO si el dueño lo activa en Vento (Ajustes → Verificar pagos → «Leer los avisos de este celular»): leer los
 *    avisos de PLATA RECIBIDA de las apps de bancos y billeteras (DaviPlata, Nequi, Bancolombia…), igual que hacía
 *    MacroDroid, pero sin instalar nada más. Así la transferencia que llega a tu número de DaviPlata aparece en Vento
 *    al instante (con voz, en la mesa y en los demás celulares del negocio).
 * Vento no lee ni guarda los mensajes de otras apps: de los bancos solo toma los avisos de plata recibida (nunca
 * códigos, claves ni compras), y de las demás apps nada.
 */
public class VentoEscucha extends NotificationListenerService {
    static volatile VentoEscucha activa;

    static final String PREF_ON = "pagosAvisos", PREF_COLA = "pagosAvisosCola";
    // Las reglas (qué es plata recibida, el valor y la frase) están en AvisoPago (se prueban sin Android).
    private static final long VIGENCIA = 6 * 3600_000L;   // un aviso que la página no alcanzó a tomar en 6 h ya no sirve
    static final String PREF_VISTOS = "pagosAvisosVistos", PREF_NOTIF = "pagosNotif", PREF_SMS_OK = "pagosSmsConfiar", PREF_RECIENTES = "pagosRecientes";
    // Avisos de apps de banco que hablan de plata pero que Vento NO tomó como pago (sin nombres ni números), para revisar
    // y enseñarle a Vento ese formato. Y la última vez que llegó cualquier aviso de banco (¿está escuchando?).
    static final String PREF_DIAG = "pagosAvisosDiag", PREF_ULTIMO = "pagosAvisosUltimo";

    @Override
    public void onListenerConnected() {
        activa = this;
        seguirViva();
        // Los pagos que llegaron mientras Vento no estaba escuchando (el celular la cerró, se reinició…) siguen en la barra
        // de notificaciones: se toman ahora (los que ya se habían visto no se repiten).
        try {
            StatusBarNotification[] l = getActiveNotifications();
            boolean alguno = false;
            if (l != null) for (StatusBarNotification sbn : l) { nuevaFirma(firma(sbn)); if (leer(sbn, true)) alguno = true; }
            if (alguno) avisarPagina();
        } catch (Exception ignorado) { }
    }

    @Override
    public void onListenerDisconnected() {
        if (activa == this) activa = null;
        // Si Android la desconecta (ahorro de batería, actualización), se pide volver a conectarla: sin esto los pagos
        // dejaban de llegar hasta abrir Vento otra vez.
        try { requestRebind(new android.content.ComponentName(this, VentoEscucha.class)); } catch (Exception ignorado) { }
    }

    @Override public void onDestroy() { if (activa == this) activa = null; super.onDestroy(); }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try { nuevaFirma(firma(sbn)); if (leer(sbn, false)) { seguirViva(); avisarPagina(); } } catch (Exception ignorado) { }
    }

    // ---------- 🧹 Revisión de la barra cada 10 s (1.43.8) ----------
    // Con el celular en uso, Android (sobre todo Xiaomi) a veces deja de pasarle a Vento los avisos nuevos SIN decir que
    // se desconectó: el pago de Nequi quedaba en la barra y no sonaba. Cada 10 s se miran los avisos que están en la barra;
    // el de un banco que no había llegado se toma ya (con voz si es de hace menos de 3 min). Lo ya visto no se repite. Si
    // Android no deja leer la barra, la conexión está caída: se pide reconectar de una.
    private static final java.util.LinkedHashMap<String, Boolean> FIRMAS = new java.util.LinkedHashMap<String, Boolean>(256, 0.75f, false) {
        @Override protected boolean removeEldestEntry(java.util.Map.Entry<String, Boolean> e) { return size() > 600; }
    };
    static synchronized boolean nuevaFirma(String f) { if (f == null || FIRMAS.containsKey(f)) return false; FIRMAS.put(f, true); return true; }
    static String firma(StatusBarNotification sbn) {
        try {
            Notification n = sbn.getNotification(); Bundle x = n != null ? n.extras : null;
            String t = x == null ? "" : texto(x.getCharSequence(Notification.EXTRA_TITLE)) + "|" + texto(x.getCharSequence(Notification.EXTRA_TEXT)) + "|" + texto(x.getCharSequence(Notification.EXTRA_BIG_TEXT));
            return sbn.getKey() + "|" + sbn.getPostTime() + "|" + t.hashCode();
        } catch (Throwable e) { return null; }
    }
    static void barrer() { VentoEscucha e = activa; if (e != null) e.barrerAhora(); }
    private void barrerAhora() {
        SharedPreferences sp = getSharedPreferences("vento", MODE_PRIVATE);
        if (!sp.getBoolean(PREF_ON, false)) return;
        StatusBarNotification[] l;
        try { l = getActiveNotifications(); }
        catch (SecurityException caida) {
            if (activa == this) activa = null;
            try { requestRebind(new android.content.ComponentName(this, VentoEscucha.class)); } catch (Exception ignorado) { }
            return;
        } catch (Throwable otro) { return; }
        if (l == null) return;
        int tomados = 0;
        for (StatusBarNotification sbn : l) {
            if (!nuevaFirma(firma(sbn))) continue;
            try { if (leer(sbn, true)) tomados++; } catch (Exception ignorado) { }
        }
        if (tomados > 0) {
            traza(sp, "Vento", "", "🧹 " + tomados + (tomados == 1 ? " aviso tomado" : " avisos tomados") + " de la barra: Android no se lo había pasado a Vento");
            seguirViva(); avisarPagina();
        }
    }

    /** Que Vento siga viva: si el servicio de fondo se había cerrado (la quitaron de recientes, el celular la cerró),
     *  se vuelve a prender. (Android lo permite si Vento no tiene ahorro de batería.) */
    private void seguirViva() {
        try {
            if (!VentoServicio.activo && getSharedPreferences("vento", MODE_PRIVATE).getBoolean("fondo", true)) VentoServicio.arrancar(this);
        } catch (Throwable ignorado) { }
    }

    private static void avisarPagina() {
        // La página (aunque la ventana esté cerrada, la mantiene viva VentoServicio) lo toma ya.
        VentoApp.ui.post(() -> {
            VentoApp.motor(null);
            VentoApp.js("try{window.ventoAvisosNativos&&window.ventoAvisosNativos()}catch(e){}");
        });
    }

    /** Lee una notificación. «atrasada»: tomada al reconectar (si es vieja, se registra sin decirla en voz alta). */
    private boolean leer(StatusBarNotification sbn, boolean atrasada) throws Exception {
        SharedPreferences sp = getSharedPreferences("vento", MODE_PRIVATE);
        if (!sp.getBoolean(PREF_ON, false) || sbn == null) return false;
        String pkg = sbn.getPackageName();
        if (pkg == null || pkg.equals(getPackageName())) return false;
        Notification n = sbn.getNotification();
        if (n == null) return false;
        // Aviso «resumen» (cuando llegan varios seguidos, la app los agrupa). Antes se ignoraba SIEMPRE: hay apps (Nequi a
        // veces) que ponen el pago SOLO en el resumen, y ese pago nunca sonaba. Ahora se lee, sin repetir lo ya dicho.
        boolean resumen = (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0;
        android.content.pm.PackageManager pm = getPackageManager();
        String app;
        android.content.pm.ApplicationInfo info;
        try { info = pm.getApplicationInfo(pkg, 0); app = String.valueOf(pm.getApplicationLabel(info)); }
        catch (Exception e) { return false; }
        String smsDefecto = null;
        try { smsDefecto = android.provider.Telephony.Sms.getDefaultSmsPackage(this); } catch (Throwable ignorado) { }
        boolean sms = AvisoPago.esAppSms(pkg, smsDefecto);
        if (!sms && !AvisoPago.esBanco(app) && !AvisoPago.paqueteOficial(pkg)) return false;
        // ¿Es la app de verdad del banco? (la oficial, o instalada desde la tienda, o del celular). Una app con nombre de
        // banco instalada por fuera podría mostrar pagos falsos: ese aviso queda «⚠️ Revisar», nunca «Pago confirmado».
        // Si Android no deja saber de dónde se instaló (algunos celulares lo esconden), se confía como antes: solo se marca
        // «Revisar» cuando se SABE que se instaló por fuera de la tienda.
        String instalador = null;
        boolean sabe = false;
        try {
            if (android.os.Build.VERSION.SDK_INT >= 30) instalador = pm.getInstallSourceInfo(pkg).getInstallingPackageName();
            else instalador = pm.getInstallerPackageName(pkg);
            sabe = true;
        } catch (Throwable ignorado) { }
        boolean confiable = !sabe || AvisoPago.confiable(pkg, instalador, (info.flags & android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0);
        Bundle x = n.extras;
        if (x == null) x = new Bundle();
        String titulo = texto(x.getCharSequence(Notification.EXTRA_TITLE));
        if (titulo.isEmpty()) titulo = texto(x.getCharSequence(Notification.EXTRA_TITLE_BIG));
        CharSequence grande = x.getCharSequence(Notification.EXTRA_BIG_TEXT);
        String principal = texto(grande != null ? grande : x.getCharSequence(Notification.EXTRA_TEXT));
        // Hay apps de banco que ponen el valor en otra parte del aviso (subtítulo, resumen, el texto de la barra) o que
        // dibujan su propio aviso sin texto normal: si en el título y el texto no está el valor, se busca ahí.
        if (AvisoPago.monto(titulo + " " + principal) <= 0) {
            StringBuilder mas = new StringBuilder();
            for (String k : new String[]{Notification.EXTRA_SUB_TEXT, Notification.EXTRA_INFO_TEXT, Notification.EXTRA_SUMMARY_TEXT}) {
                String v = texto(x.getCharSequence(k)); if (!v.isEmpty() && !principal.contains(v)) mas.append(' ').append(v);
            }
            String tick = texto(n.tickerText); if (!tick.isEmpty() && !principal.contains(tick)) mas.append(' ').append(tick);
            // El texto corto (si se usó el largo): a veces el valor está solo ahí.
            if (grande != null) { String corto = texto(x.getCharSequence(Notification.EXTRA_TEXT)); if (!corto.isEmpty() && !principal.contains(corto)) mas.append(' ').append(corto); }
            // El aviso dibujado por la app: si no trae ningún texto, o si dice que llegó plata pero el valor no está en el
            // texto (1.43.7: la llave Bre-B de Nequi puede traer el valor solo en su diseño propio, y no se decía).
            String hasta = titulo + " " + principal + mas;
            if (principal.isEmpty() && titulo.isEmpty() && mas.length() == 0) {
                String vista = textosDeVista(n);
                if (!vista.isEmpty()) mas.append(' ').append(vista);
            } else if (AvisoPago.monto(hasta) <= 0 && AvisoPago.esRecibido(hasta)) {
                String vista = textosDeVista(n);
                if (AvisoPago.monto(vista) > 0) mas.append(' ').append(vista);
            }
            principal = (principal + mas).trim();
        }
        if (titulo.isEmpty() && principal.isEmpty()) return false;
        try { sp.edit().putLong(PREF_ULTIMO, System.currentTimeMillis()).apply(); } catch (Exception ignorado) { }
        // Cuando llega otro pago con el primero todavía en la barra, la app los junta («2 mensajes nuevos»): cada
        // aviso viene en una línea (InboxStyle) o en un mensaje (MessagingStyle). Antes solo se leía el resumen.
        java.util.List<String> otros = new java.util.ArrayList<>();
        java.util.List<Object[]> mensajes = new java.util.ArrayList<>();       // {texto, hora} de una conversación (SMS)
        CharSequence[] lineas = x.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lineas != null) for (CharSequence l : lineas) otros.add(texto(l));
        try {
            android.os.Parcelable[] msgs = x.getParcelableArray(Notification.EXTRA_MESSAGES);
            if (msgs != null) for (android.os.Parcelable m : msgs) if (m instanceof Bundle) {
                String t = texto(((Bundle) m).getCharSequence("text"));
                otros.add(t);
                mensajes.add(new Object[]{t, ((Bundle) m).getLong("time", 0L)});
            }
        } catch (Exception ignorado) { }
        // La misma notificación actualizada (mismo «cuándo» y mismo texto) no se repite; dos pagos iguales (mismo valor,
        // misma persona) SÍ son dos pagos: cada uno trae su propio «cuándo». Antes se tomaban como uno solo.
        long cuando = n.when != 0 ? n.when : sbn.getPostTime();
        tiempos(n.when, sbn.getPostTime());
        // Al reconectar: lo de los últimos 30 min se toma (lo de más de 3 min, sin decirlo en voz alta); lo más viejo no
        // (podría cuadrar por casualidad con el saldo de una mesa de ahora).
        long edad = Math.abs(System.currentTimeMillis() - sbn.getPostTime());
        if (atrasada && edad > 30 * 60_000L) return false;
        boolean callado = atrasada && edad > 3 * 60_000L;
        boolean alguno = false;
        if (sms) return resumen ? false : leerSms(sp, titulo, principal, mensajes, sbn.getKey() + ":" + cuando + ":", callado);
        if (resumen ? !contenidoVisto(sp, app, principal) : !porResumen(app, principal)) {
            if (procesarApp(sp, app, titulo, principal, sbn.getKey() + ":" + cuando + ":", confiable, callado)) alguno = true;
            if (resumen) marcarResumen(app, principal);
        }
        marcarContenido(sp, app, principal);
        // Las líneas de un aviso agrupado son los pagos de antes que siguen en la barra: solo cuenta la que no se había
        // visto (antes una línea vieja podía volver a sonar como pago nuevo).
        for (String l : otros) if (!l.isEmpty() && !l.equals(principal) && !principal.contains(l) && !contenidoVisto(sp, app, l)) {
            if (procesar(sp, app, titulo, l, "L:", confiable, callado)) alguno = true;
            marcarContenido(sp, app, l);
            if (resumen) marcarResumen(app, l);
        }
        return alguno;
    }

    /** El aviso de una app de banco: si es pago, se dice; si no se entendió (y no es un repetido), igual se le pasa a la
     *  página, que siempre está al día y puede entender un formato nuevo del banco sin reinstalar la app (si lo entiende,
     *  ella lo dice en voz alta). */
    static boolean procesarApp(SharedPreferences sp, String app, String titulo, String principal, String pref, boolean confiable, boolean callado) throws Exception {
        if (procesar(sp, app, titulo, principal, pref, confiable, callado)) return true;
        String t0 = titulo + " " + principal;
        if (!AvisoPago.esRecibido(t0) || (AvisoPago.monto(t0) <= 0 && !AvisoPago.esPlataSinValor(t0))) diagnostico(sp, app, t0);
        return !AvisoPago.esRecibido(t0) && AvisoPago.sirveCrudo(t0)
                && crudo(sp, app, app + " | " + titulo + " | " + principal, pref, confiable ? null : "La app «" + app + "» de este celular no es la oficial: míralo en la app del banco", false, callado);
    }

    /** SMS: la app de mensajes muestra la CONVERSACIÓN entera (los mensajes de antes también). Solo cuentan los mensajes
     *  nuevos (de los últimos 3 min, cada uno con su hora): antes, al llegar un SMS se podían volver a decir los viejos. */
    static boolean leerSms(SharedPreferences sp, String remitente, String principal, java.util.List<Object[]> mensajes, String prefijo, boolean callado) throws Exception {
        boolean alguno = false;
        long ahora = System.currentTimeMillis();
        // El mensaje MÁS NUEVO de la conversación es el que hizo sonar el aviso: se lee SIEMPRE, sin importar la hora que
        // traiga. En la 1.40.4 solo se leían los de los últimos 3 min, y el 85888 a veces manda el SMS con retraso o con la
        // hora de la red corrida: ese pago se ignoraba. (Hasta la 1.39 siempre se leía el último y sí sonaba.)
        int nuevo = -1; long horaNuevo = Long.MIN_VALUE;
        for (int i = 0; i < mensajes.size(); i++) { long h = (Long) mensajes.get(i)[1]; if (h > 0 && h >= horaNuevo) { horaNuevo = h; nuevo = i; } }
        for (int i = 0; i < mensajes.size(); i++) {
            Object[] m = mensajes.get(i);
            long hora = (Long) m[1];
            if (hora <= 0) continue;
            // Los de antes: solo los de los últimos 10 min (los más viejos ya se dijeron o no son de ahora). Cada mensaje se
            // reconoce por su hora y su texto: el mismo nunca suena dos veces.
            if (i != nuevo && ahora - hora > 10 * 60_000L) continue;
            tiempos(hora, ahora);
            if (procesarSms(sp, remitente, (String) m[0], "M:" + hora + ":", callado)) alguno = true;
        }
        if (nuevo < 0 && procesarSms(sp, remitente, principal, prefijo, callado)) alguno = true;
        return alguno;
    }

    // Lo que se dijo desde un RESUMEN en los últimos 30 s: si después llega el aviso normal con el mismo texto, es el mismo
    // pago (no se repite). Dos pagos iguales de verdad llegan cada uno en su aviso normal y suenan los dos.
    private static final java.util.HashMap<String, Long> DESDE_RESUMEN = new java.util.HashMap<>();
    static synchronized void marcarResumen(String app, String t) { DESDE_RESUMEN.put(claveContenido(app, t), System.currentTimeMillis()); }
    static synchronized boolean porResumen(String app, String t) {
        long ahora = System.currentTimeMillis();
        DESDE_RESUMEN.values().removeIf(x -> ahora - x > 30_000L);
        return DESDE_RESUMEN.remove(claveContenido(app, t)) != null;
    }

    private static String claveContenido(String app, String t) { return "C:" + (app + "|" + (t == null ? "" : t.replaceAll("\\s+", " ").trim())).hashCode(); }
    private static synchronized void marcarContenido(SharedPreferences sp, String app, String t) {
        try { JSONObject v = new JSONObject(sp.getString(PREF_VISTOS, "{}")); v.put(claveContenido(app, t), System.currentTimeMillis()); sp.edit().putString(PREF_VISTOS, v.toString()).apply(); } catch (Exception ignorado) { }
    }
    private static synchronized boolean contenidoVisto(SharedPreferences sp, String app, String t) {
        try { JSONObject v = new JSONObject(sp.getString(PREF_VISTOS, "{}")); return System.currentTimeMillis() - v.optLong(claveContenido(app, t), 0) < 12 * 3600_000L; } catch (Exception e) { return false; }
    }

    /** Aviso de una app de banco que habla de plata pero no se tomó como pago: se guarda SIN datos para revisarlo. */
    private static synchronized void diagnostico(SharedPreferences sp, String app, String todo) {
        try {
            if (!AvisoPago.pareceDePlata(todo)) return;
            String limpio = AvisoPago.sinDatos(todo);
            JSONArray l = new JSONArray(sp.getString(PREF_DIAG, "[]")), out = new JSONArray();
            for (int i = 0; i < l.length(); i++) { JSONObject o = l.getJSONObject(i); if (!limpio.equals(o.optString("txt"))) out.put(o); }
            out.put(new JSONObject().put("app", app).put("txt", limpio).put("t", System.currentTimeMillis())
                    .put("motivo", AvisoPago.esRecibido(todo) ? "sin valor" : "no parece plata recibida"));
            while (out.length() > 15) out.remove(0);
            sp.edit().putString(PREF_DIAG, out.toString()).apply();
        } catch (Exception ignorado) { }
    }

    /** Texto de un aviso dibujado por la app (sin título ni texto normal): se arma la vista y se leen sus letreros. */
    private String textosDeVista(Notification n) {
        StringBuilder b = new StringBuilder();
        for (android.widget.RemoteViews rv : new android.widget.RemoteViews[]{n.bigContentView, n.contentView}) {
            if (rv == null) continue;
            try {
                android.view.View v = rv.apply(this, null);
                juntarTextos(v, b);
                if (b.length() > 0) break;
            } catch (Throwable ignorado) { }
        }
        String t = b.toString().replaceAll("\\s+", " ").trim();
        return t.length() > 400 ? t.substring(0, 400) : t;
    }
    private static void juntarTextos(android.view.View v, StringBuilder b) {
        if (v instanceof android.widget.TextView) { CharSequence c = ((android.widget.TextView) v).getText(); if (c != null && c.length() > 0) b.append(c).append(' '); }
        else if (v instanceof android.view.ViewGroup) { android.view.ViewGroup g = (android.view.ViewGroup) v; for (int i = 0; i < g.getChildCount(); i++) juntarTextos(g.getChildAt(i), b); }
    }

    /** Un aviso: si es plata recibida y no se había visto, se dice en voz alta YA (aunque Vento esté minimizada o la
     *  pantalla apagada), sale el aviso del celular y queda en la cola para la página (que lo registra). */
    private static boolean procesar(SharedPreferences sp, String app, String titulo, String cuerpo, String prefijo, boolean confiable, boolean callado) throws Exception {
        String todo = titulo + " " + cuerpo;
        if (!AvisoPago.esRecibido(todo)) { traza(sp, app, todo, "🚫 " + AvisoPago.porQueNo(todo)); return false; }
        long monto = AvisoPago.monto(todo);
        // Sin valor en el aviso («¡Te llegó plata! Entra a Nequi»): igual suena, sin el valor.
        if (monto <= 0 && AvisoPago.esPlataSinValor(todo)) {
            String id0 = prefijo + (app + " | " + titulo + " | " + cuerpo).hashCode();
            if (!marcarVisto(sp, id0)) { traza(sp, app, todo, "↩️ repetido (ya se había dicho)"); return false; }
            // DaviPlata por la llave Bre-B avisa SIN el valor («Recibiste Plata de otra entidad usando Llaves») y el valor
            // llega por SMS del 85888 («Recibiste 140,000»). Se juntan: el aviso de la app confirma y el SMS dice cuánto.
            if (confiable) {
                JSONObject sms = smsSinPareja(sp);
                if (sms != null) {
                    long m = sms.optLong("m");
                    // El SMS con el valor ya llegó y ya se dijo: este aviso solo lo confirma (no se repite la voz).
                    traza(sp, app, todo, "🔊 junto con el SMS: " + AvisoPago.frase(app, m, todo));
                    if (!callado && !sms.optBoolean("dicho")) VentoApp.anunciarPago(app, m, sp.getBoolean(PREF_NOTIF, true), todo);
                    guardar(sp, id0, app + " | " + titulo + " | Recibiste $" + AvisoPago.plata(m).substring(1) + " · " + cuerpo, !callado, null, false, sms.optString("id"));
                    return true;
                }
                if (!callado) {
                    // Se dice YA, sin esperar el SMS (1.41.1). Antes se esperaban 5 s el SMS con el valor y, con la pantalla
                    // apagada, Android dormía el celular en esa espera: la llave no sonaba hasta desbloquearlo. Ahora suena
                    // de una «Llegó plata por Bre-B, en DaviPlata» y, cuando llega el SMS del banco, «Recibiste 65000 pesos…».
                    pendiente(sp, id0, app, todo);
                    String f = AvisoPago.esBreB(todo) ? "Llegó plata por Bre-B, en " + AvisoPago.nombreApp(app) + "." : AvisoPago.fraseSinValor(app);
                    traza(sp, app, todo, "🔊 " + f + " (el valor lo dice el SMS del banco cuando llegue)");
                    VentoApp.decirPago(f);
                    if (sp.getBoolean(PREF_NOTIF, true)) VentoApp.notificarPago("💜 Llegó plata por " + (AvisoPago.esBreB(todo) ? "Bre-B en " : "") + AvisoPago.nombreApp(app), f, todo, "", (AvisoPago.esBreB(todo) ? "Bre-B en " : "") + AvisoPago.nombreApp(app), "sinvalor");
                    guardar(sp, id0, app + " | " + titulo + " | " + cuerpo, true, null, false, null);
                    return true;
                }
            }
            if (!callado) {
                VentoApp.decirPago(AvisoPago.fraseSinValor(app));
                if (sp.getBoolean(PREF_NOTIF, true)) VentoApp.notificarPago("💜 Llegó plata por " + AvisoPago.nombreApp(app), AvisoPago.fraseSinValor(app), todo, "", AvisoPago.nombreApp(app), "sinvalor");
            }
            guardar(sp, id0, app + " | " + titulo + " | " + cuerpo, !callado, null, false, null);
            return true;
        }
        String txt = app + " | " + titulo + " | " + cuerpo;
        String id = prefijo + txt.hashCode();
        if (!marcarVisto(sp, id)) { traza(sp, app, todo, "↩️ repetido (ya se había dicho)"); return false; }
        // Sin valor que se entienda: no se dice nada; la página lo reporta para aprender ese formato.
        boolean voz = false;
        if (monto <= 0) callado = true;
        // ¿Ya llegó este mismo pago por SMS (el banco avisa por los dos lados)? Entonces este aviso de la app lo confirma
        // y reemplaza al del SMS (no son dos pagos).
        JSONObject par = monto > 0 && confiable ? parear(sp, monto, false, id, true) : null;
        String reemplaza = par != null ? par.optString("id") : null;
        // Si el SMS de este mismo pago ya se dijo como CONFIRMADO (el 85888 de DaviPlata), no se repite. Pero si el SMS
        // solo se dijo como «revísalo» (Nequi y otros bancos no tienen un número corto confirmado), ahora la app del banco
        // lo confirma: se dice, con su notificación y su 🪟 ventana. Antes ese Nequi no abría la ventana.
        boolean yaDicho = par != null && par.optBoolean("ok");
        if (confiable && !callado && !yaDicho) { VentoApp.anunciarPago(app, monto, sp.getBoolean(PREF_NOTIF, true), todo); voz = true; }
        else if (confiable && !callado) voz = true;
        else if (!confiable && !callado) {
            String f = "Ojo. Llegó un aviso de " + monto + " pesos de una aplicación que no es la oficial de " + AvisoPago.nombreApp(app) + ". Revísalo en la aplicación del banco antes de entregar.";
            VentoApp.decirPago(f); voz = true;
            if (sp.getBoolean(PREF_NOTIF, true)) VentoApp.notificarPago("⚠️ Aviso de " + AvisoPago.plata(monto) + ": revísalo", f, todo, AvisoPago.plata(monto), AvisoPago.nombreApp(app), "revisar");
        }
        traza(sp, app, todo, monto <= 0 ? "❓ no se entendió el valor" : callado ? "🔕 llegó con Vento desconectada (sin voz)" : confiable ? "🔊 " + AvisoPago.frase(app, monto, todo) : "⚠️ app no oficial: «revísalo»");
        guardar(sp, id, txt, voz, confiable ? null : "La app «" + app + "» de este celular no es la oficial (no se instaló desde la tienda): míralo en la app del banco", false, reemplaza);
        return true;
    }

    /** SMS del banco: solo plata recibida que nombra un banco. Desde un celular común = falso; desde el código corto del
     *  banco = «revísalo» (o «Pago confirmado» si el dueño eligió confirmar los SMS del banco). */
    private static boolean procesarSms(SharedPreferences sp, String remitente, String cuerpo, String prefijo, boolean callado) throws Exception {
        if (!AvisoPago.esSmsDePago(remitente, cuerpo)) {
            if (AvisoPago.pareceDePlata(cuerpo)) traza(sp, "SMS " + remitente, cuerpo, "🚫 " + AvisoPago.porQueNo(remitente + " " + cuerpo));
            // SMS de un código corto del banco que estas reglas no entendieron: a la página (ver crudo). Nunca de un contacto.
            if (AvisoPago.remitenteBanco(remitente) && !"celular".equals(AvisoPago.tipoRemitente(remitente)) && AvisoPago.sirveCrudo(cuerpo)) {
                String b = AvisoPago.bancoDeCodigo(remitente);
                return crudo(sp, "SMS " + remitente, "SMS | " + remitente + " | " + (b != null && !cuerpo.toLowerCase().contains(b.toLowerCase()) ? b + ": " : "") + cuerpo,
                        prefijo, null, b != null || sp.getBoolean(PREF_SMS_OK, false), callado);
            }
            return false;
        }
        long monto = AvisoPago.monto(cuerpo);
        if (monto <= 0) monto = AvisoPago.monto(remitente + " " + cuerpo);
        String banco = AvisoPago.bancoDeCodigo(remitente);
        String txt = "SMS | " + remitente + " | " + (banco != null && !cuerpo.toLowerCase().contains(banco.toLowerCase()) ? banco + ": " : "") + cuerpo;
        String id = prefijo + txt.hashCode();
        if (!marcarVisto(sp, id)) return false;
        String tipo = AvisoPago.tipoRemitente(remitente);
        // ¿La app del banco ya avisó «Recibiste plata» sin el valor (hace poco)? Este SMS del banco trae el valor: es el
        // mismo pago, confirmado por la app. Se dice «Recibiste 140000 pesos por Bre-B, en DaviPlata».
        if (!"celular".equals(tipo)) {
            JSONObject pend = tomarPendienteReciente(sp);
            if (pend != null) {
                String app = pend.optString("app");
                traza(sp, "SMS " + remitente, cuerpo, "🔊 junto con el aviso de " + app + ": " + AvisoPago.frase(app, monto, pend.optString("todo")));
                if (!callado) VentoApp.anunciarPago(app, monto, sp.getBoolean(PREF_NOTIF, true), pend.optString("todo") + " " + cuerpo);
                guardar(sp, id, app + " | " + app + " | Recibiste $" + AvisoPago.plata(monto).substring(1) + (AvisoPago.esBreB(pend.optString("todo")) ? " por Bre-B" : "") + " · " + cuerpo, !callado, null, false, null);
                return true;
            }
            // El mismo pago ya llegó por la app del banco con su valor (confirmado): el SMS no se cuenta otra vez.
            if (parear(sp, monto, true, id, banco != null || sp.getBoolean(PREF_SMS_OK, false)) != null) return false;
            // El código corto OFICIAL del banco (85888 = DaviPlata) cuenta como confirmado: el valor del pago solo llega por
            // ahí (la app de DaviPlata no lo trae). Otros códigos cortos: «revísalo», salvo que el dueño elija confirmarlos.
            final boolean confiar = banco != null || sp.getBoolean(PREF_SMS_OK, false);
            recordarSms(sp, id, monto, !callado);
            traza(sp, "SMS " + remitente, cuerpo, "🔊 " + (banco != null ? AvisoPago.frase(banco, monto, cuerpo) : AvisoPago.fraseSms(remitente, cuerpo, monto, tipo, confiar)));
            if (!callado) {
                // Se dice YA (1.41.1): antes esperaba 1,5 s el aviso de la app y, con la pantalla apagada, esa espera podía
                // quedarse dormida hasta desbloquear el celular.
                String f = banco != null ? AvisoPago.frase(banco, monto, cuerpo) : AvisoPago.fraseSms(remitente, cuerpo, monto, tipo, confiar);
                VentoApp.decirPago(f);
                if (sp.getBoolean(PREF_NOTIF, true)) {
                    if (confiar) VentoApp.anunciarPagoAviso(banco != null ? banco : AvisoPago.bancoDe(cuerpo), monto, cuerpo);
                    else VentoApp.notificarPago("⚠️ Aviso de " + AvisoPago.plata(monto) + " por SMS: revísalo", f, cuerpo, AvisoPago.plata(monto), "SMS " + remitente, "revisar");
                }
            }
            guardar(sp, id, txt, !callado, null, confiar, null);
            return true;
        }
        boolean confiar = false;
        boolean voz = false;
        if (!callado) {
            VentoApp.decirPago(AvisoPago.fraseSms(remitente, cuerpo, monto, tipo, confiar)); voz = true;
            if (sp.getBoolean(PREF_NOTIF, true)) VentoApp.notificarPago("🚨 Mensaje de pago FALSO: " + AvisoPago.plata(monto), AvisoPago.fraseSms(remitente, cuerpo, monto, tipo, confiar), cuerpo, AvisoPago.plata(monto), "SMS de un celular", "falso");
        }
        if (!callado && confiar && sp.getBoolean(PREF_NOTIF, true)) try { VentoApp.anunciarPagoAviso(banco != null ? banco : AvisoPago.bancoDe(cuerpo), monto); } catch (Throwable ignorado) { }
        guardar(sp, id, txt, voz, null, confiar, null);
        return true;
    }

    // ---------- Aviso de la app SIN valor + SMS del banco CON el valor (DaviPlata por la llave Bre-B) ----------
    // JUNTAR: el SMS del banco puede llegar hasta 2 min después del aviso de la app. JUNTAR_SMS: un aviso de la app solo se
    // junta con un SMS de hace menos de 1 min (antes 3 min: se juntaba con un SMS viejo de OTRO pago).
    // Sin esperas (1.41.1): cada aviso se dice en el instante en que llega (con la pantalla apagada, Android dormía las
    // esperas y la llave Bre-B no sonaba hasta desbloquear). JUNTAR: el SMS del banco puede llegar hasta 2 min después
    // del aviso de la app. JUNTAR_SMS: un aviso de la app solo se junta con un SMS de hace menos de 1 min.
    static final long JUNTAR = 2 * 60_000L, JUNTAR_SMS = 60_000L;
    static final String PREF_PEND = "pagosSinValor", PREF_SMSV = "pagosSmsValor";

    private static synchronized void pendiente(SharedPreferences sp, String id, String app, String todo) {
        try { sp.edit().putString(PREF_PEND, new JSONObject().put("id", id).put("app", app).put("todo", todo).put("t", System.currentTimeMillis()).toString()).apply(); } catch (Exception ignorado) { }
    }
    /** El aviso sin valor de hace poco (si hay), y se borra. */
    private static synchronized JSONObject tomarPendienteReciente(SharedPreferences sp) {
        try {
            JSONObject o = new JSONObject(sp.getString(PREF_PEND, "{}"));
            if (o.optString("id").isEmpty() || System.currentTimeMillis() - o.optLong("t") > JUNTAR) return null;
            sp.edit().remove(PREF_PEND).apply();
            return o;
        } catch (Exception e) { return null; }
    }
    /** SMS del banco con valor que todavía no tiene su aviso de la app. Es una LISTA: antes era uno solo y, si llegaban
     *  dos pagos seguidos por SMS, el segundo borraba al primero y el primero nunca sonaba. */
    private static JSONArray smsLista(SharedPreferences sp) {
        try { return new JSONArray(sp.getString(PREF_SMSV, "[]")); } catch (Exception e) { return new JSONArray(); }
    }
    private static void smsGuardar(SharedPreferences sp, JSONArray l) {
        JSONArray out = new JSONArray(); long ahora = System.currentTimeMillis();
        for (int i = 0; i < l.length(); i++) { JSONObject o = l.optJSONObject(i); if (o != null && ahora - o.optLong("t") <= JUNTAR) out.put(o); }
        while (out.length() > 30) out.remove(0);
        sp.edit().putString(PREF_SMSV, out.toString()).apply();
    }
    private static synchronized void recordarSms(SharedPreferences sp, String id, long monto, boolean dicho) {
        try { JSONArray l = smsLista(sp); l.put(new JSONObject().put("id", id).put("m", monto).put("t", System.currentTimeMillis()).put("dicho", dicho)); smsGuardar(sp, l); } catch (Exception ignorado) { }
    }
    /** El SMS más reciente (de hace menos de 1 min) que todavía no tiene su aviso de la app; queda emparejado. */
    private static synchronized JSONObject smsSinPareja(SharedPreferences sp) {
        try {
            JSONArray l = smsLista(sp); long ahora = System.currentTimeMillis();
            for (int i = l.length() - 1; i >= 0; i--) {
                JSONObject o = l.getJSONObject(i);
                if (o.optBoolean("par") || o.optLong("m") <= 0 || ahora - o.optLong("t") > JUNTAR_SMS) continue;
                o.put("par", true); smsGuardar(sp, l);
                return o;
            }
        } catch (Exception ignorado) { }
        return null;
    }

    /** El mismo pago por los dos lados (app del banco y SMS, mismo valor, en 3 min): devuelve el ID del otro aviso si
     *  todavía no estaba emparejado (y los empareja); si no, guarda este para emparejarlo después. */
    private static synchronized JSONObject parear(SharedPreferences sp, long monto, boolean esSms, String id, boolean ok) {
        try {
            JSONArray l = new JSONArray(sp.getString(PREF_RECIENTES, "[]")), out = new JSONArray();
            long ahora = System.currentTimeMillis();
            JSONObject par = null;
            for (int i = 0; i < l.length(); i++) {
                JSONObject o = l.getJSONObject(i);
                if (ahora - o.optLong("t") > 5 * 60_000L) continue;
                if (par == null && !o.optBoolean("par") && o.optLong("m") == monto && o.optBoolean("sms") != esSms && ahora - o.optLong("t") <= 3 * 60_000L) {
                    o.put("par", true);
                    par = o;
                }
                out.put(o);
            }
            // «ok»: ese aviso ya se dijo como pago CONFIRMADO (la app del banco o el SMS del 85888). Un SMS de «revísalo» no.
            if (par == null) out.put(new JSONObject().put("id", id).put("m", monto).put("sms", esSms).put("t", ahora).put("ok", ok));
            while (out.length() > 40) out.remove(0);
            sp.edit().putString(PREF_RECIENTES, out.toString()).apply();
            return par;
        } catch (Exception e) { return null; }
    }

    /** Avisos ya vistos (12 h): el mismo aviso no se dice dos veces aunque la app del banco lo vuelva a publicar. */
    private static synchronized boolean marcarVisto(SharedPreferences sp, String id) throws Exception {
        JSONObject v = new JSONObject(sp.getString(PREF_VISTOS, "{}")), out = new JSONObject();
        if (v.has(id)) return false;
        long ahora = System.currentTimeMillis();
        java.util.Iterator<String> it = v.keys();
        while (it.hasNext()) { String k = it.next(); long t = v.optLong(k); if (ahora - t < 12 * 3600_000L) out.put(k, t); }
        out.put(id, ahora);
        sp.edit().putString(PREF_VISTOS, out.toString()).apply();
        return true;
    }

    private static String texto(CharSequence c) { return c == null ? "" : c.toString().replaceAll("\\s+", " ").trim(); }

    /** Aviso del banco que estas reglas no entendieron: va a la página «crudo» (ella decide con sus reglas, que se
     *  actualizan solas, y si es un pago lo dice en voz alta). Una vez por aviso. */
    private static boolean crudo(SharedPreferences sp, String app, String txt, String prefijo, String revisar, boolean smsOk, boolean callado) {
        try {
            String id = prefijo + "R:" + txt.hashCode();
            if (!marcarVisto(sp, id)) return false;
            traza(sp, app, txt, "📤 no lo entendí: se lo paso a la página para que lo revise");
            guardar(sp, id, txt, callado, revisar, smsOk, null, true);
            return true;
        } catch (Exception e) { return false; }
    }

    private static void guardar(SharedPreferences sp, String id, String txt, boolean voz, String revisar, boolean smsOk, String reemplaza) throws Exception {
        guardar(sp, id, txt, voz, revisar, smsOk, reemplaza, false);
    }

    /** Cola de avisos para la página (sobrevive si la página todavía no ha cargado). */
    private static synchronized void guardar(SharedPreferences sp, String id, String txt, boolean voz, String revisar, boolean smsOk, String reemplaza, boolean crudo) throws Exception {
        JSONArray l = new JSONArray(sp.getString(PREF_COLA, "[]")), out = new JSONArray();
        long ahora = System.currentTimeMillis();
        for (int i = 0; i < l.length(); i++) {
            JSONObject o = l.getJSONObject(i);
            if (id.equals(o.optString("id"))) return;                     // el mismo aviso actualizado: no se repite
            if (ahora - o.optLong("t") < VIGENCIA) out.put(o);
        }
        JSONObject o = new JSONObject().put("id", id).put("txt", txt).put("t", ahora).put("voz", voz);   // voz: ya se dijo en voz alta aquí
        if (revisar != null) o.put("revisar", revisar);                  // no es la app oficial: «⚠️ Revisar», no «confirmado»
        if (smsOk) o.put("smsOk", true);                                  // SMS del banco y el dueño eligió confirmarlos
        if (reemplaza != null) o.put("reemplaza", reemplaza);             // confirma el SMS de este mismo pago
        if (crudo) o.put("crudo", true);                                  // la app no lo entendió: la página decide
        out.put(o);
        while (out.length() > 30) out.remove(0);
        sp.edit().putString(PREF_COLA, out.toString()).apply();
        // Al Servidor Vento de una (sin esperar a que la página despierte): así les llega ya a los demás equipos.
        if (!crudo && !id.startsWith("PRUEBA")) try { VentoApp.reenviarPago(id, txt, revisar, smsOk); } catch (Throwable ignorado) { }
    }

    /** Para la página: los avisos de banco que no se tomaron, el registro de los últimos avisos del banco y qué hizo Vento
     *  con cada uno, y cuándo llegó el último aviso de banco. */
    static String diag(SharedPreferences sp) {
        try { return new JSONObject().put("lista", new JSONArray(sp.getString(PREF_DIAG, "[]"))).put("traza", new JSONArray(sp.getString(PREF_TRAZA, "[]")))
                .put("ultimo", sp.getLong(PREF_ULTIMO, 0)).put("vivo", activa != null).toString(); }
        catch (Exception e) { return "{}"; }
    }

    // ---------- Registro: cada aviso del banco que llega y qué hizo Vento (sin nombres ni números) ----------
    static final String PREF_TRAZA = "pagosAvisosTraza";
    // ⏱ Cuándo dice el banco que pasó el pago (la hora del aviso o del SMS) y cuándo llegó al celular: el registro dice
    // si el BANCO mandó el aviso tarde (Vento lo dice en el instante en que llega). Así se sabe de dónde viene una demora.
    private static volatile long tBanco = 0, tLlego = 0;
    static void tiempos(long banco, long llego) { tBanco = banco; tLlego = llego; }
    static long horaBanco() { return tBanco; }
    static String demora() {
        long b = tBanco, l = tLlego, ahora = System.currentTimeMillis();
        StringBuilder x = new StringBuilder();
        if (b > 0 && l > 0 && l - b >= 3000 && l - b < 3600_000L) x.append(" · ⏱ el banco lo mandó ").append((l - b) / 1000).append(" s tarde");
        if (l > 0 && ahora - l >= 3000 && ahora - l < 3600_000L) x.append(" · ⏱ Vento lo leyó ").append((ahora - l) / 1000).append(" s después");
        return x.toString();
    }

    static synchronized void traza(SharedPreferences sp, String app, String texto, String resultado) {
        try {
            resultado = (resultado == null ? "" : resultado) + ("Vento".equals(app) ? "" : demora());   // (las líneas de la ventana no llevan la demora del banco)
            JSONArray l = new JSONArray(sp.getString(PREF_TRAZA, "[]"));
            l.put(new JSONObject().put("t", System.currentTimeMillis()).put("app", app == null ? "" : app).put("txt", AvisoPago.sinDatos(texto)).put("r", resultado == null ? "" : resultado));
            while (l.length() > 25) l.remove(0);
            sp.edit().putString(PREF_TRAZA, l.toString()).apply();
        } catch (Exception ignorado) { }
    }

    /** Prueba piloto: pasa un aviso de prueba por el MISMO camino que uno de verdad (reglas, voz, aviso del celular) sin
     *  registrarlo como pago. Devuelve lo que hizo. */
    static synchronized String probar(SharedPreferences sp, String app, String titulo, String cuerpo, boolean esSms) {
        try {
            String pref = "PRUEBA:" + System.nanoTime() + ":";
            tiempos(0, 0);
            boolean ok = esSms ? procesarSms(sp, titulo, cuerpo, pref, false) : procesar(sp, app, titulo, cuerpo, pref, true, false);
            JSONArray l = new JSONArray(sp.getString(PREF_TRAZA, "[]"));
            String r = l.length() > 0 ? l.getJSONObject(l.length() - 1).optString("r") : "";
            return new JSONObject().put("ok", ok).put("r", r).toString();
        } catch (Exception e) { return "{\"ok\":false,\"r\":\"error\"}"; }
    }

    /** La página toma los avisos pendientes (y quedan vistos). */
    static synchronized String tomar(SharedPreferences sp) {
        String s = sp.getString(PREF_COLA, "[]");
        try {
            JSONArray l = new JSONArray(s), out = new JSONArray();
            long ahora = System.currentTimeMillis();
            for (int i = 0; i < l.length(); i++) { JSONObject o = l.getJSONObject(i); if (ahora - o.optLong("t") < VIGENCIA) out.put(o); }
            s = out.toString();
        } catch (Exception e) { s = "[]"; }
        sp.edit().putString(PREF_COLA, "[]").apply();
        return s;
    }
}
