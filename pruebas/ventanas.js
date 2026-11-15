// 🪟 1.99.5 · Ayuda para las pruebas: contestar las ventanas propias de ORDEVA (las que reemplazan confirm/prompt/alert
// del navegador). contestar(p, valor): si sale «escribe el dato» (#promptOverlay) pone el valor y acepta; si sale una
// confirmación (#confirmOverlay) toca «Sí» (o «Cancelar» si valor === false). Si no sale ninguna en «ms», no hace nada.
async function contestar(p, valor, ms){
  const sel = '#promptOverlay.show, #confirmOverlay.show';
  try{ await p.waitForSelector(sel, { timeout: ms || 4000 }); }catch(e){ return false; }
  return p.evaluate(v => {
    const po = document.getElementById('promptOverlay');
    if(po && po.classList.contains('show')){
      const i = document.getElementById('promptInput');
      if(v === false || v === null){ document.getElementById('promptCancelBtn').click(); return 'prompt:cancel'; }
      if(!i.hidden){ i.value = v == null || v === true ? i.value : String(v); }
      document.getElementById('promptOkBtn').click(); return 'prompt';
    }
    const co = document.getElementById('confirmOverlay');
    if(co && co.classList.contains('show')){ document.getElementById(v === false ? 'confirmCancelBtn' : 'confirmOkBtn').click(); return 'confirm'; }
    return false;
  }, valor);
}
module.exports = { contestar };
