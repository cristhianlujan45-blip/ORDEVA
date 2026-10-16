package co.vento.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;

/**
 * 💜 La ventana del pago ENCIMA de la pantalla de bloqueo (y prende la pantalla). La abre la notificación del pago
 * («pantalla completa») cuando el celular está bloqueado. Se cierra con «Cerrar» o sola a los 15 s; si llega otro pago
 * mientras está abierta, muestra el nuevo y vuelve a contar.
 * OPACA (fondo oscuro de pantalla completa, como la de una alarma): en Android 10 en adelante una ventana semitransparente
 * NO tapa la pantalla de bloqueo (se abría detrás del bloqueo y no se veía). Así sale encima en todos los celulares.
 */
public class PagoActivity extends Activity {
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable cerrar = this::finish;
    static volatile long abierta = 0;      // cuándo se mostró la última (para el registro: ¿sí se abrió?)
    static volatile long vista = 0;        // cuándo quedó A LA VISTA (onResume): así se sabe si de verdad se vio

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setBackgroundDrawable(new ColorDrawable(0xFF14101F));   // opaca: tapa la pantalla de bloqueo
        pintar(getIntent());
    }

    @Override
    protected void onResume() { super.onResume(); vista = System.currentTimeMillis(); }

    @Override
    protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); pintar(i); }

    private void pintar(Intent i) {
        if (i == null) { finish(); return; }
        abierta = System.currentTimeMillis();
        setContentView(VentanaPago.tarjeta(this, i.getStringExtra(VentanaPago.E_VALOR), i.getStringExtra(VentanaPago.E_BANCO),
                i.getStringExtra(VentanaPago.E_FRASE), i.getStringExtra(VentanaPago.E_TEXTO), i.getStringExtra(VentanaPago.E_TIPO), this::finish));
        h.removeCallbacks(cerrar);
        h.postDelayed(cerrar, VentanaPago.DURA);
    }

    @Override
    protected void onDestroy() { h.removeCallbacks(cerrar); super.onDestroy(); }
}
