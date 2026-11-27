/* ORDEVA · pedido/app.js — antes estaba dentro de pedido.html (1.99.92: así la lista blanca CSP no deja correr código pegado en la página). Se carga en el mismo lugar y orden. */
const P=new URLSearchParams(location.search),
  mesa=(P.get('mesa')||'').replace(/\D/g,''),
  wa=(w=>(w.length===10&&w[0]==='3')?'57'+w:w)((P.get('w')||'').replace(/\D/g,'')),   // 10 dígitos de celular colombiano → con 57, si no wa.me no abre el chat
  c=(P.get('c')||'').replace(/[^\w]/g,''),
  v=(P.get('v')||'').replace(/[^\w]/g,''),
  nq=(P.get('nq')||'').replace(/\D/g,'').slice(0,10),
  nqn=(P.get('nqn')||'').slice(0,60);
/* Modo domicilio: el mismo link de pedidos pero sin mesa (se pone en la página web del
   negocio, en Instagram o se manda por WhatsApp). Pide los datos de entrega y el pedido
   le llega a la app como un domicilio, no como una mesa. */
const dom=P.get('dom')==='1';
const SUF=dom?'dom':mesa;
// Canciones por mesa cada 15 min: lo decide el negocio (Ajustes → Música) y llega con la carta (cat.cl) o con la cuenta
// en vivo de la mesa (snap.cm). 0 = sin límite.
const MAXC=()=>{try{if(snap&&+snap.cm>0)return +snap.cm;}catch(e){}try{if(cat&&cat.cl!=null)return +cat.cl>0?+cat.cl:0;}catch(e){}return 10;};   // sin dato: 10 (lo que trae ORDEVA)
const V=15*6e4,K='canc_'+SUF,KR='rondas_'+SUF,KH='hist_'+SUF,VIDA_RONDA=12*36e5;
const $=i=>document.getElementById(i);
const jget=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const jset=(k,x)=>{try{localStorage.setItem(k,JSON.stringify(x))}catch(e){}};
// El cupo de canciones es POR MESA: la app del local publica en la cuenta en vivo (snap.cs) la hora de cada
// canción que pidió la mesa (desde cualquier celular). Se usa la cuenta más alta entre la mesa y este celular.
let snapEn=0;
const recLocal=()=>jget(K,[]).filter(x=>Date.now()-x<V);
const recMesa=()=>{if(!snap||!Array.isArray(snap.cs))return[];const d=Date.now()-snapEn;return snap.cs.map(x=>Date.now()-((+snap.t||0)-x)-d).filter(x=>Date.now()-x<V)};
const recientes=()=>{const a=recLocal(),b=recMesa();return b.length>a.length?b:a},usadas=()=>{const m=MAXC();return m?Math.min(m,recientes().length):recientes().length};
let modo='p',ultimo='',es=null,snap=null,lineas=[];

function h(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}

