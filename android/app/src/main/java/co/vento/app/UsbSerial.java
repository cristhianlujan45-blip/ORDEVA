package co.vento.app;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;

import java.io.IOException;

/**
 * Puerto serial por USB para balanzas y cajones (y algunas impresoras): 8 bits, sin paridad, 1 bit de parada.
 * Los convertidores que más se ven en Colombia: CH340/CH341 (los más baratos), PL2303, CP210x (Silicon Labs), FTDI y los
 * que se anuncian como CDC/ACM (Arduino y varias balanzas nuevas). Cada chip se configura con sus propios mensajes de
 * control (los mismos que usa Linux); los datos van y vienen por las salidas «bulk».
 */
final class UsbSerial implements Equipos.Con {
    private final UsbDeviceConnection con;
    private final UsbInterface itfDatos, itfControl;
    private final UsbEndpoint entra, sale;
    private final String chip;
    private final int paquete;

    static boolean esImpresora(UsbDevice d) {
        for (int i = 0; i < d.getInterfaceCount(); i++) if (d.getInterface(i).getInterfaceClass() == UsbConstants.USB_CLASS_PRINTER) return true;
        return false;
    }
    static String chip(UsbDevice d) {
        switch (d.getVendorId()) {
            case 0x0403: return "ftdi";
            case 0x10C4: return "cp210x";
            case 0x1A86: return "ch34x";
            case 0x067B: return "pl2303";
            default:
                for (int i = 0; i < d.getInterfaceCount(); i++) {
                    int c = d.getInterface(i).getInterfaceClass();
                    if (c == UsbConstants.USB_CLASS_COMM || c == UsbConstants.USB_CLASS_CDC_DATA) return "cdc";
                }
                return "serial";
        }
    }
    /** Velocidad que se usa cuando la elegida no está en la tabla del chip. */
    static int velocidad(int baud) { return baud == 1200 || baud == 2400 || baud == 4800 || baud == 9600 || baud == 19200 || baud == 38400 || baud == 57600 || baud == 115200 ? baud : 9600; }

