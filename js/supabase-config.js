const SUPABASE_URL = 'https://rfjklotbdzujbxdblyhs.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YYqcOBlXu4LLsdrJ9leK5A_5dgcvx_b';

const SupabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);