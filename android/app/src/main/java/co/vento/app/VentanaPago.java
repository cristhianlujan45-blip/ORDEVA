package co.vento.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * 💜 Ventana emergente de cada pago: el valor grande, por qué banco y el texto, con «Cerrar» y que se cierra sola a los
 * 15 s. Sale:
 *  • con el celular bloqueado o la pantalla apagada: encima de la pantalla de bloqueo (PagoActivity, por la notificación
 *    de «pantalla completa» del pago);
 *  • usando otra app: encima de lo que se esté viendo (permiso «Aparecer encima de otras apps»);
 *  • con Vento abierta: la muestra la página (aquí no se repite).
 */
final class VentanaPago {
    private VentanaPago() { }
    static final String PREF = "pagosVentana";
    static final long DURA = 15_000L;
    static final String E_VALOR = "valor", E_BANCO = "banco", E_FRASE = "frase", E_TEXTO = "texto", E_TIPO = "tipo";

    private static View vista;                      // la que está encima de otras apps ahora
    private static Runnable cerrarVista;
    private static final Handler H = new Handler(Looper.getMainLooper());

    static boolean prendida(Context c) { return c.getSharedPreferences("vento", Context.MODE_PRIVATE).getBoolean(PREF, true); }

    /** ¿El celular está bloqueado o con la pantalla apagada? */
    static boolean bloqueado(Context c) {
        try {
            android.app.KeyguardManager km = (android.app.KeyguardManager) c.getSystemService(Context.KEYGUARD_SERVICE);
            android.os.PowerManager pm = (android.os.PowerManager) c.getSystemService(Context.POWER_SERVICE);
            return (km != null && km.isKeyguardLocked()) || (pm != null && !pm.isInteractive());
        } catch (Throwable e) { return false; }
    }

    static boolean puedeEncima(Context c) { return Build.VERSION.SDK_INT < 23 || android.provider.Settings.canDrawOverlays(c); }

