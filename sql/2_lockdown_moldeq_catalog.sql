-- ⚠️ NÃO RODAR AINDA. Só rode isto depois que:
--   1. as env vars novas (SUPABASE_SERVICE_ROLE_KEY, ADMIN_PIN,
--      ADMIN_SESSION_SECRET) estiverem configuradas no Vercel;
--   2. o deploy com o código novo (App.jsx, data.js e a pasta api/) estiver
--      publicado e você já tiver testado: a loja carrega os produtos
--      normalmente, e o painel do vendedor consegue logar com o PIN e
--      salvar uma alteração de teste.
--
-- Se você rodar isto ANTES do deploy novo estar no ar, o site para de
-- carregar produtos pra todo mundo (porque o código antigo ainda lê a
-- tabela direto do navegador) e o painel para de conseguir salvar.
--
-- O que isto faz: remove as duas políticas que deixavam a tabela
-- moldeq_catalog com leitura E escrita liberadas pra qualquer pessoa com a
-- anon key (que é pública por natureza, embutida no site). Depois disso, só
-- a service role key (usada só nas rotas api/catalog.js, api/admin-catalog.js
-- e api/admin-save.js, nunca no navegador) consegue ler ou escrever nessa
-- tabela — RLS fica ativado e sem nenhuma política pra anon/authenticated,
-- ou seja, acesso negado por padrão pra qualquer chamada direta ao Supabase
-- feita de fora do seu servidor.

drop policy if exists "Escrita pública" on moldeq_catalog;
drop policy if exists "Leitura pública" on moldeq_catalog;

-- Não precisa (nem deve) criar nenhuma policy nova aqui: com RLS ativado e
-- zero políticas, anon/authenticated não conseguem mais nada nessa tabela, e
-- é exatamente esse o objetivo.

-- --------------------------------------------------------------------------
-- Ainda NÃO incluído neste arquivo (fica pra uma próxima etapa, combinado):
-- o bucket de Storage "product-images" continua com upload/substituição/
-- exclusão liberados pra qualquer pessoa com a anon key (políticas
-- product_images_insert/update/delete, comando público). Corrigir isso
-- direito precisa de uma rota autenticada (ou signed upload URL) pro upload
-- de fotos/vídeos, senão o painel para de conseguir subir imagem. Fica como
-- próximo passo depois que este aqui estiver validado em produção.
