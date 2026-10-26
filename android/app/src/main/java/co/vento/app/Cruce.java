package co.vento.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * 💜 Los pagos entre los equipos del negocio, desde Android (no desde la página).
 * Con el celular bloqueado Android duerme la página de Vento: antes un pago que leía un celular les llegaba tarde (o
 * nunca) a los demás, y el aviso de este celular al servidor salía solo cuando la página despertaba.
 *  • reenviar(): cada aviso de banco que lee este celular sale de una al Servidor Vento (con el mismo ID que usa la página:
 *    el servidor lo cuenta una sola vez aunque llegue por los dos lados).
 *  • revisar(): cada 2,5 s, desde el servicio de fondo, pregunta por los pagos nuevos del negocio (pagos_dispositivo) y los
 *    anuncia aquí: notificación de pagos, 🪟 ventana y voz. Solo el dueño y los administradores; nunca el pago que leyó
 *    este mismo celular (ya sonó). Cada pago suena UNA vez: Android y la página lo «reclaman» antes de avisar.
 * La página le da la dirección, la llave pública y el token del celular (pagosCruce) al entrar al negocio.
 */
final class Cruce {
    static final String PREF_CFG = "cruceCfg", PREF_DESDE = "cruceDesde", PREF_VISTOS = "cruceVistos", PREF_ESTADO = "cruceEstado";
    /** Cada cuánto pregunta el servicio de fondo (VentoServicio). */
    static final long CADA_MS = 2500;
    private static volatile boolean ocupado, otraVez;
    /** 1.65.3: canal en vivo del negocio («vp-…», lo da el servidor): VentoServicio deja abierta la conexión (EnVivo). */
    static volatile String vivo;

    private static SharedPreferences sp(Context c) { return c.getSharedPreferences("vento", Context.MODE_PRIVATE); }
    static JSONObject cfg(Context c) { try { return new JSONObject(sp(c).getString(PREF_CFG, "{}")); } catch (Exception e) { return new JSONObject(); } }
    static void configurar(Context c, String json) {
        if (json == null || json.isEmpty()) { sp(c).edit().remove(PREF_CFG).apply(); return; }
        try {
            JSONObject n = new JSONObject(json), v = cfg(c);
            // Otro negocio u otro celular: se empieza de cero (no se anuncian los pagos viejos del otro negocio).
            if (!n.optString("token").equals(v.optString("token"))) sp(c).edit().remove(PREF_DESDE).apply();
            sp(c).edit().putString(PREF_CFG, n.toString()).apply();
        } catch (Exception ignorado) { }
    }

    /** ¿Ya se avisó este pago aquí? Si no, queda reclamado (lo avisa quien lo reclama primero: Android o la página). */
    static synchronized boolean reclamar(Context c, String id) {
        if (id == null || id.isEmpty()) return false;
        try {
            JSONArray l = new JSONArray(sp(c).getString(PREF_VISTOS, "[]"));
            for (int i = 0; i < l.length(); i++) if (id.equals(l.optString(i))) return false;
            l.put(id);
            while (l.length() > 300) l.remove(0);
            sp(c).edit().putString(PREF_VISTOS, l.toString()).apply();
            return true;
        } catch (Exception e) { return true; }
    }

