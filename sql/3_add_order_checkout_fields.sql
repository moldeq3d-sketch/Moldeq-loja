-- PODE RODAR AGORA (não quebra nada em produção): só adiciona duas colunas
-- novas na tabela "orders" que já existe (criada em AUTH_SETUP.sql), com
-- valor padrão nulo — pedidos antigos continuam funcionando normalmente.
--
-- Guarda o nome completo e a forma de pagamento que o cliente confirma na
-- nova tela de checkout (entre o carrinho e o WhatsApp), pra aparecer no
-- histórico de pedidos ("Meus pedidos") de quem está logado.
--
-- Não mexe em RLS: a policy "orders_insert_own" já cobre qualquer coluna
-- nova, porque ela só confere auth.uid() = user_id.

alter table orders add column if not exists customer_name text;
alter table orders add column if not exists payment_method text;
