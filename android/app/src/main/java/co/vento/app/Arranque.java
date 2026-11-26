package co.vento.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Al prender el celular (o actualizar la app), Vento vuelve a trabajar de fondo sola, sin abrirla. */
public class Arranque extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i == null ? null : i.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(a) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)
                && !"android.intent.action.QUICKBOOT_POWERON".equals(a)) return;
        if (!c.getSharedPreferences("vento", Context.MODE_PRIVATE).getBoolean("fondo", true)) return;
        VentoServicio.arrancar(c);
        Guardia.programar(c);
        // 1.99.83: se actualizó de madrugada con ORDEVA en pantalla: se vuelve a abrir (así la encuentran como la dejaron).
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) try {
            android.content.SharedPreferences p = c.getSharedPreferences("vento", Context.MODE_PRIVATE);
            long t = p.getLong(Actualizador.P_REABRIR, 0);
            if (t > 0 && System.currentTimeMillis() - t < 15 * 60_000L) {
                p.edit().remove(Actualizador.P_REABRIR).apply();
                c.startActivity(new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            }
        } catch (Throwable ignorado) { }
    }
}
