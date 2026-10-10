const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://cfxdmhkxwuityjskkkkd.supabase.co', 'sb_publishable_J5d0F5DxeO05q9rhzdlDAg_0NVEn85l');

async function check() {
  const tables = ['products', 'categories', 'expenses', 'orders', 'inventory_sessions', 'customers', 'settings'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('store_id').limit(1);
    if (error && error.code === '42703') {
      console.log(`Table ${table} does NOT have store_id column!`);
    } else if (error) {
       console.log(`Table ${table} error: ${error.message} (${error.code})`);
    } else {
      console.log(`Table ${table} HAS store_id column.`);
    }
  }
}
check();
