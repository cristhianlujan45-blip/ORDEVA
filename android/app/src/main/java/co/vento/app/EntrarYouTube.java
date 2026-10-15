package co.vento.app;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Entrar a YouTube con la cuenta del dueño DENTRO de la app (para que el reproductor de Vento sepa que tiene
 * YouTube Premium y no ponga comerciales).
 *  • Es la página de inicio de sesión de Google de verdad, sin trucos: no se cambia el «user agent» ni se esconde que es
 *    una app. Si Google no deja entrar desde una app («Este navegador o app no es seguro»), Vento lo dice claro y ofrece
 *    el TV (donde Premium sí funciona siempre).
 *  • La sesión queda en las cookies de la app (las mismas que usa el reproductor de Vento). Vento nunca ve la contraseña.
 */
public class EntrarYouTube extends Activity {
    static final String URL = "https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&hl=es&continue="
            + Uri.encode("https://www.youtube.com/signin?action_handle_signin=true&app=m&hl=es&next=https%3A%2F%2Fm.youtube.com%2F");
    private WebView w;
    private TextView estado;
    private boolean listo = false;

    private int dp(int v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(0xFF0B0A12);
        LinearLayout barra = new LinearLayout(this);
        barra.setOrientation(LinearLayout.HORIZONTAL);
        barra.setGravity(Gravity.CENTER_VERTICAL);
        barra.setPadding(dp(14), dp(10), dp(8), dp(10));
        estado = new TextView(this);
        estado.setText("Entra con tu cuenta de YouTube Premium");
        estado.setTextColor(Color.WHITE);
        estado.setTextSize(15);
        barra.addView(estado, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        Button cerrar = new Button(this);
        cerrar.setText("Cerrar");
        cerrar.setOnClickListener(v -> finish());
        barra.addView(cerrar);
        raiz.addView(barra);

        w = new WebView(this);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true);
        w.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String esq = r.getUrl().getScheme();
                return esq == null || !(esq.equals("https") || esq.equals("http"));   // intent://, market://…: no se abren
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                if (VentoApp.youtubeSesion()) {
                    listo = true;
                    CookieManager.getInstance().flush();
                    estado.setText("✅ Listo: YouTube ya sabe que eres tú");
                    v.postDelayed(EntrarYouTube.this::finish, 900);
                }
            }
        });
        raiz.addView(w, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(raiz);
        w.loadUrl(URL);
    }

    @Override
    public void onBackPressed() {
        if (w != null && w.canGoBack()) w.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        boolean ok = listo || VentoApp.youtubeSesion();
        CookieManager.getInstance().flush();
        VentoApp.js("try{window.ventoYouTubeSesion&&window.ventoYouTubeSesion(" + ok + ")}catch(e){}");
        if (w != null) { w.destroy(); w = null; }
        super.onDestroy();
    }
}
