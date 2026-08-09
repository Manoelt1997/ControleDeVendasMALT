-- Rode este script no Supabase: painel do projeto → SQL Editor → New query → colar → Run.

create table if not exists public.ordens (
  id uuid primary key default gen_random_uuid(),
  modelo text not null,
  marca text,
  defeito text,
  valor_compra numeric not null default 0,
  custo_peca numeric not null default 0,
  mao_de_obra numeric not null default 0,
  custo_dinheiro numeric not null default 0,
  demanda text,
  margem_alvo numeric,
  margem_minima numeric,
  preco_equilibrio numeric,
  preco_minimo numeric,
  preco_sugerido numeric,
  lucro_alvo numeric,
  preco_mercado numeric,
  veredito text,
  foto_url text,
  criado_em timestamptz not null default now()
);

-- Habilita Row Level Security. Como este app não tem login (chave "anon" fica
-- exposta no navegador), a política abaixo libera leitura/escrita pra qualquer
-- um que tenha a URL do site. Bom o suficiente pra uso pessoal/equipe pequena.
-- Se no futuro você quiser exigir login, é só trocar essas políticas por
-- "auth.uid() is not null" e ligar autenticação no Supabase.
alter table public.ordens enable row level security;

create policy "Permitir leitura pública" on public.ordens
  for select using (true);

create policy "Permitir inserção pública" on public.ordens
  for insert with check (true);

create policy "Permitir remoção pública" on public.ordens
  for delete using (true);

create policy "Permitir atualização pública" on public.ordens
  for update using (true);

-- Habilita a sincronização em tempo real (Realtime) pra essa tabela.
alter publication supabase_realtime add table public.ordens;
