import { createClient } from '@supabase/supabase-js';

// Substitua pelos seus dados do painel do Supabase (Project Settings -> API)
const supabaseUrl = 'https://qkqhhkwbiuwtokwjnkig.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcWhoa3diaXV3dG9rd2pua2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTg5NzIsImV4cCI6MjA5NTczNDk3Mn0.H-6PxHr-49Tyf_qpp62oTXfTcHxYm4q_5X9gUhOiPSk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey)