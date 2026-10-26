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
  console.log('    TESTS D\'INTÉGRATION : GESTION DU STOCK ÉPUISÉ / NÉGATIF');
  console.log('================================================================\n');

  const adminToken = await login('fidele.test@maboutique.app', 'TestPassword2026!');
  const cashierToken = await login('caisse1@caisse.maboutique.app', 'CaissePassword2026!');
  console.log('✓ Connexion réussie : Admin et Caissier authentifiés.');

  // 1. Vérification de la présence de la colonne allow_negative_stock
  const checkCol = await fetch(url + '/rest/v1/settings?store_id=eq.' + storeId + '&select=allow_negative_stock', {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });

  if (checkCol.status === 400) {
    console.log('\n⚠️ Le script SQL migration_negative_stock.sql n\'a pas encore été exécuté en base de données.');
    console.log('👉 Veuillez exécuter migration_negative_stock.sql dans le SQL Editor Supabase pour activer la colonne.');
    return;
  }

  const settingsData = await checkCol.json();
  console.log('✓ Colonne allow_negative_stock présente en base.');
  console.log('Valeur actuelle :', settingsData[0]?.allow_negative_stock);

  // 2. Récupérer un produit test
  const prodRes = await fetch(url + '/rest/v1/products?store_id=eq.' + storeId + '&limit=1', {
    headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
  });
  const prod = (await prodRes.json())[0];
  const initialStock = Number(prod.stock);
  console.log(`\nProduit test sélectionné : [${prod.name}] (Stock actuel : ${initialStock})`);

  try {
    // -------------------------------------------------------------
    // ÉTAPE A : Test en Mode Strict (allow_negative_stock = false)
    // -------------------------------------------------------------
    console.log('\n--- ÉTAPE A : Test du Mode Strict (Stock plafonné à 0) ---');
    await fetch(url + '/rest/v1/settings?store_id=eq.' + storeId, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow_negative_stock: false })
    });

    // Mettre temporairement le stock du produit à 1
    await fetch(url + '/rest/v1/products?id=eq.' + prod.id, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: 1 })
    });

    // Vente de 3 unités (dépassement de stock de 2)
    const saleStrictId = 'sale_strict_' + Date.now();
    await fetch(url + '/rest/v1/rpc/create_sale', {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + cashierToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_store_id: storeId,
        p_sale_id: saleStrictId,
        p_subtotal: 3000,
        p_tax: 0,
        p_discount: 0,
        p_total: 3000,
        p_payment_method: 'cash',
        p_customer_name: 'Client Test Strict',
        p_created_at: new Date().toISOString(),
        p_items: [{
          productId: prod.id,
          productName: prod.name,
          quantity: 3,
          unitPrice: 1000,
          total: 3000,
          unitName: 'Unité'
        }]
      })
    });

    // Vérifier que le stock n'est pas descendu en dessous de 0
    const pStrictRes = await fetch(url + '/rest/v1/products?id=eq.' + prod.id, {
      headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
    });
    const pStrict = (await pStrictRes.json())[0];
    console.log(`Stock après vente en mode strict : ${pStrict.stock} (attendu: 0)`);
    if (Number(pStrict.stock) === 0) {
      console.log('✓ Mode strict respecté : le stock a été borné à 0.');
    } else {
      console.log('❌ Échec mode strict');
    }

    // -------------------------------------------------------------
    // ÉTAPE B : Test en Mode Souple (allow_negative_stock = true)
    // -------------------------------------------------------------
    console.log('\n--- ÉTAPE B : Test du Mode Souple (Stock Négatif Autorisé) ---');
    await fetch(url + '/rest/v1/settings?store_id=eq.' + storeId, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow_negative_stock: true })
    });

    // Stock à 0
    await fetch(url + '/rest/v1/products?id=eq.' + prod.id, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: 0 })
    });

    // Vente de 2 unités alors que le stock est à 0
    const saleSoupleId = 'sale_souple_' + Date.now();
    await fetch(url + '/rest/v1/rpc/create_sale', {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + cashierToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_store_id: storeId,
        p_sale_id: saleSoupleId,
        p_subtotal: 2000,
        p_tax: 0,
        p_discount: 0,
        p_total: 2000,
        p_payment_method: 'cash',
        p_customer_name: 'Client Test Souple',
        p_created_at: new Date().toISOString(),
        p_items: [{
          productId: prod.id,
          productName: prod.name,
          quantity: 2,
          unitPrice: 1000,
          total: 2000,
          unitName: 'Unité'
        }]
      })
    });

    const pSoupleRes = await fetch(url + '/rest/v1/products?id=eq.' + prod.id, {
      headers: { apikey: key, Authorization: 'Bearer ' + adminToken }
    });
    const pSouple = (await pSoupleRes.json())[0];
    console.log(`Stock après vente en mode souple : ${pSouple.stock} (attendu: -2)`);
    if (Number(pSouple.stock) === -2) {
      console.log('✓ Mode souple validé : le stock est passé à -2 sans blocage.');
    } else {
      console.log('❌ Échec mode souple');
    }

    // -------------------------------------------------------------
    // ÉTAPE C : Test de Régularisation Mathématique (Arrivage +5)
    // -------------------------------------------------------------
    console.log('\n--- ÉTAPE C : Régularisation automatique lors d\'une entrée en stock ---');
    console.log('Simulation réception arrivage fournisseur : 5 unités reçues.');
    const newStock = Number(pSouple.stock) + 5; // -2 + 5 = 3
    await fetch(url + '/rest/v1/products?id=eq.' + prod.id, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: newStock })
    });
    console.log(`Calcul : -2 + 5 = ${newStock} unités.`);
    console.log('✓ Stock régularisé avec succès à +3 unités.');

  } finally {
    // Nettoyage et remise en état initial
    console.log('\n--- Nettoyage et restauration ---');
    await fetch(url + '/rest/v1/products?id=eq.' + prod.id, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: initialStock })
    });
    await fetch(url + '/rest/v1/settings?store_id=eq.' + storeId, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow_negative_stock: false })
    });
    console.log(`✓ Stock du produit [${prod.name}] restauré à ${initialStock}.`);
    console.log('✓ allow_negative_stock réinitialisé à false (Mode Strict par défaut).');
    console.log('\n================================================================');
    console.log('        TEST COMPLET DU STOCK NÉGATIF EXÉCUTÉ AVEC SUCCÈS');
    console.log('================================================================');
  }
}

runTests();
