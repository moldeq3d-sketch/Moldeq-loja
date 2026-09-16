import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { createAdminToken, safeEqual, getClientIp } from "../lib/adminAuth.js";

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

// Rota pública (POST /api/admin-login), chamada pela tela de PIN do painel.
// Antes, o PIN (ADMIN_PIN = "2461") ficava em texto puro em src/data.js,
// embutido no JS que qualquer visitante baixa — não era uma checagem real,
// só uma string comparada no navegador. Agora:
//   - o PIN correto só existe como variável de ambiente no servidor
//     (nunca é enviado ao cliente, nem em caso de erro);
//   - cada tentativa (certa ou errada) fica registrada por IP em
//     admin_login_attempts, e depois de 5 tentativas erradas em 15 minutos
//     o IP fica bloqueado por essa janela — o que antes não existia (a
//     única "trava" no Supabase Auth era o rate limit padrão de
//     30 tentativas/5min, genérico e não específico deste painel);
//   - em caso de sucesso, devolve um token assinado (não o PIN) com
//     validade de 4 horas, que o navegador passa a usar para chamar
//     /api/admin-catalog e /api/admin-save.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const body = typeof req.body === "string" ? safeJsonParse(req.body) : req.body || {};
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  const ip = getClientIp(req);

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error("Erro em /api/admin-login:", e);
    return res.status(500).json({ error: "Configuração do servidor incompleta" });
  }

  try {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("admin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("success", false)
      .gte("attempted_at", since);

    if (countError) throw countError;

    if ((count || 0) >= MAX_FAILED_ATTEMPTS) {
      return res.status(429).json({
        error: "Muitas tentativas incorretas. Aguarde " + WINDOW_MINUTES + " minutos e tente de novo.",
      });
    }

    const expectedPin = process.env.ADMIN_PIN;
    const ok = !!expectedPin && pin.length > 0 && safeEqual(pin, expectedPin);

    // Registra a tentativa (não bloqueia a resposta se isso falhar, mas loga).
    supabase
      .from("admin_login_attempts")
      .insert({ ip, success: ok })
      .then(({ error }) => {
        if (error) console.error("Erro ao registrar tentativa de login:", error);
      });

    if (!ok) {
      return res.status(401).json({ error: "PIN incorreto" });
    }

    const token = createAdminToken();
    return res.status(200).json({ token });
  } catch (e) {
    console.error("Erro em /api/admin-login:", e);
    return res.status(500).json({ error: "Erro ao processar login" });
  }
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
