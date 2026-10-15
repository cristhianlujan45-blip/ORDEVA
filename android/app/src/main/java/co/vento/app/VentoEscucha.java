package co.vento.app;

import android.app.Notification;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.regex.Pattern;

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
    // Apps de bancos y billeteras (por el nombre que muestra el celular).
    private static final Pattern BANCO = Pattern.compile("daviplata|nequi|bancolombia|davivienda|movii|\\bdale\\b|bre-?b|banco|\\bnu\\b|lulo|rappipay|powwi|ual[aá]|bbva|scotiabank|av villas|colpatria|occidente|caja social", Pattern.CASE_INSENSITIVE);
    // Plata que ENTRA (igual que pgLeer en la página). DaviPlata escribe de «usted»: «Le llegó plata», «Le pasaron».
    private static final Pattern RECIBIDO = Pattern.compile("recibiste|has recibido|ha recibido|(te|le) lleg[oó]|(te|le) llegaron|(te|le) pas[oó]|(te|le) pasaron|pasaron plata|(te|le) envi[oó]|(te|le) enviaron|(te|le) transfiri|(te|le) pag[oó]|(te|le) pagaron|(te|le) consign|(te|le) abon|consignaron|abonaron|entr[oó] plata|lleg[oó] plata|ingres[oó]|recibi[oó]|recepci[oó]n|pago recibido|dinero recibido|transferencia recibida|abono a (tu|su) cuenta", Pattern.CASE_INSENSITIVE);
    // Nunca se toman códigos, claves ni avisos de plata que SALE.
    private static final Pattern PRIVADO = Pattern.compile("c[oó]digo|clave|otp|contrase|token|enviaste|pagaste|transferiste|retiraste|compraste|sacaste|usted (envi|pag|transfiri|pas)", Pattern.CASE_INSENSITIVE);
    private static final long VIGENCIA = 6 * 3600_000L;   // un aviso que la página no alcanzó a tomar en 6 h ya no sirve

    @Override public void onListenerConnected() { activa = this; }
    @Override public void onListenerDisconnected() { if (activa == this) activa = null; }
    @Override public void onDestroy() { if (activa == this) activa = null; super.onDestroy(); }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            SharedPreferences sp = getSharedPreferences("vento", MODE_PRIVATE);
            if (!sp.getBoolean(PREF_ON, false) || sbn == null) return;
            String pkg = sbn.getPackageName();
            if (pkg == null || pkg.equals(getPackageName())) return;
            Notification n = sbn.getNotification();
            if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            String app;
            try { app = String.valueOf(getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(pkg, 0))); }
            catch (Exception e) { return; }
            if (!BANCO.matcher(app).find()) return;
            Bundle x = n.extras;
            if (x == null) return;
            String titulo = texto(x.getCharSequence(Notification.EXTRA_TITLE));
            CharSequence grande = x.getCharSequence(Notification.EXTRA_BIG_TEXT);
            String cuerpo = texto(grande != null ? grande : x.getCharSequence(Notification.EXTRA_TEXT));
            String todo = titulo + " " + cuerpo;
            if (!RECIBIDO.matcher(todo).find()) return;
            // «Recibiste $20.000» siempre pasa; si además habla de códigos o plata que sale, no se toma.
            if (PRIVADO.matcher(todo).find() && !Pattern.compile("recibiste|recibi[oó]|ha recibido|(te|le) lleg", Pattern.CASE_INSENSITIVE).matcher(todo).find()) return;
            String txt = app + " | " + titulo + " | " + cuerpo;
            guardar(sp, sbn.getKey() + ":" + txt.hashCode(), txt);
            // La página (aunque la ventana esté cerrada, la mantiene viva VentoServicio) lo toma ya.
            VentoApp.ui.post(() -> {
                VentoApp.motor(null);
                VentoApp.js("try{window.ventoAvisosNativos&&window.ventoAvisosNativos()}catch(e){}");
            });
        } catch (Exception ignorado) { }
    }

    private static String texto(CharSequence c) { return c == null ? "" : c.toString().replaceAll("\\s+", " ").trim(); }

    /** Cola de avisos para la página (sobrevive si la página todavía no ha cargado). */
    private static synchronized void guardar(SharedPreferences sp, String id, String txt) throws Exception {
        JSONArray l = new JSONArray(sp.getString(PREF_COLA, "[]")), out = new JSONArray();
        long ahora = System.currentTimeMillis();
        for (int i = 0; i < l.length(); i++) {
            JSONObject o = l.getJSONObject(i);
            if (id.equals(o.optString("id"))) return;                     // el mismo aviso actualizado: no se repite
            if (ahora - o.optLong("t") < VIGENCIA) out.put(o);
        }
        out.put(new JSONObject().put("id", id).put("txt", txt).put("t", ahora));
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
