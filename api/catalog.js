import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

const STORAGE_KEY = "moldeq_catalog_v1";

// Rota pública (GET /api/catalog). Substitui a leitura que o site fazia
// direto do Supabase com a anon key (supabase.from("moldeq_catalog").select(...)).
//
// Duas diferenças importantes em relação ao comportamento antigo:
// 1. Quem lê aqui é o servidor, com a service role key — o navegador do
//    visitante (e qualquer outra ferramenta que chame esta rota) nunca mais
//    toca a tabela moldeq_catalog diretamente com a anon key.
// 2. "sales" e "pricingSettings" são removidos da resposta. Antes, como o
//    app lia a linha inteira direto do Supabase no carregamento da loja,
//    esses dois campos internos (histórico de vendas e a calculadora de
//    custo/margem) chegavam ao navegador de QUALQUER visitante, mesmo sem
//    abrir o painel do vendedor — bastava olhar a aba Network ou o estado
//    do React. Isso nunca devia ter sido público.
//
// CORS liberado e uns campos de contagem foram mantidos aqui porque uma
// versão anterior desta rota (usando a anon key, sem a filtragem de sales/
// pricingSettings) foi feita para permitir que ferramentas externas
// consultassem o catálogo público — mantemos essa utilidade, só que agora
// com os dados sensíveis já removidos e lendo com a service role.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido. Use GET." });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("moldeq_catalog")
      .select("data, updated_at")
      .eq("id", STORAGE_KEY)
      .maybeSingle();

    if (error) throw error;

    if (!data || !data.data) {
      // Banco ainda vazio (primeira vez). O site usa os valores padrão
      // locais (INITIAL_PRODUCTS etc.) até um admin logar e salvar pela
      // primeira vez — ninguém grava nada aqui de forma anônima.
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ data: null, updated_at: null, updatedAt: null, totalProducts: 0, activeProducts: 0 });
    }

    const { sales, pricingSettings, ...publicData } = data.data;
    const allProducts = publicData.products || [];
    const activeProducts = allProducts.filter((p) => p.active);

    res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=45");
    return res.status(200).json({
      // Formato usado pelo próprio site (src/App.jsx): data.products, data.banners etc.
      data: publicData,
      updated_at: data.updated_at,
      // Aliases/extras mantidos para quem consumir esta rota como API de
      // consulta externa (ex.: conferir preços/estoque sem abrir o site).
      updatedAt: data.updated_at || null,
      totalProducts: allProducts.length,
      activeProducts: activeProducts.length,
    });
  } catch (e) {
    console.error("Erro em /api/catalog:", e);
    return res.status(500).json({ error: "Erro ao carregar catálogo" });
  }
}
