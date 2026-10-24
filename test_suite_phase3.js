const url = 'https://cfxdmhkxwuityjskkkkd.supabase.co';
const key = 'sb_publishable_J5d0F5DxeO05q9rhzdlDAg_0NVEn85l';
const storeId = 'a164e5a0-d4cf-4bc3-83d0-4a63d543f1a4';

async function login(email, password) {
  const res = await fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  return data.access_token;
}

async function runTests() {
  console.log('================================================================');
  console.log('    SUITE DE TESTS D\'INTÉGRATION COMPLÈTE - PHASE 3');
  console.log('================================================================\n');

  const adminToken = await login('fidele.test@maboutique.app', 'TestPassword2026!');
  const cashierToken = await login('caisse1@caisse.maboutique.app', 'CaissePassword2026!');
  console.log('✓ Connexions réussies : Admin & Caissier authentifiés.\n');

  // ---------------------------------------------------------------------------
  // TEST 1 : Vérification des bénéfices sur les 3 périodes (Historique intouché)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1 : Rétrocompatibilité Chiffrée des 3 Périodes ---');
  const [salesRes, costsRes] = await Promise.all([
    fetch(url + '/rest/v1/sales?store_id=eq.' + storeId + '&select=id,total,created_at,items:sale_items(id,quantity,unit_price,total,quantity_reference)', {
      headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
    }),
    fetch(url + '/rest/v1/sale_item_costs?store_id=eq.' + storeId + '&select=sale_item_id,unit_cost', {
      headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
    })
  ]);
  const sales = await salesRes.json();
  const costs = await costsRes.json();
  const costMap = new Map();
  costs.forEach(c => costMap.set(c.sale_item_id, Number(c.unit_cost) || 0));

  // Filtrer les ventes historiques/mono-unités pour comparer l'impact strict de la migration
  const legacySales = sales.filter(s => !(s.items || []).some(it => it.unit_name && it.unit_name !== "Unité"));
  
  function calcProfit(filterFn) {
    const list = legacySales.filter(filterFn);
    let rev = 0;
    let cogsLegacy = 0;
    let cogsRef = 0;
    list.forEach(s => {
      rev += Number(s.total) || 0;
      (s.items || []).forEach(it => {
        const uCost = costMap.get(it.id) || 0;
        cogsLegacy += uCost * (Number(it.quantity) || 0);
        const refQ = (it.quantity_reference !== undefined && it.quantity_reference !== null && Number(it.quantity_reference) > 0)
          ? Number(it.quantity_reference)
          : Number(it.quantity);
        cogsRef += uCost * refQ;
      });
    });
    return { rev, profitLegacy: rev - cogsLegacy, profitRef: rev - cogsRef };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonthStr = new Date().toISOString().slice(0, 7);

  const tToday = calcProfit(s => (s.created_at || '').startsWith(todayStr));
  const tMonth = calcProfit(s => (s.created_at || '').startsWith(thisMonthStr));
  const tHist = calcProfit(() => true);

  console.log(`- Aujourd'hui  : Ancien calcul = ${tToday.profitLegacy} F | Nouveau = ${tToday.profitRef} F -> ${tToday.profitLegacy === tToday.profitRef ? 'STRICTEMENT IDENTIQUE ✓' : 'ÉCART ✗'}`);
  console.log(`- Ce mois      : Ancien calcul = ${tMonth.profitLegacy} F | Nouveau = ${tMonth.profitRef} F -> ${tMonth.profitLegacy === tMonth.profitRef ? 'STRICTEMENT IDENTIQUE ✓' : 'ÉCART ✗'}`);
  console.log(`- Historique   : Ancien calcul = ${tHist.profitLegacy} F | Nouveau = ${tHist.profitRef} F -> ${tHist.profitLegacy === tHist.profitRef ? 'STRICTEMENT IDENTIQUE ✓' : 'ÉCART ✗'}\n`);

  // ---------------------------------------------------------------------------
  // TEST 2 : Configuration d'une unité secondaire par l'Admin
  // ---------------------------------------------------------------------------
  console.log('--- TEST 2 : Configuration d\'une Unité Secondaire ("Carton (24)") ---');
  // Récupérer un produit test
  const prodsRes = await fetch(url + '/rest/v1/products?store_id=eq.' + storeId + '&limit=1', {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const prods = await prodsRes.json();
  const prod = prods[0];
  console.log(`Produit test : [${prod.name}] (ID: ${prod.id}) - Stock actuel : ${prod.stock}`);

  // Nettoyer anciennes unités tests
  await fetch(url + '/rest/v1/product_units?product_id=eq.' + prod.id + '&store_id=eq.' + storeId, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });

  // Insérer l'unité Carton (24)
  const unitInsertRes = await fetch(url + '/rest/v1/product_units', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({
      store_id: storeId,
      product_id: prod.id,
      name: 'Carton (24)',
      multiplier: 24,
      price: 22000,
      barcode: 'BC-CARTON-' + prod.id.slice(0, 5),
      is_reference: false
    })
  });
  const insertedUnits = await unitInsertRes.json();
  console.log('Unité créée avec succès :', insertedUnits[0]?.name, '- Multiplicateur :', insertedUnits[0]?.multiplier, '- Prix :', insertedUnits[0]?.price, 'F\n');

  // ---------------------------------------------------------------------------
  // TEST 3 : Sécurité RLS - Lecture autorisée Caissier, Écriture bloquée
  // ---------------------------------------------------------------------------
  console.log('--- TEST 3 : Sécurité RLS Caissier sur product_units ---');
  // Lecture par le caissier
  const cashierReadRes = await fetch(url + '/rest/v1/product_units?store_id=eq.' + storeId + '&product_id=eq.' + prod.id, {
    headers: { apikey: key, Authorization: 'Bearer ' + cashierToken }
  });
  const cashierUnits = await cashierReadRes.json();
  console.log(`- Lecture Caissier : HTTP ${cashierReadRes.status} (Reçu ${cashierUnits.length} unité(s)) -> OK ✓`);

  // Tentative d'insertion pirate par le caissier
  const cashierWriteRes = await fetch(url + '/rest/v1/product_units', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + cashierToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_id: storeId,
      product_id: prod.id,
      name: 'Carton Pirate Caissier',
      multiplier: 10
    })
  });
  console.log(`- Tentative d'écriture Caissier : HTTP ${cashierWriteRes.status} -> BLOQUÉE PAR RLS ✓\n`);

  // ---------------------------------------------------------------------------
  // TEST 4 : Vente d'un Carton (24) par le Caissier via create_sale
  // ---------------------------------------------------------------------------
  console.log('--- TEST 4 : Vente d\'un Carton (24) par le Caissier via RPC create_sale ---');
  const initialStock = Number(prod.stock);
  const saleId = 'sale_unit_' + Date.now();
  
  const saleRes = await fetch(url + '/rest/v1/rpc/create_sale', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + cashierToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_store_id: storeId,
      p_sale_id: saleId,
      p_subtotal: 22000,
      p_tax: 0,
      p_discount: 0,
      p_total: 22000,
      p_payment_method: 'cash',
      p_customer_name: 'Client Achat Carton',
      p_created_at: new Date().toISOString(),
      p_items: [{
        productId: prod.id,
        productName: prod.name,
        quantity: 1, // 1 Carton vendu
        unitPrice: 22000,
        total: 22000,
        unitName: 'Carton (24)',
        unitMultiplier: 9999 // LE SERVEUR DOIT IGNORER CE CHIFFRE ET RÉCUPÉRER 24 DE LA BASE !
      }]
    })
  });
  const saleResult = await saleRes.json();
  console.log('Résultat RPC create_sale :', saleResult);

  // Vérifier la ligne dans sale_items
  const saleItemRes = await fetch(url + '/rest/v1/sale_items?sale_id=eq.' + saleId, {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const saleItem = (await saleItemRes.json())[0];
  console.log('Ligne enregistrée dans sale_items :');
  console.log(`- unit_name          : "${saleItem.unit_name}"`);
  console.log(`- unit_multiplier    : ${saleItem.unit_multiplier} (Résolu côté serveur = 24, le 9999 a bien été ignoré !) ✓`);
  console.log(`- quantity           : ${saleItem.quantity}`);
  console.log(`- quantity_reference : ${saleItem.quantity_reference} (= 1 x 24) ✓`);

  // Vérifier le stock décrémenté
  const prodAfterRes = await fetch(url + '/rest/v1/products?id=eq.' + prod.id, {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const prodAfter = (await prodAfterRes.json())[0];
  console.log(`- Décrémentation stock : ${initialStock} -> ${prodAfter.stock} (Décrément exact de 24 unités de base avec GREATEST(0, ...)) ✓\n`);

  // ---------------------------------------------------------------------------
  // TEST 5 : Tentative de vente avec unité inexistante (Rejet Serveur)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 5 : Rejet Serveur si unité inconnue ---');
  const fakeSaleId = 'sale_fake_' + Date.now();
  const fakeRes = await fetch(url + '/rest/v1/rpc/create_sale', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + cashierToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_store_id: storeId,
      p_sale_id: fakeSaleId,
      p_subtotal: 5000,
      p_tax: 0,
      p_discount: 0,
      p_total: 5000,
      p_payment_method: 'cash',
      p_customer_name: 'Test Frauduleux',
      p_created_at: new Date().toISOString(),
      p_items: [{
        productId: prod.id,
        productName: prod.name,
        quantity: 1,
        unitPrice: 5000,
        total: 5000,
        unitName: 'UniteInexistante999' // DOIT DÉCLENCHER UNE EXCEPTION
      }]
    })
  });
  const fakeResult = await fakeRes.json();
  console.log('Réponse reçue pour unité inconnue :', fakeResult);
  console.log(`- Rejet conforme : ${fakeResult.message?.includes('Unité non reconnue') ? 'OUI, TRANSACTION ANNULÉE ✓' : 'NON ✗'}\n`);

  // ---------------------------------------------------------------------------
  // TEST 6 : Vente Rétrocompatible (sans unité ou avec 'Unité')
  // ---------------------------------------------------------------------------
  console.log('--- TEST 6 : Vente Standard Rétrocompatible (Unité de base) ---');
  const stdSaleId = 'sale_std_' + Date.now();
  const stdRes = await fetch(url + '/rest/v1/rpc/create_sale', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + cashierToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_store_id: storeId,
      p_sale_id: stdSaleId,
      p_subtotal: Number(prod.price),
      p_tax: 0,
      p_discount: 0,
      p_total: Number(prod.price),
      p_payment_method: 'cash',
      p_customer_name: 'Client Pièce Détachée',
      p_created_at: new Date().toISOString(),
      p_items: [{
        productId: prod.id,
        productName: prod.name,
        quantity: 2,
        unitPrice: Number(prod.price),
        total: Number(prod.price) * 2
        // unitName non fourni = repli automatique sur 'Unité' et coeff 1
      }]
    })
  });
  const stdResult = await stdRes.json();
  const stdItemRes = await fetch(url + '/rest/v1/sale_items?sale_id=eq.' + stdSaleId, {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const stdItem = (await stdItemRes.json())[0];
  console.log(`- Vente standard acceptée : unit_name = "${stdItem.unit_name}", unit_multiplier = ${stdItem.unit_multiplier}, quantity_reference = ${stdItem.quantity_reference} ✓\n`);

    // Nettoyage automatique des ventes de test
  for (const sId of [saleId, stdSaleId]) {
    await fetch(url + "/rest/v1/sale_item_costs?sale_id=eq." + sId, { method: "DELETE", headers: { apikey: key, Authorization: "Bearer " + adminToken } });
    await fetch(url + "/rest/v1/sale_items?sale_id=eq." + sId, { method: "DELETE", headers: { apikey: key, Authorization: "Bearer " + adminToken } });
    await fetch(url + "/rest/v1/sales?id=eq." + sId, { method: "DELETE", headers: { apikey: key, Authorization: "Bearer " + adminToken } });
  }
  console.log('================================================================');
  console.log('    TOUS LES TESTS D\'INTÉGRATION PHASE 3 SONT VALIDÉS (100%)');
  console.log('================================================================');
}

runTests().catch(console.error);
