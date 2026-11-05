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
                    recibir(sp, remitente, cuerpo, cuando);
                }
            } catch (Throwable ignorado) {
            } finally {
                try { pr.finish(); } catch (Throwable ignorado) { }
            }
        }, "vento-sms").start();
    }

    /** Un SMS que llegó directo (también lo usan las pruebas). true si se tomó como pago. */
    static boolean recibir(SharedPreferences sp, String remitente, String cuerpo, long cuando) {
                    if (!AvisoPago.remitenteBanco(remitente) || "celular".equals(AvisoPago.tipoRemitente(remitente))) return false;
                    VentoEscucha.tiempos(cuando, System.currentTimeMillis());
                    // 1.82.1: si la app de mensajes ya lo trajo (llegó antes por su aviso), es el MISMO SMS: no se repite.
                    if (tomar(sp, PREF_AVISO, remitente, cuerpo)) return false;
                    // Se anota ANTES de procesarlo (y siempre, aunque quede emparejado callado con el aviso de la app del banco):
                    // así el aviso de la app de mensajes con este mismo SMS se salta. Antes solo se anotaba si se decía: el SMS
                    // que quedaba emparejado con el aviso de Nequi / DaviPlata volvía a entrar por la app de mensajes y sonaba
                    // otra vez («llegaron 200 pesos… llegaron 200 pesos por mensaje de texto»).
                    anotar(sp, PREF_TOMADOS, remitente, cuerpo);
                    return VentoEscucha.smsDirecto(sp, remitente, cuerpo, "D:" + cuando + ":");
    }

    private static String clave(String cuerpo) { return Integer.toHexString(String.valueOf(cuerpo).replaceAll("\\s+", " ").trim().toLowerCase().hashCode()); }

    /** 1.82.1: los SMS que ya trajo el aviso de la app de mensajes (por si llega antes que el receptor directo). */
    static final String PREF_AVISO = "smsPorAviso";
    /** Lo que vale un SMS (o 0). */
    static long montoDe(String remitente, String cuerpo) {
        long m = AvisoPago.monto(cuerpo);
        if (m <= 0) m = AvisoPago.monto(String.valueOf(remitente) + " " + cuerpo);
        return m;
    }
    /** Este SMS ya lo tomó un lado (el receptor directo o el aviso de la app de mensajes): el otro lado lo salta UNA vez.
     *  Cada SMS deja su marca: dos pagos iguales (dos «Recibiste 1,000.») dejan dos y los dos suenan una vez cada uno. */
    static synchronized void anotar(SharedPreferences sp, String lista, String remitente, String cuerpo) {
        try {
            JSONArray l = vigentes(sp, lista);
            // La app de mensajes vuelve a publicar la misma conversación: ese mismo texto no deja otra marca.
            if (PREF_AVISO.equals(lista)) for (int i = 0; i < l.length(); i++) if (clave(cuerpo).equals(l.getJSONObject(i).optString("h"))) return;
            l.put(new JSONObject().put("h", clave(cuerpo)).put("m", montoDe(remitente, cuerpo)).put("t", System.currentTimeMillis()));
            while (l.length() > 40) l.remove(0);
            sp.edit().putString(lista, l.toString()).apply();
        } catch (Exception ignorado) { }
    }
    /** ¿El otro lado ya tomó este mismo SMS? Si sí, gasta su marca y devuelve true. El mismo texto, o (el aviso de la app de
     *  mensajes a veces lo trae cortado o con otro encabezado) el mismo valor en los últimos 3 minutos. */
    static synchronized boolean tomar(SharedPreferences sp, String lista, String remitente, String cuerpo) {
        try {
            JSONArray l = vigentes(sp, lista);
            String h = clave(cuerpo);
            long m = montoDe(remitente, cuerpo), ahora = System.currentTimeMillis();
            int k = -1;
            for (int i = 0; i < l.length() && k < 0; i++) if (h.equals(l.getJSONObject(i).optString("h"))) k = i;
            for (int i = 0; i < l.length() && k < 0 && m > 0; i++) { JSONObject o = l.getJSONObject(i); if (o.optLong("m") == m && ahora - o.optLong("t") <= 3 * 60_000L) k = i; }
            if (k < 0) return false;
            l.remove(k); sp.edit().putString(lista, l.toString()).apply();
            return true;
        } catch (Exception ignorado) { return false; }
    }
    /** El aviso de la app de mensajes: ¿ya lo tomó el receptor directo? Si no, queda anotado para que el receptor no lo
     *  repita si llega después. */
    static boolean yaTomado(SharedPreferences sp, String remitente, String cuerpo) {
        if (tomar(sp, PREF_TOMADOS, remitente, cuerpo)) return true;
        if (AvisoPago.remitenteBanco(remitente) && !"celular".equals(AvisoPago.tipoRemitente(remitente))) anotar(sp, PREF_AVISO, remitente, cuerpo);
        return false;
    }
    static boolean yaTomado(SharedPreferences sp, String cuerpo) { return yaTomado(sp, "", cuerpo); }

    private static JSONArray vigentes(SharedPreferences sp) { return vigentes(sp, PREF_TOMADOS); }
    private static JSONArray vigentes(SharedPreferences sp, String lista) {
        JSONArray out = new JSONArray();
        try {
            JSONArray l = new JSONArray(sp.getString(lista, "[]"));
            long ahora = System.currentTimeMillis();
            for (int i = 0; i < l.length(); i++) { JSONObject o = l.getJSONObject(i); if (ahora - o.optLong("t") < JUNTAR_MS) out.put(o); }
        } catch (Exception ignorado) { }
        return out;
    }
}