    private static String http(String url, String key, String cuerpo) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
        try {
            h.setConnectTimeout(8000); h.setReadTimeout(10000);
            h.setRequestMethod("POST"); h.setDoOutput(true);
            h.setRequestProperty("Content-Type", key == null ? "text/plain" : "application/json");
            if (key != null) { h.setRequestProperty("apikey", key); h.setRequestProperty("Authorization", "Bearer " + key); }
            try (OutputStream o = h.getOutputStream()) { o.write(cuerpo.getBytes(StandardCharsets.UTF_8)); }
            int st = h.getResponseCode();
            InputStream in = st >= 400 ? h.getErrorStream() : h.getInputStream();
            StringBuilder b = new StringBuilder();
            if (in != null) { byte[] buf = new byte[4096]; int n; while ((n = in.read(buf)) > 0) b.append(new String(buf, 0, n, StandardCharsets.UTF_8)); in.close(); }
            if (st >= 500) throw new java.io.IOException("servidor " + st);
            return b.toString();
            // 1.65.3: sin disconnect() cuando salió bien: Android reutiliza la conexión segura ya abierta (keep-alive) y el
            // siguiente aviso o pregunta sale sin volver a negociar el cifrado (unos 200-400 ms menos con datos móviles).
        } catch (Exception e) {
            h.disconnect();
            throw e;
        }
    }

    // ---------------------------------------------------------------- Este celular → servidor
    /** id: el de la cola («k…»); la página lo manda como «and-k…». nivel: «revisar» si la app no es la oficial. */
    static void reenviar(final Context c, final String id, final String txt, final String revisar, final boolean smsOk) {
        if (c == null) return;
        final JSONObject k = cfg(c);
        if (k.optString("url").isEmpty() || k.optString("token").length() < 20) return;
        final long monto = AvisoPago.monto(txt);
        if (monto <= 0) return;                                          // sin valor: la página decide (frases del administrador)
        new Thread(() -> {
            try {
                JSONObject pista = new JSONObject().put("monto", monto).put("app", txt.split("\\|")[0].trim());
                if (revisar != null) pista.put("nivel", "revisar"); else if (smsOk) pista.put("nivel", "app");
                JSONObject j = new JSONObject().put("text", txt.length() > 1000 ? txt.substring(0, 1000) : txt).put("id", "and-" + id).put("pista", pista);
                for (int i = 0; i < 3; i++) {
                    try { http(k.optString("url").replaceAll("/+$", "") + "/functions/v1/vento-pagos/aviso/" + k.optString("token"), null, j.toString()); return; }
                    catch (Exception e) { try { Thread.sleep(3000L * (i + 1)); } catch (InterruptedException x) { return; } }
                }
            } catch (Exception ignorado) { }
        }).start();
    }

    // ---------------------------------------------------------------- Otros equipos → este celular
    static void revisar(final Context c) {
        if (c == null) return;
        // Si ya hay una pregunta en camino, se hace otra apenas termine: el aviso en vivo puede llegar justo después de que
        // esa pregunta salió (y el pago nuevo no venía en ella).
        if (ocupado) { otraVez = true; return; }
        final JSONObject k = cfg(c);
        if (k.optString("url").isEmpty() || k.optString("key").isEmpty() || k.optString("token").length() < 20) return;
        ocupado = true;
        new Thread(() -> {
            try {
                String desde = sp(c).getString(PREF_DESDE, "");
                JSONObject body = new JSONObject().put("p_token", k.optString("token")).put("p_desde", desde.isEmpty() ? JSONObject.NULL : desde);
                JSONObject r = new JSONObject(http(k.optString("url").replaceAll("/+$", "") + "/rest/v1/rpc/pagos_dispositivo", k.optString("key"), body.toString()));
                sp(c).edit().putString(PREF_ESTADO, new JSONObject().put("t", System.currentTimeMillis()).put("ok", r.optBoolean("ok")).put("error", r.optString("error")).toString()).apply();
                if (!r.optBoolean("ok")) {
                    // El celular fue retirado (o el token cambió): la página lo vuelve a autorizar y le pasa el token nuevo.
                    VentoApp.js("try{window.ventoPagosCruceMal&&window.ventoPagosCruceMal(" + VentoApp.q(r.optString("error")) + ")}catch(e){}");
                    return;
                }
                // 1.65.2: si ESTE celular suena lo dice el servidor (lo elige el dueño), no la página: con el celular
                // bloqueado la página duerme y su dato podía quedar viejo, y los pagos solo sonaban al desbloquear.
                if (r.has("suena")) sp(c).edit().putBoolean("pagosSuena", r.optBoolean("suena", true)).apply();
                if (r.optString("vivo").startsWith("vp-")) vivo = r.optString("vivo");
                JSONArray l = r.optJSONArray("pagos");
                boolean primera = desde.isEmpty(), jefe = "dueno".equals(r.optString("rol")) || "admin".equals(r.optString("rol"));
                String yo = r.optString("dispositivo"), max = desde, ahora = r.optString("ahora");
                int nuevos = 0;
                for (int i = 0; l != null && i < l.length(); i++) {
                    JSONObject p = l.getJSONObject(i);
                    String act = p.optString("actualizado_en");
                    if (max.isEmpty() || act.compareTo(max) > 0) max = act;
                    // La primera vez solo se toma la hora (no se anuncian los pagos de antes de prender esto).
                    if (primera || !jefe || yo.equals(p.optString("de_dispositivo"))) { reclamar(c, p.optString("id")); continue; }
                    if (Math.abs(segundos(ahora) - segundos(p.optString("aprobado_en", act))) > 15 * 60) { reclamar(c, p.optString("id")); continue; }
                    if (!reclamar(c, p.optString("id"))) continue;
                    anunciar(p); nuevos++;
                }
                if (!max.isEmpty()) sp(c).edit().putString(PREF_DESDE, max).apply();
                else if (primera && !ahora.isEmpty()) sp(c).edit().putString(PREF_DESDE, ahora).apply();
                if (nuevos > 0) VentoApp.js("try{window.ventoPagos&&window.ventoPagos.sincronizar()}catch(e){}");
            } catch (Exception e) {
                try { sp(c).edit().putString(PREF_ESTADO, new JSONObject().put("t", System.currentTimeMillis()).put("ok", false).put("error", String.valueOf(e.getMessage())).toString()).apply(); } catch (Exception ignorado) { }
            } finally {
                ocupado = false;
                if (otraVez) { otraVez = false; revisar(c); }
            }
        }).start();
    }
    private static long segundos(String iso) {
        try { return java.time.OffsetDateTime.parse(iso.replace(' ', 'T').replaceAll("\\+00$", "+00:00")).toEpochSecond(); }
        catch (Throwable e) { return System.currentTimeMillis() / 1000; }
    }

    private static final java.util.Map<String, String> METODO = new java.util.HashMap<>();
    static {
        METODO.put("NEQUI", "Nequi"); METODO.put("DAVIPLATA", "DaviPlata"); METODO.put("BANCOLOMBIA", "Bancolombia"); METODO.put("BRE-B", "Bre-B");
        METODO.put("TRANSFERENCIA", "transferencia"); METODO.put("CARD", "tarjeta"); METODO.put("PSE", "PSE"); METODO.put("MOVII", "Movii"); METODO.put("DALE", "Dale");
    }
    static String metodo(String m) { String x = METODO.get(String.valueOf(m).toUpperCase()); return x != null ? x : (m == null || m.isEmpty() ? "transferencia" : m.charAt(0) + m.substring(1).toLowerCase()); }

    /** Notificación de pagos + 🪟 ventana + voz, como un pago leído en este celular. */
    static void anunciar(JSONObject p) {
        long monto = p.optLong("monto");
        String banco = metodo(p.optString("metodo")), de = p.optString("pagador", ""), conf = p.optString("confianza"), detalle = p.optString("detalle", "");
        if ("null".equals(de)) de = "";
        if ("null".equals(detalle)) detalle = "";
        String plata = AvisoPago.plata(monto);
        if ("falso".equals(conf)) {
            String f = "Ojo. Llegó un mensaje de pago sospechoso por " + monto + " pesos. Parece falso. No entregues nada.";
            VentoApp.decirPago(f);
            VentoApp.notificarPago("🚨 Mensaje de pago FALSO: " + plata, f, detalle, plata, banco, "falso");
        } else if ("revisar".equals(conf)) {
            String f = "Llegó un aviso de " + monto + " pesos por " + banco + ". Revísalo en la aplicación del banco antes de entregar.";
            VentoApp.decirPago(f);
            VentoApp.notificarPago("⚠️ Aviso de " + plata + ": revísalo", f, detalle, plata, banco, "revisar");
        } else {
            VentoApp.decirPago("Llegaron " + monto + " pesos por " + banco + ".");   // la cantidad siempre; sin el nombre
            VentoApp.notificarPago("💜 Recibiste " + plata + " por " + banco, "Recibiste " + monto + " pesos por " + banco + (de.isEmpty() ? "" : ", de " + de) + ".", detalle, plata, banco, "ok");
        }
    }
}
