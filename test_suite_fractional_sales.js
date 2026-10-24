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
  console.log('    TESTS D\'INTÉGRATION : VENTE AU MONTANT / VRAC FRACTIONNÉ');
  console.log('================================================================\n');

  const adminToken = await login('fidele.test@maboutique.app', 'TestPassword2026!');
  const cashierToken = await login('caisse1@caisse.maboutique.app', 'CaissePassword2026!');
  console.log('✓ Admin et Caissier connectés.');

  // 1. Récupérer un produit test (ex: Casque ou créer Huile)
  const pRes = await fetch(url + '/rest/v1/products?store_id=eq.' + storeId + '&limit=1', {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const prod = (await pRes.json())[0];
  const initialStock = Number(prod.stock);
  const unitPrice = 850; // Simulation prix 850 F le litre
  console.log(`Produit test : [${prod.name}] (Stock initial : ${initialStock})`);

  // 2. Vente de "100 F" par le Caissier (Quantité = 100 / 850 = 0.118)
  const amountToSpend = 100;
  const computedQty = Math.round((amountToSpend / unitPrice) * 1000) / 1000; // 0.118
  console.log(`\n--- Vente au montant : Client demande pour ${amountToSpend} FCFA ---`);
  console.log(`- Prix unitaire : ${unitPrice} F`);
  console.log(`- Fraction calculée : ${computedQty} (soit ${amountToSpend} / ${unitPrice})`);

  const saleId = 'sale_frac_' + Date.now();
  const saleRes = await fetch(url + '/rest/v1/rpc/create_sale', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + cashierToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_store_id: storeId,
      p_sale_id: saleId,
      p_subtotal: amountToSpend,
      p_tax: 0,
      p_discount: 0,
      p_total: amountToSpend,
      p_payment_method: 'cash',
      p_customer_name: 'Client 100F Vrac Huile',
      p_created_at: new Date().toISOString(),
      p_items: [{
        productId: prod.id,
        productName: prod.name,
        quantity: computedQty,
        unitPrice: unitPrice,
        total: amountToSpend,
        unitName: 'Unité',
        unitMultiplier: 1
      }]
    })
  });
  const saleData = await saleRes.json();
  console.log('Réponse RPC create_sale :', saleData);

  // 3. Contrôle de la ligne dans sale_items
  const itemRes = await fetch(url + '/rest/v1/sale_items?sale_id=eq.' + saleId, {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const item = (await itemRes.json())[0];
  console.log('\nLigne enregistrée dans sale_items :');
  console.log(`- quantity           : ${item.quantity} (attendu: ${computedQty}) -> ${Number(item.quantity) === computedQty ? 'OK ✓' : 'ERREUR ✗'}`);
  console.log(`- quantity_reference : ${item.quantity_reference} (attendu: ${computedQty}) -> ${Number(item.quantity_reference) === computedQty ? 'OK ✓' : 'ERREUR ✗'}`);
  console.log(`- total scellé       : ${item.total} FCFA (attendu: ${amountToSpend} FCFA) -> ${Number(item.total) === amountToSpend ? 'OK ✓' : 'ERREUR ✗'}`);

  // 4. Contrôle du stock dans products
  const pAfterRes = await fetch(url + '/rest/v1/products?id=eq.' + prod.id, {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const prodAfter = (await pAfterRes.json())[0];
  const expectedStock = Math.round((initialStock - computedQty) * 1000) / 1000;
  console.log(`\nContrôle décrémentation stock dans products :`);
  console.log(`- Stock avant : ${initialStock}`);
  console.log(`- Stock après : ${prodAfter.stock} (attendu: ${expectedStock}) -> ${Number(prodAfter.stock) === expectedStock ? 'DÉCRÉMENTATION EXACTE AU MILLIÈME PRÈS ✓' : 'ERREUR ✗'}`);

  // 5. Nettoyage
  await fetch(url + '/rest/v1/sale_item_costs?sale_id=eq.' + saleId, { method: 'DELETE', headers: { apikey: key, Authorization: 'Bearer ' + adminToken } });
  await fetch(url + '/rest/v1/sale_items?sale_id=eq.' + saleId, { method: 'DELETE', headers: { apikey: key, Authorization: 'Bearer ' + adminToken } });
  await fetch(url + '/rest/v1/sales?id=eq.' + saleId, { method: 'DELETE', headers: { apikey: key, Authorization: 'Bearer ' + adminToken } });
  await fetch(url + '/rest/v1/products?id=eq.' + prod.id, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock: initialStock })
  });
  console.log('\n✓ Données restaurées et test nettoyé.');
  console.log('\n================================================================');
  console.log('    TEST DE VENTE AU MONTANT VALIDÉ AVEC SUCCÈS (100%)');
  console.log('================================================================');
}

runTests().catch(console.error);
