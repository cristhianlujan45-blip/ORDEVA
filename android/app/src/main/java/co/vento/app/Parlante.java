package co.vento.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Parlante de avisos: un parlante por Bluetooth o por cable (también USB o la salida de línea) donde suenan SOLO los
 * avisos que el dueño elija (pagos, pedidos, piden la cuenta, domicilios…), no la música. La voz de cada aviso se graba
 * (como la de los pagos) y se toca directo en ESE parlante con AudioTrack.setPreferredDevice; la música del celular no
 * se baja ni se mueve. Si el parlante no está conectado, el aviso suena como siempre en el celular.
 */
final class Parlante {
    private Parlante() { }
    static final String PREF_ID = "parlanteId", PREF_NOMBRE = "parlanteNombre", PREF_TIPO = "parlanteTipo", PREF_TIPOS = "parlanteTipos";

    private static SharedPreferences sp(Context c) { return c.getSharedPreferences("vento", Context.MODE_PRIVATE); }

    /** ¿Ese aviso («pagos», «pedidos», «cuenta», «domicilios»…) va al parlante? (y hay uno elegido) */
    static boolean usa(Context c, String tipo) {
        try {
            SharedPreferences p = sp(c);
            if (p.getString(PREF_NOMBRE, "").isEmpty()) return false;
            return ("," + p.getString(PREF_TIPOS, "pagos,pedidos,cuenta,domicilios") + ",").contains("," + tipo + ",");
        } catch (Exception e) { return false; }
    }

    static boolean salidaUtil(AudioDeviceInfo d) {
        if (d == null || !d.isSink()) return false;
        int t = d.getType();
        return t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == AudioDeviceInfo.TYPE_WIRED_HEADSET || t == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                || t == AudioDeviceInfo.TYPE_LINE_ANALOG || t == AudioDeviceInfo.TYPE_LINE_DIGITAL || t == AudioDeviceInfo.TYPE_AUX_LINE
                || t == AudioDeviceInfo.TYPE_USB_DEVICE || t == AudioDeviceInfo.TYPE_USB_HEADSET || t == AudioDeviceInfo.TYPE_USB_ACCESSORY
                || t == AudioDeviceInfo.TYPE_HDMI || t == AudioDeviceInfo.TYPE_DOCK || t == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                || (Build.VERSION.SDK_INT >= 31 && (t == AudioDeviceInfo.TYPE_BLE_SPEAKER || t == AudioDeviceInfo.TYPE_BLE_HEADSET));
    }

    static String clase(int t) {
        if (t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || (Build.VERSION.SDK_INT >= 31 && (t == AudioDeviceInfo.TYPE_BLE_SPEAKER || t == AudioDeviceInfo.TYPE_BLE_HEADSET))) return "bluetooth";
        if (t == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) return "celular";
        if (t == AudioDeviceInfo.TYPE_USB_DEVICE || t == AudioDeviceInfo.TYPE_USB_HEADSET || t == AudioDeviceInfo.TYPE_USB_ACCESSORY) return "usb";
        if (t == AudioDeviceInfo.TYPE_HDMI) return "hdmi";
        return "cable";
    }

    static String nombre(AudioDeviceInfo d) {
        String n = d.getProductName() == null ? "" : d.getProductName().toString().trim();
        String c = clase(d.getType());
        if ("celular".equals(c)) return "Parlante del celular";
        if (n.isEmpty() || n.equalsIgnoreCase(Build.MODEL)) n = "bluetooth".equals(c) ? "Parlante Bluetooth" : "usb".equals(c) ? "Parlante USB" : "Parlante por cable";
        return n;
    }