    UsbSerial(UsbDevice d, UsbDeviceConnection c, int baud) throws IOException {
        con = c; chip = chip(d); baud = velocidad(baud);
        UsbInterface datos = null, control = null; UsbEndpoint in = null, out = null;
        // La interfaz de datos: la que tiene una entrada y una salida «bulk» (en CDC es la de clase «datos»).
        for (int i = 0; i < d.getInterfaceCount() && (in == null || out == null); i++) {
            UsbInterface f = d.getInterface(i);
            if (f.getInterfaceClass() == UsbConstants.USB_CLASS_COMM) { control = f; continue; }
            UsbEndpoint ii = null, oo = null;
            for (int k = 0; k < f.getEndpointCount(); k++) {
                UsbEndpoint p = f.getEndpoint(k);
                if (p.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
                if (p.getDirection() == UsbConstants.USB_DIR_IN) ii = p; else oo = p;
            }
            if (ii != null && oo != null) { datos = f; in = ii; out = oo; }
        }
        if (datos == null) { c.close(); throw new IOException("Ese aparato USB no tiene un puerto serial"); }
        itfDatos = datos; itfControl = control; entra = in; sale = out; paquete = Math.max(8, in.getMaxPacketSize());
        if (control != null && !con.claimInterface(control, true)) { c.close(); throw new IOException("Android no dejó usar el puerto USB"); }
        if (!con.claimInterface(datos, true)) { c.close(); throw new IOException("Android no dejó usar el puerto USB"); }
        try {
            switch (chip) {
                case "ftdi": ftdi(baud); break;
                case "cp210x": cp210x(baud); break;
                case "ch34x": ch34x(baud); break;
                case "pl2303": pl2303(baud); break;
                default: cdc(baud, control != null ? control.getId() : datos.getId());
            }
        } catch (IOException e) { cerrar(); throw e; }
    }

    // ---------------------------------------------------------------- Mensajes de control de cada chip
    private int ctl(int tipo, int req, int valor, int indice, byte[] buf) { return con.controlTransfer(tipo, req, valor, indice, buf, buf == null ? 0 : buf.length, 3000); }
    private void ok(int r, String paso) throws IOException { if (r < 0) throw new IOException("El puerto USB no respondió (" + chip + ", " + paso + ")"); }
    private static byte[] linea(int baud) { return new byte[]{(byte) baud, (byte) (baud >> 8), (byte) (baud >> 16), (byte) (baud >> 24), 0, 0, 8}; }

    /** CDC/ACM (también la parte final del PL2303): velocidad y 8N1, y prende DTR/RTS. */
    private void cdc(int baud, int itf) throws IOException {
        ok(ctl(0x21, 0x20, 0, itf, linea(baud)), "velocidad");
        ctl(0x21, 0x22, 0x03, itf, null);
    }
    private void cp210x(int baud) throws IOException {
        int itf = itfDatos.getId();
        ok(ctl(0x41, 0x00, 0x0001, itf, null), "prender");                                   // IFC_ENABLE
        ok(ctl(0x41, 0x1E, 0, itf, new byte[]{(byte) baud, (byte) (baud >> 8), (byte) (baud >> 16), (byte) (baud >> 24)}), "velocidad");
        ctl(0x41, 0x03, 0x0800, itf, null);                                                   // 8 bits, sin paridad, 1 parada
        ctl(0x41, 0x07, 0x0303, itf, null);                                                   // DTR y RTS
    }
    private void ftdi(int baud) throws IOException {
        int puerto = itfDatos.getId() + 1;
        ok(ctl(0x40, 0, 0, puerto, null), "reiniciar");
        ctl(0x40, 1, 0x0303, puerto, null);                                                   // DTR y RTS
        ctl(0x40, 2, 0, puerto, null);                                                        // sin control de flujo
        int div;
        switch (baud) {                                                                      // divisor de 3 MHz (con fracción en los bits altos)
            case 1200: div = 0x09C4; break; case 2400: div = 0x04E2; break; case 4800: div = 0x0271; break;
            case 19200: div = 0x809C; break; case 38400: div = 0xC04E; break; case 57600: div = 0x0034; break;
            case 115200: div = 0x001A; break; default: div = 0x4138;                         // 9600
        }
        ok(ctl(0x40, 3, div, puerto, null), "velocidad");
        ctl(0x40, 4, 0x0008, puerto, null);                                                   // 8N1
    }
    private void ch34x(int baud) throws IOException {
        byte[] b = new byte[2];
        ctl(0xC0, 0x5F, 0, 0, b);
        ok(ctl(0x40, 0xA1, 0, 0, null), "iniciar");
        ch34xVelocidad(baud);
        ctl(0xC0, 0x95, 0x2518, 0, b);
        ctl(0x40, 0x9A, 0x2518, 0x0050, null);
        ctl(0xC0, 0x95, 0x0706, 0, b);
        ctl(0x40, 0xA1, 0x501F, 0xD90A, null);
        ch34xVelocidad(baud);
        ctl(0x40, 0xA4, ~((1 << 5) | (1 << 6)) & 0xFFFF, 0, null);                          // DTR y RTS
        ctl(0x40, 0x9A, 0x2518, 0x00C3, null);                                               // 8N1, recibir y enviar
    }
    private void ch34xVelocidad(int baud) throws IOException {
        int a, b;
        switch (baud) {
            case 2400: a = 0xD901; b = 0x0038; break; case 4800: a = 0x6402; b = 0x001F; break;
            case 19200: a = 0xD902; b = 0x000D; break; case 38400: a = 0x6403; b = 0x000A; break;
            case 115200: a = 0xCC03; b = 0x0008; break; default: a = 0xB202; b = 0x0013;     // 9600
        }
        ok(ctl(0x40, 0x9A, 0x1312, a, null), "velocidad");
        ctl(0x40, 0x9A, 0x0F2C, b, null);
    }
    private void pl2303(int baud) throws IOException {
        byte[] b = new byte[1];
        byte[] raw = con.getRawDescriptors();
        boolean hx = raw != null && raw.length > 7 && (raw[7] & 0xFF) == 64;
        ctl(0xC0, 0x01, 0x8484, 0, b); ctl(0x40, 0x01, 0x0404, 0, null);
        ctl(0xC0, 0x01, 0x8484, 0, b); ctl(0xC0, 0x01, 0x8383, 0, b);
        ctl(0xC0, 0x01, 0x8484, 0, b); ctl(0x40, 0x01, 0x0404, 1, null);
        ctl(0xC0, 0x01, 0x8484, 0, b); ctl(0xC0, 0x01, 0x8383, 0, b);
        ctl(0x40, 0x01, 0, 1, null); ctl(0x40, 0x01, 1, 0, null);
        ctl(0x40, 0x01, 2, hx ? 0x44 : 0x24, null);
        cdc(baud, 0);
    }

    // ---------------------------------------------------------------- Datos
    public void escribir(byte[] b) throws IOException {
        for (int i = 0; i < b.length; ) {
            int n = Math.min(sale.getMaxPacketSize() * 16, b.length - i);
            byte[] parte = new byte[n]; System.arraycopy(b, i, parte, 0, n);
            int r = con.bulkTransfer(sale, parte, n, 3000);
            if (r < 0) throw new IOException("No se pudo mandar por el puerto USB");
            i += r;
        }
    }
    public int leer(byte[] buf, int ms) {
        int n = con.bulkTransfer(entra, buf, buf.length, ms);
        if (n <= 0) return 0;
        if (!"ftdi".equals(chip)) return n;
        // FTDI: cada paquete empieza con 2 bytes de estado que no son datos.
        int k = 0;
        for (int i = 0; i < n; i += paquete) for (int j = i + 2; j < Math.min(n, i + paquete); j++) buf[k++] = buf[j];
        return k;
    }
    public void cerrar() {
        try { con.releaseInterface(itfDatos); } catch (Exception ignorado) { }
        try { if (itfControl != null) con.releaseInterface(itfControl); } catch (Exception ignorado) { }
        try { con.close(); } catch (Exception ignorado) { }
    }
}
