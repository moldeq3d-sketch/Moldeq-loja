-- PODE RODAR AGORA (não quebra nada em produção): cria uma tabela nova,
-- não mexe nas tabelas existentes nem nas políticas atuais.
--
-- Guarda tentativas de login do painel do vendedor (api/admin-login.js usa
-- essa tabela pra bloquear um IP por 15 minutos depois de 5 PINs errados —
-- isso é o que faltava no ponto "validou a quantidade de tentativa de
-- login?": antes só existia o rate limit padrão do Supabase Auth, que é
-- genérico e nem se aplica a este painel, já que ele não usa supabase.auth).
--
-- RLS fica ativado e sem nenhuma política para anon/authenticated: só a
-- service role key (usada pelas rotas serverless) consegue ler ou escrever
-- aqui, porque a service role sempre ignora RLS.

create table if not exists admin_login_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_ip_time_idx
  on admin_login_attempts (ip, attempted_at desc);

alter table admin_login_attempts enable row level security;
-- Sem "create policy" aqui de propósito: nenhuma policy = acesso negado por
-- padrão para anon/authenticated. Só a service role (que ignora RLS) lê e
-- escreve nesta tabela.

-- Opcional: rodar de vez em quando pra não deixar a tabela crescer pra
-- sempre (tentativas com mais de 30 dias não servem mais pra nada).
-- delete from admin_login_attempts where attempted_at < now() - interval '30 days';
