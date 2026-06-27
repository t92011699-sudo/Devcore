 const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

console.log('✅ Supabase connected');
console.log(`📡 Supabase URL: ${supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'Not set'}`);

module.exports = supabase;