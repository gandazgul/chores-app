import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlpaxsxsqoyloviwfkxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJscGF4c3hzcW95bG92aXdma3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0ODIzOTQsImV4cCI6MjA2NDA1ODM5NH0.s817pRiMNgx-m2-39M7dxxsE-t46IgaXAybfCatMJ0c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