    static boolean puedePantallaCompleta(Context c) {
        if (Build.VERSION.SDK_INT < 34) return true;
        try { return ((android.app.NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).canUseFullScreenIntent(); } catch (Throwable e) { return false; }
    }

    static Intent intent(Context c, String valor, String banco, String frase, String texto, String tipo) {
        return new Intent(c, PagoActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NO_USER_ACTION)
                .putExtra(E_VALOR, valor).putExtra(E_BANCO, banco).putExtra(E_FRASE, frase).putExtra(E_TEXTO, texto).putExtra(E_TIPO, tipo);
    }

    /** Celular desbloqueado y Vento sin estar a la vista: la ventana encima de la app que se esté usando. */
    static void mostrarEncima(Context c, String valor, String banco, String frase, String texto, String tipo) {
        H.post(() -> {
            try {
                if (VentoApp.alFrente) return;
                // Sin el permiso «encima de otras apps»: se intenta abrir la ventana como pantalla (en Xiaomi sale si está
                // «Mostrar ventanas emergentes en segundo plano»). Antes, sin ese permiso, no salía nada.
                if (!puedeEncima(c)) { abrirPantalla(c, intent(c, valor, banco, frase, texto, tipo)); return; }
                cerrar();
                WindowManager wm = (WindowManager) c.getSystemService(Context.WINDOW_SERVICE);
                final View[] v = {null};
                Runnable fin = () -> { try { if (v[0] != null && v[0].getParent() != null) wm.removeView(v[0]); } catch (Throwable ignorado) { } if (vista == v[0]) { vista = null; cerrarVista = null; } };
                v[0] = tarjeta(c, valor, banco, frase, texto, tipo, fin);
                WindowManager.LayoutParams p = new WindowManager.LayoutParams(
                        WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT,
                        Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_DIM_BEHIND, PixelFormat.TRANSLUCENT);
                p.gravity = Gravity.CENTER; p.dimAmount = 0.45f;
                wm.addView(v[0], p);
                vista = v[0]; cerrarVista = fin;
                H.postDelayed(() -> { if (vista == v[0]) fin.run(); }, DURA);
            } catch (Throwable ignorado) { }
        });
    }

    /** Android 15: para abrir una pantalla desde el fondo con el permiso de «encima de otras apps», Vento tiene que tener
     *  una ventana encima en ese momento. Se pone una invisible de 1 punto durante 3 s. */
    static void ancla(Context c) {
        H.post(() -> {
            try {
                WindowManager wm = (WindowManager) c.getSystemService(Context.WINDOW_SERVICE);
                final View v = new View(c);
                WindowManager.LayoutParams p = new WindowManager.LayoutParams(1, 1,
                        Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE, PixelFormat.TRANSLUCENT);
                p.gravity = Gravity.TOP | Gravity.START;
                wm.addView(v, p);
                H.postDelayed(() -> { try { wm.removeView(v); } catch (Throwable ignorado) { } }, 3000);
            } catch (Throwable ignorado) { }
        });
    }

    /** Abre la ventana del pago como pantalla (PagoActivity), sobre la pantalla de bloqueo si está bloqueado. */
    static void abrirPantalla(Context c, Intent i) { H.postDelayed(() -> { try { c.startActivity(i); } catch (Throwable ignorado) { } }, 150); }

    // ---------- Xiaomi / Redmi / POCO (MIUI, HyperOS): sus permisos propios ----------
    // Xiaomi bloquea por su cuenta que una app abra ventanas sola: «Mostrar ventanas emergentes mientras se ejecuta en
    // segundo plano» (10021) y «Mostrar en pantalla de bloqueo» (10020). Vienen apagados; sin ellos la ventana del pago no
    // sale aunque Android tenga los otros permisos. Se leen con AppOpsManager (si el celular deja saberlo).
    static boolean esXiaomi() {
        String m = (Build.MANUFACTURER + " " + Build.BRAND).toLowerCase(java.util.Locale.ROOT);
        return m.contains("xiaomi") || m.contains("redmi") || m.contains("poco");
    }
    /** true/false, o null si no se sabe (no es Xiaomi o el celular no lo deja ver). */
    static Boolean xiaomiPermiso(Context c, int op) {
        if (!esXiaomi()) return null;
        try {
            android.app.AppOpsManager ao = (android.app.AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
            java.lang.reflect.Method m = android.app.AppOpsManager.class.getMethod("checkOpNoThrow", int.class, int.class, String.class);
            int r = (Integer) m.invoke(ao, op, android.os.Process.myUid(), c.getPackageName());
            return r == android.app.AppOpsManager.MODE_ALLOWED;
        } catch (Throwable e) { return null; }
    }
    /** Abre «Otros permisos» de Vento en Xiaomi (donde están esos dos). */
    static boolean abrirPermisosXiaomi(Context c) {
        String[][] pantallas = {
                {"com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity"},
                {"com.miui.securitycenter", "com.miui.permcenter.permissions.AppPermissionsEditorActivity"}};
        for (String[] p : pantallas) {
            try {
                Intent i = new Intent("miui.intent.action.APP_PERM_EDITOR").setClassName(p[0], p[1]).putExtra("extra_pkgname", c.getPackageName()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (c.getPackageManager().resolveActivity(i, 0) != null) { c.startActivity(i); return true; }
            } catch (Throwable ignorado) { }
        }
        try { c.startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:" + c.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return true; } catch (Throwable e) { return false; }
    }

    static boolean mostrandoEncima() { return vista != null; }

    static void cerrar() { Runnable r = cerrarVista; if (r != null) try { r.run(); } catch (Throwable ignorado) { } }

    private static int dp(Context c, float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics())); }

    /** La tarjeta del pago (la misma encima de otras apps y en la pantalla de bloqueo). «fin» la cierra. */
    static View tarjeta(Context c, String valor, String banco, String frase, String texto, String tipo, Runnable fin) {
        boolean falso = "falso".equals(tipo), revisar = "revisar".equals(tipo), sinValor = "sinvalor".equals(tipo);
        int color = falso ? 0xFFDC2626 : revisar ? 0xFFD97706 : 0xFF7C3AED;
        LinearLayout marco = new LinearLayout(c);
        marco.setPadding(dp(c, 18), dp(c, 18), dp(c, 18), dp(c, 18));
        marco.setGravity(Gravity.CENTER);
        LinearLayout t = new LinearLayout(c);
        t.setOrientation(LinearLayout.VERTICAL);
        t.setGravity(Gravity.CENTER_HORIZONTAL);
        t.setPadding(dp(c, 20), dp(c, 18), dp(c, 20), dp(c, 16));
        GradientDrawable fondo = new GradientDrawable();
        fondo.setColor(Color.WHITE); fondo.setCornerRadius(dp(c, 22)); fondo.setStroke(dp(c, 3), color);
        t.setBackground(fondo);
        if (Build.VERSION.SDK_INT >= 21) t.setElevation(dp(c, 12));
        marco.addView(t, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView arriba = texto(c, falso ? "🚨 Pago FALSO" : revisar ? "⚠️ Revisa este pago" : sinValor ? "💜 Llegó plata" : "💜 Recibiste", 20, color, true);
        t.addView(arriba);
        if (valor != null && !valor.isEmpty()) {
            TextView v = texto(c, valor, 46, 0xFF111827, true);
            v.setPadding(0, dp(c, 2), 0, 0);
            t.addView(v);
        }
        if (banco != null && !banco.isEmpty()) t.addView(texto(c, "por " + banco, 19, 0xFF374151, true));
        String detalle = (frase == null ? "" : frase) + (texto == null || texto.isEmpty() ? "" : "\n«" + texto + "»");
        if (!detalle.trim().isEmpty()) {
            TextView d = texto(c, detalle.trim(), 15, 0xFF4B5563, false);
            d.setMaxLines(5); d.setEllipsize(android.text.TextUtils.TruncateAt.END);
            d.setPadding(0, dp(c, 10), 0, 0);
            t.addView(d);
        }
        final TextView cuenta = texto(c, "Se cierra sola en 15 s", 13, 0xFF6B7280, false);
        cuenta.setPadding(0, dp(c, 10), 0, dp(c, 4));
        t.addView(cuenta);
        Button b = new Button(c);
        b.setText("✕ Cerrar"); b.setAllCaps(false); b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18); b.setTextColor(Color.WHITE);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable bf = new GradientDrawable(); bf.setColor(color); bf.setCornerRadius(dp(c, 14));
        b.setBackground(bf);
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(c, 52));
        lb.topMargin = dp(c, 6);
        t.addView(b, lb);
        b.setOnClickListener(x -> fin.run());
        // La cuenta regresiva (15, 14, 13…)
        final long hasta = System.currentTimeMillis() + DURA;
        final Handler h = new Handler(Looper.getMainLooper());
        final Runnable tic = new Runnable() { @Override public void run() {
            long s = Math.max(0, (hasta - System.currentTimeMillis() + 999) / 1000);
            cuenta.setText("Se cierra sola en " + s + " s");
            if (s > 0) h.postDelayed(this, 1000);
        } };
        marco.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener() {
            @Override public void onViewAttachedToWindow(View x) { h.removeCallbacks(tic); h.post(tic); }
            @Override public void onViewDetachedFromWindow(View x) { h.removeCallbacks(tic); }
        });
        return marco;
    }

    private static TextView texto(Context c, String s, float sp, int color, boolean negrita) {
        TextView v = new TextView(c);
        v.setText(s); v.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp); v.setTextColor(color); v.setGravity(Gravity.CENTER);
        if (negrita) v.setTypeface(Typeface.DEFAULT_BOLD);
        return v;
    }
}