/* ---------- Idiomas (es, en, pt, fr, zh, hi) ---------- */
const LANGS=['es','en','pt','fr','zh','hi'];
const DICT_SRC={
  subtitle:["Pide desde tu mesa, nosotros te lo llevamos.","Order from your table, we’ll bring it to you.","Peça pela sua mesa, a gente leva até você.","Commandez depuis votre table, on vous l’apporte.","在您的桌上点单，我们为您送上。","अपनी मेज़ से ऑर्डर करें, हम आपके पास लाएँगे।"],
  mesaLabel:["Mesa {n}","Table {n}","Mesa {n}","Table {n}","{n}号桌","मेज़ {n}"],
  domLabel:["Pedido a domicilio","Delivery order","Pedido para entrega","Commande à livrer","外送订单","होम डिलीवरी ऑर्डर"],
  domSubtitle:["Pide y te lo llevamos hasta donde estés.","Order and we’ll bring it to you.","Peça e levamos até você.","Commandez, on vous livre.","下单，我们送货上门。","ऑर्डर करें, हम आप तक पहुँचाएँगे।"],
  domDatos:["Datos para la entrega","Delivery details","Dados para a entrega","Informations de livraison","配送信息","डिलीवरी की जानकारी"],
  domHint:["Para poderte llevar el pedido hasta donde estés.","So we can bring your order to you.","Para levarmos seu pedido até você.","Pour vous apporter votre commande.","以便我们把订单送到您手中。","ताकि हम आपका ऑर्डर आप तक पहुँचा सकें।"],
  domNombre:["Tu nombre","Your name","Seu nome","Votre nom","您的姓名","आपका नाम"],
  domTel:["Tu teléfono / WhatsApp","Your phone / WhatsApp","Seu telefone / WhatsApp","Votre téléphone / WhatsApp","您的电话 / WhatsApp","आपका फ़ोन / WhatsApp"],
  domDir:["Dirección (barrio, calle, apto…)","Address (street, apt…)","Endereço (bairro, rua, apto…)","Adresse (rue, appartement…)","地址（街道、门牌号…）","पता (गली, मकान नं…)"],
  domEnviar:["Enviar pedido a domicilio","Send delivery order","Enviar pedido para entrega","Envoyer la commande","提交外送订单","डिलीवरी ऑर्डर भेजें"],
  domFaltan:["Escribe tu nombre y la dirección de entrega.","Enter your name and delivery address.","Escreva seu nome e o endereço de entrega.","Indiquez votre nom et l’adresse de livraison.","请填写姓名和配送地址。","अपना नाम और डिलीवरी पता लिखें।"],
  tabPedido:["Pedido","Order","Pedido","Commande","订单","ऑर्डर"],
  tabCancion:["Canción","Song","Canção","Chanson","点歌","गाना"],
  tabCuenta:["Mi cuenta","My bill","Minha conta","Mon addition","我的账单","मेरा बिल"],
  repetirRonda:["Repetir la misma ronda","Repeat the same round","Repetir a mesma rodada","Répéter la même tournée","重复上一轮","वही राउंड दोहराएँ"],
  queVasAPedir:["¿Qué vas a pedir?","What would you like?","O que você vai pedir?","Que souhaitez-vous commander ?","您想点什么？","आप क्या ऑर्डर करेंगे?"],
  escribeSugerimos:["Escribe y te sugerimos. Ej:","Type and we’ll suggest. E.g.:","Escreva e sugerimos. Ex.:","Écrivez, on vous suggère. Ex. :","输入即可获得建议。例如：","लिखें, हम सुझाव देंगे। जैसे:"],
  ejemploPedido:["2 águilas","2 beers","2 cervejas","2 bières","2瓶啤酒","2 बीयर"],
  ejemploPedidoPlaceholder:["Ej: 2 águilas","E.g. 2 beers","Ex.: 2 cervejas","Ex. : 2 bières","例如：2瓶啤酒","जैसे: 2 बीयर"],
  addAria:["Agregar al pedido","Add to order","Adicionar ao pedido","Ajouter à la commande","添加到订单","ऑर्डर में जोड़ें"],
  tituloMenu:["🍽️ Menú","🍽️ Menu","🍽️ Cardápio","🍽️ Menu","🍽️ 菜单","🍽️ मेन्यू"],
  tituloCarta:["📖 Carta","📖 Menu","📖 Cardápio","📖 Carte","📖 菜单","📖 मेन्यू"],
  verMenu:["Ver el menú","View the menu","Ver o cardápio","Voir le menu","查看菜单","मेन्यू देखें"],
  verCarta:["Ver la carta","View the menu","Ver a carta","Voir la carte","查看菜单","मेन्यू देखें"],
  catAunNoDisp:["Aún no disponible","Not available yet","Ainda não disponível","Pas encore disponible","暂未提供","अभी उपलब्ध नहीं"],
  catCount:["{n} productos · toca para ver y agregar","{n} items · tap to view and add","{n} produtos · toque para ver e adicionar","{n} produits · touchez pour voir et ajouter","{n} 件商品 · 点击查看并添加","{n} उत्पाद · देखने और जोड़ने के लिए टैप करें"],
  cerrar:["Cerrar","Close","Fechar","Fermer","关闭","बंद करें"],
  volverPedido:["Volver a mi pedido","Back to my order","Voltar ao meu pedido","Retour à ma commande","返回我的订单","मेरे ऑर्डर पर वापस"],
  buscarMenu:["Buscar en el menú…","Search the menu…","Buscar no cardápio…","Rechercher dans le menu…","搜索菜单…","मेन्यू में खोजें…"],
  buscarCarta:["Buscar en la carta…","Search the menu…","Buscar na carta…","Rechercher dans la carte…","搜索菜单…","मेन्यू में खोजें…"],
  sinCoincidencias:["Nada coincide con «{q}».","Nothing matches “{q}”.","Nada corresponde a “{q}”.","Rien ne correspond à « {q} ».","没有与“{q}”匹配的内容。","“{q}” से कुछ मेल नहीं खाता।"],
  sinPublicarCarta:["El local todavía no publicó su carta. Escribe en tu pedido lo que quieres.","The place hasn’t published its menu yet. Write what you want in your order.","O local ainda não publicou a carta. Escreva no seu pedido o que você quer.","L’établissement n’a pas encore publié sa carte. Écrivez ce que vous voulez dans votre commande.","商家还未发布菜单。请在订单中写下您想要的内容。","दुकान ने अभी अपना मेन्यू प्रकाशित नहीं किया। अपने ऑर्डर में लिखें कि आप क्या चाहते हैं।"],
  sinPublicarMenu:["El local todavía no publicó su menú. Escribe en tu pedido lo que quieres.","The place hasn’t published its menu yet. Write what you want in your order.","O local ainda não publicou o cardápio. Escreva no seu pedido o que você quer.","L’établissement n’a pas encore publié son menu. Écrivez ce que vous voulez dans votre commande.","商家还未发布菜单。请在订单中写下您想要的内容。","दुकान ने अभी अपना मेन्यू प्रकाशित नहीं किया। अपने ऑर्डर में लिखें कि आप क्या चाहते हैं।"],
  agotado:["Agotado","Sold out","Esgotado","Épuisé","已售罄","खत्म"],
  ultimasUnidades:["Últimas unidades","Few left","Últimas unidades","Dernières unités","仅剩少量","सीमित स्टॉक"],
  promoTitulo:["🎁 Promociones","🎁 Promotions","🎁 Promoções","🎁 Promotions","🎁 促销","🎁 प्रमोशन"],
  promoAhorra:["🎁 Ahorra {n}%","🎁 Save {n}%","🎁 Economize {n}%","🎁 Économisez {n}%","🎁 省{n}%","🎁 {n}% बचाएं"],
  enviarPedido:["Enviar pedido","Send order","Enviar pedido","Envoyer la commande","提交订单","ऑर्डर भेजें"],
  producto:["producto","item","produto","produit","件","उत्पाद"],
  productos:["productos","items","produtos","produits","件","उत्पाद"],
  pedirCuenta:["Pedir la cuenta","Ask for the bill","Pedir a conta","Demander l’addition","请求账单","बिल माँगें"],
  pedirCancion:["Pedir canción","Request song","Pedir música","Demander une chanson","点歌","गाना माँगें"],
  modoFacil:["Letra grande","Large text","Letra grande","Grand texte","大字体","बड़ा टेक्स्ट"],
  qrIncompleto:["Este QR está incompleto.","This QR is incomplete.","Este QR está incompleto.","Ce QR est incomplet.","此二维码不完整。","यह QR अधूरा है।"],
  escribeAlgo:["Escribe algo primero.","Write something first.","Escreva algo primeiro.","Écrivez quelque chose d’abord.","请先输入内容。","पहले कुछ लिखें।"],
  cancionLimiteMesa:["Esta mesa ya pidió {max} canciones. Podrán pedir otra en {min} min.","This table has already requested {max} songs. You can request another in {min} min.","Esta mesa já pediu {max} músicas. Poderão pedir outra em {min} min.","Cette table a déjà demandé {max} chansons. Vous pourrez en redemander une dans {min} min.","本桌已点了{max}首歌。{min}分钟后可再点一首。","इस टेबल ने पहले ही {max} गाने माँगे हैं। {min} मिनट में और माँग सकते हैं।"],
  cancionLimite:["Ya pediste {max} canciones. Podrás pedir otra en {min} min.","You’ve already requested {max} songs. You can request another in {min} min.","Você já pediu {max} músicas. Poderá pedir outra em {min} min.","Vous avez déjà demandé {max} chansons. Vous pourrez en redemander une dans {min} min.","您已点了{max}首歌。{min}分钟后可再点一首。","आपने पहले ही {max} गाने माँगे हैं। {min} मिनट में और माँग सकते हैं।"],
  pedidoLargo:["Tu pedido es muy largo. Envíalo en dos rondas.","Your order is too long. Send it in two rounds.","Seu pedido é muito longo. Envie em duas rodadas.","Votre commande est trop longue. Envoyez-la en deux fois.","您的订单太长，请分两次发送。","आपका ऑर्डर बहुत लंबा है। इसे दो राउंड में भेजें।"],
  ytMuchas:["Hay muchas búsquedas en este momento. Espera un minuto y vuelve a buscar.","Too many searches right now. Wait a minute and search again.","Muitas buscas agora. Espere um minuto e busque de novo.","Trop de recherches en ce moment. Attendez une minute et réessayez.","当前搜索太多，请等一分钟再搜索。","अभी बहुत सारी खोजें हो रही हैं। एक मिनट रुककर फिर खोजें।"],
  musicaApagada:["El local tiene la música apagada en este momento: tu canción no se puso.","Music is turned off right now: your song was not added.","A música está desligada agora: sua música não foi colocada.","La musique est coupée en ce moment : votre chanson n’a pas été ajoutée.","商家现在关闭了音乐，您的歌曲未加入。","अभी संगीत बंद है: आपका गाना नहीं जोड़ा गया।"],
  cancionRepetida:["Esa canción ya está en la cola: no se pidió otra vez.","That song is already in the queue.","Essa música já está na fila.","Cette chanson est déjà dans la file.","这首歌已在队列中。","यह गाना पहले से कतार में है।"],
  cancionVieja:["Tu canción llegó muy tarde al local (sin conexión mucho rato) y no se puso. Pídela otra vez si todavía la quieres.","Your song reached the place too late (offline for a long time) and was not added. Request it again if you still want it.","Sua música chegou tarde demais e não foi colocada. Peça de novo se ainda quiser.","Votre chanson est arrivée trop tard et n’a pas été ajoutée. Redemandez-la si vous la voulez encore.","您的歌曲太晚才送达，未加入。如仍想听请再点一次。","आपका गाना बहुत देर से पहुँचा और नहीं जोड़ा गया। चाहें तो फिर से माँगें।"],
  cancionNoMesa:["Esa mesa no está en el local: pídele al mesero el QR de tu mesa.","That table isn’t set up at this place: ask the waiter for your table’s QR.","Essa mesa não existe no local: peça ao garçom o QR da sua mesa.","Cette table n’existe pas ici : demandez au serveur le QR de votre table.","本店没有这张桌号，请向服务员索取您桌的二维码。","यह टेबल यहाँ नहीं है: वेटर से अपनी टेबल का QR माँगें।"],
  pagarTransfer:["💸 Paga por transferencia","💸 Pay by bank transfer","💸 Pague por transferência","💸 Payez par virement","💸 转账支付","💸 ट्रांसफ़र से भुगतान करें"],
  llaveBreb:["🔑 Llave Bre-B · desde cualquier banco","🔑 Bre-B key · from any bank","🔑 Chave Bre-B · de qualquer banco","🔑 Clé Bre-B · depuis n’importe quelle banque","🔑 Bre-B 密钥 · 任何银行均可","🔑 Bre-B की · किसी भी बैंक से"],
  transferInstr:["Desde la app de tu banco o Nequi, transfiere el valor exacto a la llave o al número. Luego toca «Ya pagué por transferencia» y el local lo revisa.","From your bank or Nequi app, transfer the exact amount to the key or number. Then tap «I paid by transfer» and the staff will check it.","Pelo app do seu banco ou Nequi, transfira o valor exato para a chave ou o número. Depois toque em «Já paguei por transferência».","Depuis l’app de votre banque ou Nequi, virez le montant exact vers la clé ou le numéro. Puis touchez «J’ai payé par virement».","在您的银行或 Nequi 应用中，向密钥或号码转账准确金额，然后点击「我已转账」。","अपने बैंक या Nequi ऐप से सही राशि की या नंबर पर भेजें। फिर «ट्रांसफ़र से भुगतान कर दिया» दबाएँ।"],
  copiar:["📋 Copiar","📋 Copy","📋 Copiar","📋 Copier","📋 复制","📋 कॉपी"],
  yaPagueTransfer:["✅ Ya pagué por transferencia","✅ I paid by transfer","✅ Já paguei por transferência","✅ J’ai payé par virement","✅ 我已转账","✅ ट्रांसफ़र से भुगतान कर दिया"],
  avisoTransfer:["✅ Le avisamos al local: van a revisar tu transferencia.","✅ We told the staff: they will check your transfer.","✅ Avisamos o local: vão conferir sua transferência.","✅ Nous avons prévenu l’établissement : il va vérifier votre virement.","✅ 已通知商家，他们会核对您的转账。","✅ दुकान को बता दिया: वे आपका ट्रांसफ़र जाँचेंगे।"],
  eligeVersion:["🎵 Toca «▶ Pedir» en la canción correcta. Si no está, vuelve a tocar «Pedir canción» y se manda como la escribiste.","🎵 Tap «▶ Request» on the right song. If it isn’t there, tap «Request song» again to send it as you typed it.","🎵 Toque «▶ Pedir» na música certa. Se não estiver, toque de novo em «Pedir música» e ela vai como você escreveu.","🎵 Touchez «▶ Demander» sur la bonne chanson. Sinon, touchez à nouveau «Demander» pour l’envoyer telle quelle.","🎵 请点击正确歌曲的「▶ 点歌」。如果没有，再点一次「点歌」按原样发送。","🎵 सही गाने पर «▶ माँगें» दबाएँ। न मिले तो «गाना माँगें» फिर दबाएँ, जैसा लिखा वैसा भेज दिया जाएगा।"],
  enviadoOk:["✅ Enviado, ya lo recibió el local.","✅ Sent, the place received it.","✅ Enviado, o local já recebeu.","✅ Envoyé, l’établissement l’a reçu.","✅ 已发送，商家已收到。","✅ भेजा गया, दुकान को मिल गया।"],
  cancionesLlevas:[" Llevas {u} de {max} canciones."," You’ve used {u} of {max} songs."," Você já pediu {u} de {max} músicas."," Vous avez utilisé {u} chansons sur {max}."," 您已点{u}/{max}首歌。"," आपने {max} में से {u} गाने माँगे हैं।"],
  noEnviadoWa:["No se pudo enviar. Usa el botón de WhatsApp.","Couldn’t send. Use the WhatsApp button.","Não foi possível enviar. Use o botão do WhatsApp.","Échec de l’envoi. Utilisez le bouton WhatsApp.","发送失败，请使用WhatsApp按钮。","भेजा नहीं जा सका। WhatsApp बटन का उपयोग करें।"],
  pedGuardado:["⏳ Aún no se pudo enviar. Tu pedido quedó guardado y se reintenta solo cada pocos segundos: no lo vuelvas a enviar.","⏳ Not sent yet. Your order is saved and retries by itself every few seconds: no need to send it again.","⏳ Ainda não enviado. Seu pedido foi salvo e é reenviado sozinho a cada poucos segundos: não envie de novo.","⏳ Pas encore envoyée. Votre commande est enregistrée et se renvoie seule toutes les quelques secondes : inutile de la renvoyer.","⏳ 尚未发送。订单已保存，几秒后会自动重试，无需再次发送。","⏳ अभी भेजा नहीं गया। आपका ऑर्डर सेव है और कुछ सेकंड में अपने-आप दोबारा भेजा जाएगा।"],
  pedEsperando:["Enviado. Esperando que el local lo confirme…","Sent. Waiting for the place to confirm…","Enviado. Aguardando a confirmação do local…","Envoyé. En attente de confirmation…","已发送，等待商家确认…","भेजा गया। दुकान की पुष्टि का इंतज़ार…"],
  pedSinConfirmar:["El local todavía no confirma tu pedido. Si tarda, avísale al mesero.","The place hasn’t confirmed yet. If it takes long, tell the waiter.","O local ainda não confirmou. Se demorar, avise o garçom.","Pas encore confirmé. Si cela tarde, prévenez le serveur.","商家尚未确认，如久未确认请告知服务员。","दुकान ने अभी पुष्टि नहीं की। देर हो तो वेटर को बताएँ।"],
  tusPedidos:["Tus pedidos","Your orders","Seus pedidos","Vos commandes","您的订单","आपके ऑर्डर"],
  noEnviadoMesero:["No se pudo enviar. Avísale al mesero.","Couldn’t send. Let the waiter know.","Não foi possível enviar. Avise o garçom.","Échec de l’envoi. Prévenez le serveur.","发送失败，请告知服务员。","भेजा नहीं जा सका। वेटर को बताएँ।"],
  rondaCargada:["Ronda cargada. Revisa y toca «Enviar pedido».","Round loaded. Check it and tap “Send order”.","Rodada carregada. Confira e toque em “Enviar pedido”.","Tournée chargée. Vérifiez et touchez « Envoyer la commande ».","已加载上一轮，请检查后点击“提交订单”。","राउंड लोड हुआ। जाँचें और «ऑर्डर भेजें» दबाएँ।"],
  waTxt:["¿No llegó? Enviar por WhatsApp","Didn’t arrive? Send via WhatsApp","Não chegou? Enviar por WhatsApp","Pas reçu ? Envoyer par WhatsApp","没收到？通过WhatsApp发送","नहीं पहुँचा? WhatsApp से भेजें"],
  tuPedido:["Tu pedido","Your order","Seu pedido","Votre commande","您的订单","आपका ऑर्डर"],
  vacioLineas:["Todavía no has agregado nada. Escribe arriba o toca una sugerencia.","Nothing added yet. Type above or tap a suggestion.","Você ainda não adicionou nada. Escreva acima ou toque numa sugestão.","Rien d’ajouté. Écrivez ci-dessus ou touchez une suggestion.","还没有添加任何内容。请在上方输入或点选建议。","अभी कुछ नहीं जोड़ा। ऊपर लिखें या सुझाव पर टैप करें।"],
  quitarUno:["Quitar uno de {n}","Remove one {n}","Remover um de {n}","Retirer un de {n}","移除一份{n}","{n} में से एक हटाएँ"],
  agregarUnoMas:["Agregar uno más de {n}","Add one more {n}","Adicionar mais um de {n}","Ajouter un {n} de plus","再添加一份{n}","{n} में से एक और जोड़ें"],
  quitarProducto:["Quitar {n}","Remove {n}","Remover {n}","Retirer {n}","移除{n}","{n} हटाएँ"],
  pedirEsta:["▶ Pedir","▶ Request","▶ Pedir","▶ Demander","▶ 点歌","▶ माँगें"],
  pedida:["✅ Pedida","✅ Requested","✅ Pedida","✅ Demandée","✅ 已点","✅ माँगा"],
  generosT:["¿No sabes qué pedir? Toca un género:","Not sure? Tap a genre:","Não sabe o que pedir? Toque um gênero:","Pas d’idée ? Touchez un genre :","不知道点什么？点一个类型：","क्या माँगें? एक शैली चुनें:"],
  pideCancion:["Pide tu canción","Request your song","Peça sua música","Demandez votre chanson","点一首歌","अपना गाना चुनें"],
  hintCancion:["Escribe artista y canción; así suena más rápido. Puedes pedir hasta 10; cada cupo se libera a los 15 minutos. Suenan por turnos entre todas las mesas.","Type the artist and song; it plays faster that way. You can request up to 10; each slot frees up after 15 minutes. Songs play in turns between all tables.","Escreva o artista e a música; assim toca mais rápido. Você pode pedir até 10; cada vaga libera após 15 minutos. Tocam por turnos entre todas as mesas.","Écrivez l’artiste et la chanson ; elle passera plus vite. Vous pouvez en demander jusqu’à 10 ; chaque créneau se libère après 15 minutes. Elles passent à tour de rôle entre toutes les tables.","请输入艺人和歌曲名，这样播放更快。最多可点10首；每个名额15分钟后释放。各桌轮流播放。","कलाकार और गाना लिखें; इससे जल्दी बजेगा। आप 10 तक माँग सकते हैं; हर स्लॉट 15 मिनट बाद खाली होता है। सभी मेज़ों के बीच बारी-बारी बजते हैं।"],
  ejemploCancion:["Ej: Bad Bunny - Titi Me Preguntó","E.g. Bad Bunny - Titi Me Preguntó","Ex.: Bad Bunny - Titi Me Preguntó","Ex. : Bad Bunny - Titi Me Preguntó","例如：Bad Bunny - Titi Me Preguntó","जैसे: Bad Bunny - Titi Me Preguntó"],
  cancionesLibre:["🎵 Pide las canciones que quieras: suenan por turnos entre las mesas.","🎵 Request as many songs as you like: tables take turns.","🎵 Peça as músicas que quiser: as mesas tocam por turnos.","🎵 Demandez autant de chansons que vous voulez : les tables passent à tour de rôle.","🎵 想点多少首都可以：各桌轮流播放。","🎵 जितने चाहें गाने माँगें: टेबलें बारी-बारी से बजती हैं।"],
  cancionesEstado:["Llevas {u} de {max} canciones. Cada cupo se libera a los 15 minutos.","You’ve used {u} of {max} songs. Each slot frees up after 15 minutes.","Você já pediu {u} de {max} músicas. Cada vaga libera após 15 minutos.","Vous avez utilisé {u} chansons sur {max}. Chaque créneau se libère après 15 minutes.","您已点{u}/{max}首歌。每个名额15分钟后释放。","आपने {max} में से {u} गाने माँगे हैं। हर स्लॉट 15 मिनट बाद खाली होता है।"],
  tuCuenta:["Tu cuenta","Your bill","Sua conta","Votre addition","您的账单","आपका बिल"],
  cargandoCuenta:["Cargando tu cuenta…","Loading your bill…","Carregando sua conta…","Chargement de l’addition…","正在加载账单…","आपका बिल लोड हो रहा है…"],
  hintCuenta:["¿Ya quieres pagar? Pide la cuenta y te la llevamos a la mesa.","Ready to pay? Ask for the bill and we’ll bring it to your table.","Já quer pagar? Peça a conta e levamos até a sua mesa.","Prêt à payer ? Demandez l’addition, on l’apporte à votre table.","想结账吗？请求账单，我们送到您的桌上。","भुगतान करना चाहते हैं? बिल माँगें, हम मेज़ पर ले आएँगे।"],
  notaPlaceholder:["Nota opcional (ej. pago con tarjeta)","Optional note (e.g. paying by card)","Nota opcional (ex.: pagamento no cartão)","Note facultative (ex. paiement par carte)","备注（可选，例如：刷卡支付）","वैकल्पिक नोट (जैसे: कार्ड से भुगतान)"],
  cuentaSinConsumo:["Tu mesa no tiene consumo todavía.","Your table has no orders yet.","Sua mesa ainda não tem consumo.","Votre table n’a encore rien consommé.","您的桌子还没有消费记录。","आपकी मेज़ पर अभी कोई खपत नहीं है।"],
  cuentaSinVivo:["Este QR no muestra la cuenta en vivo. Toca «Pedir la cuenta».","This QR doesn’t show the live bill. Tap “Ask for the bill”.","Este QR não mostra a conta ao vivo. Toque em “Pedir a conta”.","Ce QR n’affiche pas l’addition en direct. Touchez « Demander l’addition ».","此二维码不显示实时账单。请点击“请求账单”。","यह QR लाइव बिल नहीं दिखाता। «बिल माँगें» दबाएँ।"],
  consumo:["Consumo","Ordered","Consumo","Consommation","消费","खपत"],
  pagado:["Pagado","Paid","Pago","Payé","已付","भुगतान हुआ"],
  porPagar:["Por pagar","To pay","A pagar","À payer","待付","बकाया"],
  pagarNequi:["💜 Paga con Nequi","💜 Pay with Nequi","💜 Pague com Nequi","💜 Payez avec Nequi","💜 用 Nequi 支付","💜 Nequi से भुगतान करें"],
  aNombreDe:["A nombre de","Account holder","Em nome de","Au nom de","户名","खाता धारक"],
  nequiInstr:["Abre tu app Nequi → Enviar → pega este número → escribe el valor exacto → envía.","Open your Nequi app → Send → paste this number → enter the exact amount → send.","Abra o app Nequi → Enviar → cole este número → digite o valor exato → envie.","Ouvrez l’appli Nequi → Envoyer → collez ce numéro → indiquez le montant exact → envoyez.","打开你的 Nequi 应用 → 发送 → 粘贴此号码 → 输入准确金额 → 发送。","अपना Nequi ऐप खोलें → भेजें → यह नंबर पेस्ट करें → सही राशि लिखें → भेजें।"],
  copiarNumero:["📋 Copiar número","📋 Copy number","📋 Copiar número","📋 Copier le numéro","📋 复制号码","📋 नंबर कॉपी करें"],
  numeroCopiado:["📋 Número copiado","📋 Number copied","📋 Número copiado","📋 Numéro copié","📋 号码已复制","📋 नंबर कॉपी हुआ"],
  pagaQR:["📱 Paga con QR","📱 Pay with QR","📱 Pague com QR","📱 Payez par QR","📱 扫码支付","📱 QR से भुगतान करें"],
  pagaQRInstr:["Guarda o comparte el QR, abre tu app (Nequi, Bancolombia, Daviplata…) → «Pagar con QR» y elige la imagen de tu galería. Luego toca «Ya pagué».","Save or share the QR, open your bank app → “Pay with QR” and pick the image from your gallery. Then tap “I already paid”.","Salve ou compartilhe o QR, abra o app do banco → «Pagar com QR» e escolha a imagem da galeria. Depois toque «Já paguei».","Enregistrez ou partagez le QR, ouvrez votre app bancaire → « Payer par QR » et choisissez l’image. Puis touchez « J’ai payé ».","保存或分享二维码，打开银行应用→“扫码支付”，从相册选择图片。然后点“我已付款”。","QR सेव या शेयर करें, बैंक ऐप खोलें → “QR से भुगतान” और गैलरी से फोटो चुनें। फिर “भुगतान कर दिया” दबाएँ।"],
  guardarQR:["📤 Guardar / compartir QR","📤 Save / share QR","📤 Salvar / compartilhar QR","📤 Enregistrer / partager le QR","📤 保存 / 分享二维码","📤 QR सेव / शेयर करें"],
  yaPague:["✅ Ya pagué","✅ I already paid","✅ Já paguei","✅ J’ai payé","✅ 我已付款","✅ भुगतान कर दिया"],
  yaPagueNequi:["✅ Ya pagué por Nequi","✅ I already paid with Nequi","✅ Já paguei pelo Nequi","✅ J’ai déjà payé avec Nequi","✅ 我已用 Nequi 付款","✅ मैंने Nequi से भुगतान कर दिया"],
  avisoNequiEnviado:["✅ Le avisamos a la mesa que pagaste por Nequi.","✅ We told the staff you paid with Nequi.","✅ Avisamos à equipe que você pagou pelo Nequi.","✅ Nous avons prévenu l’équipe que vous avez payé avec Nequi.","✅ 已通知店员你用 Nequi 付款了。","✅ हमने स्टाफ़ को बता दिया कि आपने Nequi से भुगतान किया।"],
  actualizado:["Actualizado {hora}","Updated {hora}","Atualizado {hora}","Mis à jour à {hora}","更新于{hora}","अपडेट किया गया {hora}"],
  pedisteAntes:["Pediste antes","Ordered before","Pedido antes","Déjà commandé","您之前点过","पहले ऑर्डर किया"],
  yaEnTuMesa:["Ya en tu mesa","Already at your table","Já na sua mesa","Déjà à votre table","已在您桌上","पहले से आपकी मेज़ पर"],
  deLaCarta:["De la carta","From the menu","Da carta","De la carte","菜单中","मेन्यू से"],
  delMenu:["Del menú","From the menu","Do cardápio","Du menu","菜单中","मेन्यू से"],
  agregarTalComoLoEscribiste:["Agregar “{q}” tal como lo escribiste","Add “{q}” as you typed it","Adicionar “{q}” como você digitou","Ajouter « {q} » tel quel","按输入添加“{q}”","“{q}” को वैसे ही जोड़ें जैसे आपने लिखा"],
  haceUnMomento:["hace un momento","just now","agora mesmo","à l’instant","刚刚","अभी अभी"],
  haceMin:["hace {m} min","{m} min ago","há {m} min","il y a {m} min","{m}分钟前","{m} मिनट पहले"],
  haceHoras:["hace {h} h","{h} h ago","há {h} h","il y a {h} h","{h}小时前","{h} घंटे पहले"],
  monedaLabel:["Moneda","Currency","Moeda","Devise","货币","मुद्रा"],
  tasaNota:["Conversión referencial. El cobro es en pesos colombianos (COP).","Reference conversion only. Charges are in Colombian pesos (COP).","Conversão apenas referencial. A cobrança é em pesos colombianos (COP).","Conversion indicative uniquement. Le paiement se fait en pesos colombiens (COP).","仅供参考的换算。实际收费以哥伦比亚比索（COP）计。","यह केवल संदर्भ हेतु रूपांतरण है। भुगतान कोलंबियाई पेसो (COP) में होगा।"],
  abiertoAhora:["Abierto ahora","Open now","Aberto agora","Ouvert maintenant","营业中","अभी खुला है"],
  cerradoAhora:["Cerrado ahora","Closed now","Fechado agora","Fermé maintenant","已打烊","अभी बंद है"]
};
const DICT={};
Object.keys(DICT_SRC).forEach(k=>{DICT[k]={};LANGS.forEach((l,i)=>{DICT[k][l]=DICT_SRC[k][i];});});
const LANG_KEY='pm-lang';
let LANG=(()=>{ try{ const s=localStorage.getItem(LANG_KEY); if(s) return s; const l=(navigator.language||'es').slice(0,2).toLowerCase(); return LANGS.includes(l)?l:'es'; }catch(e){ return 'es'; } })();
function t(key,vars){
  let s=(DICT[key]&&(DICT[key][LANG]!=null?DICT[key][LANG]:DICT[key].es))||key;
  if(vars) Object.keys(vars).forEach(k=>{ s=s.split('{'+k+'}').join(vars[k]); });
  return s;
}

