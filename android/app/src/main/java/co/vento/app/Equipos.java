package co.vento.app;

import android.Manifest;
import android.app.PendingIntent;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.UUID;

/**
 * 🔌 Equipos del punto de venta: balanza, impresora de facturas (térmica ESC/POS) y cajón de dinero.
 * La página arma lo que se imprime (ESC/POS) y lee el peso; aquí solo se conecta y se pasan los bytes:
 *  • Bluetooth (SPP): las impresoras de 58/80 mm y las balanzas con Bluetooth.
 *  • USB: impresoras USB (clase impresora) y balanzas o cajones por cable serial/USB (convertidores CH340, PL2303,
 *    CP210x, FTDI y los que se anuncian como CDC/ACM).
 *  • Red (wifi o cable): impresoras con IP, puerto 9100.
 * El cajón casi siempre va conectado a la impresora (cable RJ11): se abre con el comando ESC p que manda la página.
 * window.VentoEquipos en la página. Las respuestas llegan a window.__ventoEquipos(tipo, datos).
 */
final class Equipos {
    static final int RC_BT = 7301;
    private static final String ACCION_USB = "co.vento.app.USB_PERMISO";
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final Context ctx;
    private Con balanza;
    private Thread lector;
    private volatile boolean leyendo;

    Equipos(Context c) { ctx = c.getApplicationContext(); }

    private static void js(String tipo, JSONObject d) { VentoApp.js("try{window.__ventoEquipos&&window.__ventoEquipos(" + VentoApp.q(tipo) + "," + d + ")}catch(e){}"); }
    private static JSONObject o(Object... kv) {
        JSONObject j = new JSONObject();
        try { for (int i = 0; i + 1 < kv.length; i += 2) j.put(String.valueOf(kv[i]), kv[i + 1]); } catch (Exception ignorado) { }
        return j;
    }
    private boolean btPermiso() { return Build.VERSION.SDK_INT < 31 || VentoApp.tiene(Manifest.permission.BLUETOOTH_CONNECT); }

    // ---------------------------------------------------------------- Qué hay conectado
    @JavascriptInterface
    public String lista() {
        JSONObject r = new JSONObject();
        try {
            JSONArray bt = new JSONArray();
            r.put("btPermiso", btPermiso());
            BluetoothAdapter a = BluetoothAdapter.getDefaultAdapter();
            r.put("bt", a != null);
            r.put("btPrendido", a != null && btPermiso() && a.isEnabled());
            if (a != null && btPermiso()) for (BluetoothDevice d : a.getBondedDevices()) bt.put(o("nombre", d.getName() == null ? d.getAddress() : d.getName(), "mac", d.getAddress()));
            r.put("emparejados", bt);
            JSONArray usb = new JSONArray();
            UsbManager m = (UsbManager) ctx.getSystemService(Context.USB_SERVICE);
            if (m != null) for (UsbDevice d : m.getDeviceList().values()) {
                String nombre = Build.VERSION.SDK_INT >= 21 && d.getProductName() != null ? d.getProductName() : ("USB " + Integer.toHexString(d.getVendorId()) + ":" + Integer.toHexString(d.getProductId()));
                usb.put(o("nombre", nombre, "id", d.getDeviceName(), "vid", d.getVendorId(), "pid", d.getProductId(), "tipo", UsbSerial.esImpresora(d) ? "impresora" : UsbSerial.chip(d), "permiso", m.hasPermission(d)));
            }
            r.put("usb", usb);
        } catch (Exception e) { try { r.put("error", String.valueOf(e.getMessage())); } catch (Exception ignorado) { } }
        return r.toString();
    }

