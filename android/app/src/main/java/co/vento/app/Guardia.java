package co.vento.app;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;

/**
 * 🛡️ Guardia: varias marcas (Xiaomi, Oppo/Realme, Vivo, Huawei, Tecno/Infinix…) cierran las apps de fondo aunque tengan
 * su aviso fijo, y desde ahí los pagos no sonaban con el celular bloqueado hasta abrir Vento. Android despierta este
 * trabajo cada 15 min (también después de reiniciar el celular): si el servicio de Vento no está prendido, lo prende otra
 * vez, y de una revisa la barra de avisos (pagos que llegaron mientras estaba cerrado) y los pagos de los otros equipos.
 * Con Vento sin ahorro de batería, Android sí deja prender el servicio desde aquí.
 */
public class Guardia extends JobService {
    static final int ID = 7302;

    static void programar(Context c) {
        try {
            JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (js == null) return;
            for (JobInfo j : js.getAllPendingJobs()) if (j.getId() == ID) return;     // ya está
            js.schedule(new JobInfo.Builder(ID, new ComponentName(c, Guardia.class))
                    .setPeriodic(15 * 60_000L)
                    .setPersisted(true)                                                   // sigue después de reiniciar
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_NONE)
                    .build());
        } catch (Throwable ignorado) { }
    }

    @Override
    public boolean onStartJob(JobParameters p) {
        try {
            if (getSharedPreferences("vento", MODE_PRIVATE).getBoolean("fondo", true) && !VentoServicio.activo) VentoServicio.arrancar(this);
            try { VentoEscucha.barrer(); } catch (Throwable ignorado) { }
            try { Cruce.revisar(this); } catch (Throwable ignorado) { }
        } catch (Throwable ignorado) { }
        return false;
    }

    @Override
    public boolean onStopJob(JobParameters p) { return true; }
}
