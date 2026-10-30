/* ORDEVA · app/04d-combos-estadisticas-carta.js — parte 4 de 8 de app/04-principal.js (antes dentro de index.html). Se carga en el mismo lugar y orden. */
/* ---------- Promociones y combos: un combo es un producto que descuenta varios ---------- */
const PROMO_CAT = 'cat-promos', PMS = 'style="padding:9px;font-size:14px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;min-width:0;flex:1"';
const promoNormal = c => (c || []).reduce((a, x) => { const p = data.products.find(y => y.id === x.id); return a + (p ? p.price * x.qty : 0); }, 0);
const promoText = c => (c || []).map(x => { const p = data.products.find(y => y.id === x.id); return p ? x.qty + '× ' + p.name : ''; }).filter(Boolean).join(' + ');
function renderPromos(){
  const L = data.products.filter(p => p.combo);
  document.getElementById('promoList').innerHTML = L.length ? L.map(p => { const n = promoNormal(p.combo), ah = n - p.price;
    return '<div class="inv-row"><div><b>🎁 ' + invEsc(p.name) + '</b><small>' + invEsc(promoText(p.combo)) + '</small><small>' + fmt(p.price) + (ah > 0 ? ' · normal ' + fmt(n) + ' · ahorra ' + fmt(ah) + ' (' + Math.round(ah / n * 100) + '%)' : '') + '</small></div><div class="inv-btns"><button class="btn-ghost" data-act="edit" data-id="' + p.id + '">Editar</button><button class="btn-ghost" data-act="del" data-id="' + p.id + '">Eliminar</button></div></div>'; }).join('')
    : '<div class="empty-state">Aún no tienes combos ni promociones. Crea uno: por ejemplo "6 águilas + papas" a precio especial, o un 2x1 (2 unidades al precio de 1).</div>';
}
function promoOpen(id){
  const ed = id ? data.products.find(p => p.id === id) : null, c = (ed && ed.combo) || [];
  const real = data.products.filter(p => !p.combo).sort((a, b) => a.name.localeCompare(b.name));
  const opts = sel => '<option value="">—</option>' + real.map(p => '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + invEsc(p.name + (p.size ? ' ' + p.size : '')) + ' · ' + fmt(p.price) + '</option>').join('');
  const rows = [0, 1, 2, 3].map(i => '<div style="display:flex;gap:6px"><select class="pmP" ' + PMS + '>' + opts(c[i] && c[i].id) + '</select><input class="pmQ" type="number" inputmode="numeric" min="1" value="' + (c[i] ? c[i].qty : 1) + '" ' + PMS.replace('flex:1', 'width:62px;flex:none') + '></div>').join('');
  const TXT = INV_IN.replace('type="number" inputmode="numeric" min="0"', 'type="text"');
  const rd = o => { const q = o.querySelectorAll('.pmQ'); return [...o.querySelectorAll('.pmP')].map((s, i) => ({ id: s.value, qty: Math.max(1, parseInt(q[i].value, 10) || 1) })).filter(x => x.id); };
  const o = invDlg('<b>🎁 ' + (ed ? 'Editar' : 'Nuevo') + ' combo o promoción</b><input id="pmName" ' + TXT + ' placeholder="Nombre (ej. Combo 6 águilas)" value="' + invEsc(ed ? ed.name : '') + '"><small style="color:var(--ink-soft)">Qué incluye (hasta 4 productos y cuántas unidades de cada uno):</small>' + rows +
    '<input id="pmPrice" ' + INV_IN + ' placeholder="Precio del combo $" value="' + (ed ? ed.price : '') + '"><small id="pmInfo" style="color:var(--ink-soft)"></small>', o => {
    const name = o.querySelector('#pmName').value.trim(), price = parseFloat(o.querySelector('#pmPrice').value), comp = rd(o);
    if(!name || isNaN(price) || price < 0 || !comp.length){ showToast('Pon un nombre, un precio y al menos un producto.'); return false; }
    if(data.products.some(p => p.id !== (ed && ed.id) && dupKey(p) === dupKey({ name }))){ showToast('Ya existe un producto con ese nombre.'); return false; }
    if(!data.categories.some(k => k.id === PROMO_CAT)) data.categories.push({ id: PROMO_CAT, name: 'Promociones y combos' });
    if(ed){ ed.name = name; ed.price = price; ed.combo = comp; } else data.products.push({ id: 'combo-' + Date.now(), name, price, categoryId: PROMO_CAT, combo: comp });
    saveData(); renderPromos(); renderProductos();
  });
  const upd = () => { const n = promoNormal(rd(o)), p = parseFloat(o.querySelector('#pmPrice').value); o.querySelector('#pmInfo').textContent = 'Precio normal: ' + fmt(n) + (p >= 0 && n > p ? ' · el cliente ahorra ' + fmt(n - p) + ' (' + Math.round((n - p) / n * 100) + '%)' : ''); };
  o.addEventListener('input', upd); o.addEventListener('change', upd); upd();
}
document.getElementById('promoNew').addEventListener('click', () => promoOpen());
document.getElementById('promoList').addEventListener('click', async e => {
  const b = e.target.closest('button[data-act]'); if(!b) return;
  if(b.dataset.act === 'edit') return promoOpen(b.dataset.id);
  const p = data.products.find(x => x.id === b.dataset.id); if(!p) return;
  if(await showConfirm({ title: '¿Eliminar combo?', message: '"' + p.name + '" se elimina. Las cuentas abiertas que ya lo tengan no cambian.', confirmText: 'Sí, eliminar', icon: '🗑️' })){ data.products = data.products.filter(x => x.id !== p.id); saveData(); renderPromos(); renderProductos(); }
});

/* ---------- Idiomas (es, en, 中文, हिन्दी, fr) ---------- */
const I18N_T = [
["Mesas", "Tables", "桌台", "मेज़ें", "Tables", "Mesas"],
["Mesa", "Table", "桌", "मेज़", "Table", "Mesa"],
["🍳 Cocina", "🍳 Kitchen", "🍳 厨房", "🍳 रसोई", "🍳 Cuisine", "🍳 Cozinha"],
["Productos", "Products", "商品", "उत्पाद", "Produits", "Produtos"],
["Inventario", "Inventory", "库存", "इन्वेंटरी", "Inventaire", "Estoque"],
["Historial", "History", "历史记录", "इतिहास", "Historique", "Histórico"],
["🎵 Música", "🎵 Music", "🎵 音乐", "🎵 संगीत", "🎵 Musique", "🎵 Música"],
["⚙️ Ajustes", "⚙️ Settings", "⚙️ 设置", "⚙️ सेटिंग्स", "⚙️ Réglages", "⚙️ Configurações"],
["📊 Estadísticas", "📊 Statistics", "📊 统计", "📊 आँकड़े", "📊 Statistiques", "📊 Estatísticas"],
["📖 Carta", "📖 Menu", "📖 酒水单", "📖 मेन्यू", "📖 Carte", "📖 Cardápio"],
["Cocina", "Kitchen", "厨房", "रसोई", "Cuisine", "Cozinha"],
["libre", "free", "空闲", "खाली", "libre", "livre"],
["libres", "free", "空闲", "खाली", "libres", "livres"],
["abierta", "open", "使用中", "खुली", "ouverte", "aberta"],
["abiertas", "open", "使用中", "खुली", "ouvertes", "abertas"],
["por cobrar", "to collect", "待收款", "वसूली बाकी", "à encaisser", "a receber"],
["🪑 Número de mesas", "🪑 Number of tables", "🪑 桌台数量", "🪑 मेज़ों की संख्या", "🪑 Nombre de tables", "🪑 Número de mesas"],
["Estadísticas", "Statistics", "统计", "आँकड़े", "Statistiques", "Estatísticas"],
["Música", "Music", "音乐", "संगीत", "Musique", "Música"],
["Ajustes", "Settings", "设置", "सेटिंग्स", "Réglages", "Configurações"],
["Más", "More", "更多", "और", "Plus", "Mais"],
["Más secciones", "More sections", "更多栏目", "और अनुभाग", "Plus de sections", "Mais seções"],
["Ventas y ganancias", "Sales and profit", "销售与利润", "बिक्री और मुनाफ़ा", "Ventes et bénéfices", "Vendas e lucro"],
["Lo que ven tus clientes", "What your customers see", "顾客看到的内容", "आपके ग्राहक क्या देखते हैं", "Ce que voient vos clients", "O que seus clientes veem"],
["Cuentas cerradas y fiados", "Closed bills and tabs", "已结账单和赊账", "बंद बिल और उधार", "Additions fermées et crédits", "Contas fechadas e fiados"],
["Canciones que piden", "Song requests", "点歌", "गानों की फ़रमाइश", "Chansons demandées", "Músicas pedidas"],
["Configura tu negocio", "Set up your business", "设置你的店铺", "अपना व्यवसाय सेट करें", "Configurez votre commerce", "Configure seu negócio"],
["Pregúntale lo que sea", "Ask it anything", "随便问", "कुछ भी पूछें", "Demandez-lui tout", "Pergunte qualquer coisa"],
["🍻 Carta", "🍻 Menu", "🍻 酒水单", "🍻 मेन्यू", "🍻 Carte", "🍻 Cardápio"],
["🍽️ Menú", "🍽️ Menu", "🍽️ 菜单", "🍽️ मेन्यू", "🍽️ Menu", "🍽️ Cardápio"],
["Menú", "Menu", "菜单", "मेन्यू", "Menu", "Cardápio"],
["Carta", "Menu", "菜单", "मेन्यू", "Carte", "Cardápio"],
["Nada coincide con la búsqueda.", "Nothing matches your search.", "没有匹配的搜索结果。", "खोज से कुछ मेल नहीं खाता।", "Aucun résultat pour la recherche.", "Nada corresponde à busca."],
["Hoy", "Today", "今天", "आज", "Aujourd’hui", "Hoje"],
["7 días", "7 days", "7天", "7 दिन", "7 jours", "7 dias"],
["30 días", "30 days", "30天", "30 दिन", "30 jours", "30 dias"],
["Todo", "All", "全部", "सब", "Tout", "Tudo"],
["💵 Ventas", "💵 Sales", "💵 销售", "💵 बिक्री", "💵 Ventes", "💵 Vendas"],
["📦 Inventario", "📦 Inventory", "📦 库存", "📦 इन्वेंटरी", "📦 Inventaire", "📦 Estoque"],
["💰 Ventas", "💰 Sales", "💰 销售额", "💰 बिक्री", "💰 Ventes", "💰 Vendas"],
["🧾 Cuentas", "🧾 Bills", "🧾 账单", "🧾 बिल", "🧾 Additions", "🧾 Contas"],
["🎟️ Ticket promedio", "🎟️ Average ticket", "🎟️ 平均客单价", "🎟️ औसत बिल", "🎟️ Ticket moyen", "🎟️ Ticket médio"],
["🍺 Unidades vendidas", "🍺 Units sold", "🍺 销售数量", "🍺 बिकी इकाइयाँ", "🍺 Unités vendues", "🍺 Unidades vendidas"],
["📒 Fiado (debe)", "📒 On credit (owed)", "📒 赊账", "📒 उधार", "📒 À crédit (dû)", "📒 Fiado (a receber)"],
["📅 Promedio por día", "📅 Daily average", "📅 日均", "📅 दैनिक औसत", "📅 Moyenne par jour", "📅 Média diária"],
["📈 Ventas por día", "📈 Sales per day", "📈 每日销售", "📈 दैनिक बिक्री", "📈 Ventes par jour", "📈 Vendas por dia"],
["📈 Ventas por hora", "📈 Sales per hour", "📈 每小时销售", "📈 प्रति घंटा बिक्री", "📈 Ventes par heure", "📈 Vendas por hora"],
["📈 Ventas por mes", "📈 Sales per month", "📈 每月销售", "📈 मासिक बिक्री", "📈 Ventes par mois", "📈 Vendas por mês"],
["🏆 Lo más vendido (unidades)", "🏆 Top sellers (units)", "🏆 热销商品（数量）", "🏆 सबसे ज़्यादा बिके (इकाइयाँ)", "🏆 Les plus vendus (unités)", "🏆 Mais vendidos (unidades)"],
["💳 Cómo te pagaron", "💳 How they paid", "💳 支付方式", "💳 भुगतान का तरीका", "💳 Modes de paiement", "💳 Como pagaram"],
["🗂️ Ventas por categoría", "🗂️ Sales by category", "🗂️ 分类销售", "🗂️ श्रेणी अनुसार बिक्री", "🗂️ Ventes par catégorie", "🗂️ Vendas por categoria"],
["🕒 Horas pico (en el período)", "🕒 Peak hours", "🕒 高峰时段", "🕒 व्यस्त घंटे", "🕒 Heures de pointe", "🕒 Horários de pico (no período)"],
["🪑 Ventas por mesa", "🪑 Sales by table", "🪑 各桌销售", "🪑 मेज़ अनुसार बिक्री", "🪑 Ventes par table", "🪑 Vendas por mesa"],
["📉 Se agotan primero", "📉 Running out first", "📉 最先售罄", "📉 सबसे पहले खत्म", "📉 Bientôt épuisés", "📉 Acabando primeiro"],
["💹 Rentabilidad", "💹 Profitability", "💹 盈利能力", "💹 लाभप्रदता", "💹 Rentabilité", "💹 Rentabilidade"],
["🧮 Margen bruto", "🧮 Gross margin", "🧮 毛利润", "🧮 सकल मार्जिन", "🧮 Marge brute", "🧮 Margem bruta"],
["📊 Margen %", "📊 Margin %", "📊 利润率", "📊 मार्जिन %", "📊 Marge %", "📊 Margem %"],
["🥇 Más rentable (margen)", "🥇 Most profitable (margin)", "🥇 利润最高（毛利）", "🥇 सबसे लाभदायक (मार्जिन)", "🥇 Les plus rentables (marge)", "🥇 Mais lucrativos (margem)"],
["📊 Vs. período anterior", "📊 Vs. previous period", "📊 对比上一周期", "📊 पिछली अवधि की तुलना में", "📊 Vs période précédente", "📊 Vs. período anterior"],
["Configura el costo de tus productos (en Productos → Editar) para ver aquí el margen de ganancia.", "Set your products’ cost (in Products → Edit) to see profit margin here.", "在“商品 → 编辑”中设置商品成本，即可在这里查看利润率。", "मार्जिन देखने के लिए अपने उत्पादों की लागत सेट करें (उत्पाद → संपादित करें में)।", "Renseignez le coût de vos produits (dans Produits → Modifier) pour voir la marge ici.", "Configure o custo dos seus produtos (em Produtos → Editar) para ver a margem aqui."],
["🎁 Combos y promociones", "🎁 Combos & promotions", "🎁 套餐与促销", "🎁 कॉम्बो और प्रमोशन", "🎁 Combos et promotions", "🎁 Combos e promoções"],
["➕ Nuevo combo o promoción", "➕ New combo or promotion", "➕ 新建套餐或促销", "➕ नया कॉम्बो या प्रमोशन", "➕ Nouveau combo ou promotion", "➕ Novo combo ou promoção"],
["Editar", "Edit", "编辑", "संपादित करें", "Modifier", "Editar"],
["Eliminar", "Delete", "删除", "हटाएँ", "Supprimer", "Excluir"],
["🌐 Idioma", "🌐 Language", "🌐 语言", "🌐 भाषा", "🌐 Langue", "🌐 Idioma"],
["Agrega productos para armar tu carta.", "Add products to build your menu.", "添加商品以创建您的菜单。", "अपना मेन्यू बनाने के लिए उत्पाद जोड़ें।", "Ajoutez des produits pour créer votre carte.", "Adicione produtos para montar sua carta."],
["Agrega productos para armar tu menú.", "Add products to build your menu.", "添加商品以创建您的菜单。", "अपना मेन्यू बनाने के लिए उत्पाद जोड़ें।", "Ajoutez des produits pour créer votre menu.", "Adicione produtos para montar seu cardápio."],
["Número de mesas:", "Number of tables:", "桌数：", "मेज़ों की संख्या:", "Nombre de tables :", "Número de mesas:"],
["Aplicar", "Apply", "应用", "लागू करें", "Appliquer", "Aplicar"],
["📋 Lista", "📋 List", "📋 列表", "📋 सूची", "📋 Liste", "📋 Lista"],
["🗺️ Mapa del local", "🗺️ Floor map", "🗺️ 店铺地图", "🗺️ दुकान का नक्शा", "🗺️ Plan du local", "🗺️ Mapa do local"],
["🧾 Cuenta general", "🧾 General bill", "🧾 总账单", "🧾 सामान्य बिल", "🧾 Addition générale", "🧾 Conta geral"],
["✋ Ubicar mesas (arrastrar)", "✋ Place tables (drag)", "✋ 摆放桌子（拖动）", "✋ मेज़ें व्यवस्थित करें (खींचें)", "✋ Placer les tables (glisser)", "✋ Posicionar mesas (arrastar)"],
["↺ Reordenar en cuadrícula", "↺ Reset to grid", "↺ 重新排列为网格", "↺ ग्रिड में पुनर्व्यवस्थित करें", "↺ Réorganiser en grille", "↺ Reorganizar em grade"],
["📷 Escanear con IA + web", "📷 Scan with AI + web", "📷 用AI+网络扫描", "📷 AI + वेब से स्कैन करें", "📷 Scanner avec IA + web", "📷 Escanear com IA + web"],
["⚙️ Configurar IA", "⚙️ Configure AI", "⚙️ 配置AI", "⚙️ AI कॉन्फ़िगर करें", "⚙️ Configurer l’IA", "⚙️ Configurar IA"],
["🎤 Producto por voz + IA", "🎤 Product by voice + AI", "🎤 语音+AI录入商品", "🎤 आवाज़ + AI से उत्पाद जोड़ें", "🎤 Produit par la voix + IA", "🎤 Produto por voz + IA"],
["Crear", "Create", "创建", "बनाएं", "Créer", "Criar"],
["Cancelar", "Cancel", "取消", "रद्द करें", "Annuler", "Cancelar"],
["Agregar", "Add", "添加", "जोड़ें", "Ajouter", "Adicionar"],
["📷 Escanear para dar entrada", "📷 Scan to add stock", "📷 扫描入库", "📷 स्टॉक जोड़ने हेतु स्कैन करें", "📷 Scanner pour ajouter au stock", "📷 Escanear para dar entrada"],
["🧩 Unir repetidos", "🧩 Merge duplicates", "🧩 合并重复项", "🧩 डुप्लिकेट मिलाएँ", "🧩 Fusionner les doublons", "🧩 Unir duplicados"],
["🏷️ Escanear precio y margen", "🏷️ Scan price & margin", "🏷️ 扫描价格和利润率", "🏷️ कीमत और मार्जिन स्कैन करें", "🏷️ Scanner prix et marge", "🏷️ Escanear preço e margem"],
["📤 Publicar en QR", "📤 Publish to QR", "📤 发布到二维码", "📤 QR पर प्रकाशित करें", "📤 Publier sur le QR", "📤 Publicar no QR"],
["📋 Compartir", "📋 Share", "📋 分享", "📋 साझा करें", "📋 Partager", "📋 Compartilhar"],
["🖨️ Imprimir", "🖨️ Print", "🖨️ 打印", "🖨️ प्रिंट करें", "🖨️ Imprimer", "🖨️ Imprimir"],
["Así la ven tus clientes al escanear el QR de la mesa.", "This is what your customers see when they scan the table’s QR.", "这是顾客扫描桌台二维码时看到的内容。", "मेज़ का QR स्कैन करने पर ग्राहकों को यही दिखता है।", "C’est ce que vos clients voient en scannant le QR de la table.", "É assim que seus clientes veem ao escanear o QR da mesa."],
["🔒 Cerrar caja del día", "🔒 Close the day’s register", "🔒 结束当日收银", "🔒 दिन का कैश बंद करें", "🔒 Clôturer la caisse du jour", "🔒 Fechar caixa do dia"],
["🗑️ Borrar historial de un día", "🗑️ Delete a day’s history", "🗑️ 删除某天的历史记录", "🗑️ किसी दिन का इतिहास हटाएँ", "🗑️ Supprimer l’historique d’un jour", "🗑️ Excluir histórico de um dia"],
["Todos", "All", "全部", "सभी", "Tous", "Todos"],
["✅ Pagaron", "✅ Paid", "✅ 已付款", "✅ भुगतान हुआ", "✅ Payé", "✅ Pagaram"],
["⏳ Deben", "⏳ Owing", "⏳ 欠款", "⏳ बकाया", "⏳ Doivent", "⏳ Devendo"],
["📊 Ver gráficas de ventas", "📊 View sales charts", "📊 查看销售图表", "📊 बिक्री चार्ट देखें", "📊 Voir les graphiques de ventes", "📊 Ver gráficos de vendas"],
["Cierres de caja", "Register closures", "收银结算记录", "कैश समापन", "Clôtures de caisse", "Fechamentos de caixa"],
["Resumen general", "General summary", "总体摘要", "सामान्य सारांश", "Résumé général", "Resumo geral"],
["Cuentas cerradas", "Closed bills", "已结账单", "बंद किए गए बिल", "Additions clôturées", "Contas fechadas"],
["🎵 Cola de música", "🎵 Music queue", "🎵 音乐队列", "🎵 संगीत कतार", "🎵 File d’attente musicale", "🎵 Fila de música"],
["📥 Cargar en mi lista de YouTube Music", "📥 Load into my YouTube Music playlist", "📥 加载到我的YouTube Music播放列表", "📥 मेरी YouTube Music प्लेलिस्ट में लोड करें", "📥 Charger dans ma playlist YouTube Music", "📥 Carregar na minha playlist do YouTube Music"],
["Abrir lista", "Open playlist", "打开播放列表", "प्लेलिस्ट खोलें", "Ouvrir la playlist", "Abrir playlist"],
["▶ Siguiente canción", "▶ Next song", "▶ 下一首歌", "▶ अगला गाना", "▶ Chanson suivante", "▶ Próxima música"],
["Vaciar cola", "Clear queue", "清空队列", "कतार खाली करें", "Vider la file", "Esvaziar fila"],
["📺 Música en el TV", "📺 Music on TV", "📺 电视上播放音乐", "📺 टीवी पर संगीत", "📺 Musique à la télé", "📺 Música na TV"],
["🔊 Reproducción automática", "🔊 Auto play", "🔊 自动播放", "🔊 ऑटो प्ले", "🔊 Lecture automatique", "🔊 Reprodução automática"],
["Cómo se reparte", "How it’s shared", "分配方式", "यह कैसे बंटता है", "Comment ça se répartit", "Como é distribuído"],
["▶ YouTube Music automático", "▶ Automatic YouTube Music", "▶ 自动YouTube Music", "▶ स्वचालित YouTube Music", "▶ YouTube Music automatique", "▶ YouTube Music automático"],
["Conectar con Google", "Connect with Google", "连接Google账号", "Google से कनेक्ट करें", "Se connecter avec Google", "Conectar com o Google"],
["Restablecer", "Reset", "重置", "रीसेट करें", "Réinitialiser", "Restablecer"],
["Restablecer día", "Reset the day", "重置当日", "दिन रीसेट करें", "Réinitialiser la journée", "Restablecer o dia"],
["Restablecer todo", "Reset everything", "全部重置", "सब कुछ रीसेट करें", "Tout réinitialiser", "Restablecer tudo"],
["Borrar nombres de todas las mesas", "Clear all table names", "清除所有桌子名称", "सभी मेज़ों के नाम हटाएँ", "Effacer les noms de toutes les tables", "Apagar nomes de todas as mesas"],
["Cuenta y negocio", "Account and business", "账户与商家", "खाता और व्यवसाय", "Compte et commerce", "Conta e negócio"],
["Micrófono", "Microphone", "麦克风", "माइक्रोफ़ोन", "Microphone", "Microfone"],
["Datos y transferencia", "Data and transfer", "数据与传输", "डेटा और ट्रांसफर", "Données et transfert", "Dados e transferência"],
["💾 Guardar", "💾 Save", "💾 保存", "💾 सहेजें", "💾 Enregistrer", "💾 Salvar"],
["📤 Transferir", "📤 Transfer", "📤 传输", "📤 ट्रांसफर करें", "📤 Transférer", "📤 Transferir"],
["📥 Recibir", "📥 Receive", "📥 接收", "📥 प्राप्त करें", "📥 Recevoir", "📥 Receber"],
["Cierre automático de caja", "Automatic register closing", "自动收银结算", "स्वचालित कैश समापन", "Clôture automatique de caisse", "Fechamento automático de caixa"],
["QR de las mesas (permanentes)", "Table QR codes (permanent)", "桌台二维码（永久）", "मेज़ों के QR कोड (स्थायी)", "QR des tables (permanents)", "QR das mesas (permanentes)"],
["Ver QR", "View QR", "查看二维码", "QR देखें", "Voir le QR", "Ver QR"],
["🖨️ Imprimir todos", "🖨️ Print all", "🖨️ 全部打印", "🖨️ सभी प्रिंट करें", "🖨️ Tout imprimer", "🖨️ Imprimir todos"],
["📤 Publicar catálogo", "📤 Publish catalog", "📤 发布商品目录", "📤 कैटलॉग प्रकाशित करें", "📤 Publier le catalogue", "📤 Publicar catálogo"],
["Letra", "Typeface", "字体", "फ़ॉन्ट", "Police", "Fonte"],
["Fondo de la aplicación", "App background", "应用背景", "ऐप पृष्ठभूमि", "Fond de l’application", "Plano de fundo do app"],
["🖼️ Elegir foto", "🖼️ Choose photo", "🖼️ 选择照片", "🖼️ फ़ोटो चुनें", "🖼️ Choisir une photo", "🖼️ Escolher foto"],
["Quitar", "Remove", "移除", "हटाएँ", "Retirer", "Remover"],
["Apariencia", "Appearance", "外观", "रूप", "Apparence", "Aparência"],
["🧓 Modo fácil", "🧓 Easy mode", "🧓 简易模式", "🧓 आसान मोड", "🧓 Mode simplifié", "🧓 Modo fácil"],
["Activar modo fácil", "Turn on easy mode", "开启简易模式", "आसान मोड चालू करें", "Activer le mode simplifié", "Ativar modo fácil"],
["Salir", "Log out", "退出登录", "लॉग आउट करें", "Se déconnecter", "Sair"],
["Generar código", "Generate code", "生成代码", "कोड जनरेट करें", "Générer le code", "Gerar código"],
["🧮 Calculadoras rápidas", "🧮 Quick calculators", "🧮 快速计算器", "🧮 त्वरित कैलकुलेटर", "🧮 Calculatrices rapides", "🧮 Calculadoras rápidas"],
["Descuento", "Discount", "折扣", "छूट", "Remise", "Desconto"],
["Prima / Bonificación", "Bonus / Prima", "奖金/Prima", "बोनस / प्राइमा", "Prime / Bonus", "Prêmio / Bonificação"],
["Calcular DV", "Calculate check digit", "计算校验码", "जाँच अंक गणना करें", "Calculer le chiffre de contrôle", "Calcular DV"],
["🏷️ Imprimir etiquetas", "🏷️ Print labels", "🏷️ 打印标签", "🏷️ लेबल प्रिंट करें", "🏷️ Imprimer les étiquettes", "🏷️ Imprimir etiquetas"],
["📊 Código de barras", "📊 Barcode", "📊 条形码", "📊 बारकोड", "📊 Code-barres", "📊 Código de barras"],
["▦ Código QR", "▦ QR code", "▦ 二维码", "▦ QR कोड", "▦ Code QR", "▦ Código QR"],
["💜 Pasarela de pago (Nequi)", "💜 Payment gateway (Nequi)", "💜 支付网关（Nequi）", "💜 भुगतान गेटवे (Nequi)", "💜 Passerelle de paiement (Nequi)", "💜 Gateway de pagamento (Nequi)"],
["Aceptar pagos por Nequi", "Accept payments via Nequi", "接受 Nequi 支付", "Nequi से भुगतान स्वीकार करें", "Accepter les paiements via Nequi", "Aceitar pagamentos pelo Nequi"],
["Tu número de Nequi", "Your Nequi number", "你的 Nequi 号码", "आपका Nequi नंबर", "Votre numéro Nequi", "Seu número do Nequi"],
["Nombre en la cuenta (opcional)", "Account name (optional)", "账户姓名（可选）", "खाता नाम (वैकल्पिक)", "Nom du compte (facultatif)", "Nome na conta (opcional)"],
["🛵 Domicilios", "🛵 Delivery", "🛵 外卖配送", "🛵 डिलीवरी", "🛵 Livraison", "🛵 Entregas"],
["Activar domicilios", "Turn on delivery", "开启外卖配送", "डिलीवरी चालू करें", "Activer la livraison", "Ativar entregas"],
["✅ Listo", "✅ Ready", "✅ 完成", "✅ तैयार", "✅ Prêt", "✅ Pronto"],
["↩️ Reabrir", "↩️ Reopen", "↩️ 重新打开", "↩️ फिर से खोलें", "↩️ Rouvrir", "↩️ Reabrir"],
["✅ Aceptar", "✅ Accept", "✅ 接受", "✅ स्वीकार करें", "✅ Accepter", "✅ Aceitar"],
["❌ Rechazar", "❌ Reject", "❌ 拒绝", "❌ अस्वीकार करें", "❌ Rejeter", "❌ Rejeitar"],
["📥 Pedidos nuevos por confirmar", "📥 New orders to confirm", "📥 待确认的新订单", "📥 पुष्टि हेतु नए ऑर्डर", "📥 Nouvelles commandes à confirmer", "📥 Novos pedidos para confirmar"],
["No hay pedidos abiertos en este momento. 🎉", "No open orders right now. 🎉", "目前没有待处理的订单。🎉", "अभी कोई खुला ऑर्डर नहीं है। 🎉", "Aucune commande ouverte pour le moment. 🎉", "Nenhum pedido em aberto no momento. 🎉"],
["🔳 Escanear código", "🔳 Scan code", "🔳 扫描代码", "🔳 कोड स्कैन करें", "🔳 Scanner le code", "🔳 Escanear código"],
["🔳 Vender escaneando código", "🔳 Sell by scanning code", "🔳 扫码销售", "🔳 स्कैन करके बेचें", "🔳 Vendre en scannant le code", "🔳 Vender escaneando código"],
["Apunta la cámara al código del producto.", "Point the camera at the product's code.", "将相机对准产品代码。", "उत्पाद के कोड पर कैमरा फोकस करें।", "Pointez la caméra vers le code du produit.", "Aponte a câmera para o código do produto."],
["Escanea el código del producto para agregarlo a la cuenta — puedes escanear varios seguidos.", "Scan the product's code to add it to the bill — you can scan several in a row.", "扫描产品代码将其添加到账单中——可以连续扫描多个。", "उत्पाद का कोड स्कैन करके बिल में जोड़ें — लगातार कई स्कैन कर सकते हैं।", "Scannez le code du produit pour l'ajouter à l'addition — vous pouvez en scanner plusieurs à la suite.", "Escaneie o código do produto para adicioná-lo à conta — você pode escanear vários seguidos."],
["Escanea el código de barras o QR de un producto para agregarlo o encontrarlo.", "Scan a product's barcode or QR code to add or find it.", "扫描产品的条形码或二维码以添加或查找它。", "किसी उत्पाद का बारकोड या QR कोड स्कैन करके उसे जोड़ें या खोजें।", "Scannez le code-barres ou le QR code d'un produit pour l'ajouter ou le trouver.", "Escaneie o código de barras ou QR de um produto para adicioná-lo ou encontrá-lo."]
];
const I18N = { en: {}, zh: {}, hi: {}, fr: {}, pt: {} };
I18N_T.forEach(r => ['en', 'zh', 'hi', 'fr', 'pt'].forEach((l, i) => { I18N[l][r[0]] = r[i + 1]; }));
const LANG_KEY = 'cm-lang';
let LANG = (() => { try{ return localStorage.getItem(LANG_KEY) || 'es'; }catch(e){ return 'es'; } })();
const I18N_ATTR = ['placeholder', 'aria-label', 'title'];
const i18nPut = k => LANG === 'es' ? k : ((I18N[LANG] || {})[k] || k);
function i18nNode(n){
  if(n.nodeType === 3){
    const raw = n.nodeValue, k = n._k || raw.trim();
    if(!k || !(k in I18N.en)) return;
    n._k = k; const t = i18nPut(k), m = raw.match(/^(\s*)[\s\S]*?(\s*)$/);
    if(raw.trim() !== t) n.nodeValue = m[1] + t + m[2];
  }else if(n.nodeType === 1){
    I18N_ATTR.forEach(a => { const v = n.getAttribute(a); if(v == null) return; n._ka = n._ka || {}; const k = (v in I18N.en) ? v : (n._ka[a] || v); if(!(k in I18N.en)) return; n._ka[a] = k; const t = i18nPut(k); if(v !== t) n.setAttribute(a, t); });
  }
}
function i18nAll(root){
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while((n = w.nextNode())){ const tg = n.parentNode.tagName; if(tg !== 'SCRIPT' && tg !== 'STYLE') i18nNode(n); }
  if(root.nodeType === 1){ i18nNode(root); root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(i18nNode); }
}
/* Reaplica el idioma a todas las vistas dinámicas: algunas etiquetas se arman
   pegando texto con datos (nombre del negocio, período elegido…) y por eso no
   basta con barrer el DOM — hay que volver a generarlas para que también queden
   en el idioma elegido, estén o no visibles en este momento. */
try{ const dets = document.querySelectorAll('.tv-opt'); let g = null; try{ g = JSON.parse(localStorage.getItem('vito_tvopt') || 'null'); }catch(e){}
  dets.forEach((d, k) => { if(Array.isArray(g)) d.open = g.includes(k); d.addEventListener('toggle', () => { try{ localStorage.setItem('vito_tvopt', JSON.stringify([...dets].map((x, i) => x.open ? i : -1).filter(i => i >= 0))); }catch(e){} }); }); }catch(e){}
function i18nRefreshDynamic(){
  try{ if(typeof data === 'undefined' || !data) return; }catch(e){ return; }
  try{ if(typeof cartaLabel === 'function') cartaLabel(); }catch(e){}
  try{ if(typeof renderCarta === 'function') renderCarta(); }catch(e){}
  try{ if(typeof renderStats === 'function') renderStats(); }catch(e){}
}
function setLang(l){ LANG = l; try{ localStorage.setItem(LANG_KEY, l); }catch(e){} document.documentElement.lang = l; i18nAll(document.body); i18nRefreshDynamic(); }
new MutationObserver(ms => { if(LANG === 'es') return; ms.forEach(m => { if(m.type === 'attributes') i18nNode(m.target); else m.addedNodes.forEach(nd => nd.nodeType === 3 ? i18nNode(nd) : nd.nodeType === 1 && i18nAll(nd)); }); })
  .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: I18N_ATTR });
