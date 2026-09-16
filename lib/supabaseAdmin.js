import { createClient } from "@supabase/supabase-js";

// Cliente Supabase server-side, usando a service role key.
// A service role key IGNORA todas as políticas de RLS — por isso ela nunca pode
// ir para o bundle do navegador (nunca importe este arquivo de dentro de src/).
// Ela deve existir só como variável de ambiente no Vercel (Settings → Environment
// Variables), preenchida com o valor "service_role" de
// Supabase → Project Settings → API.
let cached = null;

export function getSupabaseAdmin() {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL || "https://sixpidujmrzubiadyrmk.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada nas variáveis de ambiente do Vercel."
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