    /** Las salidas de sonido conectadas ahora: [{id, nombre, clase}] */
    static String lista(Context c) {
        JSONArray l = new JSONArray();
        try {
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            java.util.HashSet<String> vistos = new java.util.HashSet<>();
            for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                if (!salidaUtil(d)) continue;
                String k = d.getType() + "|" + nombre(d);
                if (!vistos.add(k)) continue;
                l.put(new JSONObject().put("id", d.getId()).put("nombre", nombre(d)).put("clase", clase(d.getType())).put("tipo", d.getType()));
            }
        } catch (Exception ignorado) { }
        return l.toString();
    }

    /** El parlante elegido, si está conectado ahora (los Bluetooth cambian de número al reconectarse: se busca por nombre). */
    static AudioDeviceInfo elegido(Context c) {
        try {
            SharedPreferences p = sp(c);
            String nom = p.getString(PREF_NOMBRE, "");
            if (nom.isEmpty()) return null;
            int id = p.getInt(PREF_ID, -1), tipo = p.getInt(PREF_TIPO, -1);
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            AudioDeviceInfo porNombre = null;
            for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                if (!salidaUtil(d)) continue;
                if (d.getId() == id) return d;
                if (porNombre == null && d.getType() == tipo && nom.equals(nombre(d))) porNombre = d;
            }
            return porNombre;
        } catch (Exception e) { return null; }
    }

    static void elegir(Context c, int id) {
        SharedPreferences.Editor e = sp(c).edit();
        if (id <= 0) { e.remove(PREF_ID).remove(PREF_NOMBRE).remove(PREF_TIPO).apply(); return; }
        try {
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS))
                if (d.getId() == id && salidaUtil(d)) { e.putInt(PREF_ID, id).putString(PREF_NOMBRE, nombre(d)).putInt(PREF_TIPO, d.getType()).apply(); return; }
        } catch (Exception ignorado) { }
    }

    static String estado(Context c) {
        try {
            SharedPreferences p = sp(c);
            AudioDeviceInfo d = elegido(c);
            return new JSONObject().put("nombre", p.getString(PREF_NOMBRE, "")).put("conectado", d != null)
                    .put("tipos", p.getString(PREF_TIPOS, "pagos,pedidos,cuenta,domicilios")).put("clase", d != null ? clase(d.getType()) : "").toString();
        } catch (Exception e) { return "{}"; }
    }

    static void tipos(Context c, String csv) { sp(c).edit().putString(PREF_TIPOS, csv == null ? "" : csv.replaceAll("[^a-z,]", "")).apply(); }

    /**
     * Toca un WAV PCM de 16 bits (el de la voz pareja) en el parlante elegido. Devuelve false si no hay parlante conectado
     * o no se pudo (entonces se toca como siempre). «fin» se llama al terminar (una sola vez).
     */
    static boolean tocar(Context c, byte[] wav, Runnable fin) {
        AudioDeviceInfo d = elegido(c);
        if (d == null || wav == null || wav.length <= 44) return false;
        try {
            int canales = (wav[22] & 0xff), frec = (wav[24] & 0xff) | ((wav[25] & 0xff) << 8) | ((wav[26] & 0xff) << 16) | ((wav[27] & 0xff) << 24);
            int datos = wav.length - 44, cuadros = datos / (2 * Math.max(1, canales));
            AudioFormat f = new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(frec)
                    .setChannelMask(canales == 2 ? AudioFormat.CHANNEL_OUT_STEREO : AudioFormat.CHANNEL_OUT_MONO).build();
            AudioAttributes a = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
            int min = AudioTrack.getMinBufferSize(frec, canales == 2 ? AudioFormat.CHANNEL_OUT_STEREO : AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
            final AudioTrack t = new AudioTrack(a, f, Math.max(datos, Math.max(min, 4096)), AudioTrack.MODE_STATIC, AudioManager.AUDIO_SESSION_ID_GENERATE);
            t.write(wav, 44, datos);
            t.setPreferredDevice(d);
            final boolean[] listo = {false};
            final Handler h = new Handler(Looper.getMainLooper());
            final Runnable cerrar = () -> { if (listo[0]) return; listo[0] = true; try { t.stop(); } catch (Throwable ignorado) { } try { t.release(); } catch (Throwable ignorado) { } if (fin != null) fin.run(); };
            t.setNotificationMarkerPosition(Math.max(1, cuadros - 1));
            t.setPlaybackPositionUpdateListener(new AudioTrack.OnPlaybackPositionUpdateListener() {
                @Override public void onMarkerReached(AudioTrack x) { h.postDelayed(cerrar, 150); }
                @Override public void onPeriodicNotification(AudioTrack x) { }
            }, h);
            // Por si el aparato nunca avisa que terminó: se cierra solo al pasar lo que dura (más un poco).
            h.postDelayed(cerrar, (long) cuadros * 1000L / Math.max(8000, frec) + 2500);
            t.play();
            return true;
        } catch (Throwable e) { return false; }
    }
}
