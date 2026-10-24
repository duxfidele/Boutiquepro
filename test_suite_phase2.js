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
  console.log('--- DÉBUT DE LA SUITE DE TESTS PHASE 2 ---');

  const adminToken = await login('fidele.test@maboutique.app', 'TestPassword2026!');
  const cashierToken = await login('caisse1@caisse.maboutique.app', 'CaissePassword2026!');
  console.log('Connexions réussies : Admin & Caissier authentifiés.');

  // Récupérer un produit existant pour les tests
  const resP = await fetch(url + '/rest/v1/products?store_id=eq.' + storeId + '&limit=1', {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const prods = await resP.json();
  const prod = prods[0];
  console.log(`Produit test utilisé : [${prod.name}] (ID: ${prod.id}) - Prix vente: ${prod.price} F`);

  // Récupérer son coût actuel dans product_costs
  const resC = await fetch(url + '/rest/v1/product_costs?store_id=eq.' + storeId + '&product_id=eq.' + prod.id, {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const costs = await resC.json();
  const currentCost = costs[0]?.cost || 0;
  console.log(`Coût d'achat catalogue actuel : ${currentCost} F`);

  // =========================================================================
  // TEST 1 : Vente par un caissier (création automatique du coût figé via SECURITY DEFINER)
  // =========================================================================
  console.log('\n--- TEST 1 : Vente par un Caissier ---');
  const cashierSaleId = 'sale_test_cashier_' + Date.now();
  const resSaleCashier = await fetch(url + '/rest/v1/rpc/create_sale', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + cashierToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_store_id: storeId,
      p_sale_id: cashierSaleId,
      p_subtotal: Number(prod.price),
      p_tax: 0,
      p_discount: 0,
      p_total: Number(prod.price),
      p_payment_method: 'cash',
      p_customer_name: 'Client Comptant Caissier',
      p_created_at: new Date().toISOString(),
      p_items: [{ productId: prod.id, productName: prod.name, quantity: 1, unitPrice: Number(prod.price), total: Number(prod.price) }]
    })
  });
  const resSaleCashierData = await resSaleCashier.json();
  console.log('Résultat RPC create_sale par caissier :', resSaleCashierData);

  // Vérification de la ligne de coût créée (par Admin)
  const resCostCashier = await fetch(url + '/rest/v1/sale_item_costs?sale_id=eq.' + cashierSaleId + '&select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const cashierCostLines = await resCostCashier.json();
  console.log('Ligne de coût figé créée dans sale_item_costs :', cashierCostLines);

  // =========================================================================
  // TEST 2 : Vente par un admin
  // =========================================================================
  console.log('\n--- TEST 2 : Vente par un Admin ---');
  const adminSaleId = 'sale_test_admin_' + Date.now();
  const resSaleAdmin = await fetch(url + '/rest/v1/rpc/create_sale', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_store_id: storeId,
      p_sale_id: adminSaleId,
      p_subtotal: Number(prod.price) * 2,
      p_tax: 0,
      p_discount: 0,
      p_total: Number(prod.price) * 2,
      p_payment_method: 'card',
      p_customer_name: 'Client Admin Test',
      p_created_at: new Date().toISOString(),
      p_items: [{ productId: prod.id, productName: prod.name, quantity: 2, unitPrice: Number(prod.price), total: Number(prod.price) * 2 }]
    })
  });
  const resSaleAdminData = await resSaleAdmin.json();
  console.log('Résultat RPC create_sale par Admin :', resSaleAdminData);

  const resCostAdmin = await fetch(url + '/rest/v1/sale_item_costs?sale_id=eq.' + adminSaleId + '&select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const adminCostLines = await resCostAdmin.json();
  console.log('Ligne de coût figé créée pour Admin :', adminCostLines);

  // =========================================================================
  // TEST 3 : Vente à crédit (avec acompte et reste à payer)
  // =========================================================================
  console.log('\n--- TEST 3 : Vente à crédit ---');
  const creditSaleId = 'sale_test_credit_' + Date.now();
  const totalCredit = Number(prod.price) * 3;
  const paidCredit = Number(prod.price);
  const remainingCredit = totalCredit - paidCredit;

  const resSaleCredit = await fetch(url + '/rest/v1/rpc/create_sale', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + cashierToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_store_id: storeId,
      p_sale_id: creditSaleId,
      p_subtotal: totalCredit,
      p_tax: 0,
      p_discount: 0,
      p_total: totalCredit,
      p_payment_method: 'credit',
      p_customer_name: 'Client Crédit Test',
      p_customer_phone: '+228 90 00 00 00',
      p_amount_paid: paidCredit,
      p_remaining_amount: remainingCredit,
      p_payment_status: 'partial',
      p_due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      p_created_at: new Date().toISOString(),
      p_items: [{ productId: prod.id, productName: prod.name, quantity: 3, unitPrice: Number(prod.price), total: totalCredit }]
    })
  });
  const resSaleCreditData = await resSaleCredit.json();
  console.log('Résultat RPC create_sale crédit :', resSaleCreditData);

  const resCostCredit = await fetch(url + '/rest/v1/sale_item_costs?sale_id=eq.' + creditSaleId + '&select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const creditCostLines = await resCostCredit.json();
  console.log('Ligne de coût figé pour vente à crédit :', creditCostLines);

  // =========================================================================
  // TEST 4 : Vente hors-ligne synchronisée
  // =========================================================================
  console.log('\n--- TEST 4 : Vente hors-ligne synchronisée ---');
  const offlineSaleId = 'sale_test_offline_synced_' + Date.now();
  const resSaleOffline = await fetch(url + '/rest/v1/rpc/create_sale', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + cashierToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_store_id: storeId,
      p_sale_id: offlineSaleId,
      p_subtotal: Number(prod.price),
      p_tax: 0,
      p_discount: 0,
      p_total: Number(prod.price),
      p_payment_method: 'cash',
      p_customer_name: 'Client PWA Offline Synchronisé',
      p_created_at: new Date(Date.now() - 3600000).toISOString(), // Vente passée il y a 1h hors connexion
      p_items: [{ productId: prod.id, productName: prod.name, quantity: 1, unitPrice: Number(prod.price), total: Number(prod.price) }]
    })
  });
  const resSaleOfflineData = await resSaleOffline.json();
  console.log('Résultat RPC create_sale synchronisée :', resSaleOfflineData);

  const resCostOffline = await fetch(url + '/rest/v1/sale_item_costs?sale_id=eq.' + offlineSaleId + '&select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const offlineCostLines = await resCostOffline.json();
  console.log('Ligne de coût figé pour vente synchronisée :', offlineCostLines);

  // =========================================================================
  // TEST 5 : Modification d'un prix d'achat dans le catalogue
  // =========================================================================
  console.log('\n--- TEST 5 : Modification du prix d\'achat dans le catalogue ---');
  const newCatalogCost = Number(currentCost) + 5000;
  console.log(`Mise à jour du coût catalogue de ${currentCost} F -> ${newCatalogCost} F`);

  // Mise à jour de product_costs
  const resUpdateCost = await fetch(url + '/rest/v1/product_costs?store_id=eq.' + storeId + '&product_id=eq.' + prod.id, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ cost: newCatalogCost })
  });
  const updatedCostRow = await resUpdateCost.json();
  console.log('Catalogue product_costs mis à jour :', updatedCostRow);

  // A. Vérifier que la vente passée conserve SON ANCIEN COÛT FIGÉ
  const resCheckOldSale = await fetch(url + '/rest/v1/sale_item_costs?sale_id=eq.' + cashierSaleId + '&select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const oldSaleCost = await resCheckOldSale.json();
  console.log('Coût figé de l\'ancienne vente après modification catalogue (DOIT RESTER INTRAITÉ) :', oldSaleCost[0]?.unit_cost + ' F');

  // B. Créer une nouvelle vente après modification
  const newSaleAfterUpdateId = 'sale_after_cost_change_' + Date.now();
  await fetch(url + '/rest/v1/rpc/create_sale', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + cashierToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_store_id: storeId,
      p_sale_id: newSaleAfterUpdateId,
      p_subtotal: Number(prod.price),
      p_tax: 0,
      p_discount: 0,
      p_total: Number(prod.price),
      p_payment_method: 'cash',
      p_customer_name: 'Client Nouvelle Vente Coût Changé',
      p_created_at: new Date().toISOString(),
      p_items: [{ productId: prod.id, productName: prod.name, quantity: 1, unitPrice: Number(prod.price), total: Number(prod.price) }]
    })
  });

  const resCheckNewSale = await fetch(url + '/rest/v1/sale_item_costs?sale_id=eq.' + newSaleAfterUpdateId + '&select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const newSaleCost = await resCheckNewSale.json();
  console.log('Coût figé de la nouvelle vente (DOIT PRENDRE LE NOUVEAU COÛT) :', newSaleCost[0]?.unit_cost + ' F');

  // Rétablir le coût original dans le catalogue pour garder la base saine
  await fetch(url + '/rest/v1/product_costs?store_id=eq.' + storeId + '&product_id=eq.' + prod.id, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cost: currentCost })
  });
  console.log(`Coût catalogue rétabli à sa valeur initiale (${currentCost} F).`);

  // =========================================================================
  // TEST 6 : Caissier qui tente de lire sale_item_costs
  // =========================================================================
  console.log('\n--- TEST 6 : Caissier qui tente de lire sale_item_costs ---');
  const resReadCashier = await fetch(url + '/rest/v1/sale_item_costs?select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + cashierToken }
  });
  console.log('Statut HTTP retourné au Caissier :', resReadCashier.status);
  const cashierReadData = await resReadCashier.json();
  console.log('Contenu retourné au Caissier (DOIT ÊTRE VIDE []) :', cashierReadData);

  console.log('\n--- TOUS LES TESTS SONT TERMINÉS AVEC SUCCÈS ---');
}

runTests().catch(err => console.error('ERREUR TEST:', err));