/* ---------- Modo fácil: letra/botones grandes, sin animaciones ---------- */
const EASY_KEY='pm-easy';
let EASY=(()=>{ try{ return localStorage.getItem(EASY_KEY)==='1'; }catch(e){ return false; } })();
function applyEasyMode(){
  document.body.classList.toggle('easy-mode',EASY);
  const b=$('easyBtn');
  if(!b) return;
  b.setAttribute('aria-pressed',String(EASY));
  b.textContent=(EASY?'✅ ':'🔎 ')+t('modoFacil');
}
function setEasyMode(on){
  EASY=on; try{ localStorage.setItem(EASY_KEY,on?'1':'0'); }catch(e){}
  applyEasyMode();
}

/* ---------- Monedas ---------- */
const CUR_KEY='pm-cur',RATES_KEY='pm-rates';
const CUR_META={
  COP:{sym:'$',dec:0,locale:'es-CO'}, USD:{sym:'US$',dec:2,locale:'en-US'}, EUR:{sym:'€',dec:2,locale:'de-DE'},
  MXN:{sym:'MX$',dec:2,locale:'es-MX'}, BRL:{sym:'R$',dec:2,locale:'pt-BR'}, GBP:{sym:'£',dec:2,locale:'en-GB'},
  ARS:{sym:'AR$',dec:2,locale:'es-AR'}, PEN:{sym:'S/',dec:2,locale:'es-PE'}, CLP:{sym:'CL$',dec:0,locale:'es-CL'}
};
const RATES_FALLBACK={COP:1,USD:.000316,EUR:.000275,MXN:.005421,BRL:.00162,GBP:.000236,ARS:.477739,PEN:.001068,CLP:.30322};
let CUR=(()=>{ try{ return localStorage.getItem(CUR_KEY)||'COP'; }catch(e){ return 'COP'; } })();
let RATES=(()=>{ try{ const c=JSON.parse(localStorage.getItem(RATES_KEY)||'null'); if(c&&c.t&&Date.now()-c.t<12*36e5&&c.r) return c.r; }catch(e){} return Object.assign({},RATES_FALLBACK); })();
async function actualizarTasas(){
  try{
    const ctrl=new AbortController(),tmo=setTimeout(()=>ctrl.abort(),6000);
    const r=await fetch('https://open.er-api.com/v6/latest/COP',{signal:ctrl.signal});
    clearTimeout(tmo);
    const j=await r.json();
    if(j&&j.result==='success'&&j.rates){
      RATES=Object.assign({},j.rates,{COP:1});
      try{localStorage.setItem(RATES_KEY,JSON.stringify({t:Date.now(),r:RATES}))}catch(e){}
      if(CUR!=='COP') refrescarVista();
    }
  }catch(e){ /* seguimos con la tasa guardada o la aproximada */ }
}
function fmCop(n){ return '$'+Math.round(n).toLocaleString('es-CO'); }
function fm(n){
  if(CUR==='COP'||!RATES[CUR]) return fmCop(n);
  const meta=CUR_META[CUR]||CUR_META.COP,val=n*RATES[CUR];
  return meta.sym+val.toLocaleString(meta.locale,{minimumFractionDigits:meta.dec,maximumFractionDigits:meta.dec})+' (≈ '+fmCop(n)+')';
}
function updateCurNote(){
  const e=$('curNote');
  if(CUR==='COP'){ e.hidden=true; return; }
  e.hidden=false; e.textContent=t('tasaNota');
}

function msg(txt,cl){ $('m').textContent=txt; $('m').className=cl||''; }
let lastMsg=null;
function setMsg(builder,cl){ lastMsg={builder,cl}; msg(builder(),cl); }
function clearMsg(){ lastMsg=null; msg('',''); }

$('t').textContent=dom?t('domLabel'):t('mesaLabel',{n:mesa||'?'});
document.title=dom?t('domLabel'):t('mesaLabel',{n:mesa||'?'});

/* ---------- Texto predictivo ---------- */
const NUM={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12};
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
const sing=s=>s.length>3?s.replace(/s$/,''):s;
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

/* Productos que ya conocemos de esta mesa: los que están en su cuenta y los que pidió antes desde este celular */
function candidatos(){
  const m=new Map();
  if(snap&&Array.isArray(snap.i))snap.i.forEach(x=>{const n=String(x[0]).slice(0,60),k=norm(n);if(k&&!m.has(k))m.set(k,{n:n,k:k,src:'mesa',c:+x[1]||0})});
  const hs=jget(KH,{});
  Object.keys(hs).forEach(k=>{if(!m.has(k))m.set(k,{n:hs[k].n,k:k,src:'antes',c:hs[k].c||0})});
  if(cat&&Array.isArray(cat.p))cat.p.forEach(x=>{const k=norm(x[0]);if(k&&x[3]!==2&&!m.has(k))m.set(k,{n:String(x[0]).slice(0,60),k:k,src:'cat',c:0})});
  return Array.from(m.values());
}
function puntaje(nk,qk){
  const qs=sing(qk),ts=qs!==qk?[qk,qs]:[qk];
  let best={s:0,len:0};
  ts.forEach(term=>{
    let s=0;
    if(nk.startsWith(term))s=3;
    else if(nk.split(' ').some(w=>w.startsWith(term)))s=2;
    else if(term.length>=3&&nk.includes(term))s=1;
    if(s>best.s)best={s:s,len:term.length};
  });
  return best;
}
function sugerencias(rest){
  const qk=norm(rest);if(!qk)return[];
  const out=[];
  candidatos().forEach(x=>{const r=puntaje(x.k,qk);if(r.s)out.push(Object.assign({},x,{score:r.s,len:r.s==3?r.len:0}))});
  out.sort((a,b)=>b.score-a.score||(a.src=='mesa'?0:1)-(b.src=='mesa'?0:1)||b.c-a.c||a.n.length-b.n.length);
  return out.slice(0,5);
}
/* "2 águilas", "2x águila", "dos águilas" → cantidad + producto */
function interpretar(txt){
  txt=String(txt).trim();
  let cant=1,rest=txt,m;
  if((m=/^(\d{1,2})(?:\s*[x×]\s*|\s+)(.+)$/i.exec(txt))){cant=+m[1];rest=m[2]}
  else if((m=/^(\d{1,2})$/.exec(txt))){cant=+m[1];rest=''}
  else if((m=/^(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(.+)$/i.exec(txt))){
    const nk=norm(txt);
    if(!candidatos().some(x=>x.k.startsWith(nk))){cant=NUM[m[1].toLowerCase()];rest=m[2]}
  }
  return{q:Math.min(Math.max(cant,1),50),rest:rest.trim()};
}
function agregar(cant,nombre){
  const k=norm(nombre);if(!k)return;
  const l=lineas.find(x=>x.k===k);
  if(l)l.q=Math.min(50,l.q+cant);else lineas.push({k:k,q:Math.min(50,cant),n:nombre});
  pintarLineas();
}
/* 🧩 1.76.0 · Opciones del producto (término, sin…, adiciones): el negocio las manda en la carta (cat.op). Al pedir ese
   producto se elige cómo lo quiere; la línea queda «Hamburguesa (Término medio · +Queso extra)». El precio de las
   adiciones se muestra aquí, pero el negocio lo vuelve a calcular con SUS opciones al recibir el pedido. */
const escOp=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const OPX={};
const agregarSinOp=agregar;
function opcionesDe(nombre){const o=cat&&cat.op;if(!o)return null;const k=norm(nombre);const key=Object.keys(o).find(x=>norm(x)===k);return key?o[key]:null}
agregar=function(cant,nombre){const G=opcionesDe(nombre);if(!G)return agregarSinOp(cant,nombre);elegirOp(nombre,G,cant)};
function elegirOp(nombre,G,cant){
  let ov=$('opPed');
  if(!ov){ov=document.createElement('div');ov.id='opPed';ov.className='op-ped';document.body.appendChild(ov);}
  const sel=G.map(()=>[]);
  const pesos=n=>'$'+Math.round(n).toLocaleString('es-CO');
  const pintar=()=>{
    let extra=0;G.forEach((g,gi)=>sel[gi].forEach(i=>{extra+=+g[2][i][1]||0}));
    ov.innerHTML='<div class="op-box"><b class="op-t">'+escOp(nombre)+'</b><p class="op-s">¿Cómo lo quiere?'+(cant>1?' ('+cant+')':'')+'</p>'+
      G.map((g,gi)=>'<div class="op-g"><b>'+escOp(g[0])+'</b> <small>'+(g[1]?'(varias)':'(elige una)')+'</small><div>'+g[2].map((o,oi)=>'<button type="button" class="op-o'+(sel[gi].includes(oi)?' on':'')+'" data-g="'+gi+'" data-i="'+oi+'">'+escOp(o[0])+(o[1]?' +'+pesos(o[1]):'')+'</button>').join('')+'</div></div>').join('')+
      '<p class="op-m" id="opPedMsg"></p><div class="op-a"><button type="button" class="op-x">Cancelar</button><button type="button" class="op-ok">Agregar'+(extra?' (+'+pesos(extra)+')':'')+'</button></div></div>';
  };
  pintar();ov.hidden=false;
  ov.onclick=e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.classList.contains('op-x')){ov.hidden=true;return}
    if(b.classList.contains('op-o')){const gi=+b.dataset.g,oi=+b.dataset.i,s=sel[gi];if(G[gi][1]){const k=s.indexOf(oi);if(k>=0)s.splice(k,1);else s.push(oi)}else sel[gi]=s[0]===oi?[]:[oi];pintar();return}
    if(b.classList.contains('op-ok')){
      const f=G.findIndex((g,gi)=>!g[1]&&!sel[gi].length);
      if(f>=0){$('opPedMsg').textContent='⚠️ Elige '+String(G[f][0]).toLowerCase()+'.';return}
      const partes=[];let extra=0;
      G.forEach((g,gi)=>{const els=sel[gi].map(i=>g[2][i]);if(!els.length)return;els.forEach(o=>{extra+=+o[1]||0});const ng=norm(g[0]);
        if(/^sin\b/.test(ng))partes.push('Sin '+els.map(o=>String(o[0]).replace(/^sin\s+/i,'')).join(', '));
        else if(g[1])els.forEach(o=>partes.push('+'+o[0]));else partes.push(g[0]+' '+String(els[0][0]).charAt(0).toLowerCase()+String(els[0][0]).slice(1));});
      const full=nombre+(partes.length?' ('+partes.join(' · ')+')':'');
      OPX[norm(full)]=extra;ov.hidden=true;agregarSinOp(cant,full);
    }
  };
}
const opCss=document.createElement('style');
opCss.textContent='.op-ped{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center}.op-ped[hidden]{display:none}'+
  '.op-box{background:var(--card,#171033);color:var(--ink,#fff);width:min(520px,100%);max-height:88vh;overflow:auto;border-radius:20px 20px 0 0;padding:16px 16px 20px}.op-t{font-size:19px}.op-s{margin:4px 0 8px;opacity:.8}'+
  '.op-g{margin:10px 0}.op-g small{opacity:.7}.op-g div{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.op-o{min-height:44px;padding:8px 14px;border-radius:12px;border:2px solid var(--line,#555);background:transparent;color:inherit;font:inherit;font-weight:700}'+
  '.op-o.on{border-color:var(--acc,#a855f7);background:rgba(168,85,247,.25)}.op-m{color:#f87171;font-weight:700;min-height:18px;margin:6px 0}.op-a{display:flex;gap:8px;justify-content:flex-end}.op-a button{min-height:46px;padding:10px 16px;border-radius:12px;border:0;font:inherit;font-weight:800}.op-ok{background:var(--acc,#a855f7);color:#fff}.op-x{background:transparent;color:inherit;border:1px solid var(--line,#555)!important}';
document.head.appendChild(opCss);
function agregarTexto(txt){
  let n=0;
  String(txt).split(/[,;\n]+/).forEach(pz=>{
    const r=interpretar(pz);if(!r.rest)return;
    const nk=norm(r.rest),s=sugerencias(r.rest)[0];
    const nombre=(s&&(s.k===nk||s.k.startsWith(sing(nk))))?s.n:cap(r.rest.slice(0,60));
    agregar(r.q,nombre);n++;
  });
  return n;
}
function pintarSug(){
  const box=$('sug');box.textContent='';
  const r=interpretar($('p').value);
  if(!r.rest){box.hidden=true;return}
  const lista=sugerencias(r.rest);
  lista.forEach((s,i)=>{
    const b=h('button','row'+(i==0?' top':''));b.type='button';
    const nm=h('span','nm');
    if(s.len>0){nm.appendChild(h('b',null,s.n.slice(0,s.len)));nm.appendChild(document.createTextNode(s.n.slice(s.len)))}
    else nm.textContent=s.n;
    b.appendChild(nm);
    b.appendChild(h('span','tag',s.src=='mesa'?t('yaEnTuMesa'):s.src=='cat'?(catT()==='Menú'?t('delMenu'):t('deLaCarta')):t('pedisteAntes')));
    b.onmousedown=e=>e.preventDefault();
    b.onclick=()=>{agregar(interpretar($('p').value).q,s.n);$('p').value='';pintarSug();$('p').focus()};
    box.appendChild(b);
  });
  if(r.rest.length>=2&&(!lista.length||lista[0].score<3)){
    const f=h('button','row free',t('agregarTalComoLoEscribiste',{q:r.rest}));f.type='button';
    f.onmousedown=e=>e.preventDefault();
    f.onclick=()=>{agregarTexto($('p').value);$('p').value='';pintarSug();$('p').focus()};
    box.appendChild(f);
  }
  box.hidden=!box.children.length;
}
function entrar(){
  const txt=$('p').value;if(!txt.trim())return;
  if(agregarTexto(txt)){$('p').value='';pintarSug()}
}
$('p').addEventListener('input',pintarSug);
$('p').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();entrar()}});
$('add').onclick=()=>{entrar();$('p').focus()};

