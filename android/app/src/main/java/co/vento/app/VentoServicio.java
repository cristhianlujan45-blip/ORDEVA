package co.vento.app;

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
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Vento trabajando de fondo: con este servicio (y su aviso fijo en la barra de notificaciones)
 * Android no apaga la app aunque la ventana esté cerrada, la pantalla apagada o la app quitada de
 * recientes. La página de Vento (VentoApp.web) sigue recibiendo pedidos y mandando la música al TV.
 * Mantiene el procesador y el wifi despiertos mientras está prendido.
 */
public class VentoServicio extends Service {

    static volatile boolean activo = false;
    private static final String CANAL = "vento_fondo";
    private static final int ID = 7;
    private static final String DETENER = "co.vento.app.DETENER";

    private PowerManager.WakeLock cpu;
    private WifiManager.WifiLock wifi;

    /* Latido: con la ventana cerrada, Android frena los relojes de la página (hasta 1 vez por minuto).
       El servicio la despierta cada 5 s para que las canciones nuevas lleguen al TV enseguida. */
    private final Runnable latido = new Runnable() {
        @Override public void run() {
            if (!activo) return;
            VentoApp.js("try{window.ventoLatido&&window.ventoLatido()}catch(e){}");
            // 1.57.1: otra vez como en la 1.55.3 (la que funcionaba). En la 1.55.4 se revisaba cada 10 s y a los 30 s se apagaba y
            // prendía la lectura de avisos: con el celular bloqueado Android no la reconecta hasta desbloquear, así que la cortaba
            // una y otra vez y los pagos llegaban al desbloquear.
            if (++vueltas % 12 == 0) revisarEscucha();               // cada minuto: ¿sigue leyendo los avisos de los bancos?
            if (vueltas % 2 == 0) try { VentoEscucha.barrer(); } catch (Throwable ignorado) { }   // cada 10 s: ¿quedó un pago en la barra sin llegar?
            // Cada 5 min: ¿hay una versión nueva de la app? (revisa cada 30 min; si ya hay una, la instala cuando no se use Vento)
            if (vueltas % 60 == 30) try { Actualizador.revisar(VentoServicio.this, false); } catch (Throwable ignorado) { }
            // Cada 5 min: el motor de voz de los pagos listo (si Android lo cerró, se vuelve a preparar): el pago suena de una.
            if (vueltas % 60 == 5) try { VentoApp.prepararVozPagos(); } catch (Throwable ignorado) { }
            VentoApp.ui.postDelayed(this, 5000);
        }
    };

    /* Los pagos que leyeron los OTROS equipos del negocio, también con el celular bloqueado y la página dormida: cada
       2,5 s (1.50.0; antes cada 5 s, y en la 1.48.0 cada 10 s). «Que suene apenas pagan, en todos los celulares». */
    private final Runnable cruce = new Runnable() {
        @Override public void run() {
            if (!activo) return;
            try { Cruce.revisar(VentoServicio.this); } catch (Throwable ignorado) { }
            VentoApp.ui.postDelayed(this, Cruce.CADA_MS);
        }
    };

    private int vueltas = 0, sinEscucha = 0;

    /** Android a veces desconecta la lectura de avisos (ahorro de batería, actualización) y los pagos dejan de sonar hasta
     *  abrir Vento. Si la lectura de pagos está prendida, hay permiso y no está conectada: se le pide volver a conectarla y,
     *  si sigue sin conectar, se apaga y se prende el componente (así Android la vuelve a conectar). */
    private void revisarEscucha() {
        try {
            if (VentoEscucha.activa != null) { sinEscucha = 0; return; }
            if (!getSharedPreferences("vento", MODE_PRIVATE).getBoolean(VentoEscucha.PREF_ON, false)) return;
            String s = android.provider.Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
            if (s == null || !s.contains(getPackageName())) return;
            android.content.ComponentName cn = new android.content.ComponentName(this, VentoEscucha.class);
            sinEscucha++;
            if (Build.VERSION.SDK_INT >= 24) android.service.notification.NotificationListenerService.requestRebind(cn);
            if (sinEscucha >= 2) {
                android.content.pm.PackageManager pm = getPackageManager();
                pm.setComponentEnabledSetting(cn, android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED, android.content.pm.PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(cn, android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED, android.content.pm.PackageManager.DONT_KILL_APP);
                sinEscucha = 0;
            }
        } catch (Throwable ignorado) { }
    }

    static void arrancar(Context c) {
        Intent i = new Intent(c, VentoServicio.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception ignorado) { }
    }

    static void detener(Context c) {
        try { c.stopService(new Intent(c, VentoServicio.class)); } catch (Exception ignorado) { }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        activo = true;
        // Si no hay ventana (por ejemplo, el celular se acaba de prender), se crea la página de Vento aquí.
        VentoApp.ui.post(() -> VentoApp.motor(null));
        VentoApp.ui.postDelayed(latido, 5000);
        VentoApp.ui.removeCallbacks(cruce);
        VentoApp.ui.postDelayed(cruce, 1000);
        VentoApp.ui.postDelayed(VentoApp::prepararVozPagos, 3000);   // la voz de los pagos lista desde ya (sale de una)
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            cpu = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "vento:fondo");
            cpu.setReferenceCounted(false);
            cpu.acquire();
        } catch (Exception ignorado) { cpu = null; }
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
            int modo = Build.VERSION.SDK_INT >= 29 ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
            wifi = wm.createWifiLock(modo, "vento:fondo");
            wifi.setReferenceCounted(false);
            wifi.acquire();
        } catch (Exception ignorado) { wifi = null; }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && DETENER.equals(intent.getAction())) {
            getSharedPreferences("vento", MODE_PRIVATE).edit().putBoolean("fondo", false).apply();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        Notification n = aviso();
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(ID, n);
        return START_STICKY;                       // si Android lo cierra, lo vuelve a abrir
    }

    /** La app se quitó de recientes: el servicio y la página siguen trabajando. */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        activo = false;
        VentoApp.ui.removeCallbacks(latido);
        VentoApp.ui.removeCallbacks(cruce);
        try { if (cpu != null && cpu.isHeld()) cpu.release(); } catch (Exception ignorado) { }
        try { if (wifi != null && wifi.isHeld()) wifi.release(); } catch (Exception ignorado) { }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private Notification aviso() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Vento trabajando de fondo", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Vento sigue recibiendo pedidos y mandando la música al TV con la app cerrada.");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        int flagsPi = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent abrir = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK), flagsPi);
        PendingIntent parar = PendingIntent.getService(this, 1, new Intent(this, VentoServicio.class).setAction(DETENER), flagsPi);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
                .setContentTitle("Vento está trabajando")
                .setContentText("Recibiendo pedidos y mandando la música al TV, aunque cierres la app.")
                .setOngoing(true)
                .setContentIntent(abrir)
                .addAction(new Notification.Action.Builder(null, "Detener", parar).build());
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return b.build();
    }
}
