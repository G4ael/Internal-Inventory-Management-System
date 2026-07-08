import { createClient } from '@supabase/supabase-js';

// Lê as credenciais do .env.local (variáveis com prefixo VITE_ são expostas ao browser)
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('⚠️ Faltam VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY no .env.local');
}

export const supabase = createClient(url, anonKey);