if(LANG !== 'es'){ document.documentElement.lang = LANG; i18nAll(document.body); }

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
window.FX_SETS_ALL = FX_SETS;
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

document.getElementById('langSel').value = LANG;
document.getElementById('langSel').addEventListener('change', e => setLang(e.target.value));

/* ---------- Estadísticas: ventas e inventario con gráficas ---------- */
let stPer = '7';
const stMoney = n => fmt(Math.round(n || 0));
function stBars(items){                          // columnas verticales [{l,v,t}]
  const mx = Math.max(1, ...items.map(i => i.v)), every = Math.ceil(items.length / 8);
  return '<div class="st-bars">' + items.map((i, k) => '<div class="st-col" title="' + invEsc(i.t) + '"><div class="st-bar" style="height:' + (i.v ? Math.max(3, Math.round(i.v / mx * 100)) : 0) + '%"></div><span>' + (k % every === 0 ? invEsc(i.l) : '') + '</span></div>').join('') + '</div>';
}
function stRows(items){                          // barras horizontales [{l,v,t,c}]
  const mx = Math.max(1, ...items.map(i => i.v));
  return items.map(i => '<div class="st-row"><div class="st-rl" title="' + invEsc(i.l) + '">' + invEsc(i.l) + '</div><div class="st-rt"><i style="width:' + Math.max(2, Math.round(i.v / mx * 100)) + '%' + (i.c ? ';background:' + i.c : '') + '"></i></div><b>' + invEsc(i.t) + '</b></div>').join('');
}
function stDonut(parts){                         // [{l,v,c}]
  const tot = parts.reduce((a, p) => a + p.v, 0); if(!tot) return '';
  let off = 0;
  const segs = parts.filter(p => p.v > 0).map(p => { const pc = p.v / tot * 100, sg = '<circle r="15.9155" cx="21" cy="21" fill="none" stroke="' + p.c + '" stroke-width="7" stroke-dasharray="' + pc + ' ' + (100 - pc) + '" stroke-dashoffset="' + (25 - off) + '"/>'; off += pc; return sg; }).join('');
  return '<div class="st-donut"><svg viewBox="0 0 42 42" width="130" height="130">' + segs + '</svg><div>' + parts.map(p => '<div class="st-leg"><i style="background:' + p.c + '"></i>' + invEsc(p.l) + ' <b>' + stMoney(p.v) + '</b> <small>' + Math.round(p.v / tot * 100) + '%</small></div>').join('') + '</div></div>';
}
const stCard = (t, b) => '<div class="st-card"><h3>' + t + '</h3>' + b + '</div>';
const stKpi = (l, v) => '<div class="st-kpi"><small>' + l + '</small><b>' + v + '</b></div>';

// ---------- Comparativo por semana y mes calendario (independiente del filtro de período) ----------
function stStartOfWeek(d){ const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }
function stSumBetween(from, to){ return (data.history || []).reduce((s, h) => { const t = new Date(h.date).getTime(); return (t >= from && t < to) ? s + (h.total || 0) : s; }, 0); }
function stPctChange(cur, prev){
  if(prev === 0 && cur === 0) return '—';
  if(prev === 0) return '▲ 100%';
  const pc = Math.round((cur - prev) / prev * 100);
  return (pc >= 0 ? '▲ ' : '▼ ') + Math.abs(pc) + '%';
}
function calendarComparisonCard(){
  const now = new Date(), nowMs = Date.now() + 1;
  const wStart = stStartOfWeek(now), wStartMs = +wStart, prevWStart = wStartMs - 7 * 864e5;
  const thisWeek = stSumBetween(wStartMs, nowMs), lastWeek = stSumBetween(prevWStart, wStartMs);
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1), prevMStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = stSumBetween(+mStart, nowMs), lastMonth = stSumBetween(+prevMStart, +mStart);
  return stCard('📅 Comparativo (semana y mes calendario)', '<div class="st-kpis">' +
    stKpi('Esta semana', stMoney(thisWeek)) + stKpi('Semana pasada', stMoney(lastWeek)) + stKpi('Cambio semanal', stPctChange(thisWeek, lastWeek)) +
    stKpi('Este mes', stMoney(thisMonth)) + stKpi('Mes pasado', stMoney(lastMonth)) + stKpi('Cambio mensual', stPctChange(thisMonth, lastMonth)) +
    '</div>');
}
/* ---------- Exportar ventas a Excel (hoy, ayer, mes, rango o por cierre) ----------
   Genera un .csv (con BOM y separador ";" para que Excel en español lo abra
   directo, con tildes bien) con el detalle de cada producto vendido en el
   período elegido — mesas, mostrador y domicilios — más el total al final.
   No hace falta ninguna librería extra: Excel abre un .csv sin problema. */
