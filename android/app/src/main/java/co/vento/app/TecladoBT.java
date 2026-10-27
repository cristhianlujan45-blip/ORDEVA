package co.vento.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothHidDevice;
import android.bluetooth.BluetoothHidDeviceAppSdpSettings;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 🔵 1.65.6 · El celular como LECTOR DE CÓDIGOS BLUETOOTH del computador, sin internet.
 * La app se presenta al computador como un teclado Bluetooth (perfil HID de Android 9 o más): cada código que lee la
 * cámara en lector.html se «escribe» en el computador seguido de Enter, igual que una pistola lectora. ORDEVA en el
 * computador ya entiende esas pistolas en la caja y en el inventario (lib/vento-pos.js, lib/vento-inventario.js), y
 * sirve también con cualquier otro programa (Excel, el sistema de facturación…).
 * Se empareja UNA vez: el computador → Bluetooth → «Agregar dispositivo» → el nombre de este celular. Después se vuelve
 * a conectar solo cada vez que se prende.
 * Solo números y letras (A-Z): son las mismas teclas en el teclado español y en el inglés del computador (los símbolos
 * cambian de lugar según el idioma del teclado y saldrían otros). Los códigos de barras de los productos son números.
 */
final class TecladoBT {
    private static TecladoBT uno;
    static synchronized TecladoBT de(Context c) { if (uno == null) uno = new TecladoBT(c.getApplicationContext()); return uno; }
    static boolean soportado() { return Build.VERSION.SDK_INT >= 28; }

    private static final String PREF_HOST = "btTecladoHost";
    // Teclado estándar (Report ID 1): modificadores, reservado y 6 teclas.
    private static final byte[] DESCRIPTOR = {
        0x05, 0x01, 0x09, 0x06, (byte) 0xA1, 0x01, (byte) 0x85, 0x01,
        0x05, 0x07, 0x19, (byte) 0xE0, 0x29, (byte) 0xE7, 0x15, 0x00, 0x25, 0x01, 0x75, 0x01, (byte) 0x95, 0x08, (byte) 0x81, 0x02,
        (byte) 0x95, 0x01, 0x75, 0x08, (byte) 0x81, 0x01,
        (byte) 0x95, 0x06, 0x75, 0x08, 0x15, 0x00, 0x25, 0x65, 0x05, 0x07, 0x19, 0x00, 0x29, 0x65, (byte) 0x81, 0x00,
        (byte) 0xC0
    };
    private final Context ctx;
    private final ExecutorService hilo = Executors.newSingleThreadExecutor();
    private BluetoothHidDevice hid;
    private volatile BluetoothDevice host;
    private volatile boolean registrado = false, prendido = false;
    private volatile String error = "";

    private TecladoBT(Context c) { ctx = c; }

    private BluetoothAdapter adaptador() {
        BluetoothManager bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        return bm == null ? null : bm.getAdapter();
    }
    static boolean permiso() { return Build.VERSION.SDK_INT < 31 || (VentoApp.tiene(Manifest.permission.BLUETOOTH_CONNECT) && VentoApp.tiene(Manifest.permission.BLUETOOTH_ADVERTISE)); }

    /** Estado para lector.html: { soportado, bluetooth, permiso, prendido, registrado, conectado, computador, error }. */
    String estado() {
        try {
            BluetoothAdapter ad = soportado() ? adaptador() : null;
            String nombre = "";
            try { if (host != null && permiso()) nombre = host.getName(); } catch (SecurityException ignorado) { }
            return new JSONObject().put("soportado", soportado()).put("bluetooth", ad != null && ad.isEnabled()).put("permiso", permiso())
                    .put("prendido", prendido).put("registrado", registrado).put("conectado", host != null).put("computador", nombre == null ? "" : nombre)
                    .put("error", error).toString();
        } catch (Exception e) { return "{}"; }
    }

    /** Prende el teclado: se registra como teclado Bluetooth y se vuelve a conectar con el último computador. */
    void prender() {
        if (!soportado()) { error = "Este celular tiene Android 8 o más viejo: no puede ser teclado Bluetooth."; return; }
        if (!permiso()) { error = "Falta el permiso «Dispositivos cercanos»."; return; }
        BluetoothAdapter ad = adaptador();
        if (ad == null) { error = "Este celular no tiene Bluetooth."; return; }
        if (!ad.isEnabled()) { error = "Prende el Bluetooth del celular."; return; }
        error = ""; prendido = true;
        if (hid != null) { registrar(); return; }
        try {
            ad.getProfileProxy(ctx, new BluetoothProfile.ServiceListener() {
                @Override public void onServiceConnected(int perfil, BluetoothProfile p) { hid = (BluetoothHidDevice) p; if (prendido) registrar(); }
                @Override public void onServiceDisconnected(int perfil) { hid = null; registrado = false; host = null; }
            }, BluetoothProfile.HID_DEVICE);
        } catch (SecurityException e) { error = "Falta el permiso «Dispositivos cercanos»."; prendido = false; }
    }