/* ---------- Texto predictivo para canciones: lo que ya pediste antes desde este celular ---------- */
const KCH='cancHist_'+mesa;
function cancionHist(){ return jget(KCH,{}); }
function aprenderCancion(nombre){
  const k=norm(nombre); if(!k) return;
  const hs=cancionHist(); const e=hs[k];
  hs[k]={n:nombre.slice(0,120),c:(e?e.c:0)+1};
  const o={}; Object.keys(hs).sort((a,b)=>hs[b].c-hs[a].c).slice(0,20).forEach(k2=>o[k2]=hs[k2]);
  jset(KCH,o);
}
function sugerenciasCancion(q){
  const qk=norm(q); if(!qk) return [];
  const hs=cancionHist(),out=[];
  Object.keys(hs).forEach(k=>{ const r=puntaje(k,qk); if(r.s) out.push({n:hs[k].n,k,score:r.s,len:r.s==3?r.len:0,c:hs[k].c}); });
  out.sort((a,b)=>b.score-a.score||b.c-a.c||a.n.length-b.n.length);
  return out.slice(0,5);
}
function pintarSugC(){
  const box=$('sugC'); if(!box) return; box.textContent='';
  const q=$('s').value;
  const lista=sugerenciasCancion(q);
  lista.forEach((s,i)=>{
    const b=h('button','row'+(i==0?' top':''));b.type='button';
    const nm=h('span','nm');
    if(s.len>0){nm.appendChild(h('b',null,s.n.slice(0,s.len)));nm.appendChild(document.createTextNode(s.n.slice(s.len)))}
    else nm.textContent=s.n;
    b.appendChild(nm);
    b.appendChild(h('span','tag',t('pedisteAntes')));
    b.onmousedown=e=>e.preventDefault();
    b.onclick=()=>{$('s').value=s.n;pintarSugC();$('s').focus()};
    box.appendChild(b);
  });
  box.hidden=!box.children.length;
}
$('s').addEventListener('input',pintarSugC);
/* Buscador de canciones con el teclado abierto: el campo sube a la parte visible de la pantalla
   (visualViewport) y las sugerencias se ajustan al espacio que deja el teclado, con su propio scroll.
   Solo mueve la vista: no cambia la búsqueda ni cómo se pide la canción. */
function ajustarSugTeclado(){
  const inp=$('s');if(!inp||document.activeElement!==inp)return;
  const vv=window.visualViewport,H=vv?vv.height:innerHeight,arriba=vv?vv.offsetTop:0;
  const teclado=Math.max(0,innerHeight-H);
  document.body.style.paddingBottom=teclado?(teclado+40)+'px':'';
  const r=inp.getBoundingClientRect();
  const meta=arriba+12;                                   // el campo queda arriba, las sugerencias debajo y visibles
  if(Math.abs(r.top-meta)>24)window.scrollBy({top:r.top-meta,behavior:'auto'});
  const disp=Math.max(150,Math.round(H-(r.height+36)));
  ['sugC','ytPrev'].forEach(id=>{const b=$(id);if(b){b.style.maxHeight=disp+'px';b.style.overflowY='auto';b.style.overscrollBehavior='contain';}});
}
let ajTimer=null;const ajustarLuego=()=>{clearTimeout(ajTimer);ajTimer=setTimeout(ajustarSugTeclado,60)};
$('s').addEventListener('focus',()=>{ajustarLuego();setTimeout(ajustarSugTeclado,350)});
$('s').addEventListener('input',ajustarLuego);
$('s').addEventListener('blur',()=>{setTimeout(()=>{if(document.activeElement!==$('s'))document.body.style.paddingBottom=''},200)});
if(window.visualViewport){visualViewport.addEventListener('resize',ajustarLuego);visualViewport.addEventListener('scroll',()=>{})}
try{const mo=new MutationObserver(ajustarLuego);['sugC','ytPrev'].forEach(id=>{const b=$(id);if(b)mo.observe(b,{childList:true,attributes:true,attributeFilter:['hidden']})});}catch(e){}
$('s').addEventListener('focus',()=>{ if(!$('s').value.trim()){ const box=$('sugC'); if(box){ box.hidden=true; } } });

/* ---------- Vista previa de YouTube: ver la canción antes de pedirla (no la agrega, solo confirma) ----------
   Busca como YouTube Music: si lo que se escribe se parece al nombre de un
   artista, primero aparecen los artistas (la propia búsqueda de YouTube ya
   encuentra nombres parecidos o con errores de tipeo), y al tocar uno se
   arma la lista de sus canciones más populares (por reproducciones reales,
   leyendo su canal). YouTube no da álbum/sencillo por su API pública —eso
   es interno de la app YouTube Music—, así que "lo más pedido del artista"
   es lo más cerca que se puede llegar sin esa información. */
// ORDEVA 2.0: sin clave de YouTube en la página pública. Todo va por el Servidor ORDEVA (vento-ia/yt/…); la API de
// Google con clave queda solo si algún día se configura una restringida a este sitio (YT_KEY), y si no, no se usa.
const YT_KEY='';
/* Búsqueda SIN cupo: el Servidor ORDEVA lee la página pública de resultados de YouTube (vento-ia/yt/buscar). Antes cada
   búsqueda gastaba 200 de las 10.000 unidades diarias de la API (canciones + artistas) y con ~50 búsquedas al día YouTube
   respondía «se alcanzó el límite»: ya no aparecía nada. La API queda solo de respaldo. */
const ytSrv=()=>{try{const n=window.VENTO_NUBE_DEFAULT;return n&&n.url?String(n.url).replace(/\/+$/,'')+'/functions/v1/vento-ia/yt/buscar':''}catch(e){return ''}};
async function ytSrvBuscar(q,tipo){
  const b=ytSrv(); if(!b) return null;
  const ctrl=new AbortController(), tm=setTimeout(()=>ctrl.abort(),7000);
  // 1.51.0: «no hay resultados» también es una respuesta (devuelve la lista vacía). Solo si el servidor NO responde se
  // devuelve null y se usa la API de YouTube de respaldo: cada búsqueda de la API gasta 100 del cupo diario.
  try{ const r=await fetch(b+'?tipo='+tipo+'&q='+encodeURIComponent(q),{signal:ctrl.signal}); if(r.status===429) ytMuchas=Date.now(); if(!r.ok) return r.status===429?429:null; const j=await r.json(); return j&&Array.isArray(j.items)?j:null; }
  catch(e){ return null; } finally{ clearTimeout(tm); }
}
// 1.99.37 («que no haya límites en la búsqueda»): si el servidor dice «muchas búsquedas seguidas» (todo el wifi de un bar
// lleno sale por una sola conexión), se reintenta sola, sin decirle nada al cliente: a los 1,5 s y a los 3 s.
const ytSrvBuscar1=ytSrvBuscar;
ytSrvBuscar=async function(q,tipo){
  for(let n=0;;n++){
    const j=await ytSrvBuscar1(q,tipo);
    if(j!==429) return j;
    if(n>=2) return null;
    await new Promise(r=>setTimeout(r,1500*(n+1)));
  }
};
let ytTimer=null, ytSeq=0, ytSelArtist=null, ytMuchas=0;   // ytMuchas: el servidor dijo «muchas búsquedas» (429), no «no hay nada»
const ytArtistCache={};
function ytPintarMsg(msg){
  const box=$('ytPrev'); if(!box) return;
  box.textContent='';
  box.appendChild(h('div','ytmsg',msg));
  box.hidden=false;
}
function ytUnesc(s){ return String(s||'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"'); }
function ytThumb(sn){ return (sn&&sn.thumbnails&&(sn.thumbnails.default||sn.thumbnails.medium)||{}).url||''; }
/* 🎵 1.95.4: el video que el cliente tocó viaja con la canción (vid). Antes el local buscaba otra vez y podía sonar otra
   versión (un cover o una con letra). Solo se manda si el texto sigue siendo el de ese video. */