function csvEscape(v){
  v = v == null ? '' : String(v);
  if(/[;"\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
function exportSalesRange(from, to, label){
  const rows = (data.history || []).filter(h => { const d = new Date(h.date); return d >= from && d <= to; });
  if(!rows.length){ showToast('No hay ventas registradas en ese período.'); return; }
  const lines = [['Fecha', 'Hora', 'Tipo', 'Mesa / Cliente', 'Producto', 'Cantidad', 'Precio unidad', 'Subtotal', 'Forma de pago', 'Vendedor']];
  let totalPeriodo = 0;
  rows.slice().reverse().forEach(h => {
    const dh = new Date(h.date);
    const fecha = dh.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = dh.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const tipo = h.table == null ? (h.delivery ? 'Domicilio' : 'Mostrador') : 'Mesa';
    const quien = (h.delivery && h.delivery.cliente) ? h.delivery.cliente : (h.tableName || (h.table != null ? (i18nPut(espacioN()) + ' ' + h.table) : ''));
    const metodo = (h.payments || []).map(p => p.method).join(' + ') || '';
    (h.items || []).forEach(it => {
      lines.push([fecha, hora, tipo, quien, it.name, it.qty, it.price, it.qty * it.price, metodo, h.by || '']);
    });
    totalPeriodo += h.total || 0;
  });
  lines.push([]);
  lines.push(['', '', '', '', '', '', '', 'TOTAL DEL PERÍODO', totalPeriodo, '']);
  const csv = lines.map(r => r.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ventas-' + label + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('📥 Ventas descargadas — ábrelo con Excel.');
}
// ---------- Modal "Exportar ventas": elegir el período ----------
function exportOverlayShow(){
  document.getElementById('exportRangeFields').hidden = true;
  document.getElementById('exportClosureFields').hidden = true;
  const sel = document.getElementById('exportClosureSel');
  const closures = data.closures || [];
  sel.innerHTML = closures.length
    ? closures.map(c => '<option value="' + c.id + '">' + new Date(c.date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' · ' + fmt(c.totalSold || 0) + '</option>').join('')
    : '<option value="">No hay cierres guardados todavía</option>';
  document.getElementById('exportOverlay').classList.add('show');
}
function exportOverlayClose(){ document.getElementById('exportOverlay').classList.remove('show'); }
document.getElementById('exportSalesExcelBtn').addEventListener('click', exportOverlayShow);
document.getElementById('exportCancelBtn').addEventListener('click', exportOverlayClose);
document.getElementById('exportOverlay').addEventListener('click', e => { if(e.target.id === 'exportOverlay') exportOverlayClose(); });
document.getElementById('exportPeriodBtns').addEventListener('click', e => {
  const b = e.target.closest('button[data-per]'); if(!b) return;
  const per = b.dataset.per;
  document.getElementById('exportRangeFields').hidden = per !== 'rango';
  document.getElementById('exportClosureFields').hidden = per !== 'cierre';
  const now = new Date();
  if(per === 'hoy'){
    const from = new Date(now); from.setHours(0,0,0,0);
    const to = new Date(now); to.setHours(23,59,59,999);
    exportSalesRange(from, to, 'hoy-' + now.toISOString().slice(0,10));
  } else if(per === 'ayer'){
    const from = new Date(now); from.setDate(from.getDate() - 1); from.setHours(0,0,0,0);
    const to = new Date(from); to.setHours(23,59,59,999);
    exportSalesRange(from, to, 'ayer-' + from.toISOString().slice(0,10));
  } else if(per === 'mes'){
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now); to.setHours(23,59,59,999);
    exportSalesRange(from, to, 'mes-' + now.toISOString().slice(0,7));
  } else if(per === 'rango'){
    const today = now.toISOString().slice(0,10);
    document.getElementById('exportFrom').value = today;
    document.getElementById('exportTo').value = today;
  }
  // 'cierre' solo muestra el selector — se descarga con el botón de abajo.
});
document.getElementById('exportRangeBtn').addEventListener('click', () => {
  const fromVal = document.getElementById('exportFrom').value, toVal = document.getElementById('exportTo').value;
  if(!fromVal || !toVal){ showToast('Elige la fecha de inicio y de fin.'); return; }
  const from = new Date(fromVal + 'T00:00:00'), to = new Date(toVal + 'T23:59:59');
  if(from > to){ showToast('La fecha "Desde" no puede ser después de "Hasta".'); return; }
  exportSalesRange(from, to, fromVal + '_a_' + toVal);
});
document.getElementById('exportClosureBtn').addEventListener('click', () => {
  const id = document.getElementById('exportClosureSel').value;
  const c = (data.closures || []).find(x => x.id === id);
  if(!c){ showToast('Elige un cierre de la lista.'); return; }
  const to = new Date(c.date);
  const from = c.from ? new Date(c.from) : new Date(0);
  exportSalesRange(from, to, 'cierre-' + to.toISOString().slice(0,10));
});

function renderStats(){
  const box = document.getElementById('statsBody'); if(!box) return;
  document.querySelectorAll('#stPer button').forEach(b => b.classList.toggle('on', b.dataset.p === stPer));
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const from = stPer === 'hoy' ? +d0 : stPer === '7' ? +d0 - 6 * 864e5 : stPer === '30' ? +d0 - 29 * 864e5 : 0;
  const H = (data.history || []).filter(h => new Date(h.date).getTime() >= from);
  const cn = {}, catOf = {}; data.categories.forEach(k => cn[k.id] = k.name); data.products.forEach(p => catOf[cartaNrm(p.name)] = cn[p.categoryId] || 'Otros');
  const total = H.reduce((a, h) => a + (h.total || 0), 0), debt = H.reduce((a, h) => a + (h.debt || 0), 0);
  let units = 0; const prod = {}, cats = {}, mesas = {}, emps = {}, meth = {}, hours = Array(24).fill(0), tl = {};
  let knownRevenue = 0, margin = 0, hasCostData = false; const profit = {};
  H.forEach(h => {
    const dt = new Date(h.date); hours[dt.getHours()] += h.total || 0;
    const tk = stPer === 'hoy' ? dt.getHours() : stPer === 'todo' ? dt.getFullYear() + '-' + dt.getMonth() : dt.toDateString();
    tl[tk] = (tl[tk] || 0) + (h.total || 0);
    const mk = h.tableName || (h.table != null ? i18nPut(espacioN()) + ' ' + h.table : '—'); mesas[mk] = (mesas[mk] || 0) + (h.total || 0);
    if(h.by){ const ek = h.by; emps[ek] = emps[ek] || { v: 0, n: 0 }; emps[ek].v += h.total || 0; emps[ek].n++; }
    (h.payments || []).forEach(p => { meth[p.method] = (meth[p.method] || 0) + (p.amount || 0); });
    (h.items || []).forEach(it => { const v = it.qty * it.price; units += it.qty; const nv = nombreVigente(it.name); const P = prod[nv] = prod[nv] || { q: 0, v: 0 }; P.q += it.qty; P.v += v; const c = catOf[cartaNrm(nv)] || 'Otros'; cats[c] = (cats[c] || 0) + v;
      if(it.cost != null){ hasCostData = true; const g = v - it.qty * it.cost; knownRevenue += v; margin += g; const G = profit[nombreVigente(it.name)] = profit[nombreVigente(it.name)] || { q: 0, g: 0 }; G.q += it.qty; G.g += g; }
    });
  });
  let prevTotal = null;                          // ventas del período anterior de igual duración (para comparar)
  if(stPer !== 'todo'){
    const span = stPer === 'hoy' ? 864e5 : stPer === '7' ? 7 * 864e5 : 30 * 864e5, pf = from - span;
    prevTotal = data.history.reduce((a, h) => { const t = new Date(h.date).getTime(); return t >= pf && t < from ? a + (h.total || 0) : a; }, 0);
  }
  let tItems = [];                               // ventas en el tiempo
  if(stPer === 'hoy') tItems = hours.map((v, i) => ({ l: i + 'h', v, t: i + ':00 · ' + stMoney(v) }));
  else if(stPer === 'todo'){
    if(H.length){ const a = new Date(Math.min(...H.map(h => +new Date(h.date)))), n = new Date(); let y = a.getFullYear(), m = a.getMonth(), c = 0;
      while((y < n.getFullYear() || (y === n.getFullYear() && m <= n.getMonth())) && c++ < 36){ const v = tl[y + '-' + m] || 0; tItems.push({ l: (m + 1) + '/' + String(y).slice(2), v, t: (m + 1) + '/' + y + ' · ' + stMoney(v) }); if(++m > 11){ m = 0; y++; } }
      tItems = tItems.slice(-24); }
  } else for(let i = 0; i < +stPer; i++){ const d = new Date(from); d.setDate(d.getDate() + i); const v = tl[d.toDateString()] || 0; tItems.push({ l: d.getDate() + '/' + (d.getMonth() + 1), v, t: d.getDate() + '/' + (d.getMonth() + 1) + ' · ' + stMoney(v) }); }
  const top = (o, n, f) => Object.entries(o).sort((a, b) => f(b[1]) - f(a[1])).slice(0, n);
  const MC = { efectivo: ['Efectivo', '#4cd97b'], transferencia: ['Transferencia', '#4aa3ff'], debe: ['Fiado (debe)', '#ff5a5a'] };
  let cmpValue = null;                           // ▲/▼ % vs. el período anterior de igual duración
  if(prevTotal != null){
    if(prevTotal === 0 && total === 0) cmpValue = '—';
    else if(prevTotal === 0) cmpValue = '▲ 100%';
    else{ const pc = Math.round((total - prevTotal) / prevTotal * 100); cmpValue = (pc >= 0 ? '▲ ' : '▼ ') + Math.abs(pc) + '%'; }
  }
  const marginPct = knownRevenue > 0 ? Math.round(margin / knownRevenue * 100) : 0;
  /* 🧮 1.67.2: rentabilidad con el motor financiero (lib/vento-finanzas.js): utilidad bruta y margen, gastos operativos
     (sin las compras de mercancía, que ya están en el costo de lo vendido), resultado neto estimado, margen por categoría,
     los más rentables y los de menor margen. Con el costo guardado en cada venta (el pasado no cambia). */
  const F = window.ventoFinanzas, R0 = { ini: from, fin: Date.now() + 1 };
  const RT = F ? F.rentabilidad(data.history, data.products, data.categories, R0) : null;
  let RS = null; try{ if(F && typeof ctMovimientos === 'function'){ const mv = ctMovimientos(R0); RS = F.resultado(knownRevenue, knownRevenue - margin, mv.mov.filter(m => m.tipo === 'gasto')); } }catch(e){}
  const pct = v => v == null ? '—' : (Math.round(v * 10) / 10).toString().replace('.', ',') + ' %';
  const conM = RT ? RT.productos.filter(x => x.margen != null && x.ventas > 0) : [];
  const profitCard = !hasCostData
    ? stCard('💹 Rentabilidad', '<div class="empty-state">Configura el costo de tus productos (en Productos → Editar) para ver aquí el margen de ganancia.</div>')
    : stCard('💹 Rentabilidad', '<div class="st-kpis">' + stKpi('🧮 Utilidad bruta', stMoney(margin)) + stKpi('📊 Margen bruto', marginPct + '%') +
        (RS ? stKpi('💸 Gastos operativos', stMoney(RS.gastosOperativos)) + stKpi('✅ Resultado neto estimado', stMoney(RS.resultadoNeto)) : '') + '</div>' +
        (RT && RT.categorias.some(c => c.margen != null) ? '<div class="st-sub">🗂️ Margen por categoría</div>' +
          stRows(RT.categorias.filter(c => c.margen != null).sort((a, b) => b.utilidad - a.utilidad).slice(0, 8).map(c => ({ l: c.nombre, v: Math.max(0, c.utilidad), t: stMoney(c.utilidad) + ' · ' + pct(c.margen) }))) : '') +
        '<div class="st-sub">🥇 Más rentable (utilidad)</div>' +
        stRows(top(profit, 8, x => x.g).map(([n, x]) => ({ l: n, v: Math.max(0, x.g), t: stMoney(x.g) + ' · ' + x.q + ' u' }))) +
        (conM.length > 1 ? '<div class="st-sub">⚠️ Menor margen</div>' + stRows(conM.slice().sort((a, b) => a.margen - b.margen).slice(0, 5).map(x => ({ l: x.nombre, v: Math.max(0.01, 100 - x.margen), t: pct(x.margen) + ' · ' + stMoney(x.utilidad) }))) : '') +
        (RT && RT.ventasSinCosto > 0 ? '<div class="st-sub" style="font-weight:500">⚠️ ' + stMoney(RT.ventasSinCosto) + ' vendidos sin costo: no entran en el margen.</div>' : ''));
  const sales = !H.length ? '<div class="empty-state">No hay ventas cobradas en este período. Las estadísticas se llenan cuando cierras cuentas.</div>' : [
    '<div class="st-kpis">' + stKpi('💰 Ventas', stMoney(total)) + stKpi('🧾 Cuentas', H.length) + stKpi('🎟️ Ticket promedio', stMoney(total / H.length)) + stKpi('🍺 Unidades vendidas', units) + stKpi('📒 Fiado (debe)', stMoney(debt)) + stKpi('📅 Promedio por día', stMoney(total / Math.max(1, stPer === 'todo' ? new Set(H.map(h => new Date(h.date).toDateString())).size : stPer === 'hoy' ? 1 : +stPer))) + (cmpValue != null ? stKpi('📊 Vs. período anterior', cmpValue) : '') + '</div>',
    stCard(i18nPut('📈 Ventas ' + (stPer === 'hoy' ? 'por hora' : stPer === 'todo' ? 'por mes' : 'por día')), stBars(tItems)),
    stCard('🏆 Lo más vendido (unidades)', stRows(top(prod, 8, x => x.q).map(([n, x]) => ({ l: n, v: x.q, t: x.q + ' u · ' + stMoney(x.v) })))),
    profitCard,
    stCard('💳 Cómo te pagaron', stDonut(Object.keys(meth).map(k => ({ l: (MC[k] || [k])[0], v: meth[k], c: (MC[k] || [0, '#b58cff'])[1] })))),
    stCard('🗂️ Ventas por categoría', stRows(top(cats, 8, x => x).map(([n, v], i) => ({ l: n, v, t: stMoney(v), c: 'var(--cat-' + (i % 6 + 1) + ')' })))),
    stPer === 'hoy' ? '' : stCard('🕒 Horas pico (en el período)', stBars(hours.map((v, i) => ({ l: i + 'h', v, t: i + ':00 · ' + stMoney(v) })))),
    stCard('🪑 Ventas por mesa', stRows(top(mesas, 8, x => x).map(([n, v]) => ({ l: n, v, t: stMoney(v) })))),
    Object.keys(emps).length < 2 ? '' : stCard('👤 Ventas por empleado (turno)', stRows(top(emps, 8, x => x.v).map(([n, x]) => ({ l: n, v: x.v, t: stMoney(x.v) + ' · ' + x.n + ' cuenta' + (x.n === 1 ? '' : 's') }))))
  ].join('');
  const tr = data.products.filter(p => p.stock != null), cnt = s2 => data.products.filter(p => invStatus(p) === s2).length;
  const key = p => invDays(p) == null ? 1e6 + p.stock : invDays(p), COL = { out: '#ff5a5a', low: '#f5b83d', ok: '#4cd97b' };
  const IV = window.ventoFinanzas ? window.ventoFinanzas.inventario(data.products) : null;   // 🧮 inventario valorizado
  const inv = '<div class="st-kpis">' + stKpi('📦 Valor del stock (a precio de venta)', stMoney(tr.reduce((a, p) => a + p.stock * p.price, 0))) +
    (IV && IV.inversion > 0 ? stKpi('💼 Plata invertida (a costo)', stMoney(IV.inversion)) + stKpi('📈 Ganancia potencial', stMoney(IV.gananciaPotencial)) : '') + stKpi('🧮 Productos con control', tr.length + ' de ' + data.products.length) + stKpi('🚫 Agotados', cnt('out')) + stKpi('⚠️ Por agotarse', cnt('low')) + '</div>' +
    (tr.length ? stCard('📉 Se agotan primero', stRows(tr.slice().sort((a, b) => key(a) - key(b)).slice(0, 10).map(p => { const d = invDays(p); return { l: p.name, v: p.stock, c: COL[invStatus(p)], t: p.stock + ' u' + (d != null ? ' · ≈' + (d < 1 ? 'hoy' : Math.round(d) + ' d') : '') }; })))
      : '<div class="empty-state">Aún no controlas stock. Configúralo en Inventario para ver estas gráficas.</div>');
  box.innerHTML = '<h3 class="st-h">💵 Ventas</h3>' + sales + calendarComparisonCard() + '<h3 class="st-h">📦 Inventario</h3>' + inv;
  try{ window.ventoTablero && window.ventoTablero.pintar(stPer); }catch(e){ console.error('vento-tablero', e); }
}
document.getElementById('stPer').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if(b){ stPer = b.dataset.p; renderStats(); } });

/* ---------- Carta: menú / carta / catálogo según el tipo de local ---------- */
// Cómo se llama la lista de precios según el negocio: Menú, Carta, Servicios, Tarifas, Catálogo…
const cartaTerm = () => { const t = data.businessType && window.VENTO_NEGOCIOS.get(data.businessType); return t ? t.carta : 'Carta'; };
const cartaIcon = () => { const t = data.businessType && window.VENTO_NEGOCIOS.get(data.businessType); return t ? t.icCarta : '📖'; };
// La pestaña de la carta es «lo que ven tus clientes»: si se llamara igual que la de
// productos (ej. Servicios y Servicios), se le pone «Lista de precios» para no repetir.
function cartaTab(){
  try{ const pr = (typeof producto1 === 'function') ? producto1()[1] : 'Productos';
    if(cartaTerm().toLowerCase() === String(pr).toLowerCase()) return 'Lista de precios'; }catch(e){}
  return cartaTerm();
}
function cartaLabel(){
  try{ aplicarVocabulario(); }catch(e){}
  const b = document.getElementById('cartaTab'), l = b && b.querySelector('.nav-lbl');
  if(l) l.textContent = i18nPut(cartaTab()); else if(b) b.textContent = i18nPut(cartaIcon() + ' ' + cartaTab());
  const ml = document.getElementById('moreCartaLbl'), mi = document.getElementById('moreCartaIc');
  if(ml) ml.textContent = i18nPut(cartaTab());
  if(mi) mi.textContent = cartaIcon();
}
const cartaNrm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function cartaData(q){                          // [[categoría, [productos]]] en el orden de tus categorías
  const g = {}, names = {}; data.categories.forEach(k => names[k.id] = k.name);
  data.products.forEach(p => { if(q && !cartaNrm(p.name + ' ' + (p.size || '')).includes(q)) return; const k = names[p.categoryId] || 'Otros'; (g[k] = g[k] || []).push(p); });
  return Object.keys(g).sort((a, b) => (a === 'Otros') - (b === 'Otros')).map(k => [k, g[k]]);
}
const cartaNom = p => p.name + (p.size ? ' ' + p.size : '');
function renderCarta(){
  cartaLabel();
  document.getElementById('cartaT').textContent = i18nPut(cartaIcon() + ' ' + cartaTerm()) + (data.businessName ? ' · ' + data.businessName : '');
  const q = cartaNrm(document.getElementById('cartaQ').value.trim()), gs = cartaData(q);
  document.getElementById('cartaList').innerHTML = gs.length ? gs.map(([k, ps], i) => '<details' + (i === 0 || q ? ' open' : '') + ' style="margin:8px 0"><summary style="cursor:pointer;font-weight:600;padding:6px 0">' + invEsc(k) + ' <small style="opacity:.7">(' + ps.length + ')</small></summary>' +
    ps.map(p => { const s = invStatus(p); return '<div class="inv-row"' + (s === 'out' ? ' style="opacity:.55"' : '') + '><div><b>' + invEsc(cartaNom(p)) + '</b>' + (s === 'out' ? '<small>🚫 Agotado</small>' : s === 'low' ? '<small>⚠️ Últimas unidades</small>' : '') + '</div><b>' + fmt(p.price) + '</b></div>'; }).join('') + '</details>').join('')
    : '<div class="empty-state">' + i18nPut(q ? 'Nada coincide con la búsqueda.' : 'Agrega productos para armar tu lista (' + cartaTerm().toLowerCase() + ').') + '</div>';
  if(typeof renderPromos === 'function') renderPromos();
}
function cartaText(){
  let t = i18nPut(cartaTerm()) + (data.businessName ? ' · ' + data.businessName : '') + '\n';
  cartaData('').forEach(([k, ps]) => { t += '\n*' + k + '*\n'; ps.forEach(p => { t += '• ' + cartaNom(p) + ' — ' + fmt(p.price) + (invStatus(p) === 'out' ? ' (agotado)' : '') + '\n'; }); });
  return t;
}
document.getElementById('cartaQ').addEventListener('input', renderCarta);
document.getElementById('cartaPub').addEventListener('click', async () => {
  const e = document.getElementById('cartaEstado'); e.textContent = 'Publicando…';
  if(window.vitoPublicarCatalogo){ await window.vitoPublicarCatalogo(true); e.textContent = document.getElementById('catPubEstado').textContent; }
});
document.getElementById('cartaCopy').addEventListener('click', () => {
  const t = cartaText();
  if(navigator.share) navigator.share({ text: t }).catch(() => {});
  else if(navigator.clipboard) navigator.clipboard.writeText(t).then(() => showToast('📋 Copiado. Pégalo donde quieras.'));
});
document.getElementById('cartaPrint').addEventListener('click', () => {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(f);
  const d = f.contentDocument; d.open();
  d.write('<title>' + invEsc(i18nPut(cartaTerm())) + '</title><body style="font-family:Georgia,serif;max-width:520px;margin:20px auto"><h1>' + invEsc(i18nPut(cartaTerm()) + (data.businessName ? ' · ' + data.businessName : '')) + '</h1>' +
    cartaData('').map(([k, ps]) => '<h2 style="border-bottom:1px solid #999">' + invEsc(k) + '</h2>' + ps.map(p => '<div style="display:flex;justify-content:space-between;padding:3px 0"><span>' + invEsc(cartaNom(p)) + (invStatus(p) === 'out' ? ' <i>(agotado)</i>' : '') + '</span><b>' + fmt(p.price) + '</b></div>').join('')).join('') + '</body>');
  d.close(); setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 300);
});

/* ---------- Productos repetidos ---------- */
const dupKey = p => [p.name, p.size].map(t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/(\d)\s*(ml|cc|cl)\b/g, '$1').replace(/[^a-z0-9]/g, '')).join('|');
function dupGroups(){
  const m = {}; data.products.forEach(p => (m[dupKey(p)] = m[dupKey(p)] || []).push(p));
  return Object.values(m).filter(g => g.length > 1);
}
function dupMerge(keep, gone){                 // pasa stock, cuentas de mesa y ventas de "gone" a "keep"
  if(!keep || !gone || keep.id === gone.id) return;
  if(gone.stock != null) keep.stock = (keep.stock || 0) + gone.stock;
  if(keep.minStock == null && gone.minStock != null) keep.minStock = gone.minStock;
  if(!keep.categoryId && gone.categoryId) keep.categoryId = gone.categoryId;
  Object.values(data.tables).forEach(t => {
    let moved = false;
    (t.items || []).forEach(it => { if(it.productId === gone.id){ it.productId = keep.id; moved = true; } });
    if(!moved) return;
    const seen = {};                            // si quedaron dos líneas iguales en la misma mesa/persona, se suman
    t.items = t.items.filter(it => { const k = it.productId + '|' + (it.personId || ''), f = seen[k]; if(!f){ seen[k] = it; return true; } f.qty += it.qty; f.history = (f.history || []).concat(it.history || []); return false; });
  });
  (data.stockLog || []).forEach(l => { if(l.p === gone.id) l.p = keep.id; });
  data.products = data.products.filter(p => p.id !== gone.id);
}
function dupOpen(){
  const gs = dupGroups(), SEL = 'style="padding:9px;font-size:14px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;width:100%"';
  const lbl = p => invEsc(p.name + (p.size ? ' ' + p.size : '')) + ' · $' + p.price + (p.stock != null ? ' · stock ' + p.stock : ' · sin stock');
  const opts = '<option value="">—</option>' + data.products.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => '<option value="' + p.id + '">' + lbl(p) + '</option>').join('');
  invDlg('<b>🧩 Unir productos repetidos</b>' + (gs.length
    ? '<small style="color:var(--ink-soft)">Marca cuál conservar en cada grupo. Se suma el stock y las cuentas de mesa pasan al que conserves.</small>' + gs.map((g, i) => {
        const best = Math.max(0, g.findIndex(p => p.stock != null));
        return '<div style="border:1px solid var(--line);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px">' + g.map((p, j) => '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="radio" name="dg' + i + '" value="' + p.id + '"' + (j === best ? ' checked' : '') + '><span>' + lbl(p) + '</span></label>').join('') + '</div>';
      }).join('')
    : '<div style="font-size:14px">No hay repetidos exactos.</div>') +
    '<small style="color:var(--ink-soft)">Unir a mano (nombres distintos que son el mismo producto):</small><select id="dmKeep" ' + SEL + '>' + opts + '</select><small style="color:var(--ink-soft)">Se une con este y este desaparece:</small><select id="dmGone" ' + SEL + '>' + opts + '</select>',
    o => {
      let n = 0;
      gs.forEach((g, i) => { const c = o.querySelector('input[name="dg' + i + '"]:checked'), keep = g.find(p => c && p.id === c.value); g.forEach(p => { if(p !== keep){ dupMerge(keep, p); n++; } }); });
      const k = data.products.find(p => p.id === o.querySelector('#dmKeep').value), x = data.products.find(p => p.id === o.querySelector('#dmGone').value);
      if(k && x && k !== x){ dupMerge(k, x); n++; }
      if(n){ saveData(); renderInventario(); renderProductos(); renderMesas(); showToast('✅ ' + n + ' producto' + (n > 1 ? 's' : '') + ' unido' + (n > 1 ? 's' : '') + '. Revisa el stock y ajústalo con "Contar" si hace falta.'); }
    });
}
function invAsk(id, act){
  const p = data.products.find(x => x.id === id); if(!p) return;
  const q = { in: '¿Cuántas unidades entraron de "' + p.name + '"?', count: 'Conteo real: ¿cuántas unidades hay ahora de "' + p.name + '"?', min: 'Avisar cuando queden esta cantidad o menos de "' + p.name + '":' }[act];
  const def = act === 'count' ? (p.stock != null ? p.stock : '') : act === 'min' ? (p.minStock != null ? p.minStock : INV_DEF_MIN) : '';
  invDlg('<div>' + invEsc(q) + '</div><input ' + INV_IN + ' value="' + def + '">', o => {
    const v = invNum(o.querySelector('input').value); if(v == null) return;
    const antes = p.stock;
    if(act === 'in') p.stock = (p.stock || 0) + v; else if(act === 'count') p.stock = v; else p.minStock = v;
    if(act !== 'min'){ data.inventarioMov = data.inventarioMov || [];
      data.inventarioMov.push({ id: Date.now() + '-' + p.id, tipo: act === 'in' ? 'entrada manual' : 'conteo', productId: p.id, name: p.name,
        qty: act === 'in' ? v : v - (antes || 0), usuario: authUser || '', at: Date.now() }); }
    saveData(); renderInventario(); renderProductos();
    if(act === 'in') showToast('✅ ' + p.name + ': ahora hay ' + p.stock);
  });
}
// Un producto puede estar en 4 estados según su margen: perdiendo plata (precio
// por debajo del costo), margen muy bajo, margen justo, o ganando bien — se usa
// tanto para la clase de color de cada fila como para el texto claro que pide
// Cristhian ("que me diga cuánto le estoy ganando o perdiendo").
function invMarginStatus(pct){
  if(pct < 0) return { cls: 'mt-loss', label: '❌ Perdiendo' };
  if(pct <= 15) return { cls: 'mt-bad', label: '⚠️ Margen muy bajo' };
  if(pct < 25) return { cls: 'mt-warn', label: '🟡 Margen justo' };
  return { cls: 'mt-ok', label: '✅ Ganando bien' };
}
function invMarginRowClass(pct){ return invMarginStatus(pct).cls; }
// Gráfica de barras horizontales que sí distingue ganancia de pérdida (barra
// verde hacia un lado, roja hacia el otro), a diferencia de hbarras() que solo
// sirve para valores positivos (ventas, unidades vendidas, etc.).
function hbarrasGanPerd(t, rows, f){
  if(!rows.length) return '';
  const mx = Math.max(...rows.map(r => Math.abs(r[1])), 1);
  return '<div class="chart-box"><h3>' + invEsc(t) + '</h3>' + rows.map(r => {
    const v = r[1], pct = Math.min(100, Math.round(Math.abs(v) / mx * 100));
    const color = v < 0 ? '#ff5a5a' : '#4cd97b';
    const sign = v > 0 ? '+' : (v < 0 ? '−' : '');
    return '<div style="display:flex;gap:6px;align-items:center;font-size:12px;margin:4px 0">' +
      '<span style="width:36%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + invEsc(r[0]) + '</span>' +
      '<span style="flex:1;background:var(--line);border-radius:4px"><i style="display:block;height:12px;width:' + pct + '%;background:' + color + ';border-radius:4px"></i></span>' +
      '<b style="color:' + color + '">' + sign + f(Math.abs(v)) + '</b></div>';
  }).join('') + '</div>';
}
function renderMarginTable(){
  const wrap = document.getElementById('marginTableWrap'), block = document.getElementById('marginBlock'), chartWrap = document.getElementById('marginChartWrap');
  if(!wrap || !block) return;
  // Las cuentas salen de cuentasProducto(): descuentan el IVA y multiplican por la
  // cantidad que hay en inventario, para ver la plata metida y la ganancia real.
  const rows = data.products.filter(p => !p.combo && p.cost != null && p.cost > 0 && p.price > 0)
    .map(p => ({ p, c: cuentasProducto(p) }))
    .sort((a, b) => (a.c.margen || 0) - (b.c.margen || 0) || a.p.name.localeCompare(b.p.name));
  block.style.display = rows.length ? 'block' : 'none';
  if(!rows.length){ wrap.innerHTML = ''; if(chartWrap) chartWrap.innerHTML = ''; return; }
  const hayIva = rows.some(r => r.c.conIva), hayCant = rows.some(r => r.c.cant != null);
  wrap.innerHTML = '<table class="margin-table"><thead><tr><th>Producto</th>' +
    '<th>Costo' + (hayIva ? ' sin IVA' : '') + '</th><th>Precio' + (hayIva ? ' sin IVA' : '') + '</th>' +
    '<th>Margen</th><th>Ganas por unidad</th>' + (hayCant ? '<th>Cantidad</th><th>Plata metida</th><th>Ganancia total</th>' : '') +
    '</tr></thead><tbody>' +
    rows.map(r => {
      const st = invMarginStatus(Math.round(r.c.margen || 0));
      return '<tr class="' + st.cls + '"><td>' + invEsc(r.p.name + (r.p.size ? ' ' + r.p.size : '')) + '</td>' +
        '<td class="mt-num">' + fmt(Math.round(r.c.costoNeto)) + '</td>' +
        '<td class="mt-num">' + fmt(Math.round(r.c.precioNeto)) + '</td>' +
        '<td class="mt-num">' + fmtPct(r.c.margen) + '</td>' +
        '<td class="mt-num">' + fmt(Math.round(r.c.utilidad)) + '</td>' +
        (hayCant ? '<td class="mt-num">' + (r.c.cant == null ? '—' : r.c.cant) + '</td>' +
          '<td class="mt-num">' + (r.c.inversion == null ? '—' : fmt(Math.round(r.c.inversion))) + '</td>' +
          '<td class="mt-num">' + (r.c.utilidadTotal == null ? '—' : fmt(Math.round(r.c.utilidadTotal))) + '</td>' : '') +
        '</tr>';
    }).join('') +
    '</tbody></table>' +
    (hayIva ? '<div class="mt-nota">Los números van sin IVA: el IVA que cobras es de la DIAN, y el que le pagas al proveedor se descuenta.</div>' : '');
  // Gráfica: la ganancia (o pérdida) real por unidad, de la peor a la mejor.
  const chartRows = rows.slice().sort((a, b) => (a.c.utilidad || 0) - (b.c.utilidad || 0)).map(r => [r.p.name + (r.p.size ? ' ' + r.p.size : ''), Math.round(r.c.utilidad || 0)]);
  if(chartWrap) chartWrap.innerHTML = hbarrasGanPerd('📊 Ganancia o pérdida por unidad (sin IVA)', chartRows, fmt);
}
function renderInventario(){
  // Productos e inventario son una sola pantalla: aquí solo se arma el resumen de
  // arriba, los avisos y la tabla de márgenes; la lista la pinta renderProductos().
  renderMarginTable();
  const ord = { out: 0, low: 1, ok: 2, none: 3 };
  const ps = data.products.filter(p => !p.combo).sort((a, b) => ord[invStatus(a)] - ord[invStatus(b)] || a.name.localeCompare(b.name));
  const n = s => ps.filter(p => invStatus(p) === s).length;
  const sum = document.getElementById('invSummary');
  if(sum) sum.innerHTML = `<span class="inv-chip inv-out">🚫 ${n('out')} agotados</span><span class="inv-chip inv-low">⚠️ ${n('low')} por agotarse</span><span class="inv-chip inv-ok">✅ ${n('ok')} con stock</span>`;
  const sinCtl = ps.filter(p => p.stock == null).length;
  const nDup = dupGroups().length;
  const avisoDup = nDup ? '<div class="inv-aviso">⚠️ Hay ' + nDup + ' producto(s) repetido(s).<button class="btn-ghost" data-act="dups">Unir repetidos</button></div>' : '';
  const aviso = sinCtl ? '<div class="inv-aviso">📦 ' + sinCtl + ' producto(s) sin control de stock.<button class="btn-ghost" data-act="setup">Ponerles stock</button></div>' : '';
  const av = document.getElementById('invAvisos'); if(av) av.innerHTML = avisoDup + aviso;
  const vieja = document.getElementById('invList'); if(vieja) vieja.innerHTML = '';
  try{ renderProductos(); }catch(e){}
  invBadge();
}
document.getElementById('invAvisos').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if(!b) return; if(b.dataset.act === 'setup') invSetup(); else if(b.dataset.act === 'dups') dupOpen(); else invAsk(b.dataset.id, b.dataset.act); });
document.getElementById('invDup').addEventListener('click', dupOpen);
setTimeout(invBadge, 1500);