    /** Android 12 o más nuevo: permiso «Dispositivos cercanos» para usar la impresora o la balanza Bluetooth. */
    @JavascriptInterface
    public void pedirBluetooth() {
        VentoApp.ui.post(() -> {
            if (btPermiso()) { js("bt", o("ok", true)); return; }
            if (VentoApp.ventana != null && Build.VERSION.SDK_INT >= 31) VentoApp.ventana.requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, RC_BT);
            else js("bt", o("ok", false));
        });
    }
    static void permisoBluetooth(boolean ok) { js("bt", o("ok", ok)); }

    /** Permiso de Android para usar ese aparato USB (sale una vez: «¿Permitir que Vento acceda a…?»). */
    @JavascriptInterface
    public void pedirUsb(final String id) {
        VentoApp.ui.post(() -> {
            UsbManager m = (UsbManager) ctx.getSystemService(Context.USB_SERVICE);
            UsbDevice d = m == null ? null : m.getDeviceList().get(id);
            if (d == null) { js("usb", o("id", id, "ok", false, "error", "No está conectado")); return; }
            if (m.hasPermission(d)) { js("usb", o("id", id, "ok", true)); return; }
            BroadcastReceiver r = new BroadcastReceiver() {
                @Override public void onReceive(Context c, Intent i) {
                    try { ctx.unregisterReceiver(this); } catch (Exception ignorado) { }
                    js("usb", o("id", id, "ok", i.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)));
                }
            };
            IntentFilter f = new IntentFilter(ACCION_USB);
            if (Build.VERSION.SDK_INT >= 33) ctx.registerReceiver(r, f, Context.RECEIVER_NOT_EXPORTED); else ctx.registerReceiver(r, f);
            Intent i = new Intent(ACCION_USB).setPackage(ctx.getPackageName());
            int fl = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
            m.requestPermission(d, PendingIntent.getBroadcast(ctx, 0, i, fl));
        });
    }

    // ---------------------------------------------------------------- Imprimir (y abrir el cajón)
    /** cfg: {via:'bt'|'usb'|'red', mac, id, host, puerto, baud}. Al terminar: __ventoEquipos('impreso', {cb, ok, error}). */
    @JavascriptInterface
    public void imprimir(final String cfg, final String b64, final String cb) {
        new Thread(() -> {
            Con c = null;
            try {
                byte[] datos = Base64.decode(b64, Base64.DEFAULT);
                c = abrir(new JSONObject(cfg));
                for (int i = 0; i < datos.length; i += 2048) {
                    int n = Math.min(2048, datos.length - i);
                    byte[] parte = new byte[n]; System.arraycopy(datos, i, parte, 0, n);
                    c.escribir(parte);
                }
                try { Thread.sleep(300); } catch (InterruptedException ignorado) { }   // que alcance a salir antes de cerrar
                js("impreso", o("cb", cb, "ok", true));
            } catch (Exception e) {
                js("impreso", o("cb", cb, "ok", false, "error", String.valueOf(e.getMessage())));
            } finally { if (c != null) c.cerrar(); }
        }).start();
    }

    // ---------------------------------------------------------------- Balanza (queda abierta leyendo el peso)
    /** cfg: {via, mac, id, baud}. Lo que manda la balanza llega a __ventoEquipos('balanza', {t}) (texto). */
    @JavascriptInterface
    public void balanzaAbrir(final String cfg) {
        balanzaCerrar();
        leyendo = true;
        lector = new Thread(() -> {
            byte[] buf = new byte[512];
            try {
                balanza = abrir(new JSONObject(cfg));
                js("balanzaEstado", o("ok", true));
                while (leyendo) {
                    int n = balanza.leer(buf, 400);
                    if (n > 0) js("balanza", o("t", new String(buf, 0, n, "ISO-8859-1")));
                }
            } catch (Exception e) {
                if (leyendo) js("balanzaEstado", o("ok", false, "error", String.valueOf(e.getMessage())));
            } finally { if (balanza != null) balanza.cerrar(); balanza = null; }
        });
        lector.start();
    }
    /** Pedirle el peso (algunas balanzas solo lo mandan cuando se les pide: ENQ, «P», «W»…). */
    @JavascriptInterface
    public void balanzaEnviar(final String b64) {
        final Con c = balanza; if (c == null) return;
        new Thread(() -> { try { c.escribir(Base64.decode(b64, Base64.DEFAULT)); } catch (Exception ignorado) { } }).start();
    }
    @JavascriptInterface
    public void balanzaCerrar() {
        leyendo = false;
        Con c = balanza; balanza = null;
        if (c != null) c.cerrar();
        if (lector != null) lector.interrupt();
        lector = null;
    }

    // ---------------------------------------------------------------- Conexiones
    interface Con {
        void escribir(byte[] b) throws IOException;
        /** Lee lo que haya (espera hasta ms). 0 = nada todavía. */
        int leer(byte[] buf, int ms) throws IOException;
        void cerrar();
    }

    private Con abrir(JSONObject cfg) throws Exception {
        String via = cfg.optString("via");
        if ("bt".equals(via)) return new ConBt(cfg.optString("mac"));
        if ("red".equals(via)) return new ConRed(cfg.optString("host"), cfg.optInt("puerto", 9100));
        if ("usb".equals(via)) {
            UsbManager m = (UsbManager) ctx.getSystemService(Context.USB_SERVICE);
            UsbDevice d = m == null ? null : m.getDeviceList().get(cfg.optString("id"));
            if (d == null && m != null) for (UsbDevice x : m.getDeviceList().values())     // el nombre cambia al desconectar y volver a conectar
                if (x.getVendorId() == cfg.optInt("vid", -1) && x.getProductId() == cfg.optInt("pid", -1)) d = x;
            if (d == null) throw new IOException("El aparato USB no está conectado");
            if (!m.hasPermission(d)) throw new IOException("Falta el permiso USB: toca «Conectar» otra vez y luego «Permitir»");
            UsbDeviceConnection con = m.openDevice(d);
            if (con == null) throw new IOException("Android no dejó abrir el aparato USB");
            if (UsbSerial.esImpresora(d) && !cfg.optBoolean("serial", false)) return new ConUsbImpresora(d, con);
            return new UsbSerial(d, con, cfg.optInt("baud", 9600));
        }
        throw new IOException("Elige cómo está conectado (Bluetooth, USB o red)");
    }

    final class ConBt implements Con {
        private final BluetoothSocket s; private final InputStream in; private final OutputStream out;
        ConBt(String mac) throws IOException {
            if (!btPermiso()) throw new IOException("Falta el permiso «Dispositivos cercanos» (Bluetooth)");
            BluetoothAdapter a = BluetoothAdapter.getDefaultAdapter();
            if (a == null) throw new IOException("Este equipo no tiene Bluetooth");
            if (!a.isEnabled()) throw new IOException("Prende el Bluetooth");
            BluetoothDevice d = a.getRemoteDevice(mac);
            try { a.cancelDiscovery(); } catch (Exception ignorado) { }
            BluetoothSocket x = null; IOException ultimo = null;
            // Seguro, sin seguridad y por el canal 1: así conectan casi todas las impresoras chinas de 58 mm.
            for (int i = 0; i < 3 && x == null; i++) {
                BluetoothSocket y = null;
                try {
                    if (i == 0) y = d.createRfcommSocketToServiceRecord(SPP);
                    else if (i == 1) y = d.createInsecureRfcommSocketToServiceRecord(SPP);
                    else y = (BluetoothSocket) d.getClass().getMethod("createRfcommSocket", int.class).invoke(d, 1);
                    y.connect(); x = y;
                } catch (Exception e) {
                    ultimo = e instanceof IOException ? (IOException) e : new IOException(String.valueOf(e.getMessage()));
                    try { if (y != null) y.close(); } catch (Exception ignorado) { }
                }
            }
            if (x == null) throw ultimo != null ? ultimo : new IOException("No conectó por Bluetooth");
            s = x; in = s.getInputStream(); out = s.getOutputStream();
        }
        public void escribir(byte[] b) throws IOException { out.write(b); out.flush(); }
        public int leer(byte[] buf, int ms) throws IOException {
            long fin = System.currentTimeMillis() + ms;
            while (System.currentTimeMillis() < fin) {
                if (in.available() > 0) return in.read(buf, 0, Math.min(buf.length, in.available()));
                try { Thread.sleep(30); } catch (InterruptedException e) { return 0; }
            }
            return 0;
        }
        public void cerrar() { try { s.close(); } catch (Exception ignorado) { } }
    }

    static final class ConRed implements Con {
        private final Socket s;
        ConRed(String host, int puerto) throws IOException {
            if (host == null || host.isEmpty()) throw new IOException("Escribe la IP de la impresora");
            s = new Socket(); s.connect(new InetSocketAddress(host, puerto), 5000); s.setSoTimeout(400);
        }
        public void escribir(byte[] b) throws IOException { s.getOutputStream().write(b); s.getOutputStream().flush(); }
        public int leer(byte[] buf, int ms) throws IOException {
            try { s.setSoTimeout(Math.max(1, ms)); int n = s.getInputStream().read(buf); return Math.max(0, n); }
            catch (java.net.SocketTimeoutException e) { return 0; }
        }
        public void cerrar() { try { s.close(); } catch (Exception ignorado) { } }
    }

    /** Impresora USB (clase impresora o con una salida «bulk»): los bytes van directo, sin controlador. */
    static final class ConUsbImpresora implements Con {
        private final UsbDeviceConnection con; private final UsbInterface itf; private final UsbEndpoint sale, entra;
        ConUsbImpresora(UsbDevice d, UsbDeviceConnection c) throws IOException {
            con = c; UsbInterface elegida = null; UsbEndpoint s = null, e = null;
            for (int i = 0; i < d.getInterfaceCount() && s == null; i++) {
                UsbInterface f = d.getInterface(i);
                for (int k = 0; k < f.getEndpointCount(); k++) {
                    UsbEndpoint p = f.getEndpoint(k);
                    if (p.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
                    if (p.getDirection() == UsbConstants.USB_DIR_OUT) { s = p; elegida = f; } else e = p;
                }
            }
            if (s == null) { c.close(); throw new IOException("La impresora USB no tiene salida de datos"); }
            itf = elegida; sale = s; entra = e;
            if (!con.claimInterface(itf, true)) { c.close(); throw new IOException("Android no dejó usar la impresora USB"); }
        }
        public void escribir(byte[] b) throws IOException { if (con.bulkTransfer(sale, b, b.length, 5000) < 0) throw new IOException("La impresora USB no recibió los datos"); }
        public int leer(byte[] buf, int ms) { if (entra == null) return 0; int n = con.bulkTransfer(entra, buf, buf.length, ms); return Math.max(0, n); }
        public void cerrar() { try { con.releaseInterface(itf); } catch (Exception ignorado) { } try { con.close(); } catch (Exception ignorado) { } }
    }
}
