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
    static final String PREF_VISTOS = "pagosAvisosVistos", PREF_NOTIF = "pagosNotif";

    @Override
    public void onListenerConnected() {
        activa = this;
        // Los pagos que llegaron mientras Vento no estaba escuchando (el celular la cerró, se reinició…) siguen en la barra
        // de notificaciones: se toman ahora (los que ya se habían visto no se repiten).
        try {
            StatusBarNotification[] l = getActiveNotifications();
            boolean alguno = false;
            if (l != null) for (StatusBarNotification sbn : l) if (leer(sbn, true)) alguno = true;
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
        try { if (leer(sbn, false)) avisarPagina(); } catch (Exception ignorado) { }
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
        if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return false;
        android.content.pm.PackageManager pm = getPackageManager();
        String app;
        android.content.pm.ApplicationInfo info;
        try { info = pm.getApplicationInfo(pkg, 0); app = String.valueOf(pm.getApplicationLabel(info)); }
        catch (Exception e) { return false; }
        if (!AvisoPago.esBanco(app) && !AvisoPago.paqueteOficial(pkg)) return false;
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
        if (x == null) return false;
        String titulo = texto(x.getCharSequence(Notification.EXTRA_TITLE));
        CharSequence grande = x.getCharSequence(Notification.EXTRA_BIG_TEXT);
        String principal = texto(grande != null ? grande : x.getCharSequence(Notification.EXTRA_TEXT));
        // Cuando llega otro pago con el primero todavía en la barra, la app los junta («2 mensajes nuevos»): cada
        // aviso viene en una línea (InboxStyle) o en un mensaje (MessagingStyle). Antes solo se leía el resumen.
        java.util.List<String> otros = new java.util.ArrayList<>();
        CharSequence[] lineas = x.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lineas != null) for (CharSequence l : lineas) otros.add(texto(l));
        try {
            android.os.Parcelable[] msgs = x.getParcelableArray(Notification.EXTRA_MESSAGES);
            if (msgs != null) for (android.os.Parcelable m : msgs) if (m instanceof Bundle) otros.add(texto(((Bundle) m).getCharSequence("text")));
        } catch (Exception ignorado) { }
        // La misma notificación actualizada (mismo «cuándo» y mismo texto) no se repite; dos pagos iguales (mismo valor,
        // misma persona) SÍ son dos pagos: cada uno trae su propio «cuándo». Antes se tomaban como uno solo.
        long cuando = n.when != 0 ? n.when : sbn.getPostTime();
        // Al reconectar: lo de los últimos 30 min se toma (lo de más de 3 min, sin decirlo en voz alta); lo más viejo no
        // (podría cuadrar por casualidad con el saldo de una mesa de ahora).
        long edad = Math.abs(System.currentTimeMillis() - sbn.getPostTime());
        if (atrasada && edad > 30 * 60_000L) return false;
        boolean callado = atrasada && edad > 3 * 60_000L;
        boolean alguno = false;
        if (procesar(sp, app, titulo, principal, sbn.getKey() + ":" + cuando + ":", confiable, callado)) alguno = true;
        for (String l : otros) if (!l.isEmpty() && !l.equals(principal) && procesar(sp, app, titulo, l, "L:", confiable, callado)) alguno = true;
        return alguno;
    }

    /** Un aviso: si es plata recibida y no se había visto, se dice en voz alta YA (aunque Vento esté minimizada o la
     *  pantalla apagada), sale el aviso del celular y queda en la cola para la página (que lo registra). */
    private boolean procesar(SharedPreferences sp, String app, String titulo, String cuerpo, String prefijo, boolean confiable, boolean callado) throws Exception {
        String todo = titulo + " " + cuerpo;
        if (!AvisoPago.esRecibido(todo)) return false;
        long monto = AvisoPago.monto(todo);
        String txt = app + " | " + titulo + " | " + cuerpo;
        String id = prefijo + txt.hashCode();
        if (!marcarVisto(sp, id)) return false;
        // Sin valor que se entienda: no se dice nada; la página lo reporta para aprender ese formato.
        boolean voz = false;
        if (monto <= 0) callado = true;
        if (confiable && !callado) { VentoApp.anunciarPago(app, monto, sp.getBoolean(PREF_NOTIF, true)); voz = true; }
        else if (!confiable && !callado) { VentoApp.decirPago("Ojo. Llegó un aviso de " + monto + " pesos de una aplicación que no es la oficial de " + AvisoPago.nombreApp(app) + ". Revísalo en la aplicación del banco antes de entregar."); voz = true; }
        guardar(sp, id, txt, voz, confiable ? null : "La app «" + app + "» de este celular no es la oficial (no se instaló desde la tienda): míralo en la app del banco");
        return true;
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

    /** Cola de avisos para la página (sobrevive si la página todavía no ha cargado). */
    private static synchronized void guardar(SharedPreferences sp, String id, String txt, boolean voz, String revisar) throws Exception {
        JSONArray l = new JSONArray(sp.getString(PREF_COLA, "[]")), out = new JSONArray();
        long ahora = System.currentTimeMillis();
        for (int i = 0; i < l.length(); i++) {
            JSONObject o = l.getJSONObject(i);
            if (id.equals(o.optString("id"))) return;                     // el mismo aviso actualizado: no se repite
            if (ahora - o.optLong("t") < VIGENCIA) out.put(o);
        }
        JSONObject o = new JSONObject().put("id", id).put("txt", txt).put("t", ahora).put("voz", voz);   // voz: ya se dijo en voz alta aquí
        if (revisar != null) o.put("revisar", revisar);                  // no es la app oficial: «⚠️ Revisar», no «confirmado»
        out.put(o);
        while (out.length() > 30) out.remove(0);
        sp.edit().putString(PREF_COLA, out.toString()).apply();
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
