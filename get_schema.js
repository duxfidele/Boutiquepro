const { createClient } = require('/home/fideleatchade/.gemini/antigravity-ide/brain/e0d28ad8-ac41-492c-a977-6f3fe6e34690/Ma boutique/saas-boutique/node_modules/@supabase/supabase-js');
const supabase = createClient('https://cfxdmhkxwuityjskkkkd.supabase.co', 'sb_publishable_J5d0F5DxeO05q9rhzdlDAg_0NVEn85l');
async function run() {
  const { data, error } = await supabase.from('products').insert([{ 
    id: 'f9b1d9c2-b5e1-4c1d-8f2c-e1f2b3c4d5e6', 
    name: 'Test Product', 
    price: 100,
    store_id: '01a0f723-053b-70a4-a386-99dc3577c43c' // some valid or invalid store_id
  }]);
  console.log("Error:", error);
}
run();
