package co.vento.app;

import android.content.SharedPreferences;
import java.util.*;

/** SOLO PARA PRUEBAS: SharedPreferences en memoria. */
public class Preferencias implements SharedPreferences {
    final Map<String, Object> m = new HashMap<>();
    public Map<String, ?> getAll() { return m; }
    public String getString(String k, String d) { Object v = m.get(k); return v == null ? d : (String) v; }
    @SuppressWarnings("unchecked") public Set<String> getStringSet(String k, Set<String> d) { Object v = m.get(k); return v == null ? d : (Set<String>) v; }
    public int getInt(String k, int d) { Object v = m.get(k); return v == null ? d : (Integer) v; }
    public long getLong(String k, long d) { Object v = m.get(k); return v == null ? d : (Long) v; }
    public float getFloat(String k, float d) { Object v = m.get(k); return v == null ? d : (Float) v; }
    public boolean getBoolean(String k, boolean d) { Object v = m.get(k); return v == null ? d : (Boolean) v; }
    public boolean contains(String k) { return m.containsKey(k); }
    public Editor edit() {
        return new Editor() {
            public Editor putString(String k, String v) { m.put(k, v); return this; }
            public Editor putStringSet(String k, Set<String> v) { m.put(k, v); return this; }
            public Editor putInt(String k, int v) { m.put(k, v); return this; }
            public Editor putLong(String k, long v) { m.put(k, v); return this; }
            public Editor putFloat(String k, float v) { m.put(k, v); return this; }
            public Editor putBoolean(String k, boolean v) { m.put(k, v); return this; }
            public Editor remove(String k) { m.remove(k); return this; }
            public Editor clear() { m.clear(); return this; }
            public boolean commit() { return true; }
            public void apply() { }
        };
    }
    public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener l) { }
    public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener l) { }
}