    private void registrar() {
        if (hid == null || registrado) return;
        BluetoothHidDeviceAppSdpSettings sdp = new BluetoothHidDeviceAppSdpSettings("ORDEVA Lector", "Lector de códigos de ORDEVA", "ORDEVA",
                BluetoothHidDevice.SUBCLASS1_KEYBOARD, DESCRIPTOR);
        try {
            hid.registerApp(sdp, null, null, Executors.newSingleThreadExecutor(), new BluetoothHidDevice.Callback() {
                @Override public void onAppStatusChanged(BluetoothDevice d, boolean reg) {
                    registrado = reg;
                    if (reg) reconectar();
                    else host = null;
                }
                @Override public void onConnectionStateChanged(BluetoothDevice d, int estado) {
                    if (estado == BluetoothProfile.STATE_CONNECTED) {
                        host = d;
                        try { ctx.getSharedPreferences("vento", Context.MODE_PRIVATE).edit().putString(PREF_HOST, d.getAddress()).apply(); } catch (Exception ignorado) { }
                    } else if (estado == BluetoothProfile.STATE_DISCONNECTED && d.equals(host)) host = null;
                }
            });
        } catch (SecurityException e) { error = "Falta el permiso «Dispositivos cercanos»."; }
    }

    /** El último computador con el que estuvo emparejado: se le pide conectar (sin volver a emparejar). */
    private void reconectar() {
        try {
            String dir = ctx.getSharedPreferences("vento", Context.MODE_PRIVATE).getString(PREF_HOST, "");
            BluetoothAdapter ad = adaptador();
            if (hid == null || ad == null || dir.isEmpty()) return;
            for (BluetoothDevice d : ad.getBondedDevices()) if (dir.equals(d.getAddress())) { hid.connect(d); return; }
        } catch (SecurityException ignorado) { }
    }

    /** Que el computador lo encuentre para emparejarlo (120 s). */
    void mostrarse() {
        try {
            Intent i = new Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE).putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 120);
            if (VentoApp.ventana != null) VentoApp.ventana.startActivity(i);
            else { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); ctx.startActivity(i); }
        } catch (Exception e) { error = "No se pudo hacer visible el celular: " + e.getMessage(); }
    }

    void apagar() {
        prendido = false;
        try { if (hid != null && registrado) hid.unregisterApp(); } catch (SecurityException ignorado) { }
        registrado = false; host = null;
    }

    /** Escribe el código en el computador y Enter. false si no hay computador conectado. */
    boolean escribir(final String texto) {
        final BluetoothDevice h = host;
        if (hid == null || h == null || texto == null) return false;
        hilo.execute(() -> {
            try {
                for (int i = 0; i < texto.length() && i < 120; i++) {
                    int[] k = tecla(texto.charAt(i));
                    if (k == null) continue;                         // símbolo: depende del idioma del teclado del computador
                    pulsar(h, k[0], k[1]);
                }
                pulsar(h, 0, 0x28);                                  // Enter
            } catch (Exception ignorado) { }
        });
        return true;
    }
    // Una tecla: presionar y soltar. 8 ms entre cada cosa: la caja de ORDEVA reconoce una pistola lectora si las teclas
    // llegan a menos de 100 ms una de otra (y el Enter a menos de 150 ms).
    private void pulsar(BluetoothDevice h, int mod, int cod) throws InterruptedException {
        try {
            hid.sendReport(h, 1, new byte[]{(byte) mod, 0, (byte) cod, 0, 0, 0, 0, 0});
            Thread.sleep(8);
            hid.sendReport(h, 1, new byte[8]);
            Thread.sleep(8);
        } catch (SecurityException ignorado) { }
    }
    /** {modificador, código HID} de un número o una letra; null para lo demás. */
    static int[] tecla(char c) {
        if (c >= 'a' && c <= 'z') return new int[]{0, 0x04 + (c - 'a')};
        if (c >= 'A' && c <= 'Z') return new int[]{0x02, 0x04 + (c - 'A')};      // Mayúscula: con Shift
        if (c >= '1' && c <= '9') return new int[]{0, 0x1E + (c - '1')};
        if (c == '0') return new int[]{0, 0x27};
        if (c == ' ') return new int[]{0, 0x2C};
        return null;
    }
}