let ytElegido=null,pedirAsi='';
const ytVidOk=v=>/^[\w-]{11}$/.test(String(v||''));
function ytSongRow(box,q,title,channelTitle,thumb,vid){
  const b=h('button','ytrow');b.type='button';
  if(thumb){ const im=document.createElement('img'); im.src=thumb; im.alt=''; b.appendChild(im); }
  const info=h('span','ytnm');
  const nm=h('span',null,title||''); nm.style.display='block';
  const ch=h('span','ytch',channelTitle||'');
  info.appendChild(nm); info.appendChild(ch);
  b.appendChild(info);
  b.onmousedown=e=>e.preventDefault();
  b.onclick=()=>{
    $('s').value=ytUnesc(title||q);ytElegido={t:$('s').value.replace(/\s+/g,' ').trim(),v:ytVidOk(vid)?vid:null};
    $('ytPrev').hidden=true;
    if($('sugC'))$('sugC').hidden=true;
    $('s').focus();
  };
  // «▶ Pedir»: la canción se pide con un toque (mismas reglas de siempre: cupo de la mesa, turnos, sin repetir).
  const fila=h('div','ytfila'), pd=h('button','ytpedir',t('pedirEsta'));
  pd.type='button'; pd.setAttribute('aria-label',t('pedirEsta')+': '+ytUnesc(title||q));
  pd.onmousedown=e=>e.preventDefault();
  pd.onclick=async()=>{
    if(pd.disabled)return; pd.disabled=true;
    $('s').value=ytUnesc(title||q);ytElegido={t:$('s').value.replace(/\s+/g,' ').trim(),v:ytVidOk(vid)?vid:null};
    if($('sugC'))$('sugC').hidden=true;
    try{ await $('b').onclick(); }catch(e){}
    if(!$('s').value){ pd.textContent=t('pedida'); pd.classList.add('ok'); setTimeout(()=>{ if($('ytPrev'))$('ytPrev').hidden=true; },900); }
    else pd.disabled=false;     // no se pudo (cupo lleno, sin conexión…): el mensaje ya salió abajo
  };
  fila.appendChild(b); fila.appendChild(pd);
  return fila;
}
function ytPintarCanciones(wrap,q,songs,titulo){
  wrap.textContent='';
  if(titulo) wrap.appendChild(h('div','ytsec',titulo));
  if(!songs.length){ wrap.appendChild(h('div','ytmsg','No encontré canciones.')); return; }
  songs.forEach(s=>wrap.appendChild(ytSongRow(wrap,q,s.title,s.channelTitle,s.thumb,s.vid)));
}
// Canales cuyo nombre coincide o se parece a lo escrito.
async function ytBuscarArtistas(q){
  const sj=await ytSrvBuscar(q,'canal');
  if(sj) return sj.items.filter(it=>it.id&&it.id.channelId).slice(0,6).map(it=>({ id:it.id.channelId, name:((it.snippet&&it.snippet.title)||'').replace(/\s*-\s*Topic$/i,''), thumb:ytThumb(it.snippet) }));
  if(!YT_KEY) return [];
  try{
    const url='https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=6&q='+encodeURIComponent(q)+'&key='+YT_KEY;
    const r=await fetch(url); if(!r.ok) return [];
    const j=await r.json();
    return (j.items||[]).filter(it=>it.id&&it.id.channelId).map(it=>({
      id:it.id.channelId,
      name:((it.snippet&&it.snippet.title)||'').replace(/\s*-\s*Topic$/i,''),
      thumb:ytThumb(it.snippet)
    }));
  }catch(e){ return []; }
}
// Canciones más populares de un artista: se leen los videos de su canal
// (playlist de "subidos", funciona también con los canales "- Topic" que
// YouTube arma solo para la música oficial) y se ordenan por reproducciones
// reales — 3 llamadas baratas en vez de una búsqueda por canal (que con
// canales "- Topic" casi siempre viene vacía).
async function ytCancionesDeArtista(channelId,nombre){
  if(ytArtistCache[channelId]) return ytArtistCache[channelId];
  // Si la API no responde (sin cupo), las canciones del artista salen de la búsqueda sin cupo con su nombre.
  const porNombre=async()=>{ const sj=nombre?await ytSrvBuscar(nombre,'video'):null; return sj?sj.items.filter(it=>it.id&&it.id.videoId).slice(0,8).map(it=>({title:it.snippet.title,channelTitle:it.snippet.channelTitle,thumb:ytThumb(it.snippet),views:0,vid:it.id.videoId})):[]; };
  // Primero por el Servidor ORDEVA (sin el cupo de Google); la API de YouTube (con cupo) solo si el servidor no trae nada.
  const r=await porNombre();
  if(r.length) return ytArtistCache[channelId]=r;
  const r2=await ytCancionesDeArtistaApi(channelId);
  if(r2.length) ytArtistCache[channelId]=r2;
  return r2;
}
async function ytCancionesDeArtistaApi(channelId){
  if(!YT_KEY) return [];
  try{
    const chJ=await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id='+channelId+'&key='+YT_KEY).then(r=>r.json());
    const uploads=chJ.items&&chJ.items[0]&&chJ.items[0].contentDetails&&chJ.items[0].contentDetails.relatedPlaylists&&chJ.items[0].contentDetails.relatedPlaylists.uploads;
    if(!uploads) return [];
    const plJ=await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=25&playlistId='+uploads+'&key='+YT_KEY).then(r=>r.json());
    const ids=(plJ.items||[]).filter(it=>it.snippet&&it.snippet.resourceId&&it.snippet.resourceId.videoId).map(it=>it.snippet.resourceId.videoId).slice(0,50);
    if(!ids.length) return [];
    const vJ=await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id='+ids.join(',')+'&key='+YT_KEY).then(r=>r.json());
    const songs=(vJ.items||[]).map(it=>({
      title:it.snippet.title, channelTitle:it.snippet.channelTitle, thumb:ytThumb(it.snippet), vid:it.id,
      views:+(it.statistics&&it.statistics.viewCount)||0
    })).sort((a,b)=>b.views-a.views).slice(0,8);
    return songs;
  }catch(e){ return []; }
}
async function ytElegirArtista(a,btn,row,songsWrap,q,myId){
  if(ytSeq!==myId) return;
  row.querySelectorAll('.ytartist').forEach(x=>x.classList.remove('sel'));
  btn.classList.add('sel');
  ytSelArtist=a;
  songsWrap.textContent='';
  songsWrap.appendChild(h('div','ytmsg','Buscando lo más pedido de '+a.name+'…'));
  const songs=await ytCancionesDeArtista(a.id,a.name);
  if(ytSeq!==myId||ytSelArtist!==a) return;
  ytPintarCanciones(songsWrap,q,songs,'🔥 Lo más pedido de '+a.name);
}
async function ytBuscar(q,genero){
  const box=$('ytPrev'); if(!box) return;
  const N=genero?8:4;                   // un género: más canciones para escoger (y sin buscar artistas)
  const myId=++ytSeq;
  ytSelArtist=null;
  ytPintarMsg('Buscando en YouTube…');
  let artistas=[], cancionesJson=null;
  try{
    [artistas,cancionesJson]=await Promise.all([
      genero?[]:ytBuscarArtistas(q),
      ytSrvBuscar(q,'video').then(j=>j?{items:j.items.slice(0,N)}:!YT_KEY?null:fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults='+N+'&q='+encodeURIComponent(q)+'&key='+YT_KEY).then(r=>r.ok?r.json():null).catch(()=>null))
    ]);
  }catch(err){}
  if(myId!==ytSeq) return;
  const canciones=((cancionesJson&&cancionesJson.items)||[]).filter(it=>it.id&&it.id.videoId).map(it=>({
    title:it.snippet.title, channelTitle:it.snippet.channelTitle, thumb:ytThumb(it.snippet), vid:it.id.videoId
  }));
  if(!artistas.length&&!canciones.length){ ytPintarMsg(Date.now()-ytMuchas<60000?t('ytMuchas'):'No encontramos nada en YouTube para "'+q+'".'); return; }
  box.textContent='';
  if(artistas.length){
    const row=h('div','ytartists');
    artistas.forEach(a=>{
      const btn=h('button','ytartist'); btn.type='button';
      const im=document.createElement('img'); im.src=a.thumb; im.alt=''; btn.appendChild(im);
      btn.appendChild(h('span',null,a.name));
      btn.onmousedown=e=>e.preventDefault();
      btn.onclick=()=>ytElegirArtista(a,btn,row,songsWrap,q,myId);
      row.appendChild(btn);
    });
    box.appendChild(row);
  }
  const songsWrap=h('div');
  box.appendChild(songsWrap);
  ytPintarCanciones(songsWrap,q,canciones,artistas.length?'🎵 Coincidencias':'🎵 Canciones');
  box.hidden=false;
}
$('s').addEventListener('input',()=>{
  const q=$('s').value.trim();
  clearTimeout(ytTimer);
  if(q.length<3){ if($('ytPrev'))$('ytPrev').hidden=true; return; }
  ytTimer=setTimeout(()=>ytBuscar(q),600);
});
$('s').addEventListener('blur',()=>{ setTimeout(()=>{ if($('ytPrev'))$('ytPrev').hidden=true; },150); });
// Géneros: un toque y salen canciones para pedir (sin escribir). Buscan por el Servidor ORDEVA: sin cupo de YouTube.
const GENEROS=[['🔥','Reguetón','reggaeton exitos'],['💃','Salsa','salsa exitos'],['🪗','Vallenato','vallenato exitos'],['💔','Despecho','musica de despecho'],
  ['🤠','Popular','musica popular colombiana'],['🎤','Pop','pop latino exitos'],['🎸','Rock','rock en español clasicos'],['🎧','Electrónica','musica electronica exitos']];
function pintarGeneros(){
  const box=$('generos'); if(!box) return; box.textContent='';
  box.appendChild(h('div','gtit',t('generosT')));
  GENEROS.forEach(g=>{ const b=h('button','gen',g[0]+' '+g[1]); b.type='button';
    b.onclick=()=>{ box.querySelectorAll('.gen').forEach(x=>x.classList.toggle('on',x===b)); $('s').value=''; clearTimeout(ytTimer); ytBuscar(g[2],true); };
    box.appendChild(b); });
}
pintarGeneros();

/* Fichas: lo que ya hay en la mesa, o lo que se pidió antes desde este celular */
function pintarChips(){
  const box=$('chips');box.textContent='';
  let lista=[],titulo=t('yaEnTuMesa');
  if(snap&&Array.isArray(snap.i)&&snap.i.length){
    lista=snap.i.slice().sort((a,b)=>(+b[1]||0)-(+a[1]||0)).slice(0,6).map(x=>String(x[0]).slice(0,60));
  }else{
    const hs=jget(KH,{});
    lista=Object.keys(hs).sort((a,b)=>hs[b].c-hs[a].c).slice(0,6).map(k=>hs[k].n);
    titulo=t('pedisteAntes');
  }
  $('chipsSec').hidden=!lista.length;$('chipsT').textContent=titulo;
  lista.forEach(n=>{
    const b=h('button','chip');b.type='button';
    b.appendChild(h('span',null,n));b.appendChild(h('b',null,'+'));
    b.onclick=()=>{const r=interpretar($('p').value);agregar(r.rest?1:r.q,n);if(!r.rest){$('p').value='';pintarSug()}};
    box.appendChild(b);
  });
}
function aprender(l){
  const hs=jget(KH,{});
  l.forEach(x=>{const e=hs[x.k];hs[x.k]={n:x.n,c:(e?e.c:0)+1}});
  const o={};
  Object.keys(hs).sort((a,b)=>hs[b].c-hs[a].c).slice(0,30).forEach(k=>o[k]=hs[k]);
  jset(KH,o);
}

/* ---------- Pedido armado ---------- */
function rotulo(){
  const b=$('b');
  let u=0;
  if(modo=='q')b.textContent=t('pedirCuenta');
  else if(modo=='c')b.textContent=t('pedirCancion');
  else{const base=dom?t('domEnviar'):t('enviarPedido');u=lineas.reduce((a,l)=>a+l.q,0);b.textContent=u?base+' · '+u+' '+(u==1?t('producto'):t('productos')):base}
  b.classList.toggle('lista',u>0);
}
/* El botón de enviar va justo debajo del campo de cada pestaña, para que se vea aunque esté el teclado abierto */
function colocarEnvio(){
  const e=$('envio'),ref=modo=='p'?(dom?$('domSec'):$('sug')):modo=='c'?$('sugC'):null;
  if(ref)ref.parentNode.insertBefore(e,ref.nextSibling);else $('vq').appendChild(e);
}
function pintarLineas(){
  const box=$('lines');box.textContent='';
  if(!lineas.length){
    box.appendChild(h('div','vacio',t('vacioLineas')));
  }else{
    const w=h('div','lst');
    lineas.forEach(l=>{
      const r=h('div','ln');
      const nm=h('span','nm',l.n);
      const st=h('div','step');
      const mn=h('button',null,'−');mn.type='button';mn.disabled=l.q<=1;mn.setAttribute('aria-label',t('quitarUno',{n:l.n}));
      mn.onclick=()=>{l.q=Math.max(1,l.q-1);pintarLineas()};
      const o=h('output',null,String(l.q));
      const ms=h('button',null,'+');ms.type='button';ms.setAttribute('aria-label',t('agregarUnoMas',{n:l.n}));
      ms.onclick=()=>{l.q=Math.min(50,l.q+1);pintarLineas()};
      st.appendChild(mn);st.appendChild(o);st.appendChild(ms);
      const x=h('button','x','×');x.type='button';x.setAttribute('aria-label',t('quitarProducto',{n:l.n}));
      x.onclick=()=>{lineas=lineas.filter(y=>y!==l);pintarLineas()};
      r.appendChild(nm);r.appendChild(st);r.appendChild(x);
      w.appendChild(r);
    });
    box.appendChild(w);
  }
  rotulo();
  if(typeof pintarBadgesCat==='function')pintarBadgesCat();
}

/* ---------- Repetir la misma ronda ---------- */
const rondas=()=>jget(KR,[]).filter(r=>r&&Array.isArray(r.l)&&r.l.length&&Date.now()-r.t<VIDA_RONDA);
function hace(ts){
  const m=Math.floor((Date.now()-ts)/6e4);
  return m<1?t('haceUnMomento'):m<60?t('haceMin',{m:m}):t('haceHoras',{h:Math.floor(m/60)});
}
function guardarRonda(l){const r=jget(KR,[]);r.unshift({t:Date.now(),l:l});jset(KR,r.slice(0,5))}
function pintarRonda(){
  const r=rondas()[0];
  if(!r){$('ronda').hidden=true;return}
  $('rondaTxt').textContent=r.l.map(x=>x.q+' '+x.n).join(' · ')+' · '+hace(r.t);
  $('ronda').hidden=false;
}
$('ronda').onclick=()=>{
  const r=rondas()[0];if(!r)return;
  lineas=r.l.map(x=>({k:x.k,q:x.q,n:x.n}));
  pintarLineas();
  setMsg(()=>t('rondaCargada'),'ok');
  try{$('lines').scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}
};

/* ---------- Pestañas ---------- */
function info(){
  if(modo=='c'){pintarCupos();const m=MAXC();setMsg(()=>m?t('cancionesEstado',{u:usadas(),max:m}):t('cancionesLibre'),'')}
}
function pintarCupos(){
  const b=$('cupos');b.textContent='';
  const u=usadas();
  const m=MAXC();b.hidden=!m;
  for(let i=0;i<m;i++)b.appendChild(h('i',i<u?'on':''));
}
function set(x){
  modo=x;colocarEnvio();
  if($('vg')){$('vg').hidden=true;$('tg').className='t';$('tg').setAttribute('aria-selected','false');}
  ['p','c','q'].forEach(k=>{
    const on=k==x;
    $('v'+k).hidden=!on;
    $('t'+k).className='t'+(on?' on':'');
    $('t'+k).setAttribute('aria-selected',on?'true':'false');
  });
  $('wa').style.display='none';
  clearMsg();rotulo();info();
}
$('tp').onclick=()=>set('p');$('tc').onclick=()=>set('c');$('tq').onclick=()=>set('q');
/* 🎮 ORDEVA PLAY: la pestaña muestra su panel sin tocar Pedir, Canción ni Mi cuenta. play/ordeva-play.js y play/play.css se
   cargan la primera vez que se toca (si falla, el menú y los pedidos siguen igual). */
let playCargado=null;
function cargarPlay(){
  if(playCargado)return playCargado;
  playCargado=new Promise((res,rej)=>{
    const l=document.createElement('link');l.rel='stylesheet';l.href='play/play.css?v=1.99.94';document.head.appendChild(l);
    const sc=document.createElement('script');sc.src='play/ordeva-play.js?v=1.99.94';sc.onload=()=>res(window.ordevaPlay);sc.onerror=()=>{playCargado=null;rej(new Error('play'))};document.head.appendChild(sc);
  });
  return playCargado;
}
$('tg').onclick=()=>{
  ['p','c','q'].forEach(k=>{$('v'+k).hidden=true;$('t'+k).className='t';$('t'+k).setAttribute('aria-selected','false');});
  $('vg').hidden=false;$('tg').className='t on';$('tg').setAttribute('aria-selected','true');clearMsg();
  cargarPlay().then(P=>{try{P.abrir($('playRoot'),{c,mesa,v})}catch(e){}}).catch(()=>{$('playRoot').innerHTML='<p class="hint">No se pudo abrir ORDEVA PLAY. Revisa tu conexión y vuelve a tocar «Play».</p>'});
};
/* En modo domicilio solo existe la pestaña de pedido: no hay mesa que cobrar ni música que pedir. */
if(dom){
  $('tc').hidden=true;$('tq').hidden=true;
  $('domSec').hidden=false;
  set('p');
}

/* ---------- Cuenta en vivo (también alimenta las sugerencias) ---------- */
function fila(a,b,cl){
  const r=h('div','l'+(cl?' '+cl:''));
  r.appendChild(h('span',null,a));r.appendChild(h('i','fill'));r.appendChild(h('span',null,b));
  $('cs').appendChild(r);
}
/* Caja de pago con Nequi: la publica el local (número guardado en Ajustes →
   Pasarela de pago) y solo se ve si hay saldo pendiente por pagar. No cobra
   sola — el cliente transfiere desde su propia app Nequi y avisa con el
   botón; el local confirma el pago cuando lo vea llegar. */
const llaveBreb=()=>(qrPago&&qrPago.l)?String(qrPago.l).slice(0,60):'';
function pintarNequi(d){
  const box=$('nequiBox');
  if(!box)return;
  const saldo=(d&&d.s>0)?d.s:0,ll=llaveBreb();
  if((!nq&&!ll)||saldo<=0){box.hidden=true;return}
  box.hidden=false;
  // Primero la llave Bre-B (recibe desde cualquier banco), después Nequi.
  $('trBreb').hidden=!ll;$('trBrebVal').textContent=ll;
  $('trNequi').hidden=!nq;$('nequiNum').textContent=nq;
  if(nq&&nqn){$('nequiName').hidden=false;$('nequiName').textContent=t('aNombreDe')+': '+nqn}
  else $('nequiName').hidden=true;
  $('nequiMonto').textContent=fm(saldo);
  if($('nequiPaidBtn').dataset.enviado!=='1'){$('nequiOkMsg').hidden=true;$('nequiPaidBtn').disabled=false;}
}
function pintar(d){
  pintarNequi(d);
  try{pintarQR(d)}catch(e){}
  $('cs').textContent='';
  if(!d.i||!d.i.length){$('cs').textContent=t('cuentaSinConsumo');return}
  d.i.forEach(x=>fila(x[1]+' × '+x[0],fm(x[1]*x[2])));
  fila(t('consumo'),fm(d.c),'tt');fila(t('pagado'),fm(d.p));fila(t('porPagar'),fm(d.s),'g');
  const u=h('small',null,t('actualizado',{hora:new Date(d.t).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}));
  $('cs').appendChild(u);
}
function conectar(){
  if(es)return;
  if(!v){$('cs').textContent=t('cuentaSinVivo');return}
  try{es=new EventSource('https://canal.vento.local/'+v+'/sse?since=12h')}catch(e){return}
  es.onmessage=ev=>{try{
    const m=JSON.parse(ev.data);
    if(m.event==='message'){snap=JSON.parse(m.message);snapEn=Date.now();pintar(snap);pintarChips();pintarSug();if(modo=='c')info()}
  }catch(e){}};
  es.onopen=()=>{if($('cs').textContent==t('cargandoCuenta'))$('cs').textContent=t('cuentaSinConsumo')};
}

/* ---------- Envío confiable: bandeja de salida + confirmación del local ---------- */
// Publica en el canal de ORDEVA con 3 intentos rápidos (un corte de señal de 1-2 s ya no deja el pedido «sin conexión»).
// Si el canal de ORDEVA responde 429 (demasiados envíos desde esa conexión), se espera un poco más antes de reintentar.
async function canalPost(body){
  const esperas=[0,1500,4000];let st=0;
  for(const w of esperas){
    if(w)await new Promise(r=>setTimeout(r,st===429?w*2:w));
    try{const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),9000);
      const r=await fetch('https://canal.vento.local/'+c,{method:'POST',body,signal:ctrl.signal});clearTimeout(tm);
      if(r.ok)return true;st=r.status;if(st>=400&&st<500&&st!==429&&st!==408)return false;}catch(e){st=0;}
  }
  return false;
}
const OUTK='outbox_'+c,MISK='mis_'+c+'_'+SUF,MISC='misc_'+c+'_'+SUF;let enVuelo=null;   // la canción que se está enviando ahora
function outboxAgregar(body){const l=jget(OUTK,[]);if(!l.some(x=>x.body===body))l.push({body,at:Date.now()});jset(OUTK,l.slice(-20));}
let vaciando=false;
async function vaciarOutbox(){
  if(vaciando||!c)return;const l=jget(OUTK,[]);if(!l.length)return;vaciando=true;
  const quedan=[];
  // 🎵 1.95.4: una canción guardada sin conexión más de 20 min ya no se manda (sonaría horas después); un pedido sí, hasta 12 h.
  const esCancion=b=>/^\{"t":"cancion"/.test(String(b||''));
  for(const m of l){let ok=false;if(Date.now()-m.at<(esCancion(m.body)?20*6e4:12*36e5)){ok=await canalPost(m.body);}else{ok=true;if(esCancion(m.body))try{const id=JSON.parse(m.body).id,ls=jget(MISK,[]),x=ls.find(y=>y.id===id);if(x){x.e='vieja';x.n='';delete x.body;jset(MISK,ls);pintarEstados();}}catch(e){}}if(!ok)quedan.push(m);}
  jset(OUTK,quedan);vaciando=false;
  outFallos=quedan.length?outFallos+1:0;
  if(l.length>quedan.length){setMsg(()=>t('pedEsperando'),'ok');escucharEstados();}
}
// Reintento con espera creciente (10 s, 20 s, 40 s… máx. 2 min) para no saturar; al volver la señal o la pantalla, de una vez.
let outFallos=0,outProx=0;
setInterval(()=>{if(Date.now()>=outProx){outProx=Date.now()+Math.min(120000,10000*Math.pow(2,Math.min(outFallos,4)));vaciarOutbox();}},5000);
window.addEventListener('online',()=>{outFallos=0;vaciarOutbox();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)vaciarOutbox();});
setTimeout(vaciarOutbox,2000);
const misPedidos=()=>jget(MISK,[]).filter(x=>Date.now()-x.at<12*36e5);
function misPedidosAgregar(o){const l=misPedidos();l.push(o);jset(MISK,l.slice(-15));pintarEstados();}
const EST_TXT={enviado:'⏳',nuevo:'🆕',recibido:'✅',preparacion:'👩‍🍳',listo:'🔔',entregado:'🍽️',cancelado:'❌',cola:'🎵',sonando:'🔊',sono:'✅',quitada:'🚫',novid:'⚠️',limite:'⏳',apagada:'🔇',repetida:'🎵',vieja:'⌛',nomesa:'⚠️'};
function pintarEstados(){
  const box=$('estPed');if(!box)return;const l=misPedidos();
  if(!l.length){box.hidden=true;return}
  box.hidden=false;box.textContent='';
  box.appendChild(h('b',null,t('tusPedidos')));
  l.slice().reverse().slice(0,5).forEach(x=>{const r=h('div');r.appendChild(h('span',null,x.txt));r.appendChild(h('em',null,(x.i||EST_TXT[x.e])+' '+(x.n||(x.e==='enviado'?'…':''))));box.appendChild(r)});
}
let esEst=null;
function escucharEstados(forzar){
  if(esEst||!c||(!forzar&&!misPedidos().length))return;
  try{esEst=new EventSource('https://canal.vento.local/'+c+'e/sse?since=12h')}catch(e){return}
  esEst.onmessage=ev=>{try{const m=JSON.parse(ev.data);if(m.event!=='message')return;const o=JSON.parse(m.message);if(!o||o.t!=='estado')return;
    // La app del local rechazó una canción porque la MESA ya llegó a su cupo (la pidieron desde otros celulares).
    // 🎵 1.95.4: también si la música está apagada, si ya estaba en la cola o si llegó muy tarde: no cuenta en el cupo.
    // Quitada o sin versión que se pueda poner: tampoco gasta el cupo de este celular (el local ya no la cuenta).
    // 🎵 1.99.22: unida a la misma canción de otra mesa: el local no la cuenta, así que aquí tampoco gasta el cupo (sin aviso de error).
    //    Si llega mientras todavía se está enviando (enVuelo), no se descuenta aquí: al terminar el envío ya no se cuenta.
    if(o.u&&/^c/.test(String(o.id))){const mc=jget(MISC,[]);if(mc.includes(o.id)){jset(MISC,mc.filter(x=>x!==o.id));if(o.id!==enVuelo){const a=jget(K,[]);a.pop();jset(K,a);if(modo=='c')pintarCupos();}}}
    if(['limite','apagada','repetida','vieja','nomesa','quitada','novid'].includes(o.e)){const mc=jget(MISC,[]);if(mc.includes(o.id)){jset(MISC,mc.filter(x=>x!==o.id));
      if(o.id!==enVuelo){const a=jget(K,[]);a.pop();jset(K,a);}if(modo=='c')pintarCupos();
      const k={apagada:'musicaApagada',repetida:'cancionRepetida',vieja:'cancionVieja',nomesa:'cancionNoMesa'}[o.e];
      if(o.e==='limite'||k)setMsg(()=>o.e==='limite'?t('cancionLimiteMesa',{max:o.max||MAXC()||10,min:o.min||1}):t(k),'err');}}
    const l=jget(MISK,[]),x=l.find(y=>y.id===o.id);if(!x)return;
    // 🎵 Canciones: los estados solo avanzan (un «en la cola» que llega tarde no tapa «sonando»; un rechazo es final).
    const RK={enviado:0,cola:1,sonando:2,sono:3,quitada:3,novid:3,limite:4,apagada:4,repetida:4,vieja:4,nomesa:4};
    if(/^c/.test(String(o.id))&&o.e in RK&&(RK[x.e]||0)>RK[o.e])return;
    x.e=o.e;x.n=o.n||'';if(o.i)x.i=String(o.i).slice(0,4);else delete x.i;delete x.body;jset(MISK,l);pintarEstados();
    if(['recibido','preparacion','listo','cola'].includes(o.e)&&$('m').className!=='err')setMsg(()=>t('enviadoOk'),'ok');}catch(e){}};
}
// Si el local no confirma: se reenvía el MISMO pedido (mismo ID, no se duplica) y luego se avisa.
setInterval(()=>{
  const l=jget(MISK,[]);let cambio=false;
  l.forEach(x=>{if(x.e!=='enviado'||!x.body)return;const s=Date.now()-x.at;
    if(s>45000&&!x.re){x.re=1;cambio=true;canalPost(x.body).then(ok=>{if(!ok)outboxAgregar(x.body);});}
    if(s>180000&&!x.av){x.av=1;cambio=true;setMsg(()=>t('pedSinConfirmar'),'err');
      // → ORDEVA Admin: el local no confirmó un pedido del QR en 3 min (¿la app del local está cerrada o sin internet?).
      try{window.ventoError&&window.ventoError('pedido','El local no confirmó un pedido del QR en 3 minutos',{mesa:String(mesa||'').slice(0,10),reenviado:!!x.re},'pedido|sin-confirmar');}catch(e){}}});
  if(cambio)jset(MISK,l);
},10000);
setTimeout(()=>{pintarEstados();escucharEstados()},800);