/* ---------- Escaneo de factura de proveedor ----------
   Lee la foto de una factura/remisión con la misma IA que reconoce productos,
   detecta cada renglón (producto, cantidad, costo por unidad), lo empareja
   contra el catálogo existente (sin crear duplicados) y avisa cuando el
   proveedor subió el precio, sugiriendo un precio de venta que mantenga el
   margen que ya tenías (o un margen sano por defecto para productos nuevos). */
const INVOICE_TARGET_MARGIN = 0.35;
// Margen a usar por defecto para un producto: el que ya tenía (si era
// razonable) o el margen sano de la app — igual criterio que ya se usaba
// en "Escanear precio y margen" (pcAutoTarget), para que las dos pantallas
// se comporten igual.
function invoiceInferMargin(product){
  if(product && product.cost != null && product.cost > 0 && product.price > 0){
    const F = window.ventoFinanzas, m = F ? F.margen(product.price, product.cost) / 100 : (product.price - product.cost) / product.price;   // 🧮 motor financiero
    if(m >= 0.05 && m < 0.95) return m;
  }
  return INVOICE_TARGET_MARGIN;
}
function invoicePriceFromMargin(cost, marginPct){
  if(!cost || cost <= 0) return 0;
  const m = Math.max(0, Math.min(0.9, marginPct)), F = window.ventoFinanzas;   // 🧮 motor financiero
  return Math.round((F ? F.precioParaMargen(cost, m * 100) : cost / (1 - m)) / 100) * 100;
}
function invoiceSuggestPrice(cost, product){
  if(!cost || cost <= 0) return product ? product.price : 0;
  return invoicePriceFromMargin(cost, invoiceInferMargin(product));
}
// Reglas de detección compartidas entre el prompt de foto y el de texto (PDF con
// texto embebido), para que ambos caminos se comporten igual — ya afinadas con
// facturas reales del usuario (tablas anchas tipo Distribuidora Colombina, nombres
// en clave, y filtrado de renglones de encabezado/dirección que no son productos).
function invoicePromptRules(){
  return 'REGLA PARA SABER QUÉ ES UN PRODUCTO: un renglón es un producto SI Y SOLO SI tiene un precio o valor en pesos al lado (precio unitario, o un total de renglón del que se pueda sacar el precio unitario dividiendo por la cantidad). ' +
    'Si un renglón tiene precio, es un producto y va en items — SIN IMPORTAR que el nombre esté abreviado, en clave, en código de proveedor, en mayúsculas cortadas o mal escrito por el OCR (ej: "CLUB COL BOT X30", "AG LIGH LAT", "COD 4521"). En «original» cópialo tal como aparece impreso (en «nombre» va interpretado). ' +
    'No te saltes NINGÚN renglón que tenga precio, así el nombre te parezca raro o difícil de leer. ' +
    'No inventes renglones ni productos que no tengan un precio visible al lado, y no agregues nada que no esté impreso en la factura. ' +
    'NO incluyas en items los renglones que NO tienen precio propio (encabezados de columna, subtotal, IVA, descuento, total general, "pague así", notas, NIT, fecha, dirección, nombre del vendedor o del cliente, etc.) — esos no son productos. ' +
    'Si la factura es una TABLA con columnas (ítem, código, descripción, cantidad, unidad de medida, precio, descuento, precio neto, IVA, precio final…), usa la columna de CANTIDAD (Cant./Cantidad) como qty, y usa el PRECIO FINAL de ese renglón (el que ya incluye descuentos e impuestos, la última columna de valor) dividido entre qty como unit_cost — es lo que el negocio realmente paga por cada unidad. Si no hay columna de precio final, súmale el IVA al precio neto. No confundas la columna de código/referencia del producto con la cantidad o el precio. ' +
    'ADEMÁS, fíjate si el renglón trae información de EMPAQUE (que casi siempre está en el mismo nombre/descripción del producto, ej: "X24", "X12", "CJ X 30", "PAQ X6", "DISPLAY X20", "FARDO X10"), o si la unidad de medida de la columna (CJ, PQ, DISPLAY, FARDO, DOC…) indica que lo que se compró son cajas/paquetes y no unidades sueltas. En ese caso: cajas = cuántas cajas o paquetes se compraron (el número de la columna de cantidad), y unidades_por_caja = cuántas unidades individuales trae cada caja/paquete (el número que va después de la "X" en el empaque, ej: en "X24" son 24). Si la compra es por unidades sueltas, o no encuentras ningún indicio de empaque, NO inventes nada: pon cajas=1 y unidades_por_caja igual a qty. ' +
    'CUIDADO con contar doble: en tickets de caja (POS) el mismo texto "X30" o "X24" en el nombre a veces es solo la presentación de referencia del producto en el catálogo del proveedor (cuántas unidades trae la caja completa de ESE producto), y la cantidad de la columna YA viene en unidades sueltas vendidas, no en cajas. Pista útil en Colombia: si el nombre dice "LT" o "LATA" seguido de "X" un número (ej: "CLUB COLOMBIA LT X24"), casi siempre se vendió por LATA individual — deja cajas=1 y unidades_por_caja=qty, no multipliques. Si dice "BOT" o "BT" (botella) seguido de "X" un número (ej: "AGUILA BT X30", "POKER BOT X30"), ahí sí suele venderse la caja completa de esa cantidad de botellas — ahí la cantidad de la columna sí son cajas. Cuando no sea claro por el nombre, decide por el precio: calcula el precio por unidad ANTES de aplicar el desglose (precio del renglón entre la cantidad de la columna); si ese precio ya se ve razonable para UNA unidad individual de ese tipo de producto (ej: unos pocos miles de pesos para una cerveza o gaseosa, unos cientos de pesos para un dulce o sobre), la cantidad de la columna YA son unidades sueltas, no multipliques de nuevo — solo trata la cantidad como número de cajas cuando, de no hacerlo, el precio por unidad daría claramente disparatado para una sola unidad (muchos miles o decenas de miles de pesos por un dulce, o cientos de miles por una bebida). ' +
    // Respuesta COMPACTA (listas en vez de nombres de campo largos y sin campos vacíos): la IA escribe
    // 3-4 veces menos texto y la factura sale en pocos segundos. fiExpandirCompacto() la vuelve al formato de siempre.
    'Devuelve SOLO JSON válido y COMPACTO (sin texto extra, sin ```, sin espacios ni saltos de línea de más), con esta forma: ' +
    '{"p":"proveedor","f":"AAAA-MM-DD","h":{"n":"número de factura","nit":"NIT del proveedor","st":subtotal,"iva":iva,"d":descuentos,"t":total},"i":[[original,nombre,qty,und,precio_unit,total_renglon,iva_pct,subtotal_renglon,iva_valor,descuento,codigo,cajas,und_por_caja,categoria]]}. ' +
    'En "h" pon solo lo que esté impreso. Cada renglón de "i" es una LISTA con ese orden exacto: ' +
    'original = la descripción del renglón EXACTAMENTE como está impresa (con sus abreviaturas); ' +
    'nombre = el producto INTERPRETADO en limpio para un inventario, entendiendo las abreviaturas (ej. "AG LIGH LAT 330" → "Cerveza Águila Light lata 330 ml", "CLUB COL BOT X30" → "Cerveza Club Colombia botella", "MAGGI CALDO GALLINA 24X594G" → "Caldo de gallina Maggi"); si es un producto ya registrado (lista de abajo), usa EXACTAMENTE ese nombre registrado; ' +
    'qty = cantidad TOTAL de unidades individuales compradas (2 cajas de 24 → 48); und = unidad de medida impresa (UND, CJ, PQ, DISPLAY…) o null; ' +
    'precio_unit = lo que se paga por UNA unidad individual YA con IVA (si solo está el total del renglón, total ÷ qty); total_renglon = valor final impreso del renglón; ' +
    'iva_pct = 0, 5 o 19 si aparece, si no null; subtotal_renglon = valor antes de IVA impreso o null; iva_valor = IVA impreso del renglón o null; descuento = en pesos o null; codigo = código del proveedor o null; ' +
    'cajas y und_por_caja = el desglose de empaque explicado arriba (1 y qty si es suelto; cajas × und_por_caja = qty); ' +
    // 1.66.1: la categoría de cada producto, para que la factura ponga las categorías sola (pedido del dueño).
    'categoria = la categoría del producto para el inventario, corta y en plural (ej. Cervezas, Gaseosas, Licores, Aguas, Jugos, Snacks, Dulces, Lácteos, Granos y abarrotes, Aseo, Carnes y embutidos, Panadería, Cigarrillos, Hielo)' + invCategoriasHint() + '. ' +
    'NO confundas la cantidad comprada (columna Cant.) con la presentación de la descripción ("24X594G" es presentación, no cantidad). ' +
    'Todo lo que no esté impreso va en null: NUNCA inventes valores. Números en pesos sin puntos ni símbolos. Fechas AAAA-MM-DD. ' + invCatalogHint();
}
// Las categorías que ya tiene el negocio: la IA usa una de esas si le sirve (no inventa otra parecida).
function invCategoriasHint(){
  try{ const l = (data.categories || []).filter(c => c && c.name && c.id !== (typeof PROMO_CAT !== 'undefined' ? PROMO_CAT : '')).map(c => c.name).slice(0, 40);
    return l.length ? '; si una de estas categorías del negocio le sirve, usa EXACTAMENTE ese nombre: ' + l.join(', ') : ''; }catch(e){ return ''; }
}
function invoicePrompt(){
  return 'Esta es una foto de una factura, remisión o recibo de un PROVEEDOR (lo que el negocio compra, no lo que vende). ' +
    'Lee TODA la tabla de renglones, de arriba a abajo, sin saltarte ninguno. ' + invoicePromptRules();
}
// Para un PDF digital cuyo texto ya se pudo extraer sin necesidad de leerlo como
// imagen (más rápido y más confiable que mandarlo como foto).
function invoicePromptForText(text){
  return 'Este es el TEXTO ya extraído digitalmente (no es una foto) de un PDF de una factura, remisión o recibo de un PROVEEDOR (lo que el negocio compra, no lo que vende). El texto puede tener columnas desalineadas por la forma en que se extrajo, pero los números y nombres impresos son correctos. ' +
    'Lee TODO el texto, de arriba a abajo, sin saltarte ningún renglón. ' + invoicePromptRules() +
    ' Este es el texto de la factura:\n\n' + text;
}
// Convierte la respuesta compacta de la IA al formato de siempre (si ya viene en el formato largo, la deja igual).
function fiExpandirCompacto(info){
  if(!info || Array.isArray(info.items) || !Array.isArray(info.i)) return info;
  const h = info.h || {}, num = v => (v == null || v === '' ? null : v);
  const items = info.i.filter(r => Array.isArray(r) && (r[0] || r[1])).map(r => ({
    original: String(r[0] || r[1] || ''), name: String(r[1] || r[0] || ''), nombreIA: !!r[1],
    qty: num(r[2]), unit: num(r[3]), unit_cost: num(r[4]), line_total: num(r[5]), iva_pct: num(r[6]),
    line_subtotal: num(r[7]), iva_value: num(r[8]), discount: num(r[9]), sku: num(r[10]),
    cajas: num(r[11]), unidades_por_caja: num(r[12]), categoria: r[13] ? String(r[13]).trim().slice(0, 40) : null
  }));
  return { supplier: info.p || '', date: info.f || '', items,
    header: { invoiceNumber: num(h.n), supplierNit: num(h.nit), subtotal: num(h.st), iva: num(h.iva), descuentos: num(h.d), total: num(h.t), issueDate: num(info.f) } };
}
// Modo rápido: primera pasada corta (un solo modelo, foto en resolución media, sin darle
// vueltas) — normalmente responde en pocos segundos. Solo si esa pasada falla o no trae
// nada usable se hace un segundo intento más a fondo (probando otro modelo si hace falta),
// igual que ya se hace al reconocer un producto por foto.
// La respuesta sirve si trae la lista de renglones.
const fiLecturaIA = txt => { const i = fiExpandirCompacto(cleanAiJsonText(txt)); return i && Array.isArray(i.items) ? i : null; };
async function recognizeInvoiceWithAI(dataUrl){
  const prompt = invoicePrompt();
  try{
    // Carrera de modelos: el principal y, si en 3 s no respondió, otro en paralelo (ver aiCarrera).
    return await aiCarrera({ prompt, imageDataUrl: dataUrl, json: true, timeoutMs: 16000, fast: true, doc: true, maxOutputTokens: 8000, maxMs: 26000 }, fiLecturaIA, 3000);
  }catch(err){
    if(err && err.kind === 'bad') throw new OpenAIError('bad', 'La IA respondió pero no pude leer la factura. Prueba con una foto más clara, derecha y con buena luz.');
    throw err;
  }
}
// Misma idea que recognizeInvoiceWithAI pero para el texto ya extraído de un PDF
// digital (sin imagen) — más rápido y no depende de que la foto quede bien tomada.
async function recognizeInvoiceWithAIFromText(text){
  const prompt = invoicePromptForText(text);
  try{
    return await aiCarrera({ prompt, json: true, timeoutMs: 20000, fast: true, maxOutputTokens: 8000, maxMs: 32000 }, fiLecturaIA, 3500);
  }catch(err){
    if(err && err.kind === 'bad') throw new OpenAIError('bad', 'La IA respondió pero no pude leer el texto del PDF de la factura.');
    throw err;
  }
}

