import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export const hasSupabaseConfig = !!(supabaseUrl && supabaseKey);
export default supabase;