/* ---------- Envío ---------- */
const wam=()=>{location.href='https://wa.me/'+wa+'?text='+encodeURIComponent(ultimo)};
$('wa').onclick=wam;

/* ---------- Pago con Nequi (manual: el cliente transfiere y avisa) ---------- */
async function copiarTexto(txt,b){
  const orig=b.textContent;
  try{
    if(navigator.clipboard)await navigator.clipboard.writeText(txt);
    else{const ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
    b.textContent=t('numeroCopiado');
  }catch(e){}
  setTimeout(()=>{b.textContent=orig},1800);
}
$('nequiCopyBtn').onclick=()=>copiarTexto(nq,$('nequiCopyBtn'));
$('trBrebCopy').onclick=()=>copiarTexto(llaveBreb(),$('trBrebCopy'));
// Un solo aviso para cualquier transferencia (Bre-B desde cualquier banco o Nequi): el local lo revisa en su cuenta.
async function avisarTransferencia(btn,okEl){
  if(!mesa)return;
  const valor=(snap&&snap.s>0)?snap.s:(snap&&snap.c>0)?snap.c:0;
  const msg='CUENTA MESA '+mesa+': 💸 Cliente dice que YA PAGÓ'+(valor>0?' '+fm(valor):'')+' por transferencia ('+[llaveBreb()?'Bre-B':'',nq?'Nequi':'',qrPago?'QR':''].filter(Boolean).join(' o ')+')';
  btn.disabled=true;
  if(c){
    try{
      const r=await fetch('https://canal.vento.local/'+c,{method:'POST',body:msg});
      if(r.ok){btn.dataset.enviado='1';okEl.hidden=false;okEl.textContent=t('avisoTransfer');try{mesoraCelebrar(['💸','✅','✨'])}catch(e){}return}
    }catch(e){}
  }
  btn.disabled=false;
  if(wa)location.href='https://wa.me/'+wa+'?text='+encodeURIComponent(msg);
}
$('nequiPaidBtn').onclick=()=>avisarTransferencia($('nequiPaidBtn'),$('nequiOkMsg'));
$('b').onclick=async()=>{
  if((!mesa&&!dom)||(!c&&!wa))return setMsg(()=>t('qrIncompleto'),'err');
  let txt='',env=null;
  if(modo=='p'){
    if($('p').value.trim()){agregarTexto($('p').value);$('p').value='';pintarSug()}
    env=lineas.map(l=>({k:l.k,q:l.q,n:l.n}));
    txt=env.map(l=>l.q+' '+l.n).join(', ');
  }else if(modo=='c')txt=$('s').value.replace(/\s+/g,' ').trim();
  else txt=$('n').value.replace(/\s+/g,' ').trim();
  if(!txt&&modo!='q')return setMsg(()=>t('escribeAlgo'),'err');
  if(modo=='c'&&MAXC()&&usadas()>=MAXC())return setMsg(()=>t(recMesa().length>recLocal().length?'cancionLimiteMesa':'cancionLimite',{max:MAXC(),min:Math.max(1,Math.ceil((Math.min(...recientes())+V-Date.now())/6e4))}),'err');
  /* 🎵 1.95.5 («cuando escriben mal el nombre no suena o suena otra cosa»): si la canción se escribió a mano (no se tocó un
     resultado), primero se muestran los resultados de YouTube para tocar la correcta. Si no está, un segundo toque la
     manda como se escribió. Sin resultados (sin servidor o sin internet), se manda de una. */
  if(modo=='c'&&!(ytElegido&&ytElegido.t===txt)&&pedirAsi!==txt&&ytSrv()){
    pedirAsi=txt;$('b').disabled=true;
    try{await ytBuscar(txt);}catch(e){}
    $('b').disabled=false;
    const prev=$('ytPrev');
    if(prev&&prev.querySelector('.ytpedir')){prev.hidden=false;try{prev.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(e){}return setMsg(()=>t('eligeVersion'),'ok');}
  }
  const tipo={p:'PEDIDO',c:'CANCION',q:'CUENTA'}[modo];
  if(dom){
    // DOMICILIO: nombre | teléfono | dirección | productos
    const nom=$('domNom').value.replace(/[|\n]/g,' ').replace(/\s+/g,' ').trim().slice(0,40);
    const tel=$('domTel').value.replace(/[^\d+ ]/g,'').trim().slice(0,15);
    const dir=$('domDir').value.replace(/[|\n]/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
    if(!nom||!dir)return setMsg(()=>t('domFaltan'),'err');
    ultimo='DOMICILIO: '+nom+' | '+tel+' | '+dir+' | '+txt;
  }
  else ultimo=tipo+' MESA '+mesa+(txt?': '+txt:'');
  // Pedidos y canciones van como JSON con un ID único: la app del local los suma una sola vez
  // aunque se reintenten, y responde el estado (recibido, en preparación, listo…) por el canal c+'e'.
  let cuerpo=ultimo,idEnv=null;
  if(c&&!dom&&(modo=='p'||modo=='c')){
    const id=(modo=='c'?'c':'p')+Date.now().toString(36)+Math.random().toString(36).slice(2,7);idEnv=id;
    if(modo=='p'){
      const precioDe=n=>{const k=norm(n);const base=String(n).replace(/\s*\([^)]*\)\s*$/,''),kb=OPX[k]!=null?norm(base):k;const x=cat&&Array.isArray(cat.p)?cat.p.find(r=>norm(r[0])===kb):null;return x?Math.round(+x[1]||0)+(OPX[k]||0):0;};
      const items=env.map(l=>({n:l.n,q:l.q,p:precioDe(l.n)}));
      cuerpo=JSON.stringify({t:'pedido',v:2,id,mesa:+mesa,vm:v,items,total:items.reduce((a,x)=>a+x.q*x.p,0),at:Date.now(),txt:ultimo.slice(0,300)});
      misPedidosAgregar({id,txt:txt.slice(0,120),at:Date.now(),e:'enviado',body:cuerpo});
    } else{const vid=ytElegido&&ytElegido.t===txt?ytElegido.v:null;ytElegido=null;
      cuerpo=JSON.stringify(Object.assign({t:'cancion',v:2,id,mesa:+mesa,vm:v,s:txt.slice(0,120),at:Date.now()},vid?{vid}:{}));jset(MISC,jget(MISC,[]).concat(id).slice(-12));
      // 🎵 1.95.4: la canción también sale en «Tus pedidos» con su estado (en cola, sonando, ya sonó) y se reenvía si el
      // local no la confirma, igual que un pedido.
      misPedidosAgregar({id,txt:'🎵 '+txt.slice(0,110),at:Date.now(),e:'enviado',body:cuerpo});escucharEstados(true)}
  }
  if(c){
    if(cuerpo.length>3800||ultimo.length>(dom?500:2000))return setMsg(()=>t('pedidoLargo'),'err');
    $('b').disabled=true;
    try{
      enVuelo=idEnv;let r;try{r={ok:await canalPost(cuerpo)};}finally{enVuelo=null;}
      if(r.ok){
        // 1.99.22: si el local la rechazó o la unió a la de otra mesa antes de terminar el envío, no se cuenta (antes se
        // descontaba otra y se sumaba esta: con el contador en 0 quedaba gastada una que no contaba).
        if(modo=='c'&&!(idEnv&&!jget(MISC,[]).includes(idEnv))){const a=recientes();a.push(Date.now());jset(K,a);}
        if(modo=='c'){aprenderCancion(txt);if($('sugC'))$('sugC').hidden=true;if($('ytPrev'))$('ytPrev').hidden=true}
        if(modo=='p'){guardarRonda(env);aprender(env);lineas=[];pintarLineas();pintarRonda();pintarChips()}
        $('s').value=$('n').value='';
        $('b').disabled=false;
        if(modo=='c')pintarCupos();
        // 🎵 1.95.4: si el local ya la rechazó (música apagada, sin cupo…) mientras terminaba el envío, ese aviso se queda.
        const yaRechazada=modo=='c'&&idEnv&&!jget(MISC,[]).includes(idEnv);
        if(!yaRechazada)setMsg(()=>(modo=='p'?t('pedEsperando'):t('enviadoOk'))+(modo=='c'&&MAXC()?t('cancionesLlevas',{u:usadas(),max:MAXC()}):''),'ok');
        if(modo=='p')escucharEstados();
        try{ mesoraCelebrar(modo=='c'?['🎵','🎶','✨']:dom?['🛵','🎉','✨']:['🎉','✨','🍻']); }catch(e){}
        return;
      }
    }catch(e){}
    $('b').disabled=false;
    // Sin conexión: el pedido NO se pierde ni se manda a otra app; queda guardado y se reintenta solo.
    try{if(navigator.onLine!==false)window.ventoError&&window.ventoError('pedido','No se pudo enviar '+(modo=='c'?'una canción':'un pedido')+' por el QR (con internet)',{mesa:String(mesa||'').slice(0,10),modo},'pedido|no-sale|'+modo);}catch(e){}
    if(modo=='p'||modo=='c'){
      outboxAgregar(cuerpo);
      if(modo=='p'){guardarRonda(env);aprender(env);lineas=[];pintarLineas();pintarRonda();pintarChips()}
      if(modo=='c'){const a=recientes();a.push(Date.now());jset(K,a);aprenderCancion(txt);}
      $('s').value=$('n').value='';
      return setMsg(()=>t('pedGuardado'),'err');
    }
    if(wa){setMsg(()=>t('noEnviadoWa'),'err');$('wa').style.display='block';return}
    return setMsg(()=>t('noEnviadoMesero'),'err');
  }
  if(modo=='p'){guardarRonda(env);aprender(env)}
  if(modo=='c')aprenderCancion(txt);
  wam();
};

/* ---------- Menú / carta (lo publica la app del local) ---------- */
let cat=jget('cat_'+c,null);
// Fotos de los productos (con fondo blanco): llegan por su propio canal de ORDEVA
// (topic + 'f'), un mensaje por producto {n: nombre, i: miniatura}; i vacío = sin foto.
let fotos=jget('fotos_'+c,{});
async function cargarFotos(){
  if(!c)return;
  try{
    const ctrl=new AbortController(),tmo=setTimeout(()=>ctrl.abort(),6000);
    const r=await fetch('https://canal.vento.local/'+c+'f/json?poll=1&since=12h',{signal:ctrl.signal});
    clearTimeout(tmo);
    const ls=(await r.text()).trim().split('\n').filter(Boolean),nuevo={};let vioQR=false;
    ls.forEach(l=>{try{const m=JSON.parse(l);if(m.event!=='message')return;const x=JSON.parse(m.message);if(!x||!x.n)return;
      if(x.n==='__qrpago__'){vioQR=true;qrPago=(x.m&&x.s)?{i:qrDeMatriz(x.s,x.m),q:x.q||'',l:x.l||'',t:Date.now()}:(x.i&&/^data:image\/(png|jpeg|webp);base64,/.test(x.i))?{i:x.i,q:x.q||'',l:x.l||'',t:Date.now()}:null;jset('qrpago_'+c,qrPago);return}
      const k=norm(x.n);if(x.i&&/^data:image\/(jpeg|png|webp);base64,/.test(x.i))nuevo[k]=x.i;else delete nuevo[k]}catch(e){}});
    fotos=nuevo;jset('fotos_'+c,fotos);
    // 1.96: un QR de pago guardado hace más de 12 h que el local ya no publica se olvida (así no queda uno viejo o falso).
    if(r.ok&&!vioQR&&qrPago&&!(qrPago.t&&Date.now()-qrPago.t<12*36e5)){qrPago=null;jset('qrpago_'+c,null);}
  }catch(e){}
  pintarQR(snap);
}
/* ---------- QR de pago del local (lo sube el dueño en su app) ----------
   Llega el patrón de cuadritos del QR (1 bit cada uno) y aquí se dibuja nítido. */
function qrDeMatriz(n,m){
  try{
    const bin=atob(m),mg=4,px=8,cv=document.createElement('canvas');cv.width=cv.height=(n+mg*2)*px;
    const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.fillStyle='#000';
    for(let i=0;i<n*n;i++)if(bin.charCodeAt(i>>3)&(128>>(i&7)))x.fillRect(((i%n)+mg)*px,(Math.floor(i/n)+mg)*px,px,px);
    return cv.toDataURL('image/png');
  }catch(e){return null}
}
let qrPago=jget('qrpago_'+c,null);
function pintarQR(d){
  try{pintarNequi(d)}catch(e){}   // la llave Bre-B llega con el QR: el recuadro de transferencia se vuelve a pintar
  const box=$('qpBox');if(!box)return;
  if(!qrPago){box.hidden=true;return}
  // En domicilio va debajo del botón de enviar (el cliente no está en el local).
  if(dom&&box.parentNode.id!=='vp')$('vp').appendChild(box);
  box.hidden=false;
  $('qpImg').src=qrPago.i;
  $('qpH').textContent=t('pagaQR')+(qrPago.q?' · '+qrPago.q:'');
  // La llave Bre-B y el «Ya pagué» van en el recuadro de transferencia cuando se ve (sin botones repetidos).
  const conTransfer=!$('nequiBox').hidden;
  $('qpLlave').hidden=!qrPago.l||conTransfer;$('qpLlave').textContent=qrPago.l?('🔑 '+qrPago.l):'';
  const saldo=(d&&d.s>0)?d.s:0;
  $('qpMonto').hidden=!saldo;if(saldo)$('qpMonto').textContent=fm(saldo);
  $('qpInstr').textContent=t('pagaQRInstr');
  $('qpGuardar').textContent=t('guardarQR');
  $('qpPague').textContent=t('yaPagueTransfer');$('qpPague').hidden=dom||!mesa||conTransfer;
}
$('qpGuardar').onclick=async()=>{
  if(!qrPago)return;
  const b=await (await fetch(qrPago.i)).blob(),f=new File([b],'qr-pago.png',{type:b.type||'image/png'});
  try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:t('pagaQR')});return}}catch(e){if(e&&e.name==='AbortError')return}
  const a=document.createElement('a');a.href=qrPago.i;a.download='qr-pago.png';document.body.appendChild(a);a.click();a.remove();
};
$('qpPague').onclick=()=>avisarTransferencia($('qpPague'),$('qpOk'));
async function qpPagueViejo(){
  if(!mesa)return;
  // El monto siempre va en el aviso al dueño (antes, si ya no quedaba saldo pendiente, se
  // mandaba sin el valor y el dueño no sabía cuánto le pagaron).
  const valor=(snap&&snap.s>0)?snap.s:(snap&&snap.c>0)?snap.c:0;
  const monto=valor>0?(' '+fm(valor)):'';
  const msg='CUENTA MESA '+mesa+': 💜 Cliente dice que YA PAGÓ'+monto+' por QR ('+(qrPago&&qrPago.q||'Nequi')+')';
  $('qpPague').disabled=true;
  try{const r=await fetch('https://canal.vento.local/'+c,{method:'POST',body:msg});if(r.ok){$('qpOk').hidden=false;$('qpOk').textContent=t('avisoNequiEnviado');try{mesoraCelebrar(['💜','✅','✨'])}catch(e){}return}}catch(e){}
  $('qpPague').disabled=false;
  if(wa)location.href='https://wa.me/'+wa+'?text='+encodeURIComponent(msg);
};
let catTab=null;                                  // categoría elegida en las pestañas (null = la primera disponible)
const PROMO_CAT_NAME='Promociones y combos';
const catT=()=>{const y=cat&&cat.y;if(cat&&typeof cat.t==='string'&&cat.t)return cat.t.slice(0,24);return (y==='restaurante'||y==='cafeteria')?'Menú':'Carta'};
const catIcon=()=>{const y=cat&&cat.y;if(cat&&typeof cat.ic==='string'&&cat.ic)return cat.ic.slice(0,4);return (y==='restaurante'||y==='cafeteria')?'🍽️':y==='cerveceria'?'🍻':'📖'};
const nrm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
/* Icono por categoría: solo con el nombre, sin depender de datos nuevos que el local tenga que publicar */
function iconoDeCategoria(nombre){
  const n=nrm(nombre||'');
  if(n===nrm(PROMO_CAT_NAME))return '🎁';
  if(/cerve|beer|birra|chela/.test(n))return '🍺';
  if(/cigarr|tabaco/.test(n))return '🚬';
  if(/aguardient|whisky|whiskey|\bron\b|vodka|tequila|licor|trago/.test(n))return '🥃';
  if(/vino/.test(n))return '🍷';
  if(/gaseosa|soda|refresco|jugo|malta|energizante/.test(n))return '🥤';
  if(/agua/.test(n))return '💧';
  if(/caf[eé]|tinto/.test(n))return '☕';
  if(/postre|dulce|torta/.test(n))return '🍰';
  if(/papa|snack|pasaboca|picada|hamburgues|pizza|perro|comida|plato/.test(n))return '🍟';
  return (cat&&cat.ip)?cat.ip:'🍽️';   // si no es comida, el dibujo del negocio (✈️ agencia, 🔧 ferretería…)
}
function pcardHtml(x){
  const r=h('div','pcard'+(x[3]==2?' ag':''));
  r.dataset.k=norm(x[0]);
  const qb=h('span','pqb');r.appendChild(qb);      // cuántas unidades de este producto ya lleva el cliente
  const foto=fotos[norm(x[0])];
  if(foto){const im=document.createElement('img');im.className='pimg';im.src=foto;im.alt='';im.loading='lazy';r.appendChild(im)}
  else r.appendChild(h('span','pic',iconoDeCategoria(x[2])));
  r.appendChild(h('span','pn',x[0]));
  if(x[3]==2){
    r.appendChild(h('span','pagot',t('agotado')));
  } else {
    r.appendChild(h('span','pp',fm(x[1])));
    if(x[4])r.appendChild(h('span','plo',t('promoAhorra',{n:x[4]})));
    else if(x[3]==1)r.appendChild(h('span','plo',t('ultimasUnidades')));
  }
  if(x[5])r.appendChild(h('span','pdet',String(x[5]).slice(0,140)));   // detalles: qué incluye, personas, medida…
  if(x[3]!=2){
    const b=h('button','padd','+');b.type='button';b.setAttribute('aria-label',t('addAria')+': '+x[0]);
    b.onclick=()=>{agregar(1,x[0])};r.appendChild(b);
  }
  return r;
}
function pintarBizName(){
  const el=$('bizName');if(!el)return;
  const nombre=cat&&cat.n?String(cat.n).trim():'';
  el.textContent=nombre;el.hidden=!nombre;
}
/* ---------- Mensaje, info extra, reloj y "abierto/cerrado" (los pone el
   local en Ajustes → Personalizar la página de pedidos, llegan con la carta
   por el mismo canal en vivo de ORDEVA, ver cargarCat()) ---------- */
