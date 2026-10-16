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
        try { if (leer(sbn, false)) { seguirViva(); avisarPagina(); } } catch (Exception ignorado) { }
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
        if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return false;
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
            if (principal.isEmpty() && titulo.isEmpty() || AvisoPago.monto(titulo + " " + principal + mas) <= 0) {
                String vista = textosDeVista(n);
                if (!vista.isEmpty()) mas.append(' ').append(vista);
            }
            principal = (principal + mas).trim();
        }
        if (titulo.isEmpty() && principal.isEmpty()) return false;
        try { sp.edit().putLong(PREF_ULTIMO, System.currentTimeMillis()).apply(); } catch (Exception ignorado) { }
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
        if (sms) {
            // Mensaje de texto: el título es quien lo manda (número o nombre); cada mensaje de la conversación es un aviso.
            if (procesarSms(sp, titulo, principal, sbn.getKey() + ":" + cuando + ":", callado)) alguno = true;
            for (String l : otros) if (!l.isEmpty() && !l.equals(principal) && procesarSms(sp, titulo, l, "S:", callado)) alguno = true;
            return alguno;
        }
        if (procesar(sp, app, titulo, principal, sbn.getKey() + ":" + cuando + ":", confiable, callado)) alguno = true;
        else { String t0 = titulo + " " + principal; if (!AvisoPago.esRecibido(t0) || (AvisoPago.monto(t0) <= 0 && !AvisoPago.esPlataSinValor(t0))) diagnostico(sp, app, t0); }
        marcarContenido(sp, app, principal);
        // Las líneas de un aviso agrupado son los pagos de antes que siguen en la barra: solo cuenta la que no se había
        // visto (antes una línea vieja podía volver a sonar como pago nuevo).
        for (String l : otros) if (!l.isEmpty() && !l.equals(principal) && !principal.contains(l) && !contenidoVisto(sp, app, l)) {
            if (procesar(sp, app, titulo, l, "L:", confiable, callado)) alguno = true;
            marcarContenido(sp, app, l);
        }
        return alguno;
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
    private boolean procesar(SharedPreferences sp, String app, String titulo, String cuerpo, String prefijo, boolean confiable, boolean callado) throws Exception {
        String todo = titulo + " " + cuerpo;
        if (!AvisoPago.esRecibido(todo)) return false;
        long monto = AvisoPago.monto(todo);
        // Sin valor en el aviso («¡Te llegó plata! Entra a Nequi»): igual suena, sin el valor.
        if (monto <= 0 && AvisoPago.esPlataSinValor(todo)) {
            String id0 = prefijo + (app + " | " + titulo + " | " + cuerpo).hashCode();
            if (!marcarVisto(sp, id0)) return false;
            // DaviPlata por la llave Bre-B avisa SIN el valor («Recibiste Plata de otra entidad usando Llaves») y el valor
            // llega por SMS del 85888 («Recibiste 140,000»). Se juntan: el aviso de la app confirma y el SMS dice cuánto.
            if (confiable) {
                JSONObject sms = smsSinPareja(sp);
                if (sms != null) {
                    long m = sms.optLong("m");
                    // Si el SMS ya se había dicho, ahora solo queda confirmado (no se repite la voz).
                    if (!callado && !sms.optBoolean("dicho")) VentoApp.anunciarPago(app, m, sp.getBoolean(PREF_NOTIF, true), todo);
                    else if (!callado) VentoApp.decirPago("Confirmado por " + AvisoPago.nombreApp(app) + ".");
                    guardar(sp, id0, app + " | " + titulo + " | Recibiste $" + AvisoPago.plata(m).substring(1) + " · " + cuerpo, !callado, null, false, sms.optString("id"));
                    return true;
                }
                if (!callado) {
                    // Se espera el SMS con el valor unos segundos; si no llega, se dice sin el valor.
                    final String app0 = app, todo0 = todo;
                    pendiente(sp, id0, app, todo);
                    VentoApp.mantenerDespierto();
                    VentoApp.ui.postDelayed(() -> {
                        try {
                            if (!tomarPendiente(sp, id0)) return;          // ya llegó el SMS y se dijo con el valor
                            VentoApp.decirPago(AvisoPago.fraseSinValor(app0));
                            if (sp.getBoolean(PREF_NOTIF, true)) VentoApp.app.new Puente().notificar("💜 Llegó plata por " + AvisoPago.nombreApp(app0), "Ábrela para ver el valor.", "pagos", false);
                        } catch (Throwable ignorado) { }
                    }, ESPERA_SMS);
                    guardar(sp, id0, app + " | " + titulo + " | " + cuerpo, true, null, false, null);
                    return true;
                }
            }
            if (!callado) {
                VentoApp.decirPago(AvisoPago.fraseSinValor(app));
                if (sp.getBoolean(PREF_NOTIF, true)) try {
                    VentoApp.app.new Puente().notificar("💜 Llegó plata por " + AvisoPago.nombreApp(app), "Ábrela para ver el valor.", "pagos", false);
                } catch (Throwable ignorado) { }
            }
            guardar(sp, id0, app + " | " + titulo + " | " + cuerpo, !callado, null, false, null);
            return true;
        }
        String txt = app + " | " + titulo + " | " + cuerpo;
        String id = prefijo + txt.hashCode();
        if (!marcarVisto(sp, id)) return false;
        // Sin valor que se entienda: no se dice nada; la página lo reporta para aprender ese formato.
        boolean voz = false;
        if (monto <= 0) callado = true;
        // ¿Ya llegó este mismo pago por SMS (el banco avisa por los dos lados)? Entonces este aviso de la app lo confirma
        // y reemplaza al del SMS (no son dos pagos).
        String reemplaza = monto > 0 && confiable ? parear(sp, monto, false, id) : null;
        if (confiable && !callado) { VentoApp.anunciarPago(app, monto, sp.getBoolean(PREF_NOTIF, true), todo); voz = true; }
        else if (!confiable && !callado) { VentoApp.decirPago("Ojo. Llegó un aviso de " + monto + " pesos de una aplicación que no es la oficial de " + AvisoPago.nombreApp(app) + ". Revísalo en la aplicación del banco antes de entregar."); voz = true; }
        guardar(sp, id, txt, voz, confiable ? null : "La app «" + app + "» de este celular no es la oficial (no se instaló desde la tienda): míralo en la app del banco", false, reemplaza);
        return true;
    }

    /** SMS del banco: solo plata recibida que nombra un banco. Desde un celular común = falso; desde el código corto del
     *  banco = «revísalo» (o «Pago confirmado» si el dueño eligió confirmar los SMS del banco). */
    private boolean procesarSms(SharedPreferences sp, String remitente, String cuerpo, String prefijo, boolean callado) throws Exception {
        if (!AvisoPago.esSmsDePago(remitente, cuerpo)) return false;
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
                if (!callado) VentoApp.anunciarPago(app, monto, sp.getBoolean(PREF_NOTIF, true), pend.optString("todo") + " " + cuerpo);
                guardar(sp, id, app + " | " + app + " | Recibiste $" + AvisoPago.plata(monto).substring(1) + (AvisoPago.esBreB(pend.optString("todo")) ? " por Bre-B" : "") + " · " + cuerpo, !callado, null, false, null);
                return true;
            }
            // El mismo pago ya llegó por la app del banco con su valor (confirmado): el SMS no se cuenta otra vez.
            if (parear(sp, monto, true, id) != null) return false;
            final boolean confiar = sp.getBoolean(PREF_SMS_OK, false);
            recordarSms(sp, id, monto);
            if (!callado) {
                // Unos segundos por si llega el aviso de la app del banco (entonces se dice confirmado, una sola vez).
                final long m = monto; final String rem = remitente, cu = cuerpo, b = banco, ti = tipo;
                VentoApp.mantenerDespierto();
                VentoApp.ui.postDelayed(() -> {
                    try {
                        if (!smsSigue(sp, id)) return;
                        VentoApp.decirPago(AvisoPago.fraseSms(rem, cu, m, ti, confiar));
                        if (confiar && sp.getBoolean(PREF_NOTIF, true)) VentoApp.anunciarPagoAviso(b != null ? b : AvisoPago.bancoDe(cu), m);
                    } catch (Throwable ignorado) { }
                }, ESPERA_APP);
            }
            guardar(sp, id, txt, !callado, null, confiar, null);
            return true;
        }
        boolean confiar = false;
        boolean voz = false;
        if (!callado) { VentoApp.decirPago(AvisoPago.fraseSms(remitente, cuerpo, monto, tipo, confiar)); voz = true; }
        if (!callado && confiar && sp.getBoolean(PREF_NOTIF, true)) try { VentoApp.anunciarPagoAviso(banco != null ? banco : AvisoPago.bancoDe(cuerpo), monto); } catch (Throwable ignorado) { }
        guardar(sp, id, txt, voz, null, confiar, null);
        return true;
    }

    // ---------- Aviso de la app SIN valor + SMS del banco CON el valor (DaviPlata por la llave Bre-B) ----------
    static final long ESPERA_SMS = 20_000L, ESPERA_APP = 6_000L, JUNTAR = 3 * 60_000L;
    static final String PREF_PEND = "pagosSinValor", PREF_SMSV = "pagosSmsValor";

    private static synchronized void pendiente(SharedPreferences sp, String id, String app, String todo) {
        try { sp.edit().putString(PREF_PEND, new JSONObject().put("id", id).put("app", app).put("todo", todo).put("t", System.currentTimeMillis()).toString()).apply(); } catch (Exception ignorado) { }
    }
    /** Lo toma si sigue pendiente (devuelve true y lo borra). */
    private static synchronized boolean tomarPendiente(SharedPreferences sp, String id) {
        // Se dice sin el valor, pero queda para juntarlo si el SMS llega después (hasta 3 min): entonces se dice el valor.
        try { JSONObject o = new JSONObject(sp.getString(PREF_PEND, "{}")); if (!id.equals(o.optString("id")) || o.optBoolean("dicho")) return false;
            sp.edit().putString(PREF_PEND, o.put("dicho", true).toString()).apply(); return true; } catch (Exception e) { return false; }
    }
    /** ¿El SMS sigue sin su aviso de la app? (se marca como ya dicho, y queda para juntarlo después) */
    private static synchronized boolean smsSigue(SharedPreferences sp, String id) {
        try { JSONObject o = new JSONObject(sp.getString(PREF_SMSV, "{}")); if (!id.equals(o.optString("id")) || o.optBoolean("dicho")) return false;
            sp.edit().putString(PREF_SMSV, o.put("dicho", true).toString()).apply(); return true; } catch (Exception e) { return false; }
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
    /** SMS del banco con valor que todavía no tiene su aviso de la app. */
    private static synchronized void recordarSms(SharedPreferences sp, String id, long monto) {
        try { sp.edit().putString(PREF_SMSV, new JSONObject().put("id", id).put("m", monto).put("t", System.currentTimeMillis()).toString()).apply(); } catch (Exception ignorado) { }
    }
    private static synchronized JSONObject smsSinPareja(SharedPreferences sp) {
        try {
            JSONObject o = new JSONObject(sp.getString(PREF_SMSV, "{}"));
            if (o.optLong("m") <= 0 || System.currentTimeMillis() - o.optLong("t") > JUNTAR) return null;
            sp.edit().remove(PREF_SMSV).apply();
            return o;
        } catch (Exception e) { return null; }
    }

    /** El mismo pago por los dos lados (app del banco y SMS, mismo valor, en 3 min): devuelve el ID del otro aviso si
     *  todavía no estaba emparejado (y los empareja); si no, guarda este para emparejarlo después. */
    private static synchronized String parear(SharedPreferences sp, long monto, boolean esSms, String id) {
        try {
            JSONArray l = new JSONArray(sp.getString(PREF_RECIENTES, "[]")), out = new JSONArray();
            long ahora = System.currentTimeMillis();
            String par = null;
            for (int i = 0; i < l.length(); i++) {
                JSONObject o = l.getJSONObject(i);
                if (ahora - o.optLong("t") > 5 * 60_000L) continue;
                if (par == null && !o.optBoolean("par") && o.optLong("m") == monto && o.optBoolean("sms") != esSms && ahora - o.optLong("t") <= 3 * 60_000L) {
                    o.put("par", true);
                    par = o.optString("id");
                }
                out.put(o);
            }
            if (par == null) out.put(new JSONObject().put("id", id).put("m", monto).put("sms", esSms).put("t", ahora));
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

    /** Cola de avisos para la página (sobrevive si la página todavía no ha cargado). */
    private static synchronized void guardar(SharedPreferences sp, String id, String txt, boolean voz, String revisar, boolean smsOk, String reemplaza) throws Exception {
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
        out.put(o);
        while (out.length() > 30) out.remove(0);
        sp.edit().putString(PREF_COLA, out.toString()).apply();
    }

    /** Para la página: los avisos de banco que no se tomaron (y cuándo llegó el último aviso de banco). */
    static String diag(SharedPreferences sp) {
        try { return new JSONObject().put("lista", new JSONArray(sp.getString(PREF_DIAG, "[]"))).put("ultimo", sp.getLong(PREF_ULTIMO, 0)).put("vivo", activa != null).toString(); }
        catch (Exception e) { return "{}"; }
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
