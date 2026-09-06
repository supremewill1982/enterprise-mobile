import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qzutctnwxcjbunhmbevt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Qs3yFG1W5BhmbGNagsrstg_ro6RFZfJ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