function isOpenNow(oh,ch){
  if(!oh||!ch)return null;
  const now=new Date(),cur=now.getHours()*60+now.getMinutes();
  const [oH,oM]=oh.split(':').map(Number),[cH,cM]=ch.split(':').map(Number);
  if(isNaN(oH)||isNaN(cH))return null;
  const openMin=oH*60+(oM||0),closeMin=cH*60+(cM||0);
  if(openMin===closeMin)return true;                    // mismo valor: abierto 24h
  if(openMin<closeMin)return cur>=openMin&&cur<closeMin;
  return cur>=openMin||cur<closeMin;                     // cruza medianoche (ej. 4pm a 2am)
}
function fmtHora12(hhmm){
  if(!hhmm)return'';
  const[h,m]=hhmm.split(':').map(Number);if(isNaN(h))return'';
  const ampm=h>=12?'p. m.':'a. m.',h12=((h+11)%12)+1;
  return h12+(m?':'+String(m).padStart(2,'0'):'')+' '+ampm;
}
function pintarInfoBar(){
  const bar=$('orderInfoBar');if(!bar)return;
  const msg=cat&&cat.msg?String(cat.msg).trim():'';
  const info=cat&&cat.info?String(cat.info).trim():'';
  const oh=cat&&cat.oh?cat.oh:'',ch=cat&&cat.ch?cat.ch:'';
  const hn=cat&&cat.hn?String(cat.hn).trim():'';
  const msgEl=$('orderMessageEl');if(msgEl){msgEl.textContent=msg;msgEl.hidden=!msg;}
  const infoEl=$('orderExtraInfoEl');if(infoEl){
    const hourLine=(oh&&ch)?(fmtHora12(oh)+' – '+fmtHora12(ch)+(hn?' · '+hn:'')):hn;
    infoEl.textContent=[info,hourLine].filter(Boolean).join(' · ');
    infoEl.hidden=!(info||hourLine);
  }
  const badge=$('orderOpenBadge');
  if(badge){
    const open=isOpenNow(oh,ch);
    if(open===null){badge.hidden=true;}
    else{
      badge.hidden=false;
      badge.textContent=open?('🟢 '+t('abiertoAhora')):('🔴 '+t('cerradoAhora'));
      badge.className='order-openbadge '+(open?'is-open':'is-closed');
    }
  }
  bar.hidden=!(msg||info||(oh&&ch));
}
function tickOrderClock(){
  const el=$('orderClockEl');if(!el)return;
  el.textContent=new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
tickOrderClock();
setInterval(tickOrderClock,1000);
/* Locales sin música: el catálogo trae mz:0 y se esconde la pestaña de pedir canción.
   Si el catálogo todavía no llegó (o es viejo, sin mz), se deja visible como siempre. */
// 🎮 La pestaña Play solo si el local la activó (la carta trae pl:1) y hay mesa (no en domicilio).
function aplicarPlayCliente(){const t=$('tg');if(!t)return;t.hidden=!(!dom&&mesa&&v&&cat&&cat.pl===1);}
function aplicarMusicaCliente(){
  const on=!dom&&!(cat&&cat.mz===0),tab=$('tc');
  if(!tab)return;
  tab.hidden=!on;
  if(!on&&modo=='c')set('p');
}
function pintarCat(fin){
  pintarBizName();
  pintarInfoBar();
  aplicarMusicaCliente();
  try{aplicarPlayCliente()}catch(e){}
  const box=$('cat');box.textContent='';
  const ps=cat&&Array.isArray(cat.p)?cat.p:[],esMenu=catT()==='Menú';
  // El título usa la palabra del negocio cuando la manda (Vuelos y planes, Tarifas, Servicios…)
  const termino=(cat&&typeof cat.t==='string'&&cat.t)?cat.t:'';
  const propio=termino&&termino!=='Menú'&&termino!=='Carta';
  $('catT').textContent=propio?termino:t(esMenu?'tituloMenu':'tituloCarta');
  $('catIc').textContent=catIcon();
  $('catBtnT').textContent=propio?('👀 '+termino):t(esMenu?'verMenu':'verCarta');
  $('catBtnS').textContent=ps.length?t('catCount',{n:ps.length}):t('catAunNoDisp');
  $('cq').placeholder=propio?('🔎 Buscar en '+termino.toLowerCase()+'…'):t(esMenu?'buscarMenu':'buscarCarta');
  $('catBtn').hidden=!fin&&!ps.length;
  if(!ps.length){box.appendChild(h('p','hint',t(esMenu?'sinPublicarMenu':'sinPublicarCarta')));return}
  const qraw=$('cq').value.trim(),q=nrm(qraw),buscando=!!q;
  const list=buscando?ps.filter(x=>nrm(x[0]+' '+(x[2]||'')).includes(q)):ps;
  if(!list.length){box.appendChild(h('p','hint',t('sinCoincidencias',{q:qraw})));return}

  // Los agotados no interrumpen la lectura: se mantiene el orden de venta,
  // pero se van al final de su categoría en vez de quedar en su posición original.
  const alFinalLosAgotados=arr=>arr.slice().sort((a,b)=>(a[3]==2)-(b[3]==2));

  // Promociones: franja fija arriba, siempre visible (no escondida en una pestaña)
  const promos=alFinalLosAgotados(list.filter(x=>(x[2]||'Otros')===PROMO_CAT_NAME));
  if(promos.length){
    const strip=h('div','promo-strip');
    strip.appendChild(h('h3',null,t('promoTitulo')));
    const g=h('div','cardgrid');promos.forEach(x=>g.appendChild(pcardHtml(x)));
    strip.appendChild(g);
    box.appendChild(strip);
  }

  const resto=list.filter(x=>(x[2]||'Otros')!==PROMO_CAT_NAME);
  if(!resto.length){pintarBadgesCat();return}

  if(buscando){
    // Buscando: se muestran los resultados de todas las categorías juntos, sin pestañas
    const g=h('div','cardgrid');alFinalLosAgotados(resto).forEach(x=>g.appendChild(pcardHtml(x)));
    box.appendChild(g);
    pintarBadgesCat();
    return;
  }

  const g={},order=[];
  resto.forEach(x=>{const k=x[2]||'Otros';if(!g[k]){g[k]=[];order.push(k)}g[k].push(x)});
  const keys=order.slice().sort((a,b)=>(a==='Otros')-(b==='Otros'));
  if(!keys.includes(catTab))catTab=keys[0]||null;

  const tabs=h('div','cat-tabs');
  keys.forEach(k=>{
    const b=h('button','cat-tab'+(k===catTab?' on':''));b.type='button';
    b.textContent=iconoDeCategoria(k)+' '+k;
    b.onclick=()=>{catTab=k;pintarCat(fin)};
    tabs.appendChild(b);
  });
  box.appendChild(tabs);

  const grid=h('div','cardgrid');
  alFinalLosAgotados(g[catTab]||[]).forEach(x=>grid.appendChild(pcardHtml(x)));
  box.appendChild(grid);
  pintarBadgesCat();
}
/* Muestra en cada producto de la carta cuántas unidades llevas en tu pedido */
function pintarBadgesCat(){
  const box=$('cat');if(!box)return;
  box.querySelectorAll('.pcard[data-k]').forEach(r=>{
    const b=r.querySelector('.pqb');if(!b)return;
    const l=lineas.find(x=>x.k===r.dataset.k),q=l?l.q:0,primera=b.dataset.q===undefined,prev=+b.dataset.q||0;
    b.classList.toggle('show',!!q);b.dataset.q=q;b.textContent=q?'×'+q:'';
    if(q&&!primera&&q!==prev){b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');}
  });
}
function abrirCarta(){pintarCat(true);$('carta').hidden=false;$('carta').scrollTop=0;document.body.style.overflow='hidden'}
function cerrarCarta(){$('carta').hidden=true;document.body.style.overflow=''}
$('catBtn').onclick=abrirCarta;$('catX').onclick=cerrarCarta;$('catBack').onclick=cerrarCarta;$('cq').oninput=()=>pintarCat(true);
/* 1.72.6: al volver a la página (o con la carta en vivo) solo se vuelve a pintar si la carta o las fotos CAMBIARON, y sin
   perder el punto donde iba el cliente. Antes se pintaba todo otra vez: la carta se devolvía arriba y las fotos se
   cargaban de nuevo («cuando bajo vuelve a subir y se carga»). */
let catPintada='';
const firmaCat=()=>{try{return JSON.stringify(cat||null)+'|'+Object.keys(fotos||{}).length}catch(e){return String(Math.random())}};
function conPosicion(fn){
  const car=$('carta'),box=$('cat'),tb=box&&box.querySelector('.cat-tabs');
  const st=car?car.scrollTop:0,wy=window.scrollY,tl=tb?tb.scrollLeft:0,alto=box?box.offsetHeight:0;
  if(box&&alto)box.style.minHeight=alto+'px';           // mientras se dibujan las fotos, la página no se encoge
  fn();
  if(car&&car.scrollTop!==st)car.scrollTop=st;
  if(Math.abs(window.scrollY-wy)>2)window.scrollTo(0,wy);
  const tb2=box&&box.querySelector('.cat-tabs');if(tb2)tb2.scrollLeft=tl;
  clearTimeout(conPosicion.t);conPosicion.t=setTimeout(()=>{if(box)box.style.minHeight=''},1500);
}
function repintarCat(){
  const f=firmaCat();if(f===catPintada)return;            // nada cambió: no se toca
  catPintada=f;conPosicion(()=>{pintarCat(!$('carta').hidden);pintarSug();});
}
async function cargarCat(){
  if(!catPintada){pintarCat();if(!c){pintarCat(true);catPintada=firmaCat();return}}
  try{
    const ctrl=new AbortController(),tmo=setTimeout(()=>ctrl.abort(),6000);
    const r=await fetch('https://canal.vento.local/'+c+'k/json?poll=1&since=12h',{signal:ctrl.signal,cache:'no-store'});
    clearTimeout(tmo);
    const ls=(await r.text()).trim().split('\n').filter(Boolean);
    for(let i=ls.length-1;i>=0;i--){const m=JSON.parse(ls[i]);if(m.event==='message'){cat=JSON.parse(m.message);jset('cat_'+c,cat);applyTh(cat.th);break}}
  }catch(e){}
  if(!catPintada||Date.now()-(cargarCat.fotosT||0)>10*60000){cargarCat.fotosT=Date.now();await cargarFotos();}
  if(!catPintada){pintarCat(true);pintarSug();catPintada=firmaCat();}
  else repintarCat();
  catEnVivo();
}
/* La carta se actualiza sola mientras el cliente la tiene abierta: cuando el negocio cambia un
   precio o un nombre, llega por el mismo canal y se vuelve a pintar (sin recargar la página). */
let catES=null;
function catEnVivo(){
  if(!c||catES||!window.EventSource)return;
  try{catES=new EventSource('https://canal.vento.local/'+c+'k/sse?since='+Math.floor(Date.now()/1000));}catch(e){return}
  catES.onmessage=ev=>{try{const m=JSON.parse(ev.data);if(m.event!=='message')return;const nuevo=JSON.parse(m.message);if(JSON.stringify(nuevo)===JSON.stringify(cat))return;cat=nuevo;jset('cat_'+c,cat);applyTh(cat.th);repintarCat();}catch(e){}};
  catES.onerror=()=>{if(catES&&catES.readyState===2){catES=null;setTimeout(catEnVivo,5000);}};
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){cargarCat();}});

