const { createClient } = require('./node_modules/@supabase/supabase-js');
const supabase = createClient('https://cfxdmhkxwuityjskkkkd.supabase.co', 'sb_publishable_J5d0F5DxeO05q9rhzdlDAg_0NVEn85l');
async function run() {
  const { data: { session } } = await supabase.auth.signInWithPassword({ email: 'admin@test.com', password: 'password123' }); // I don't know the password...
}
run();
