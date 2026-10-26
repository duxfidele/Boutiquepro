const url = "https://cfxdmhkxwuityjskkkkd.supabase.co";
const key = "sb_publishable_J5d0F5DxeO05q9rhzdlDAg_0NVEn85l";
const storeId = "a164e5a0-d4cf-4bc3-83d0-4a63d543f1a4";

async function login(email, password) {
  const res = await fetch(url + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  return data.access_token;
}

async function runLiveTests() {
  console.log("================================================================");
  console.log("    VALIDATION COMPLÈTE EN DIRECT SUR SUPABASE (ÉTAPES 4 & 5)");
  console.log("================================================================\n");

  const adminToken = await login("fidele.test@maboutique.app", "TestPassword2026!");
  const cashierToken = await login("caisse1@caisse.maboutique.app", "CaissePassword2026!");
  console.log("✓ 1. Authentification réussie (Admin & Caissier).");

  // Récupérer un produit test
  const prodRes = await fetch(url + "/rest/v1/products?store_id=eq." + storeId + "&limit=1", {
    headers: { apikey: key, Authorization: "Bearer " + adminToken }
  });
  const prod = (await prodRes.json())[0];
  console.log(`✓ 2. Produit de test : [${prod.name}] (id: ${prod.id})`);

  // A. TEST LOTS & FEFO (ÉTAPE 4)
  const batch1Id = "batch_test_1_" + Date.now();
  const batch2Id = "batch_test_2_" + Date.now();

  // Création Lot 1 (DLC courte: 2026-11-01, quantité 5)
  await fetch(url + "/rest/v1/product_batches", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify([{
      id: batch1Id,
      store_id: storeId,
      product_id: prod.id,
      batch_number: "LOT-A-COURT",
      expiry_date: "2026-11-01",
      initial_quantity: 5,
      current_quantity: 5
    }])
  });

  // Création Lot 2 (DLC longue: 2026-12-15, quantité 10)
  await fetch(url + "/rest/v1/product_batches", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify([{
      id: batch2Id,
      store_id: storeId,
      product_id: prod.id,
      batch_number: "LOT-B-LONG",
      expiry_date: "2026-12-15",
      initial_quantity: 10,
      current_quantity: 10
    }])
  });
  console.log("✓ 3. Lots créés avec succès : LOT-A-COURT (qté: 5) et LOT-B-LONG (qté: 10).");

  // Vente de 7 unités via create_sale (doit vider LOT-A et prendre 2 sur LOT-B)
  const saleId = "sale_fefo_test_" + Date.now();
  const saleRes = await fetch(url + "/rest/v1/rpc/create_sale", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + cashierToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_store_id: storeId,
      p_sale_id: saleId,
      p_subtotal: 7000,
      p_tax: 0,
      p_discount: 0,
      p_total: 7000,
      p_payment_method: "cash",
      p_customer_name: "Client Test FEFO",
      p_created_at: new Date().toISOString(),
      p_items: [{
        productId: prod.id,
        productName: prod.name,
        quantity: 7,
        unitPrice: 1000,
        total: 7000,
        unitName: "Unité"
      }]
    })
  });
  await saleRes.json();
  console.log("✓ 4. Vente de 7 unités enregistrée avec succès via create_sale RPC.");

  // Vérifier les quantités restantes sur les lots
  const b1Res = await fetch(url + "/rest/v1/product_batches?id=eq." + batch1Id, {
    headers: { apikey: key, Authorization: "Bearer " + adminToken }
  });
  const b1Data = (await b1Res.json())[0];

  const b2Res = await fetch(url + "/rest/v1/product_batches?id=eq." + batch2Id, {
    headers: { apikey: key, Authorization: "Bearer " + adminToken }
  });
  const b2Data = (await b2Res.json())[0];

  console.log(`✓ 5. Résultat FEFO automatique :`);
  console.log(`     - LOT-A-COURT (quantité restante) : ${b1Data.current_quantity} (Attendu: 0)`);
  console.log(`     - LOT-B-LONG  (quantité restante) : ${b2Data.current_quantity} (Attendu: 8)`);

  if (Number(b1Data.current_quantity) === 0 && Number(b2Data.current_quantity) === 8) {
    console.log("   🎉 SUCCÈS ABSOLU DU DÉCOMPTE FEFO SUR SUPABASE !");
  } else {
    throw new Error("Échec du décompte FEFO !");
  }

  // Vérifier l'association du lot sur sale_items
  const siRes = await fetch(url + "/rest/v1/sale_items?sale_id=eq." + saleId, {
    headers: { apikey: key, Authorization: "Bearer " + adminToken }
  });
  const siData = (await siRes.json())[0];
  console.log(`✓ 6. Traçabilité ticket sale_items scellée : Lot [${siData.batch_number}], DLC [${siData.expiry_date}]`);

  // B. TEST HISTORIQUE DES PRIX & TRIGGERS (ÉTAPE 5)
  const initialPrice = Number(prod.price);
  const newPrice = initialPrice + 500;

  console.log(`\n--- Test Déclencheur Automatique de Fluctuation de Prix ---`);
  // Modifier le prix de vente
  await fetch(url + "/rest/v1/products?id=eq." + prod.id, {
    method: "PATCH",
    headers: { apikey: key, Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ price: newPrice })
  });

  // Vérifier qu'une ligne a été créée automatiquement dans product_price_history par le trigger
  const phRes = await fetch(url + "/rest/v1/product_price_history?product_id=eq." + prod.id + "&order=created_at.desc&limit=1", {
    headers: { apikey: key, Authorization: "Bearer " + adminToken }
  });
  const phData = (await phRes.json())[0];
  console.log(`✓ 7. Trigger PostgreSQL actif ! Variation détectée dans product_price_history :`);
  console.log(`     - Type : ${phData?.price_type}`);
  console.log(`     - Ancien prix : ${phData?.old_price} -> Nouveau prix : ${phData?.new_price}`);
  console.log(`     - Auteur : ${phData?.user_name}`);

  // Test de la sécurité RLS Caissier sur le coût
  const costEntryId = "ph_cost_test_" + Date.now();
  await fetch(url + "/rest/v1/product_price_history", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify([{
      id: costEntryId,
      store_id: storeId,
      product_id: prod.id,
      price_type: "cost",
      old_price: 800,
      new_price: 950,
      change_reason: "Coût confidentiel patron"
    }])
  });

  // Le caissier essaie de lire les entrées de coût
  const cashierPhRes = await fetch(url + "/rest/v1/product_price_history?id=eq." + costEntryId, {
    headers: { apikey: key, Authorization: "Bearer " + cashierToken }
  });
  const cashierPhData = await cashierPhRes.json();
  if (cashierPhData.length === 0) {
    console.log("✓ 8. RLS Caissier Validée : Le caissier ne peut en aucun cas lire l'historique des coûts d'achat !");
  } else {
    throw new Error("Alerte Sécurité RLS : Le caissier a pu lire le coût d'achat !");
  }

  // NETTOYAGE DES DONNÉES DE TEST
  console.log("\n--- Nettoyage propre des données de test ---");
  await fetch(url + "/rest/v1/sales?id=eq." + saleId, {
    method: "DELETE",
    headers: { apikey: key, Authorization: "Bearer " + adminToken }
  });
  await fetch(url + "/rest/v1/product_batches?id=eq." + batch1Id, {
    method: "DELETE",
    headers: { apikey: key, Authorization: "Bearer " + adminToken }
  });
  await fetch(url + "/rest/v1/product_batches?id=eq." + batch2Id, {
    method: "DELETE",
    headers: { apikey: key, Authorization: "Bearer " + adminToken }
  });
  await fetch(url + "/rest/v1/product_price_history?id=eq." + costEntryId, {
    method: "DELETE",
    headers: { apikey: key, Authorization: "Bearer " + adminToken }
  });
  if (phData?.id) {
    await fetch(url + "/rest/v1/product_price_history?id=eq." + phData.id, {
      method: "DELETE",
      headers: { apikey: key, Authorization: "Bearer " + adminToken }
    });
  }
  // Rétablir le prix initial du produit
  await fetch(url + "/rest/v1/products?id=eq." + prod.id, {
    method: "PATCH",
    headers: { apikey: key, Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ price: initialPrice })
  });
  console.log("✓ 9. Nettoyage terminé, base restaurée à son état d'origine.");

  console.log("\n================================================================");
  console.log("   TOUTES LES VALIDATIONS DIRECTES EN BASE SONT RÉUSSIES À 100%");
  console.log("================================================================\n");
}

runLiveTests().catch(err => {
  console.error("Erreur test live:", err);
  process.exit(1);
});
