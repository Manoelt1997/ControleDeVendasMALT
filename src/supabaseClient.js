import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Só cria o cliente se as duas variáveis existirem. Se faltar alguma, o app
// continua abrindo normalmente (sem quebrar a tela), só que sem sincronização —
// e mostra um aviso explicando como configurar. Veja o README.
export const supabaseConfigurado = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigurado
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const TABELA_ORDENS = "ordens";
