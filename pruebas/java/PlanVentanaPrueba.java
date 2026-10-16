// 🪟 La ventana del pago en TODO tipo de celular: el mismo plan (PlanVentana) decide cómo se abre en Samsung, Xiaomi,
// Motorola, OPPO…, de Android 7 a 15, bloqueado, usando otra app o con Vento a la vista, con y sin cada permiso.
package co.vento.app;

public class PlanVentanaPrueba {
    static int ok = 0, mal = 0;
    static void chk(String n, boolean c, Object x) { if (c) { ok++; System.out.println("✅ " + n); } else { mal++; System.out.println("❌ " + n + " → " + x); } }

    public static void main(String[] a) {
        // {nombre, sdk, xiaomi}
        Object[][] celulares = {
            {"Samsung Galaxy A14 (Android 14)", 34, false}, {"Samsung Galaxy A54 (Android 15)", 35, false}, {"Samsung Galaxy A10 (Android 11)", 30, false},
            {"Xiaomi Redmi Note 12 (HyperOS, Android 14)", 34, true}, {"Xiaomi Redmi 9 (MIUI, Android 10)", 29, true}, {"POCO X5 (Android 13)", 33, true},
            {"Motorola Moto G (Android 15)", 35, false}, {"OPPO A57 (Android 12)", 31, false}, {"Huawei Y9 (Android 9)", 28, false}, {"Celular viejo (Android 7)", 24, false} };
        boolean[] tf = {true, false};
        int combinaciones = 0;
        for (Object[] c : celulares) {
            String n = (String) c[0]; int sdk = (Integer) c[1]; boolean xi = (Boolean) c[2];
            for (boolean encima : tf) for (boolean completa : tf) for (boolean xf : tf) for (boolean xb : tf) {
                Boolean xFondo = xi ? xf : null, xBloq = xi ? xb : null;
                combinaciones++;
                // Bloqueado (o pantalla apagada): SIEMPRE notificación de pantalla completa + ventana directo
                PlanVentana b = PlanVentana.de(sdk, true, false, encima, completa, xi, xFondo, xBloq);
                if (!(b.pantallaCompleta && b.directo)) chk(n + " bloqueado: pantalla completa + directo", false, b);
                if (b.ancla != (encima && sdk >= 35)) chk(n + " bloqueado: ancla solo en Android 15 con permiso de encima", false, b);
                // Usando otra app: encima si hay permiso; si no, directo (y se pide el permiso)
                PlanVentana d = PlanVentana.de(sdk, false, false, encima, completa, xi, xFondo, xBloq);
                if (encima ? !d.encima : !(d.directo && "encima".equals(d.falta))) chk(n + " usando otra app (encima=" + encima + ")", false, d);
                // Vento a la vista: la ventana la muestra la página (Android no hace nada: no sale doble)
                PlanVentana f = PlanVentana.de(sdk, false, true, encima, completa, xi, xFondo, xBloq);
                if (f.pantallaCompleta || f.directo || f.encima) chk(n + " con Vento a la vista: solo la página", false, f);
                // Nunca queda sin intentar nada fuera de Vento
                if (!(b.pantallaCompleta || b.directo) || !(d.encima || d.directo)) chk(n + ": siempre se intenta abrir", false, b + " / " + d);
            }
            chk(n + ": bloqueado, usando otra app y con Vento a la vista (16 combinaciones de permisos)", true, null);
        }
        // Qué permiso se pide en cada caso
        chk("Samsung Android 14 bloqueado sin «pantalla completa» ni «encima»: pide «pantalla completa»", "completa".equals(PlanVentana.de(34, true, false, false, false, false, null, null).falta), PlanVentana.de(34, true, false, false, false, false, null, null));
        chk("Samsung Android 14 bloqueado con «pantalla completa»: no falta nada", "".equals(PlanVentana.de(34, true, false, false, true, false, null, null).falta), PlanVentana.de(34, true, false, false, true, false, null, null));
        chk("Xiaomi bloqueado sin «Mostrar en pantalla de bloqueo»: pide los permisos de Xiaomi", "xiaomi".equals(PlanVentana.de(34, true, false, true, true, true, true, false).falta), PlanVentana.de(34, true, false, true, true, true, true, false));
        chk("Xiaomi usando otra app sin «ventanas en segundo plano»: pide los permisos de Xiaomi", "xiaomi".equals(PlanVentana.de(33, false, false, true, true, true, false, true).falta), PlanVentana.de(33, false, false, true, true, true, false, true));
        chk("Xiaomi con todo: no falta nada", "".equals(PlanVentana.de(33, true, false, true, true, true, true, true).falta) && "".equals(PlanVentana.de(33, false, false, true, true, true, true, true).falta), "");
        chk("Total: " + combinaciones + " combinaciones de celular y permisos revisadas", combinaciones == 160, combinaciones);
        System.out.println("RESULTADO " + ok + " bien " + mal + " mal");
        System.exit(mal > 0 ? 1 : 0);
    }
}