/* ================= FacturaIQ: entender la factura, no solo copiar el texto =================
   Una sola implementación que usan los dos caminos de lectura (con IA y sin internet):
   1. fiPresentacion(): separa la PRESENTACIÓN (24 x 594 g) de la CANTIDAD comprada.
   2. fiNormalizar(): corrige errores típicos del OCR (33O → 330, AGUlLA → AGUILA, POKFR → POKER),
      expande abreviaturas (DOYP, D/P → DOYPACK; LAT → LATA…) y reconoce marcas colombianas.
      La descripción ORIGINAL nunca se toca: se guarda aparte.
   3. fiCoincidir(): busca el producto en el inventario con un puntaje de confianza 0-100,
      en este orden: código del proveedor, código de barras, equivalencia aprendida,
      nombre exacto, marca + presentación + nombre, y deja la lista de posibles productos.
   4. fiAprender(): cuando confirmas «POKER 330» = «Cerveza Poker lata 330 ml», lo recuerda
      (proveedor + descripción → producto) para la próxima factura.
   5. fiEncabezado(): número, fechas, NIT, CUFE, subtotal, IVA, total… desde el texto leído.
      Lo que no aparece queda en null («Revisar dato»): nunca se inventa.
   6. fiValidar(): suma de renglones + impuestos − descuentos = total, y avisos por renglón.
   7. LayaIA: solo se consulta cuando hay duda entre varios productos (ver más abajo). */
const FI_ABREV = [
  [/\bD\/P\b|\bDOYP\b|\bDOY\s?PACK\b|\bDPK\b/g, 'DOYPACK'], [/\bLAT\b|\bLTA\b/g, 'LATA'], [/\bBOT\b|\bBTL\b|\bBOTLL?\b/g, 'BOTELLA'],
  [/\bCJ\b|\bCJA\b/g, 'CAJA'], [/\bPQ\b|\bPAQ\b|\bPQT\b/g, 'PAQUETE'], [/\bDISP\b|\bDSP\b/g, 'DISPLAY'], [/\bSIX\s?PACK\b|\bSIXP\b/g, 'SIXPACK'],
  [/\bCERV\b|\bCRVZ\b|\bCERVZ\b/g, 'CERVEZA'], [/\bGALL\b|\bGLL\b/g, 'GALLINA'], [/\bGASEO\b|\bGSA\b/g, 'GASEOSA'], [/\bCOND\b/g, 'CONDENSADA'],
  [/\bLCH\b|\bLEC\b/g, 'LECHE'], [/\bAGUARD\b|\bAGTE\b/g, 'AGUARDIENTE'], [/\bRETORN\b|\bRET\b/g, 'RETORNABLE'], [/\bDESC\b/g, 'DESCARTABLE'],
  [/\bPET\b/g, 'PET'], [/\bUND\b|\bUNID\b|\bUN\b/g, 'UND'], [/\bGRS?\b|\bGMS?\b/g, 'G'], [/\bLTS?\b|\bLTR\b/g, 'L'], [/\bMLS?\b|\bCC\b/g, 'ML'],
  [/\bKLS?\b|\bKGS\b|\bKILO\b/g, 'KG'], [/\bCLUB COL\b/g, 'CLUB COLOMBIA'], [/\bAG\b(?=\s+(LIGHT|LIGH|LAT|LATA|BOT|330|350|250))/g, 'AGUILA'],
  [/\bLIGH\b|\bLGT\b|\bLIG\b/g, 'LIGHT'], [/\bORIG\b/g, 'ORIGINAL']
];
// Marcas y productos que más se repiten en tiendas y cantinas de Colombia (para reconocer
// la marca aunque el OCR la escriba mal, y para separar marca de nombre).
const FI_MARCAS = ['AGUILA', 'AGUILA LIGHT', 'POKER', 'CLUB COLOMBIA', 'COSTENA', 'COSTENITA', 'PILSEN', 'CORONA', 'BUDWEISER', 'STELLA ARTOIS',
  'HEINEKEN', 'BBC', 'MILLER', 'TECATE', 'REDDS', 'PONY MALTA', 'POSTOBON', 'COCA COLA', 'PEPSI', 'COLOMBIANA', 'MANZANA POSTOBON', 'QUATRO', 'SPRITE',
  'HIT', 'TAMPICO', 'BRETANA', 'GATORADE', 'POWERADE', 'VIVE 100', 'SPEED MAX', 'RED BULL', 'CRISTAL', 'BRISA', 'MAGGI', 'LA LECHERA', 'NESTLE',
  'NESCAFE', 'COLCAFE', 'SELLO ROJO', 'AGUILA ROJA', 'ALPINA', 'COLANTA', 'ALQUERIA', 'ZENU', 'RICA', 'RAMO', 'NOEL', 'DIANA', 'ROA', 'FLORHUILA',
  'BIMBO', 'MARGARITA', 'DORITOS', 'DE TODITO', 'CHOCORAMO', 'JET', 'JUMBO', 'COLGATE', 'FAMILIA', 'ARIEL', 'FAB', 'DERSA', 'JABON REY', 'PROTEX',
  'ANTIOQUENO', 'NECTAR', 'TRES ESQUINAS', 'RON MEDELLIN', 'RON VIEJO DE CALDAS', 'OLD PARR', 'BUCHANANS', 'SMIRNOFF', 'FRUTINO', 'KNORR', 'FRESCAVENA',
  'QUAKER', 'KELLOGGS', 'CORONA CHOCOLATE', 'LUKER', 'GOL', 'BON BON BUM', 'TRIDENT', 'HALLS', 'PREMIER', 'OLEOCALI', 'GOURMET', 'DORIA', 'COMARRICO'];
