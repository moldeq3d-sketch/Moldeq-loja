import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getBearerToken, verifyAdminToken } from "../lib/adminAuth.js";

const STORAGE_KEY = "moldeq_catalog_v1";

// Rota autenticada (GET /api/admin-catalog). Só é chamada depois que o
// painel do vendedor é desbloqueado (PIN validado em /api/admin-login).
// Devolve o catálogo COMPLETO, incluindo "sales" e "pricingSettings" — os
// dois campos que /api/catalog (a rota pública) nunca inclui — para que o
// painel tenha os valores reais para mostrar e editar.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = getBearerToken(req);
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ error: "Sessão expirada. Faça login de novo." });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("moldeq_catalog")
      .select("data, updated_at")
      .eq("id", STORAGE_KEY)
      .maybeSingle();

    if (error) throw error;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      data: data ? data.data : null,
      updated_at: data ? data.updated_at : null,
    });
  } catch (e) {
    console.error("Erro em /api/admin-catalog:", e);
    return res.status(500).json({ error: "Erro ao carregar catálogo" });
  }
}
