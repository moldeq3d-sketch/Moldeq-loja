import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getBearerToken, verifyAdminToken } from "../lib/adminAuth.js";

const STORAGE_KEY = "moldeq_catalog_v1";
// Um pouco acima do limite de 4.5MB que o próprio app já usa no cliente
// (ver persistCatalog em App.jsx) — a checagem do cliente continua sendo a
// primeira barreira, esta é só uma rede de segurança no servidor.
const MAX_BODY_BYTES = 4_800_000;

// Rota autenticada (POST /api/admin-save). Substitui a escrita que o painel
// fazia direto no Supabase com a anon key (supabase.from("moldeq_catalog").upsert(...)).
// Antes disso, a tabela moldeq_catalog tinha uma política de RLS
// ("Escrita pública", comando ALL, using(true)/with_check(true)) que permitia
// a QUALQUER pessoa com a anon key (pública por natureza, embutida no bundle)
// escrever ali — o PIN do painel nunca foi, de fato, o que protegia a escrita.
// Agora quem escreve é sempre o servidor (service role key, nunca exposta ao
// cliente), e só depois de verificar o token de sessão do admin.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = getBearerToken(req);
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ error: "Sessão expirada. Faça login de novo antes de salvar." });
  }

  const body = typeof req.body === "string" ? safeJsonParse(req.body) : req.body || {};
  const payload = body.data;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({ error: "Payload inválido" });
  }

  const json = JSON.stringify(payload);
  if (json.length > MAX_BODY_BYTES) {
    const sizeMB = (json.length / (1024 * 1024)).toFixed(1);
    return res.status(413).json({
      error: "O catálogo ficou muito grande (" + sizeMB + "MB) para salvar de uma vez.",
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("moldeq_catalog")
      .upsert({ id: STORAGE_KEY, data: payload, updated_at: new Date().toISOString() });

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Erro em /api/admin-save:", e);
    return res.status(500).json({ error: "Erro ao salvar catálogo (falha de conexão com o banco)" });
  }
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
