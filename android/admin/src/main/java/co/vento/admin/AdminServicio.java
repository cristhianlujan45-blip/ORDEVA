package co.vento.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.webkit.WebView;

import java.lang.ref.WeakReference;

/**
 * Vento Admin conectado SIEMPRE: servicio en primer plano (con su notificación fija) que mantiene el panel
 * trabajando con la pantalla bloqueada o la app en segundo plano. Sostiene el procesador y el wifi despiertos y,
 * cada 10 s, despierta la página (window.ventoAdminLatido) para que el tiempo real siga conectado y lleguen al
 * instante los avisos de soporte y de pagos (que salen como notificaciones del celular por AdminActivity.Puente).
 */
public class AdminServicio extends Service {

    static volatile boolean activo = false;
    static WeakReference<WebView> pagina = new WeakReference<>(null);
    private static final String CANAL = "vento_admin_fondo";
    private static final int ID = 17;
    static final String DETENER = "co.vento.admin.DETENER";

    private final Handler ui = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock cpu;
    private WifiManager.WifiLock wifi;

    private final Runnable latido = new Runnable() {
        @Override public void run() {
            if (!activo) return;
            WebView w = pagina.get();
            if (w != null) {
                try { w.evaluateJavascript("try{window.ventoAdminLatido&&window.ventoAdminLatido()}catch(e){}", null); } catch (Exception ignorado) { }
            }
            ui.postDelayed(this, 10000);
        }
    };

    static void arrancar(Context c) {
        Intent i = new Intent(c, AdminServicio.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception ignorado) { }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        activo = true;
        ui.postDelayed(latido, 10000);
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            cpu = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ventoadmin:fondo");
            cpu.setReferenceCounted(false);
            cpu.acquire();
        } catch (Exception ignorado) { cpu = null; }
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
            int modo = Build.VERSION.SDK_INT >= 29 ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
            wifi = wm.createWifiLock(modo, "ventoadmin:fondo");
            wifi.setReferenceCounted(false);
            wifi.acquire();
        } catch (Exception ignorado) { wifi = null; }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && DETENER.equals(intent.getAction())) {
            getSharedPreferences("vento_admin", MODE_PRIVATE).edit().putBoolean("fondo", false).apply();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        Notification n = aviso();
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(ID, n);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        activo = false;
        ui.removeCallbacks(latido);
        try { if (cpu != null && cpu.isHeld()) cpu.release(); } catch (Exception ignorado) { }
        try { if (wifi != null && wifi.isHeld()) wifi.release(); } catch (Exception ignorado) { }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private Notification aviso() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Vento Admin conectado", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Mantiene el panel conectado para recibir al instante los avisos de soporte y pagos.");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        int flagsPi = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent abrir = PendingIntent.getActivity(this, 0,
                new Intent(this, AdminActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK), flagsPi);
        PendingIntent parar = PendingIntent.getService(this, 1, new Intent(this, AdminServicio.class).setAction(DETENER), flagsPi);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
                .setContentTitle("Vento Admin conectado")
                .setContentText("Recibiendo soporte y pagos al instante, aunque el celular esté bloqueado.")
                .setOngoing(true)
                .setContentIntent(abrir)
                .addAction(new Notification.Action.Builder(null, "Detener", parar).build());
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return b.build();
    }
}