const FI_STOP = new Set(['DE', 'LA', 'EL', 'X', 'CO', 'Y', 'EN', 'CON', 'SIN', 'POR', 'PARA', 'DEL', 'LOS', 'LAS', 'UND', 'UNIDAD']);
const fiAscii = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ñ/g, 'N').replace(/ñ/g, 'n');
function fiLev(a, b){
  if(a === b) return 0; if(!a.length) return b.length; if(!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for(let i = 1; i <= a.length; i++){
    const cur = [i];
    for(let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// Errores del OCR: letra O dentro de números (33O → 330), l/I minúscula dentro de palabras en
// mayúscula (AGUlLA → AGUILA), S/B/Z confundidas con 5/8/2 dentro de números.
function fiCorregirOCR(s){
  let t = String(s || '');
  t = t.replace(/(\d)[Oo](?=\d|\b|[a-zA-Z]{1,3}\b)/g, '$10').replace(/\b[Oo](\d)/g, '0$1');
  t = t.replace(/(\d)[lI|](?=\d)/g, '$11').replace(/(\d)[Ss](?=\d)/g, '$15').replace(/(\d)[Bb](?=\d)/g, '$18');
  t = t.replace(/([A-ZÁÉÍÓÚÑ])l([A-ZÁÉÍÓÚÑ])/g, '$1I$2').replace(/([A-ZÁÉÍÓÚÑ])0([A-ZÁÉÍÓÚÑ])/g, '$1O$2').replace(/([A-ZÁÉÍÓÚÑ])1([A-ZÁÉÍÓÚÑ])/g, '$1I$2');
  return t;
}
// Separa la presentación: «MAGGI CALDO GALLINA 24X594G CO» → 24 unidades por paquete de 594 g.
// Esto es lo que trae CADA paquete; la cantidad comprada sale de la columna de cantidad.
function fiPresentacion(desc){
  const t = fiAscii(fiCorregirOCR(desc)).toUpperCase().replace(/,/g, '.');
  const U = '(KG|G|GR|GRS|GMS|ML|L|LT|LTS|CC|OZ|UND|UN)';
  // Colombina y similares: (18BS/40/10g) = caja de 18 bolsas, cada bolsa con 40 unidades de 10 g
  const col = t.match(/\(\s*(\d{1,3})\s*(BS|PL|LAT|PP|CJ|DI|DS|PQ)\s*[\/-]\s*(\d{1,3})\s*(?:UN|UND)?\s*[\/-]\s*(\d+(?:\.\d+)?)\s*(G|GR|ML|KG|L)?/);
  // DPX8UNDSX15GR = display de 8 unidades de 15 g
  const dpx = !col && t.match(/X\s*(\d{1,3})\s*UNDS?\s*X\s*(\d+(?:\.\d+)?)\s*(G|GR|ML)\b/);
  let m = col ? null : t.match(new RegExp('(?<![\\d.])(\\d{1,3})\\s*[X\\*]\\s*(\\d+(?:\\.\\d+)?)\\s*' + U + '\\b'));
  const unidadStd = u => ({ GR: 'g', GRS: 'g', GMS: 'g', G: 'g', KG: 'kg', ML: 'ml', CC: 'ml', L: 'l', LT: 'l', LTS: 'l', OZ: 'oz', UND: 'und', UN: 'und' }[u] || u.toLowerCase());
  const out = { presentacion: null, unidadesPorPaquete: null, contenido: null, unidadContenido: null, pesoG: null, volumenMl: null };
  if(col){
    out.unidadesPorPaquete = Number(col[3]) > 1 ? Number(col[3]) : null;
    if(col[5]){ out.contenido = Number(col[4]); out.unidadContenido = unidadStd(col[5]); }
  } else if(dpx){
    out.unidadesPorPaquete = Number(dpx[1]); out.contenido = Number(dpx[2]); out.unidadContenido = unidadStd(dpx[3]);
  } else if(m){
    out.unidadesPorPaquete = Number(m[1]); out.contenido = Number(m[2]); out.unidadContenido = unidadStd(m[3]);
    out.orden = 'nx';   // «24X594G»: primero cuántas trae, luego el peso (que puede ser el total del paquete)
  } else {
    m = t.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + U + '\\s*[X\\*]\\s*(\\d{1,3})\\b'));
    if(m){ out.contenido = Number(m[1]); out.unidadContenido = unidadStd(m[2]); out.unidadesPorPaquete = Number(m[3]); }
    else {
      const s = t.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + U + '\\b'));
      if(s && !/^(UND|UN)$/.test(s[2])){ out.contenido = Number(s[1]); out.unidadContenido = unidadStd(s[2]); }
      const nx = t.match(/\b(\d{1,3})\s*X\s*(\d{2,4})\b/);
      // «LATA 330 X24» = 24 latas de 330 ml (el primero es un tamaño típico y el segundo un número de unidades)
      if(nx && [180, 200, 237, 250, 269, 300, 330, 350, 355, 375, 400, 473, 500, 600, 750, 1000, 1500, 1750, 2000].includes(Number(nx[1])) && Number(nx[2]) <= 60){ out.unidadesPorPaquete = Number(nx[2]); out.contenido = Number(nx[1]); out.unidadContenido = 'ml'; }
      else if(nx){ out.unidadesPorPaquete = Number(nx[1]); out.contenido = Number(nx[2]); out.unidadContenido = null; }
      const pk = !nx && t.match(/\b(?:X|CJ|CAJA|PQ|PAQ|PAQUETE|DISPLAY|FARDO|SIXPACK)\s*X?\s*(\d{1,3})\b(?!\s*(?:G|GR|GRS|GMS|ML|KG|L|LT|CC)\b)/);
      if(pk && Number(pk[1]) > 1 && Number(pk[1]) <= 200) out.unidadesPorPaquete = Number(pk[1]);
    }
  }
  // Sin unidad escrita pero con un número típico de lata/botella (POKER 330, AGUILA 350)
  if(out.contenido == null && !out.unidadesPorPaquete){ const n = t.match(/\b(180|200|237|250|269|300|330|350|355|375|400|473|500|600|750|1000|1500|1750|2000|2500|3000)\b/); if(n){ out.contenido = Number(n[1]); out.unidadContenido = 'ml'; } }
  if(out.contenido != null){
    if(out.unidadContenido === 'g') out.pesoG = out.contenido; else if(out.unidadContenido === 'kg') out.pesoG = out.contenido * 1000;
    else if(out.unidadContenido === 'ml') out.volumenMl = out.contenido; else if(out.unidadContenido === 'l') out.volumenMl = out.contenido * 1000;
  }
  if(out.unidadesPorPaquete || out.contenido != null)
    out.presentacion = (out.unidadesPorPaquete ? out.unidadesPorPaquete + ' x ' : '') + (out.contenido != null ? (String(out.contenido).replace('.', ',') + (out.unidadContenido ? ' ' + out.unidadContenido : '')) : 'und');
  return out;
}
// Texto comparable: sin tildes, mayúsculas, OCR corregido, abreviaturas expandidas y marcas
// arregladas por parecido (POKFR → POKER). Devuelve también la marca detectada.
function fiNormalizar(desc){
  let t = fiAscii(fiCorregirOCR(desc)).toUpperCase().replace(/[^A-Z0-9\/\.\s]/g, ' ').replace(/\s+/g, ' ').trim();
  FI_ABREV.forEach(([re, v]) => { t = t.replace(re, v); });
  const marcasTok = new Set(FI_MARCAS.flatMap(m => m.split(' ')).filter(w => w.length >= 4));
  t = t.split(' ').map(w => {
    if(w.length < 5 || /\d/.test(w) || marcasTok.has(w)) return w;
    for(const m of marcasTok) if(Math.abs(m.length - w.length) <= 1 && fiLev(w, m) === 1) return m;
    return w;
  }).join(' ');
  t = t.replace(/(^|\s)LECHERA\b/g, (m, a) => /\bLA$/.test(t.slice(0, t.indexOf(m) + a.length).trim()) ? m : a + 'LA LECHERA');
  let marca = null;
  for(const m of FI_MARCAS.slice().sort((a, b) => b.length - a.length)) if(new RegExp('\\b' + m + '\\b').test(t)){ marca = m; break; }
  const pres = fiPresentacion(t);
  const palabras = t.replace(/\b\d+\s*X\s*\d+(?:\.\d+)?\s*(KG|G|ML|L|OZ|UND)?\b/g, ' ').replace(/\d+(?:\.\d+)?\s*(KG|G|ML|L|OZ|UND)\b/g, ' ').split(' ')
    .filter(w => w && !/^\d+$/.test(w) && !FI_STOP.has(w) && w.length > 1);
  return { texto: t, marca, palabras, pres };
}
// Nombre sugerido y legible: «MAGGI CALDO GALLINA 24X594G CO» → «Maggi Caldo Gallina 594 g»
function fiNombreSugerido(desc){
  const n = fiNormalizar(desc);
  // fuera los códigos de presentación pegados (18BS/40/, DPX8UNDSX15GR, X29GR, X20X) y números sueltos del OCR
  const esCodigo = w => /\//.test(w) || /^\(?\d/.test(w) && /[A-Z]/.test(w) || /^(DPX|X)\d/.test(w) || /^\d+([.,]\d+)?$/.test(w) || /\dX$/.test(w) || /^\(|\)$/.test(w);
  const base = n.palabras.filter(w => !['LA', 'CAJA', 'PAQUETE', 'DISPLAY', 'SIXPACK', 'X'].includes(w) && !esCodigo(w)).join(' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const tam = n.pres.contenido != null ? ' ' + String(n.pres.contenido).replace('.', ',') + (n.pres.unidadContenido ? ' ' + n.pres.unidadContenido : '') : '';
  return (base + tam).trim() || String(desc || '').trim();
}
const fiKeyEq = (prov, desc) => (fiAscii(prov || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30)) + '|' + fiNormalizar(desc).texto;
// Equivalencias aprendidas: proveedor + descripción original → producto (y la misma
// descripción con cualquier proveedor, por si cambia de distribuidor).
function fiAprender(prov, desc, productId){
  if(!productId || !desc) return;
  data.equivalencias = data.equivalencias || {};
  const ahora = Date.now();
  [fiKeyEq(prov, desc), fiKeyEq('', desc)].forEach(k => {
    const e = data.equivalencias[k];
    data.equivalencias[k] = { productId, n: e && e.productId === productId ? (e.n || 1) + 1 : 1, at: ahora };
  });
  const ks = Object.keys(data.equivalencias);
  if(ks.length > 3000) ks.sort((a, b) => data.equivalencias[a].at - data.equivalencias[b].at).slice(0, ks.length - 2500).forEach(k => delete data.equivalencias[k]);
}
const fiTamanoDe = p => { const r = fiPresentacion((p.name || '') + ' ' + (p.size || '')); return r.pesoG != null ? 'g' + r.pesoG : r.volumenMl != null ? 'ml' + r.volumenMl : null; };
/* Puntaje 0-100 de qué tan seguro es que el renglón de la factura sea ese producto.
   95-100 muy alta · 85-94 alta · 70-84 posible (revisar) · <70 no se asocia solo. */
function fiCoincidir(item, proveedor){
  const desc = item.originalDescription || item.name || '';
  const prods = (data.products || []).filter(p => !p.combo);
  const res = [];
  const add = (p, conf, motivo) => { const e = res.find(r => r.p.id === p.id); if(e){ if(conf > e.conf){ e.conf = conf; e.motivo = motivo; } } else res.push({ p, conf, motivo }); };
  const sku = String(item.sku || '').trim().toUpperCase(), bar = String(item.barcode || '').replace(/\D/g, '');
  if(sku) prods.forEach(p => { if((p.skus || []).map(x => String(x).toUpperCase()).includes(sku)) add(p, 100, 'código del proveedor'); });
  if(bar.length >= 8) prods.forEach(p => { if((p.barcodes || []).includes(bar)) add(p, 100, 'código de barras'); });
  const eq = data.equivalencias || {};
  const e1 = eq[fiKeyEq(proveedor, desc)], e2 = eq[fiKeyEq('', desc)];
  [[e1, 99, 'ya lo confirmaste con este proveedor'], [e2, 96, 'ya lo confirmaste antes']].forEach(([e, c, m]) => {
    const p = e && prods.find(x => x.id === e.productId); if(p) add(p, c, m);
  });
  const n = fiNormalizar(desc), tam = n.pres.pesoG != null ? 'g' + n.pres.pesoG : n.pres.volumenMl != null ? 'ml' + n.pres.volumenMl : null;
  prods.forEach(p => {
    if(dupKey(p) === dupKey({ name: item.name || desc })){ add(p, 97, 'mismo nombre'); return; }
    const pn = fiNormalizar((p.name || '') + ' ' + (p.size || ''));
    const A = new Set(n.palabras), B = new Set(pn.palabras);
    if(!A.size || !B.size) return;
    let inter = 0;
    A.forEach(w => { if(B.has(w)) inter++; else for(const v of B) if(w.length >= 4 && v.length >= 4 && (v.startsWith(w) || w.startsWith(v) || fiLev(w, v) <= 1)){ inter += 0.8; break; } });
    const jac = inter / (A.size + B.size - inter);
    const cubre = inter / Math.min(A.size, B.size);
    let s = 20 * jac + 40 * cubre;
    if(n.marca && pn.marca) s += n.marca === pn.marca ? 28 : -35;
    else if(n.marca && pn.texto.includes(n.marca)) s += 18;
    const tp = fiTamanoDe(p);
    if(tam && tp) s += tam === tp ? 18 : -30;
    else if(!tam && n.pres.contenido != null && !n.pres.unidadContenido){            // «48X900» sin unidad: se compara solo el número
      const np = fiPresentacion((p.name || '') + ' ' + (p.size || '')).contenido;
      if(np != null) s += np === n.pres.contenido ? 14 : -15;
    }
    if(n.pres.unidadesPorPaquete && p.det && Number(p.det.unidadesPorPaquete) === n.pres.unidadesPorPaquete) s += 4;
    s = Math.round(Math.max(0, Math.min(94, s)));     // por nombre nunca pasa de 94: lo seguro viene de códigos o de lo que confirmaste
    if(s >= 45) add(p, s, 'nombre, marca y presentación parecidos');
  });
  res.sort((a, b) => b.conf - a.conf);
  const top = res[0], seg = res[1];
  const empate = top && seg && top.conf < 95 && (top.conf - seg.conf) < 6;
  const nivel = !top ? 'nuevo' : top.conf >= 95 ? 'muy alta' : top.conf >= 85 ? 'alta' : top.conf >= 70 ? 'revisar' : 'nuevo';
  const auto = top && !empate && top.conf >= 85;
  return {
    productId: auto ? top.p.id : (top && top.conf >= 70 && !empate ? top.p.id : ''),
    confianza: top ? top.conf : 0, nivel: empate ? 'varias' : nivel, revisar: !auto,
    candidatos: res.filter(r => r.conf >= 45).slice(0, 5).map(r => ({ id: r.p.id, name: r.p.name + (r.p.size ? ' ' + r.p.size : ''), conf: r.conf, motivo: r.motivo }))
  };
}

/* Renglones de producto desde el texto leído por el OCR. Entiende las dos formas más comunes:
   «CANT DESCRIPCIÓN V.UNIT TOTAL» y «DESCRIPCIÓN CANT V.UNIT TOTAL». Comprueba que
   cantidad × precio = total del renglón; si no cuadra, igual lo deja pero marcado para revisar.
   También separa palabras que el OCR pegó («MAGGICALDOGALLINA» → «MAGGI CALDO GALLINA»). */
const FI_PALABRAS = ['CERVEZA', 'LATA', 'BOTELLA', 'CALDO', 'GALLINA', 'COSTILLA', 'RES', 'POLLO', 'LECHE', 'CONDENSADA', 'DOYP', 'DOYPACK', 'POLVO', 'ENTERA', 'DESLACTOSADA',
  'ARROZ', 'AZUCAR', 'ACEITE', 'SAL', 'CAFE', 'CHOCOLATE', 'GASEOSA', 'AGUA', 'JUGO', 'NECTAR', 'GALLETA', 'GALLETAS', 'PAPAS', 'LIGHT', 'ORIGINAL', 'CERO', 'ZERO',
  'BOLSA', 'CAJA', 'PAQUETE', 'DISPLAY', 'SIXPACK', 'PET', 'VIDRIO', 'RETORNABLE', 'JABON', 'DETERGENTE', 'PAPEL', 'HIGIENICO', 'CREMA', 'DENTAL', 'SHAMPOO', 'MALTA',
  'AGUARDIENTE', 'RON', 'TRADICIONAL', 'SIN', 'CON', 'DE', 'LA', 'EL', 'MEDIA', 'LITRO', 'FRESA', 'MORA', 'MANGO', 'NARANJA', 'LIMON', 'UVA', 'VAINILLA', 'CUBOS', 'TABLETA'];
function fiSepararPegadas(tok){
  if(tok.length < 9 || /\d/.test(tok)) return tok;
  const dic = new Set(FI_PALABRAS.concat(FI_MARCAS.flatMap(m => m.split(' '))).concat((data.products || []).flatMap(p => fiAscii(p.name || '').toUpperCase().split(/[^A-Z]+/))).filter(w => w.length >= 2));
  const T = fiAscii(tok).toUpperCase(), mejor = new Array(T.length + 1).fill(null); mejor[0] = [];
  for(let i = 0; i < T.length; i++){ if(!mejor[i]) continue;
    for(let j = Math.min(T.length, i + 16); j > i + 1; j--){ const w = T.slice(i, j); if(dic.has(w) && (!mejor[j] || mejor[j].length > mejor[i].length + 1)) mejor[j] = mejor[i].concat(w); } }
  return mejor[T.length] ? mejor[T.length].join(' ') : tok;
}
/* Renglones de producto desde el texto leído (sin internet). Pensado para facturas reales de
   distribuidores colombianos: código al inicio, descripción con la presentación (24X594G,
   (18BS/40/10g), X12 UNID), columna de unidad (UN, UND, BS, PP, PL, LAT, DI), cantidades con
   decimales (1.00), precios como 18,196.00 o 8.018, % de IVA, descuentos, y tirillas POS donde la
   descripción sigue en el renglón de abajo. Cantidad y costo se comprueban con el total del
   renglón; si no cuadran, el renglón queda marcado para revisar (nunca se inventa un valor). */
const FI_UNID_COL = /^(UN|UND|UNID|UNDS|DI|BS|PP|PL|LAT|CJ|PQ|PAQ|KL|BL|FD|DP|DS|EA|NIU)$/;
const FI_IVAS = [0, 5, 8, 19];
function fiDineroTok(t0){
  // {v, dec, sep, corto, pct} o null. «18,196.00»→18196 · «2.742.00»→2742 · «8,018»→8018 · «1.00»→1 · «19%»→19 %
  let t = String(t0).replace(/[:;]/g, ',').replace(/^[-–(\/]+|[-–),.\/]+$/g, '');
  const pct = /%$/.test(t); t = t.replace(/%$/, '');
  if(/\d/.test(t)) t = t.replace(/[Oo]/g, '0').replace(/[lI]/g, '1');
  if(!/^\d[\d.,]*$/.test(t)) return /^[\d.,\/:%()-]+$/.test(t) && /\d/.test(t) ? { v: NaN, raro: true } : null;
  let m;
  if((m = t.match(/^(\d{1,3}(?:[.,]\d{3})+)[.,](\d{2})$/))) return { v: Number(m[1].replace(/[.,]/g, '') + '.' + m[2]), dec: true, sep: true, pct };
  if(/^\d{1,3}(?:[.,]\d{3})+$/.test(t)) return { v: Number(t.replace(/[.,]/g, '')), dec: false, sep: true, pct };
  if((m = t.match(/^(\d+)[.,](\d{1,2})$/))) return { v: Number(m[1] + '.' + m[2]), dec: true, sep: false, corto: true, pct };
  if(/^\d+$/.test(t)) return { v: Number(t), dec: false, sep: false, pct };
  return { v: NaN, raro: true };                                   // número dañado por el OCR (7.5680)
}
function fiParsearRenglones(texto){
  const out = [], CLAVE = /\b(SUB\s?-?TOTAL|TOTAL(ES)?|NIT|FECHA|TEL(EFONO)?|FACTURA|DESCRIPCION|RETE\w*|CUFE|CUDE|PAGAR|CAMBIO|EFECTIVO|VENCE|CLIENTE|DIRECCION|VENDEDOR|PEDIDO|CORREO|DOCUMENTO|ASESOR|OBSERVACIONES|RESOLUCION|BASE|CONTACTO|PLANILLA|IDENTIFICACION|FORMA|ITEMS)\b/;
  const PRES = /^\(?\d*[.,]?\d+\s*(X|\*)\s*\d|^X\d|\d(G|GR|GRS|GMS|ML|L|LT|KG|CC|OZ|UND|UN)$|\//i;
  const esUnidad = t => FI_UNID_COL.test(fiAscii(t).toUpperCase().replace(/[^A-Z]/g, '')) && /^[^\d]*$/.test(t);
  const esBasura = t => /^[^\dA-Za-z]*$/.test(t) || (/^[A-Za-z]{1,2}\.?$/.test(t) && !/^(X|G|ML|KG|L)$/i.test(t)) ||
    (/\d/.test(t) && /[A-Za-z]/.test(t) && (t.match(/[A-Za-z]/g) || []).length <= 2 && !PRES.test(t));
  const esCola = t => !!fiDineroTok(t) || esUnidad(t) || esBasura(t);
  let previo = null;
  String(texto || '').split(/\n/).forEach(l0 => {
    let l = fiCorregirOCR(l0).replace(/[|—–_=\[\]{}“”"¡!¿£»«©®°~^`<>]+/g, ' ').replace(/\$\s*/g, '')
      .replace(/(\d{3,})-(?=\d{1,2}\b)/g, '$1 ').replace(/(\d)[.,]\s+(\d{3})\b/g, '$1,$2').replace(/\s+/g, ' ').trim();
    const A = fiAscii(l).toUpperCase();
    if(l.length < 4) return;
    if(CLAVE.test(A)){ previo = null; return; }
    let toks = l.split(' ').filter(Boolean);
    // Continuación de una tirilla POS: sin ningún precio, justo debajo de un producto
    if(previo && previo.pos && !toks.some(t => /\d{6,}/.test(t)) && !toks.some(t => { const n = fiDineroTok(t); return n && !n.raro && !n.pct && !n.corto && n.v >= 50 && /[.,]/.test(t); }) && toks.length <= 7 && toks.some(w => /[A-Za-z]{3,}/.test(w))){
      const sig = toks.join(' ').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9)]+$/g, '').replace(/\s+[A-Za-z]$/, '').trim(), ult = previo.original.split(' ').pop();
      const pegada = fiAscii(ult + (sig.split(' ')[0] || '')).toUpperCase();
      if(sig) previo.original = previo.name = (FI_PALABRAS.includes(pegada) ? previo.original + sig : previo.original + ' ' + sig).trim();
      previo = null; return;
    }
    // 1) código del producto (y número de ítem antes de él)
    let sku = null;
    for(let i = 0; i < Math.min(3, toks.length - 2); i++){
      const t = toks[i].replace(/[^\dA-Za-z]/g, '');
      if(/^\d{3,14}$/.test(t)){
        const sig = toks[i + 1].replace(/[^\dA-Za-z]/g, '');
        if(/^\d{3,14}$/.test(sig) && toks.length > i + 3){ sku = sig; toks = toks.slice(i + 2); } else { sku = t; toks = toks.slice(i + 1); }
        break;
      }
      if(/[A-Za-z]{4,}/.test(t) && !/^[A-Z][a-z]{0,3}$/.test(toks[i])) break;     // ya empezó la descripción
    }
    // 2) cola numérica del final (precios, %, cantidad, unidad); se salta la basura del OCR
    const cola = [];
    let j = toks.length - 1;
    for(; j >= 0; j--){
      const t = toks[j], n = fiDineroTok(t);
      if(n && !n.raro){ cola.unshift({ n, t }); continue; }
      if(esUnidad(t)){ cola.unshift({ unidad: true, t }); continue; }
      if(n || esBasura(t)){ cola.unshift({ basura: true, t }); continue; }
      const precioAntes = j >= 1 && (n => n && !n.raro && n.sep && n.v >= 50)(fiDineroTok(toks[j - 1]));
      if((cola.some(c => c.n && c.n.v >= 50) || precioAntes) && j >= 2 && esCola(toks[j - 1]) && esCola(toks[j - 2]) && !esUnidad(toks[j - 1])){ cola.unshift({ basura: true, t }); continue; }
      break;
    }
    let desc = toks.slice(0, j + 1);
    const nums = cola.filter(c => c.n), exactos = nums.filter(c => !c.n.pct && !c.n.corto && c.n.v >= 50);
    const tieneLetras = desc.some(w => /[A-Za-z]{3,}/.test(w));
    // Renglón de continuación (tirillas POS): sin código ni precios, se pega al producto anterior
    if(!sku && exactos.length < 2){ previo = null; return; }
    if(!exactos.length || !tieneLetras || nums.length < 2){ previo = null; return; }
    // 3) cantidad: la que está justo antes de la columna de unidad; si no hay unidad, la que va antes del 1.er precio
    const esCant = c => c && c.n && !c.n.pct && c.n.v > 0 && c.n.v < 10000 && (!c.n.dec || /^\d+[.,]0+$/.test(c.t.replace(/[^\d.,]/g, '')));
    const antesDeUnidad = k => { for(let m = k + 1; m < cola.length; m++){ if(cola[m].basura) continue; return !!cola[m].unidad; } return false; };
    const esPrecio = c => c.n && !c.n.pct && !c.n.corto && c.n.v >= 50;
    let iU = -1; cola.forEach((c, k) => { if(c.unidad && cola.slice(k + 1).some(esPrecio)) iU = k; });
    const iP0 = cola.findIndex((c, k) => k > iU && esPrecio(c) && !antesDeUnidad(k));
    let qty = null, iQ = -1;
    if(iU > 0){ for(let k = iU - 1; k >= 0; k--){ if(cola[k].basura) continue; if(esCant(cola[k])){ qty = cola[k].n.v; iQ = k; } break; } }
    const iPct = cola.findIndex(c => c.n && c.n.pct);
    if(iU < 0 && iPct > 0 && esCant(cola[iPct - 1])){ qty = cola[iPct - 1].n.v; iQ = iPct - 1; }     // tirilla: «cant  19%  v.unit  total»
    if(qty == null && iU < 0){
      const lim = iP0 >= 0 ? iP0 : cola.length;
      for(let k = lim - 1; k >= 0; k--){ const c = cola[k]; if(c.n && c.n.pct) continue; if(esCant(c) && !(FI_IVAS.includes(c.n.v) && cola[k + 1] && cola[k + 1].n && cola[k + 1].n.pct)){ qty = c.n.v; iQ = k; } break; }
      if(qty == null){ const c = cola.slice(0, lim).reverse().find(esCant); if(c){ qty = c.n.v; iQ = cola.indexOf(c); } }
    }
    const desde = Math.max(iQ, iU);
    // lo que quedó antes de la cantidad/unidad es parte de la descripción (ej. «X 12 UNID»)
    if(desde > 0) desc = desc.concat(cola.slice(0, iQ >= 0 && iU >= 0 ? Math.min(iQ, iU) : desde).filter(c => !c.basura).map(c => c.t));
    let qtyLeida = qty;
    if(qty != null && qty >= 100 && qty % 100 === 0) qty = qty / 100;      // «200» por «2.00»
    const despues = cola.slice(desde + 1).filter(c => c.n);
    const precios = despues.filter(c => !c.n.pct && !c.n.corto && c.n.v >= 50);
    if(!precios.length){ previo = null; return; }
    let iva = null;
    const pc = despues.find(c => c.n.pct) || despues.find(c => FI_IVAS.includes(c.n.v) && !c.n.sep && !c.n.dec && despues.indexOf(c) > despues.indexOf(precios[0]));
    if(pc && FI_IVAS.includes(Math.round(pc.n.v))) iva = Math.round(pc.n.v);
    // 4) cuadrar con el total del renglón (el último precio)
    const total = precios.length > 1 ? precios[precios.length - 1].n.v : null;
    const unidades = precios.slice(0, -1).map(c => c.n.v).concat(despues.filter(c => c.n.corto && c.n.v >= 1 && c.n.v < 1000).map(c => Math.round(c.n.v * 1000)));
    if(total == null) unidades.push(precios[0].n.v);
    const cerca = (a, b) => b > 0 && Math.abs(a - b) <= Math.max(30, b * 0.031);
    const fs = [...new Set((iva != null ? [1 + iva / 100] : []).concat([1.19, 1]))];
    let sol = null;
    if(total != null){
      const prueba = (conQ, tol) => { for(const u of unidades) for(const f of fs){
        const cs = conQ ? (qty ? [qty, qtyLeida] : []) : [Math.round(total / (u * f)), Math.round(total / u)];
        const dentro = (a, b) => b > 0 && Math.abs(a - b) <= Math.max(30, b * tol);
        for(const c of cs){ if(!(c >= 1) || c > 5000 || (!conQ && (c > 60 || u < total / 60))) continue;
          if(dentro(total, c * u * f)) return { q: c, u, linea: total, iva: f > 1 ? Math.round((f - 1) * 100) : (iva != null ? iva : null) };
          // total = cantidad × precio: si ese precio es el 1.º de la fila, el total va sin IVA (tirillas POS);
          // si es una columna posterior (valor unitario con IVA), el total ya lo incluye.
          if(dentro(total, c * u)) return { q: c, u, linea: iva && u === unidades[0] ? total * (1 + iva / 100) : total, iva };
        } } return null; };
      // la cantidad leída manda; solo si es imposible (o no se leyó) se deduce del total
      const imposible = !qty || unidades.every(u => qty * u > total * 1.3 || qty * u * 1.19 < total * 0.6);
      sol = prueba(true, 0.012) || prueba(true, 0.031) || (imposible ? (prueba(false, 0.012) || prueba(false, 0.031)) : null);
      if(!sol && imposible){                                              // el OCR dañó un dígito: la opción que más se acerque
        let mejor = null;
        for(const u of unidades.slice(0, 1)) for(const f of fs) for(const c of [Math.round(total / (u * f)), Math.round(total / u)]){
          if(!(c >= 1) || c > 60) continue;
          const err = Math.abs(total - c * u * f) / total;
          if(err <= 0.08 && (!mejor || err < mejor.err)) mejor = { err, q: c, u, linea: f > 1 ? total : (iva ? total * (1 + iva / 100) : total), iva: f > 1 ? 19 : iva, dudoso: true };
        }
        sol = mejor;
      }   // el OCR dañó un dígito
    }
    let q = sol ? sol.q : (qty || 1), u = sol ? sol.u : precios[0].n.v;
    if(sol) iva = sol.iva;
    const original = desc.join(' ').replace(/^[^A-Za-z0-9(]+/, '').replace(/[\s\-.,;:]+$/, '').replace(/\s+/g, ' ').trim()
      .split(' ').map(fiSepararPegadas).join(' ');
    if(!/[A-Za-z]{3,}/.test(original)){ previo = null; return; }
    const it = { name: original, original, sku, qty: q, precioUnidad: u, line_total: sol ? Math.round(sol.linea) : null, iva_pct: iva, cuadra: !!sol && !sol.dudoso, pos: iU < 0,
      unit_cost: Math.round((sol ? sol.linea / q : u * (1 + (iva || 0) / 100)) * 100) / 100 };
    out.push(it); previo = it;
  });
  // Renglones sin IVA leído y sin total que cuadre: se usa el IVA que traen los demás renglones de la factura
  const ivas = out.filter(x => x.cuadra && x.iva_pct != null).map(x => x.iva_pct);
  const dom = ivas.length >= 2 ? ivas.sort((a, b) => ivas.filter(v => v === b).length - ivas.filter(v => v === a).length)[0] : null;
  out.forEach(x => { if(!x.cuadra && x.iva_pct == null && dom){ x.iva_pct = dom; x.unit_cost = Math.round(x.precioUnidad * (1 + dom / 100) * 100) / 100; } });
  return out;
}
// Distribuidores que más llegan a tiendas en Colombia (se reconocen aunque el OCR los escriba mal).
const FI_PROVEEDORES = [[/DISTRIMARCAS|DISTRIMAR\b/, 'Distrimarcas TAT S.A.S.'], [/C?CESTAN FORCE|CUESTAN FORCE|CEESTAN FORCE/, 'CCESTAN FORCE S.A.S.'],
  [/COLOMBINA|COLOMBINE|COLOMB1NA/, 'Distribuidora Colombina'], [/DULMARCAS|DULMARCA/, 'Dulmarcas M&M S.A.S.'], [/SUPER\s?RICAS/, 'Super Ricas'],
  [/NUTRESA|COMERCIAL NUTRESA/, 'Comercial Nutresa'], [/BAVARIA/, 'Bavaria'], [/POSTOBON/, 'Postobón'], [/COCA[- ]?COLA FEMSA|FEMSA/, 'Coca-Cola FEMSA'],
  [/ALPINA/, 'Alpina'], [/COLANTA/, 'Colanta'], [/QUALA/, 'Quala'], [/FRITO LAY|PEPSICO/, 'PepsiCo / Frito Lay'], [/YUPI/, 'Yupi'], [/RAMO\b/, 'Productos Ramo'],
  [/MONDELEZ/, 'Mondelez'], [/NESTLE/, 'Nestlé'], [/UNILEVER/, 'Unilever'], [/FAMILIA\b.*S\.?A/, 'Productos Familia'], [/ZENU|CARNICOS/, 'Zenú'], [/MERCADERISTAS|MAKRO/, 'Makro']];
/* Cuadre de cada renglón de factura (venga de la IA o del lector sin internet), ANTES de mostrarlo.
   La IA a veces devuelve el TOTAL del renglón como si fuera el precio de UNA unidad, o la cantidad
   en cajas en vez de unidades, o le suma el IVA a un total que ya lo traía. Aquí se recalcula todo
   con aritmética, sin inventar datos:
     unidades = cajas × unidades por caja (si se compró por caja/paquete)
     total con IVA = subtotal + IVA − descuento (o el total impreso)
     costo por unidad con IVA = total con IVA ÷ unidades
     costo por unidad sin IVA = costo con IVA ÷ (1 + %IVA) · IVA por unidad = la diferencia
   Si algo no cuadra se marca el renglón (y la factura) para revisar: nunca se guarda en silencio. */
const FI_EMPAQUE = /^(CJ|CJA|CAJA|CAJAS|PQ|PQT|PAQ|PAQUETE|PAQUETES|DISPLAY|DSP|DISP|FARDO|FD|BULTO|BTO|SIXPACK|SIX|DOC|DOCENA|DOCENAS|BANDEJA|BJ|PACA|PACK|BS|BOLSA|TIRA)$/;
function fiCuadrar(items, header){
  const n = v => { if(v == null || v === '') return null; const x = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(x) ? x : null; };
  const cerca = (a, b, t) => a != null && b != null && b !== 0 && Math.abs(a - b) <= Math.max(2, Math.abs(b) * (t || 0.015));
  const out = (items || []).map(x0 => {
    const x = Object.assign({}, x0), notas = [];
    let q = n(x.qty), u = n(x.unit_cost), T = n(x.line_total), S = n(x.line_subtotal), V = n(x.iva_value), D = n(x.discount);
    let r = n(x.iva_pct); if(r != null && r > 1) r = r / 100; if(r != null && (r < 0 || r > 0.3)) r = null;
    let c = n(x.cajas), k = n(x.unidades_por_caja);
    const upp = n(x.units_per_package) || (typeof fiPresentacion === 'function' ? fiPresentacion(String(x.original || x.name || '') + ' ' + (x.presentation || '')).unidadesPorPaquete : null);
    const und = String(x.unit || '').toUpperCase().replace(/[^A-Z]/g, '');
    // 1) unidades reales compradas
    if(!(c > 0 && k > 1) && FI_EMPAQUE.test(und) && upp > 1 && q > 0){ c = q; k = upp; }
    // La presentación dice cuántas trae el paquete (24X594G, X12 UND, 330 X24…): la cantidad son paquetes.
    // Si la cantidad ya viene en unidades (múltiplo exacto del paquete), se respeta.
    // Sensatez: si al repartir el valor quedaría cada unidad en menos de $200, el precio ya era por unidad
    // (ej. «LA LECHERA 48X80G», 4 × $2.742: son 4 sobres sueltos de una caja de 48, no 192).
    const valRenglon = T != null ? T : (u != null ? u * q : null);
    const repartible = !(valRenglon > 0) || valRenglon / ((q >= upp && q % upp === 0 ? q : q * upp) || 1) >= 200;
    if(!(c > 0 && k > 1) && upp > 1 && q > 0 && repartible && !/^(KG|KL|KILO|GR|G|LB|LT|LTS|L|ML|MT|M)$/.test(und)){
      if(q >= upp && q % upp === 0){ c = q / upp; k = upp; }
      else { c = q; k = upp; }
    }
    if(und === 'DOC' || und === 'DOCENA' || und === 'DOCENAS'){ if(!(k > 1)){ c = q; k = 12; } }
    let N = q;
    if(c > 0 && k > 1){
      if(!q || cerca(q, c, 0.001)){ N = c * k; notas.push(c + ' ' + (c === 1 ? 'caja/paquete' : 'cajas/paquetes') + ' × ' + k + ' = ' + (c * k) + ' unidades'); }
      else if(cerca(q, c * k, 0.001)) N = q;
      else N = q;
    }
    const qtyFalta = !(N > 0);
    if(!(N > 0)) N = 1;
    if(qtyFalta) notas.push('no se leyó la cantidad: escríbela y ORDEVA divide el total');
    // 2) total del renglón con IVA
    let Tc = null;
    if(S != null && V != null) Tc = S + V - (D || 0);
    if(T != null){
      if(Tc != null){ if(!cerca(T, Tc) && r > 0 && cerca(T, S - (D || 0))) notas.push('el total impreso no traía el IVA'); else Tc = T; }
      else if(r > 0 && S != null && cerca(T, S - (D || 0))){ Tc = T * (1 + r); notas.push('al total impreso se le sumó el IVA (' + Math.round(r * 100) + '%)'); }
      else Tc = T;
    }
    if(Tc == null && S != null && r != null) Tc = (S - (D || 0)) * (1 + r);
    if(r == null && V != null && Tc > V) r = V / (Tc - V);              // tasa sacada del IVA impreso
    // 3) costo por unidad con IVA
    let cuadra = true;
    if(Tc != null && Tc > 0){
      if(u != null && cerca(u * N, Tc)){ /* ya cuadra */ }
      else if(u != null && N > 1 && cerca(u, Tc)){ notas.push('el precio que venía era el total del renglón: se dividió entre ' + N); }
      else if(u != null && r > 0 && cerca(u * N * (1 + r), Tc)){ notas.push('el precio unitario venía sin IVA'); }
      else if(u != null && c > 0 && k > 1 && cerca(u * c, Tc)){ notas.push('el precio era por caja: se dividió entre ' + k); }
      else if(u != null && c > 0 && k > 1 && r > 0 && cerca(u * c * (1 + r), Tc)){ notas.push('el precio era por caja y sin IVA: se le sumó el IVA y se dividió entre ' + k); }
      else if(u != null && u > 0){ cuadra = false; notas.push('cantidad × precio no da el total del renglón: se usó total ÷ cantidad'); }
      u = Tc / N;
    } else if(u != null && c > 0 && k > 1 && x.precio_por_caja){ u = u / k; }
    if(!(u > 0)) u = 0;
    // 4) IVA por unidad
    const rr = r || 0, sinIva = u / (1 + rr);
    const lineaTotal = Tc != null ? Tc : u * N;
    Object.assign(x, {
      qty: Math.round(N * 1000) / 1000, unit_cost: Math.round(u * 100) / 100, line_total: Math.round(lineaTotal),
      line_subtotal: Math.round(lineaTotal / (1 + rr)), line_iva: Math.round(lineaTotal - lineaTotal / (1 + rr)),
      iva_pct: r != null ? Math.round(rr * 1000) / 10 : null, costo_unit_sin_iva: Math.round(sinIva * 100) / 100, iva_unit: Math.round((u - sinIva) * 100) / 100,
      cajas: c > 0 && k > 1 ? c : 1, unidades_por_caja: c > 0 && k > 1 ? k : N, costo_sin_iva: Math.round(sinIva * (c > 0 && k > 1 ? k : N) * 100) / 100,
      cuadra: x.cuadra === false ? false : cuadra, ajustes: notas, qty_falta: qtyFalta
    });
    return x;
  });
  // 5) La factura completa: ¿el IVA quedó sumado dos veces? Se compara con el total impreso.
  const tot = header && n(header.total);
  if(tot > 0 && out.length){
    const sA = out.reduce((s, x) => s + x.line_total, 0);
    const sB = out.reduce((s, x) => s + (x.iva_pct ? x.line_total / (1 + x.iva_pct / 100) : x.line_total), 0);
    const ok = v => cerca(v, tot, 0.02);
    if(!ok(sA) && ok(sB) && out.some(x => x.iva_pct > 0)){
      out.forEach(x => { if(!(x.iva_pct > 0)) return; const f = 1 + x.iva_pct / 100;
        x.line_total = Math.round(x.line_total / f); x.unit_cost = Math.round(x.unit_cost / f * 100) / 100;
        x.costo_unit_sin_iva = Math.round(x.unit_cost / f * 100) / 100; x.iva_unit = Math.round((x.unit_cost - x.costo_unit_sin_iva) * 100) / 100;
        x.line_subtotal = Math.round(x.line_total / f); x.line_iva = x.line_total - x.line_subtotal; x.costo_sin_iva = Math.round(x.costo_unit_sin_iva * x.unidades_por_caja * 100) / 100;
        x.ajustes.push('el IVA estaba sumado dos veces: se dejó una sola vez'); });
    }
  }
  return out;
}
/* Encabezado de la factura desde el texto leído. Solo se llena lo que aparece claramente
   escrito; lo demás queda en null y en la revisión dice «Revisar dato». */
function fiEncabezado(texto){
  const T = String(texto || ''), U = fiAscii(T).toUpperCase();
  const num = s => { if(s == null) return null; let v = String(s).replace(/[^\d.,-]/g, ''); if(!v) return null;
    if(/[.,]\d{3}$/.test(v) && !/[.,]\d{1,2}$/.test(v.replace(/[.,]\d{3}$/, ''))) v = v.replace(/[.,]/g, '');
    else v = v.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = parseFloat(v); return isFinite(n) ? Math.round(n) : null; };
  const fecha = s => { if(!s) return null; let m = s.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if(m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/); if(m){ const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); } return null; };
  const tras = (re) => { const m = U.match(re); return m ? m[1].trim() : null; };
  const valor = (re) => { const m = U.match(re); return m ? num(m[1]) : null; };
  const h = {
    invoiceNumber: tras(/\bVENTA\s*N[O0°º]\.?\s*:?\s*([A-Z]{0,4}-?\d{3,12})\b/) || tras(/\bFACTURA ELECTRONICA[^\n]{0,80}?\b(\d{2}-\d{6,10})\b/) ||
      tras(/\bNOTA\b[\s\S]{0,60}?\bPEDIDO\b[\s\S]{0,90}?\b(\d{6,8})\b/) || tras(/\b(\d{2}-\d{8})\b/) ||
      tras(/(?:FACTURA(?: ELECTRONICA)?(?: DE VENTA)?|FV|FACT\.?|REMISION)\s*(?:NO\.?|N°|Nº|NRO\.?|NUMERO|#)?\s*[:.]?\s*([A-Z]{0,5}-?\s?\d{2,12})/),
    issueDate: fecha(tras(/(?:FECHA(?: DE)? (?:EMISION|EXPEDICION|FACTURA|GENERACION)|FECHA)\s*[:.]?\s*([0-9]{1,4}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4})/)),
    dueDate: fecha(tras(/(?:VENCIMIENTO|FECHA DE VENCIMIENTO|VENCE)\s*[:.]?\s*([0-9]{1,4}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4})/)),
    supplierNit: tras(/\bNIT\.?\s*[:.]?\s*([89]\d{2}\.?\d{3}\.?\d{3}\s?-\s?\d)(?!\d)/) || tras(/\bNIT\.?\s*[:.]?\s*([89]\d{2}\.?\d{3}\.?\d{3})(?!\d)/) || tras(/\b([89]\d{8}\s?-\s?\d)(?!\d)/),
    phone: tras(/(?:TEL(?:EFONO)?|CEL(?:ULAR)?|PBX)\.?\s*[:.]?\s*(\+?\d[\d\s-]{6,15}\d)/),
    email: (T.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [null])[0],
    address: tras(/(?:DIRECCION|DIR\.)\s*[:.]?\s*([^\n]{6,60})/),
    orderNumber: tras(/(?:ORDEN DE COMPRA|PEDIDO|O\.C\.?)\s*(?:NO\.?|N°|#)?\s*[:.]?\s*([A-Z0-9-]{3,15})/),
    paymentMethod: tras(/(?:MEDIO DE PAGO|FORMA DE PAGO|METODO DE PAGO)\s*[:.]?\s*([A-Z ]{4,30})/),
    paymentTerms: tras(/(?:CONDICION(?:ES)? DE PAGO|PLAZO)\s*[:.]?\s*([A-Z0-9 ]{3,30})/),
    cufe: (U.match(/\b(?:CUFE|CUDE)\s*[:.]?\s*([0-9A-F]{60,100})/) || [null, null])[1],
    validationDate: fecha(tras(/(?:FECHA DE VALIDACION|VALIDACION DIAN)\s*[:.]?\s*([0-9]{1,4}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4})/)),
    subtotal: valor(/\bSUB\s?-?TOTAL\b[^\d\n]{0,12}([\d.,]{3,})/) || valor(/^\W{0,4}BASE\b[^\d\n]{0,12}([\d.,]{3,})/m),
    iva: valor(/\bTOTAL\s+IMPUESTOS?\b[^\d\n]{0,12}([\d.,]{3,})/) || valor(/\bIVA\s*\d{1,2}\s*%[^\d\n]{0,12}([\d.,]{3,})/) || valor(/\b(?:TOTAL\s+)?IVA\b(?:\s*\d{1,2}\s*%)?[^\d\n]{0,12}([\d.,]{4,})/),
    retenciones: valor(/\b(?:RETE\s?FUENTE|RETENCION(?:ES)?|RETEIVA|RETEICA)\b[^\d\n]{0,12}([\d.,]{3,})/),
    otrosImpuestos: valor(/\b(?:IMPOCONSUMO|ICO|IMPUESTO AL CONSUMO|IBUA|ICUI)\b[^\d\n]{0,12}([\d.,]{3,})/),
    descuentos: valor(/\bDESCUENTOS?\b[^\d\n]{0,12}([\d.,]{3,})/),
    total: valor(/\b(?:TOTAL A PAGAR|VALOR TOTAL|TOTAL FACTURA|NETO A PAGAR|TOTAL(?!\s*(?:IMPUESTOS?|DESCUENTOS?|RETENCION(?:ES)?|ITEMS|UNIDADES|CARTONES|DE ARTICULOS|IVA)))\b[^\d\n]{0,12}([\d.,]{3,})(?![\s\S]*\b(?:TOTAL A PAGAR|VALOR TOTAL|NETO A PAGAR)\b)/)
  };
  // «Creación/venc. 2026/09/28 - 2026/09/28» (notas de pedido)
  const cv = U.match(/CREACION\s*\/?\s*VENC\.?\s*(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})(?:\s*-\s*(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}))?/);
  if(cv){ if(!h.issueDate) h.issueDate = fecha(cv[1]); if(!h.dueDate && cv[2]) h.dueDate = fecha(cv[2]); }
  if(!h.issueDate){                                    // sin rótulo: la primera fecha válida del documento
    const fs = (U.match(/\b\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\b|\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4}\b/g) || []).map(fecha)
      .filter(f => f && +f.slice(5, 7) >= 1 && +f.slice(5, 7) <= 12 && +f.slice(8) >= 1 && +f.slice(8) <= 31 && Math.abs(+f.slice(0, 4) - new Date().getFullYear()) <= 1);
    if(fs.length) h.issueDate = fs[0];
  }
  // Total sin rótulo legible (tirillas): el mayor valor con $ después del subtotal
  if(h.total == null && /\$/.test(T)){
    const desde = U.search(/SUB\s?-?TOTAL|SUBO?\s?T?O?TAL|DESCUENTO/);
    const vals = (desde >= 0 ? T.slice(desde) : T).match(/\$\s?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g) || [];
    const ns = vals.map(num).filter(v => v > 0); if(ns.length >= 2) h.total = Math.max(...ns);
  }
  if(h.orderNumber && h.orderNumber === h.invoiceNumber && !/NOTA\s*(?:DE\s*)?PEDIDO/.test(U)) h.invoiceNumber = null;
  if(h.supplierNit) h.supplierNit = h.supplierNit.replace(/\s/g, '');
  const lineas = T.split(/\n/).map(x => x.trim()).filter(Boolean);
  const conocido = FI_PROVEEDORES.find(([re]) => re.test(U));
  const rs = lineas.find(x => /\b(S\.?A\.?S|LTDA|S\.?A\.?|E\.?U|DISTRIBUIDORA|COMERCIALIZADORA|DISTRIBUCIONES|ALMACEN|SUPERMERCADO|MAYORISTA)\b/i.test(fiAscii(x)) && !/NIT|FACTURA|FECHA|CLIENTE|TIENDA DE/i.test(x));
  let prov = rs ? fiAscii(rs).toUpperCase().replace(/\s*NIT.*$/, '') : '';
  const corte = prov.match(/([A-Z][A-Z&.' ]{2,45}?\b(?:S\.?\s?A\.?\s?S|LTDA|S\.?\s?A)\b\.?)/);
  if(corte) prov = corte[1]; prov = prov.replace(/^(?:[A-Z]{1,2}\s+)+(?=[A-Z]{3})/, '').replace(/[^A-Z0-9.&' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  h.supplier = conocido ? conocido[1] : (prov ? prov.slice(0, 60) : null);
  return h;
}
// Mezcla lo que trajo la IA con lo leído localmente sin pisar lo que ya venía.
function fiUnirEncabezado(a, b){ const o = Object.assign({}, b || {}); Object.keys(a || {}).forEach(k => { if(a[k] != null && a[k] !== '') o[k] = a[k]; }); return o; }
const FI_CAMPOS = [['invoiceNumber', 'Número de factura'], ['supplier', 'Proveedor'], ['supplierNit', 'NIT'], ['issueDate', 'Fecha de emisión'],
  ['dueDate', 'Fecha de vencimiento'], ['subtotal', 'Subtotal'], ['iva', 'IVA'], ['retenciones', 'Retenciones'], ['otrosImpuestos', 'Otros impuestos'],
  ['descuentos', 'Descuentos'], ['total', 'Total'], ['address', 'Dirección'], ['phone', 'Teléfono'], ['email', 'Correo'], ['orderNumber', 'Número de pedido'],
  ['paymentMethod', 'Método de pago'], ['paymentTerms', 'Condiciones de pago'], ['cufe', 'CUFE / CUDE'], ['validationDate', 'Fecha de validación']];
/* Validación matemática y avisos. Nunca cambia los valores: solo avisa. */
function fiValidar(draft){
  const av = [], h = draft.header || {};
  const items = (draft.items || []).filter(it => it.include);
  const sumaLineas = items.reduce((s, it) => s + (Number(it.lineTotal) > 0 ? Number(it.lineTotal) : (Number(it.qty) || 0) * (Number(it.cost) || 0)), 0);
  const tol = v => Math.max(200, Math.abs(v) * 0.015);
  if(h.total != null && items.length){
    const sub = h.subtotal, imp = (h.iva || 0) + (h.otrosImpuestos || 0), desc = h.descuentos || 0, ret = h.retenciones || 0;
    let ok = Math.abs(sumaLineas - h.total) <= tol(h.total);                       // renglones con IVA incluido = total
    if(!ok && sub != null) ok = Math.abs(sub + imp - desc - h.total) <= tol(h.total) || Math.abs(sub + imp - desc - ret - h.total) <= tol(h.total);
    if(!ok) av.push({ tipo: 'total', txt: 'Hay una diferencia entre los valores detectados. Revise la factura. (Suma de productos ' + fmt(Math.round(sumaLineas)) + ' · total impreso ' + fmt(h.total) + ')' });
  }
  if(!h.invoiceNumber) av.push({ tipo: 'dato', txt: 'Falta el número de factura: revisar dato.' });
  // ¿Ya se aplicó esta misma factura? (mismo proveedor y número, o mismo proveedor, fecha y total)
  const provN = String(h.supplier || draft.supplier || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ya = (data.purchases || []).find(f => String(f.supplier || '').toLowerCase().replace(/[^a-z0-9]/g, '') === provN && ((h.invoiceNumber && f.invoiceNumber === h.invoiceNumber) || (h.total > 0 && Math.round(f.total || 0) === Math.round(h.total) && (f.date || '') === (h.issueDate || draft.date || ''))));
  if(ya && provN) av.push({ tipo: 'dup', txt: 'Esta factura parece ya aplicada (' + (ya.invoiceNumber ? 'n.º ' + ya.invoiceNumber : 'mismo total y fecha') + ', ' + new Date(ya.procesadaEn || ya.at).toLocaleDateString('es-CO') + '). Aplicarla otra vez duplicaría el inventario.' });
  if(!h.issueDate && !draft.date) av.push({ tipo: 'dato', txt: 'Falta la fecha de la factura: revisar dato.' });
  if(!(h.supplier || draft.supplier)) av.push({ tipo: 'dato', txt: 'Falta el proveedor: revisar dato.' });
  items.forEach(it => {
    const n = '«' + (it.name || '').slice(0, 30) + '»';
    if(it.match && it.match.nivel === 'varias') av.push({ tipo: 'coinc', txt: n + ': hay varios productos parecidos. Elija el correcto.' });
    else if(it.match && it.match.nivel === 'revisar') av.push({ tipo: 'coinc', txt: n + ': coincidencia dudosa (' + it.match.confianza + '%). Confírmela.' });
    if(it.unidadesPorPaquete > 1 && it.qty === it.unidadesPorPaquete && it.qtyDeColumna === false)
      av.push({ tipo: 'cant', txt: n + ': la cantidad es igual a las unidades del paquete (' + it.qty + '). ¿Compró ' + it.qty + ' unidades o 1 paquete?' });
    if(it.noCuadra) av.push({ tipo: 'cant', txt: n + ': cantidad × precio no da el total del renglón (el texto salió dañado). Revise cantidad y costo.' });
    if(it.qty >= 500 && !/kg|g|ml|l|metro|m\b/i.test(it.unit || '')) av.push({ tipo: 'cant', txt: n + ': la cantidad (' + it.qty + ') parece incorrecta. Revísela.' });
    if(h.total > 0 && it.qty * it.cost > h.total * 1.2) av.push({ tipo: 'precio', txt: n + ': cantidad × costo (' + fmt(Math.round(it.qty * it.cost)) + ') es más que el total de la factura. Revise cantidad y precio.' });
    const p = it.productId && data.products.find(x => x.id === it.productId);
    if(p && p.cost > 0 && it.cost > 0){ const r = it.cost / p.cost; if(r > 1.6 || r < 0.55) av.push({ tipo: 'precio', txt: n + ': el costo (' + fmt(it.cost) + ') es muy distinto al anterior (' + fmt(p.cost) + '). ¿Es por unidad o por paquete?' }); }
    if(it.ivaPctLeido != null && ![0, 5, 8, 19].includes(Math.round(it.ivaPctLeido))) av.push({ tipo: 'iva', txt: n + ': el IVA leído (' + it.ivaPctLeido + '%) no es una tarifa normal en Colombia (0, 5 o 19 %).' });
  });
  return av;
}

/* ================= ORDEVA IA =================
   Motor de decisiones de ORDEVA (github.com/NandhaKishorM/laya): recibe un texto corto y una
   pregunta de tipo «choice» con las opciones, y responde la opción elegida con su
   probabilidad calibrada (answer_confidence). Se usa SOLO para desempatar cuando un renglón
   de la factura se parece a varios productos del inventario: lo seguro (códigos,
   equivalencias aprendidas, nombre exacto) se resuelve aquí mismo sin llamar a nadie.
   Seguridad: la clave de ORDEVA NUNCA está en la app. La app llama al puente
   (puente/laya-worker.js, un Cloudflare Worker gratis) que guarda la clave como secreto del
   servidor y reenvía a POST /v1/systemone. En Ajustes solo se escribe la dirección del puente.
   La IA propone; la app valida (puntaje) y tú confirmas en la revisión. */
const LayaIA = (() => {
  const cfg = () => (typeof data !== 'undefined' && data && data.laya) || {};
  let caido = 0;                 // si falló hace poco, no se vuelve a intentar durante 2 min
  const cache = new Map();       // misma pregunta, misma respuesta (no se paga dos veces)
  const disponible = () => !!(cfg().url && /^https:\/\//.test(cfg().url) && navigator.onLine !== false && Date.now() - caido > 120000);
  async function pedir(ruta, cuerpo, ms){
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 7000);
    try{
      const r = await fetch(cfg().url.replace(/\/+$/, '') + ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo), signal: ctl.signal });
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    }catch(e){ caido = Date.now(); throw e; }
    finally{ clearTimeout(t); }
  }
  // texto: el renglón de la factura · opciones: [{id, name}] → { id, confianza 0-1 } o null
  async function elegir(texto, opciones, instrucciones){
    if(!disponible() || !opciones || opciones.length < 2) return null;
    const ops = opciones.slice(0, 12);
    const criteria = {}; ops.forEach((o, i) => { criteria['p' + i] = String(o.name).slice(0, 80); });
    criteria.ninguno = 'ninguno de estos productos';
    const clave = texto + '§' + JSON.stringify(criteria);
    if(cache.has(clave)) return cache.get(clave);
    const r = await pedir('/v1/systemone', {
      state: { body: String(texto).slice(0, 300) },
      questions: { producto: { type: 'choice', instructions: instrucciones || 'Which inventory product is this supplier invoice line? Same brand, product and size.', criteria } },
      model: cfg().modelo || 'multilingual'
    });
    const a = r && r.answers && r.answers.producto;
    if(!a || !a.choice) return null;
    const conf = Number(a.answer_confidence != null ? a.answer_confidence : (a.probabilities && a.probabilities[a.choice])) || 0;
    const out = a.choice === 'ninguno' ? { id: null, confianza: conf } : { id: (ops[Number(String(a.choice).slice(1))] || {}).id || null, confianza: conf };
    cache.set(clave, out);
    return out;
  }
  async function probar(){
    const r = await pedir('/v1/systemone', { state: { body: 'POKER LATA 330' },
      questions: { p: { type: 'choice', instructions: 'Which product?', criteria: { a: 'Cerveza Poker lata 330 ml', b: 'Leche condensada 900 g' } } } }, 9000);
    return !!(r && r.answers && r.answers.p);
  }
  return { disponible, elegir, probar, reset: () => { caido = 0; } };
})();
// Desempate con ORDEVA IA solo en los renglones dudosos (varios candidatos o 70-84 %).
// Si ORDEVA no está o falla, no pasa nada: queda la revisión manual con el aviso.
async function fiDesempatarConIA(items){
  const dudosos = items.filter(it => it.match && it.match.candidatos.length >= 2 && (it.match.nivel === 'varias' || it.match.nivel === 'revisar' || it.match.nivel === 'nuevo')).slice(0, 8);
  if(!dudosos.length) return { usada: false };
  if(!LayaIA.disponible()) return { usada: false, sinIA: !!(data.laya && data.laya.url) };
  let falla = false;
  await Promise.all(dudosos.map(async it => {
    try{
      const r = await LayaIA.elegir(it.originalDescription || it.name, it.match.candidatos.map(c => ({ id: c.id, name: c.name })));
      if(!r) return;
      it.match.ia = r;
      if(r.id && r.confianza >= 0.7){
        const c = it.match.candidatos.find(x => x.id === r.id);
        if(c){ c.conf = Math.min(94, Math.max(c.conf, Math.round(70 + 24 * r.confianza))); c.motivo = 'ORDEVA IA lo sugiere (' + Math.round(r.confianza * 100) + '%)'; }
        it.match.candidatos.sort((a, b) => b.conf - a.conf);
        it.productId = r.id; it.match.confianza = it.match.candidatos[0].conf; it.match.nivel = it.match.confianza >= 85 ? 'alta' : 'revisar';
      }
    }catch(e){ falla = true; }
  }));
  return { usada: true, falla };
}

/* ---------- Foto de la factura lista para leer ----------
   Antes de leer (con IA o sin internet) se arregla la foto en el mismo celular, sin subirla:
   1. Recorte y perspectiva: busca el papel (la zona clara más grande), toma sus 4 esquinas y
      la «endereza» como si fuera escaneada (sirve para fotos tomadas de lado o con la hoja
      un poco doblada). Si no encuentra un papel claro, deja la foto como está.
   2. Luz pareja: divide cada punto por la luz de su alrededor, lo que borra sombras,
      reflejos suaves y poca iluminación.
   3. Contraste y nitidez para la letra pequeña.
   El enderezado fino (inclinación del texto) y el blanco/negro los sigue haciendo el lector. */
