package co.vento.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 📩 1.72.6 · Los SMS del banco, leídos DIRECTO del celular (no del aviso de la app de mensajes).
 * Android le entrega cada SMS a ORDEVA en el instante en que llega, también con el celular bloqueado y aunque Android haya
 * cortado la «lectura de avisos» (pasó 21 veces en un día en Android 16; los pagos sonaban al desbloquear, hasta 20 min
 * tarde). Sirve para los que avisan por SMS: DaviPlata (85888), Bold (890412) y los bancos con código corto.
 *  • Solo códigos cortos (3 a 6 cifras) o un remitente con nombre de banco: los SMS de personas ni se miran.
 *  • Pasa por las MISMAS reglas que el aviso (VentoEscucha.procesarSms): voz, notificación, ventana y al servidor.
 *  • El mismo SMS llega después como aviso de la app de mensajes: ese aviso se reconoce (mismo texto, en 30 min) y no
 *    vuelve a sonar. Dos SMS iguales de verdad (dos pagos de $3.000) son dos: cada aviso se empareja con uno solo.
 * Necesita el permiso «SMS» (se pide junto con la lectura de pagos). Sin él, todo sigue como antes por los avisos.
 */
public class SmsBanco extends BroadcastReceiver {
    static final String PREF_TOMADOS = "smsTomados";
    static final long JUNTAR_MS = 30 * 60_000L;

    @Override
    public void onReceive(Context c, Intent i) {
        if (i == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(i.getAction())) return;
        SharedPreferences sp = c.getSharedPreferences("vento", Context.MODE_PRIVATE);
        if (!sp.getBoolean(VentoEscucha.PREF_ON, false)) return;           // la lectura de pagos está apagada
        SmsMessage[] partes;
        try { partes = Telephony.Sms.Intents.getMessagesFromIntent(i); } catch (Throwable e) { return; }
        if (partes == null || partes.length == 0) return;
        // Un SMS largo llega en varias partes: se juntan por remitente.
        java.util.LinkedHashMap<String, StringBuilder> porRemitente = new java.util.LinkedHashMap<>();
        long hora = 0;
        for (SmsMessage m : partes) {
            if (m == null) continue;
            String r = m.getDisplayOriginatingAddress();
            if (r == null) r = m.getOriginatingAddress();
            if (r == null) continue;
            StringBuilder b = porRemitente.get(r);
            if (b == null) { b = new StringBuilder(); porRemitente.put(r, b); }
            b.append(m.getDisplayMessageBody() == null ? "" : m.getDisplayMessageBody());
            hora = Math.max(hora, m.getTimestampMillis());
        }
        final long cuando = hora > 0 ? hora : System.currentTimeMillis();
        final PendingResult pr = goAsync();
        new Thread(() -> {
            try {
                VentoApp.mantenerDespierto();
                for (java.util.Map.Entry<String, StringBuilder> e : porRemitente.entrySet()) {
                    String remitente = e.getKey(), cuerpo = e.getValue().toString().replaceAll("\\s+", " ").trim();
                    if (!AvisoPago.remitenteBanco(remitente) || "celular".equals(AvisoPago.tipoRemitente(remitente))) continue;
                    VentoEscucha.tiempos(cuando, System.currentTimeMillis());
                    boolean tomado = VentoEscucha.smsDirecto(sp, remitente, cuerpo, "D:" + cuando + ":");
                    if (tomado) anotar(sp, cuerpo);
                }
            } catch (Throwable ignorado) {
            } finally {
                try { pr.finish(); } catch (Throwable ignorado) { }
            }
        }, "vento-sms").start();
    }

    private static String clave(String cuerpo) { return Integer.toHexString(String.valueOf(cuerpo).replaceAll("\\s+", " ").trim().toLowerCase().hashCode()); }

    /** Este SMS ya lo tomó el receptor: el aviso de la app de mensajes con el mismo texto se salta (una vez). */
    static synchronized void anotar(SharedPreferences sp, String cuerpo) {
        try {
            JSONArray l = vigentes(sp);
            l.put(new JSONObject().put("h", clave(cuerpo)).put("t", System.currentTimeMillis()));
            while (l.length() > 40) l.remove(0);
            sp.edit().putString(PREF_TOMADOS, l.toString()).apply();
        } catch (Exception ignorado) { }
    }

    /** ¿Este SMS (que llega por el aviso de la app de mensajes) ya lo tomó el receptor? Si sí, queda emparejado. */
    static synchronized boolean yaTomado(SharedPreferences sp, String cuerpo) {
        try {
            JSONArray l = vigentes(sp);
            String h = clave(cuerpo);
            for (int i = 0; i < l.length(); i++) {
                JSONObject o = l.getJSONObject(i);
                if (h.equals(o.optString("h"))) { l.remove(i); sp.edit().putString(PREF_TOMADOS, l.toString()).apply(); return true; }
            }
        } catch (Exception ignorado) { }
        return false;
    }

    private static JSONArray vigentes(SharedPreferences sp) {
        JSONArray out = new JSONArray();
        try {
            JSONArray l = new JSONArray(sp.getString(PREF_TOMADOS, "[]"));
            long ahora = System.currentTimeMillis();
            for (int i = 0; i < l.length(); i++) { JSONObject o = l.getJSONObject(i); if (ahora - o.optLong("t") < JUNTAR_MS) out.put(o); }
        } catch (Exception ignorado) { }
        return out;
    }
}
