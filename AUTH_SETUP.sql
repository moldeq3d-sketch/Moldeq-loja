-- Rode isso no SQL Editor do Supabase para ativar login de clientes.
-- Cria a tabela de perfis (nome/telefone) e o histórico de pedidos,
-- cada uma protegida para que cada cliente só veja os próprios dados.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null,
  total numeric not null default 0,
  note text,
  created_at timestamptz not null default now()
);

alter table orders enable row level security;

create policy "orders_select_own" on orders
  for select using (auth.uid() = user_id);

create policy "orders_insert_own" on orders
  for insert with check (auth.uid() = user_id);
