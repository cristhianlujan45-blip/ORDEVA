// Simulador del reconocedor de voz de la app Android (VentoApp.java), para las pruebas del micrófono.
// Copia cómo se porta la app instalada: cada escucha abre con «start» (y el pitido de Android, salvo que esté silenciado
// con vozSilencio), entrega lo que se dice y se cierra en cada pausa; si se «para» sin que nadie hable, Android responde
// «no te entendí» y la app nativa (antes de 1.31.3) lo tomaba como tropiezo y VOLVÍA A ABRIR el micrófono sola.
// Con __sim.arreglado = true se porta como la app nueva (no reabre después de que la página pide parar).
// Uso: await ctx.addInitScript(require('./simandroidvoz'));   Guion: __sim.guion = ['mesa 1 dos águilas', 'tres póker'].
// Cada pedazo es un texto o { t, tarde, parcial } (tarde: ms que se demora en empezar a hablar; parcial: lo que se alcanza
// a oír antes de la frase final). __sim.ruido: lo que habla la gente
// cerca, que se oye si el micrófono sigue abierto 2,5 s después de abrirse.
module.exports = function(){
  const S = window.__sim = { guion: [], beeps: 0, aperturas: 0, mudo: false, vivo: false, sesion: 0, ruido: null, finalEn: 0, arreglado: false, reintentos: 0, cancelaciones: 0, paradas: 0, procesados: [] };
  let T = [], inicio = 0, hablo = false, reint = 0, detenida = false, actual = null;
  const V = (t, d) => window.__ventoVoz && window.__ventoVoz(t, d || {});
  const limpiar = () => { T.forEach(clearTimeout); T = []; };
  function abrir(){
    limpiar(); const ses = ++S.sesion; inicio = Date.now(); hablo = false; actual = null; S.aperturas++; S.vivo = true;
    const at = (ms, f) => T.push(setTimeout(() => { if(ses === S.sesion) f(); }, ms));
    at(150, () => { if(!S.mudo) S.beeps++; V('start'); });
    const c = S.guion.shift();
    if(c){
      const txt = typeof c === 'string' ? c : c.t, tarde = (typeof c === 'object' && c.tarde) || 0;
      const parcial = (typeof c === 'object' && c.parcial) || txt;
      at(400 + tarde, () => { hablo = true; actual = txt; V('result', { alts: [{ t: parcial, c: 0.9 }], final: false }); });
      // { trabado: true }: el reconocedor del celular se traba (nunca da la frase final ni avisa que terminó)
      if(!(typeof c === 'object' && c.trabado)) at(900 + tarde, () => { S.vivo = false; S.sesion++; S.finalEn = Date.now(); V('result', { alts: [{ t: txt, c: 0.9 }], final: true }); V('end'); });
    } else {
      if(S.ruido){ const r = S.ruido; at(2500, () => { hablo = true; actual = r; V('result', { alts: [{ t: r, c: 0.8 }], final: false }); }); at(3000, () => { S.vivo = false; S.sesion++; V('result', { alts: [{ t: r, c: 0.8 }], final: true }); V('end'); }); }
      else at(5000, () => error('timeout'));      // Android: nadie habló
    }
  }
  function error(tipo){
    const dura = Date.now() - inicio, arranque = dura < 2500, sinOir = !hablo && tipo === 'nomatch';
    if(!(S.arreglado && detenida) && reint < 2 && (arranque || sinOir) && dura < 9000){ reint++; S.reintentos++; limpiar(); S.sesion++; setTimeout(abrir, 120); return; }
    limpiar(); S.sesion++; S.vivo = false; V('error', { error: 'no-speech' }); V('end');
  }
  window.VentoAndroid = {
    info: () => '{}', hablar(){}, callar(){}, guardarArchivo(){}, fondo: () => true, fondoActivar(){}, notificar(){ return true; },
    avisosEstado: () => '{"prendidos":true}', buscarTVs(){}, lounge(){}, pararTV(){}, vozPreparar(){},
    vozSilencio(si){ S.mudo = !!si; },
    vozIniciar(){ reint = 0; detenida = false; abrir(); },
    vozParar(){ S.paradas++; detenida = true; if(!S.vivo || S.trabado) return;
      if(actual){ const txt = actual; limpiar(); setTimeout(() => { S.vivo = false; S.sesion++; V('result', { alts: [{ t: txt, c: 0.9 }], final: true }); V('end'); }, 60); }
      else { limpiar(); setTimeout(() => error('nomatch'), 80); } },
    vozCancelar(){ S.cancelaciones++; limpiar(); S.sesion++; S.vivo = false; if(!S.trabado) setTimeout(() => V('end'), 20); }
  };
  try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
};