/* Celebración: una explosión de emojis que se desvanece (cobro, pago recibido, pedido enviado).
   No sale si el celular pide menos movimiento ni en el modo fácil. */
window.mesoraCelebrar = function(emojis){
  try{
    if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if(document.body.classList.contains('easy-mode')) return;
    const E = Array.isArray(emojis) ? emojis : [emojis || '🎉', '✨'];
    const box = document.createElement('div'); box.className = 'mz-celebra'; box.setAttribute('aria-hidden', 'true');
    for(let i = 0; i < 16; i++){
      const s = document.createElement('span'); s.textContent = E[i % E.length];
      const a = -Math.PI * (0.05 + Math.random() * 0.9), d = 110 + Math.random() * 170;
      s.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
      s.style.setProperty('--dy', Math.round(Math.sin(a) * d) + 'px');
      s.style.setProperty('--r', Math.round(Math.random() * 540 - 270) + 'deg');
      s.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
      s.style.fontSize = Math.round(18 + Math.random() * 16) + 'px';
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 1500);
  }catch(e){}
};

/* ---------- Efectos de temporada (nieve, murciélagos, corazones, velitas…) ---------- */
const FX_SETS = {
  navidad: ['❄️', '❄', '✨', '🎄'],
  halloween: ['🦇', '🎃', '👻', '🕸️'],
  sanvalentin: ['💘', '❤️', '💕', '✨'],
  velitas: ['🕯️', '✨', '💛', '🌟'],
  fiesta: ['🎉', '🎊', '✨', '🥳'],
  futbol: ['⚽', '🏆', '⭐', '🇨🇴'],
  cerveza: ['🍺', '🍻', '✨', '🥂'],
  cafe: ['☕', '🥐', '✨', '🤎'],
  flores: ['🌸', '🌼', '🌺', '🌷'],
  playa: ['🌴', '☀️', '🍹', '🌊'],
  estrellas: ['⭐', '✨', '🌟', '💫'],
  musica: ['🎵', '🎶', '🎸', '✨'],
  otono: ['🍂', '🍁', '🍃', '🌰'],
  burbujas: ['🫧', '🫧', '✨', '💧']
};
function fxSet(kind){
  let L = document.getElementById('fxLayer');
  const E = FX_SETS[kind];
  if(!E){ if(L) L.remove(); return; }
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(!L){ L = document.createElement('div'); L.id = 'fxLayer'; L.setAttribute('aria-hidden', 'true'); document.body.appendChild(L); }
  L.innerHTML = '';
  for(let i = 0; i < 18; i++){ const s = document.createElement('span'); s.textContent = E[i % 4];
    s.style.cssText = 'left:' + (Math.random() * 100) + 'vw;font-size:' + (12 + Math.random() * 14) + 'px;animation-duration:' + (9 + Math.random() * 10) + 's,' + (3 + Math.random() * 3) + 's;animation-delay:' + (-Math.random() * 14) + 's,0s'; L.appendChild(s); }
}

/* ---------- Temática (la elige el local en Ajustes → Apariencia de su app;
   llega por el canal en vivo de ORDEVA junto con la carta, ver cargarCat()) ---------- */
const TH = {
  // 1.65.6: los mismos colores de las apariencias de ORDEVA (app/04g-productos-historial-caja.js, PALETTES).
  ordeva2: { '--bg':'#f4f5f7', '--card':'#ffffff', '--card2':'#f1f2f4', '--line':'rgba(17,18,20,.22)', '--line2':'rgba(13,14,16,.08)', '--ink':'#0d0e10', '--ink2':'rgba(13,14,16,.62)', '--gold':'#111214', '--gold-hi':'#3a3d42', '--gold-lo':'#000000', '--on-gold':'#ffffff' },
  apple: { '--bg':'#f2f2f7', '--card':'#ffffff', '--card2':'#e9e9ef', '--line':'rgba(10,108,255,.28)', '--line2':'rgba(28,28,30,.08)', '--ink':'#1c1c1e', '--ink2':'rgba(28,28,30,.62)', '--gold':'#0a6cff', '--gold-hi':'#609fff', '--gold-lo':'#0050c8', '--on-gold':'#ffffff' },
  claro: { '--bg':'#fbf8f4', '--card':'#ffffff', '--card2':'#f2ece4', '--line':'rgba(232,89,12,.28)', '--line2':'rgba(31,26,23,.08)', '--ink':'#1f1a17', '--ink2':'rgba(31,26,23,.62)', '--gold':'#e8590c', '--gold-hi':'#f09361', '--gold-lo':'#c2410c', '--on-gold':'#101114' },
  cafe: { '--bg':'#f3ebde', '--card':'#fffdf9', '--card2':'#eadfcc', '--line':'rgba(139,90,43,.28)', '--line2':'rgba(59,42,29,.08)', '--ink':'#3b2a1d', '--ink2':'rgba(59,42,29,.62)', '--gold':'#8b5a2b', '--gold-hi':'#b49475', '--gold-lo':'#6f4520', '--on-gold':'#ffffff' },
  menta: { '--bg':'#eff7f3', '--card':'#ffffff', '--card2':'#e0efe7', '--line':'rgba(8,122,84,.28)', '--line2':'rgba(18,38,29,.08)', '--ink':'#12261d', '--ink2':'rgba(18,38,29,.62)', '--gold':'#087a54', '--gold-hi':'#5ea990', '--gold-lo':'#066343', '--on-gold':'#ffffff' },
  nocturno: { '--bg':'#0a1220', '--card':'#101a2c', '--card2':'#16233a', '--line':'rgba(47,111,224,.28)', '--line2':'rgba(228,234,245,.10)', '--ink':'#e4eaf5', '--ink2':'rgba(228,234,245,.7)', '--gold':'#2f6fe0', '--gold-hi':'#78a1eb', '--gold-lo':'#1f55b8', '--on-gold':'#ffffff' },
  moderno: { '--bg':'#061b1c', '--card':'#0b2627', '--card2':'#103032', '--line':'rgba(13,148,136,.28)', '--line2':'rgba(227,250,247,.10)', '--ink':'#e3faf7', '--ink2':'rgba(227,250,247,.7)', '--gold':'#0d9488', '--gold-hi':'#62b9b2', '--gold-lo':'#0b766c', '--on-gold':'#101114' },
  vito: { '--bg':'#1b1208', '--card':'#241a0f', '--card2':'#2d2213', '--line':'rgba(227,155,45,.28)', '--line2':'rgba(255,243,224,.10)', '--ink':'#fff3e0', '--ink2':'rgba(255,243,224,.7)', '--gold':'#e39b2d', '--gold-hi':'#edbe76', '--gold-lo':'#b8770f', '--on-gold':'#101114' },
  grafito: { '--bg':'#111113', '--card':'#19191c', '--card2':'#222226', '--line':'rgba(163,230,53,.28)', '--line2':'rgba(241,241,243,.10)', '--ink':'#f1f1f3', '--ink2':'rgba(241,241,243,.7)', '--gold':'#a3e635', '--gold-hi':'#c3ef7c', '--gold-lo':'#7cb518', '--on-gold':'#101114' },
  navidad: { '--bg':'#0a1d14', '--card':'#0f2a1d', '--card2':'#153626', '--line':'rgba(214,40,57,.28)', '--line2':'rgba(247,240,225,.10)', '--ink':'#f7f0e1', '--ink2':'rgba(247,240,225,.7)', '--gold':'#d62839', '--gold-hi':'#e4737e', '--gold-lo':'#a81d2b', '--on-gold':'#ffffff' },
  halloween: { '--bg':'#150a1f', '--card':'#1f0f2e', '--card2':'#2a163d', '--line':'rgba(255,90,31,.28)', '--line2':'rgba(246,236,255,.10)', '--ink':'#f6ecff', '--ink2':'rgba(246,236,255,.7)', '--gold':'#ff5a1f', '--gold-hi':'#ff946d', '--gold-lo':'#d4420c', '--on-gold':'#101114' },
  sanvalentin: { '--bg':'#1f0a14', '--card':'#2a0f1c', '--card2':'#361526', '--line':'rgba(212,42,120,.28)', '--line2':'rgba(255,238,243,.10)', '--ink':'#ffeef3', '--ink2':'rgba(255,238,243,.7)', '--gold':'#d42a78', '--gold-hi':'#e375a7', '--gold-lo':'#a81d5d', '--on-gold':'#ffffff' },
  velitas: { '--bg':'#0d0c26', '--card':'#16143a', '--card2':'#1f1c4b', '--line':'rgba(245,179,1,.28)', '--line2':'rgba(255,245,220,.10)', '--ink':'#fff5dc', '--ink2':'rgba(255,245,220,.7)', '--gold':'#f5b301', '--gold-hi':'#f8ce5a', '--gold-lo':'#d49500', '--on-gold':'#101114' }
};
function applyTh(th){
  const r = document.documentElement.style, all = TH.navidad;
  Object.keys(all).forEach(k => r.removeProperty(k));
  if(TH[th]) Object.entries(TH[th]).forEach(([k, v]) => r.setProperty(k, v));
  // El motivo que eligió el local (fiesta, fútbol, café…) manda sobre el de la temática.
  const mo = typeof cat !== 'undefined' && cat && cat.mo;
  fxSet(mo === 'ninguno' ? null : (mo || th));
}

/* ---------- Aplicar idioma: textos fijos + repintar todo lo dinámico ---------- */
function applyLangStatic(){
  document.documentElement.lang=LANG;
  $('sub').textContent=dom?t('domSubtitle'):t('subtitle');
  $('tpTxt').textContent=t('tabPedido');
  $('tcTxt').textContent=t('tabCancion');
  $('tqTxt').textContent=t('tabCuenta');
  $('rondaLbl').textContent=t('repetirRonda');
  $('pLabel').textContent=t('queVasAPedir');
  $('pHint').innerHTML='';
  $('pHint').appendChild(document.createTextNode(t('escribeSugerimos')+' '));
  const ie=document.createElement('i');ie.textContent=t('ejemploPedido');$('pHint').appendChild(ie);
  $('p').placeholder=t('ejemploPedidoPlaceholder');
  $('add').setAttribute('aria-label',t('addAria'));
  $('catX').textContent=t('cerrar');
  $('catBack').textContent=t('volverPedido');
  $('wa').textContent=t('waTxt');
  $('tuPedidoLbl').textContent=t('tuPedido');
  $('pideCancionLbl').textContent=t('pideCancion');
  $('hintCancionEl').textContent=t('hintCancion');
  $('s').placeholder=t('ejemploCancion');
  $('tuCuentaLbl').textContent=t('tuCuenta');
  $('hintCuentaEl').textContent=t('hintCuenta');
  $('n').placeholder=t('notaPlaceholder');
  $('nequiH').textContent=t('pagarTransfer');
  $('nequiInstr').textContent=t('transferInstr');
  $('nequiCopyBtn').textContent=t('copiar');$('trBrebCopy').textContent=t('copiar');
  $('trBrebLbl').textContent=t('llaveBreb');
  $('nequiPaidBtn').textContent=t('yaPagueTransfer');
  $('curr').setAttribute('aria-label',t('monedaLabel'));
  if(dom){
    $('domLbl').textContent=t('domDatos');
    $('domHint').textContent=t('domHint');
    $('domNom').placeholder=t('domNombre');
    $('domTel').placeholder=t('domTel');
    $('domDir').placeholder=t('domDir');
  }
  applyEasyMode();
  updateCurNote();
}
function refrescarVista(){
  $('t').textContent=dom?t('domLabel'):t('mesaLabel',{n:mesa||'?'});
  document.title=dom?t('domLabel'):t('mesaLabel',{n:mesa||'?'});
  pintarLineas();pintarRonda();pintarChips();pintarSug();
  if(modo=='c')info();
  pintarCat(!$('carta').hidden);
  if(snap)pintar(snap);else if(!v)$('cs').textContent=t('cuentaSinVivo');else if($('cs').textContent&&$('cs').textContent!==t('cargandoCuenta'))$('cs').textContent=t('cuentaSinConsumo');
  if(lastMsg)msg(lastMsg.builder(),lastMsg.cl);
  updateCurNote();
}
function setLang(l){
  LANG=l;try{localStorage.setItem(LANG_KEY,l)}catch(e){}
  applyLangStatic();refrescarVista();
}
function setCur(c2){
  CUR=c2;try{localStorage.setItem(CUR_KEY,c2)}catch(e){}
  refrescarVista();
}

/* ---------- Inicio ---------- */
applyLangStatic();
$('lang').value=LANG;$('lang').onchange=e=>setLang(e.target.value);
$('curr').value=CUR;$('curr').onchange=e=>setCur(e.target.value);
$('easyBtn').onclick=()=>setEasyMode(!EASY);
applyEasyMode();
pintarLineas();pintarRonda();pintarChips();cargarCat();
$('cs').textContent=v?t('cargandoCuenta'):t('cuentaSinVivo');
applyTh(cat && cat.th);
conectar();
actualizarTasas();
// 🔄 1.95.1: «estoy viendo la cuenta de esta mesa» (con el código de su QR): los equipos del negocio publican la cuenta en
// vivo al instante, aunque el cliente todavía no haya pedido nada desde el QR. Una vez cada 2 minutos como mucho.
function holaMesa(){
  if(!mesa||!c||!v||dom)return;
  try{const k='ordeva-hola-'+c+'-'+mesa,u=+sessionStorage.getItem(k)||0;if(Date.now()-u<12e4)return;sessionStorage.setItem(k,String(Date.now()));}catch(e){}
  const body=JSON.stringify({t:'hola',v:2,id:'h'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),mesa:+mesa,vm:v,at:Date.now()});
  fetch('https://canal.vento.local/'+c,{method:'POST',body}).catch(()=>{});
}
holaMesa();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!snap)holaMesa();});
