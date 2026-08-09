-- Rode este script no Supabase (SQL Editor → New query → colar → Run).
-- Ele ADICIONA duas tabelas novas ao banco que você já tem — não mexe na
-- tabela "ordens" (calculadora) que já existe.

-- Aparelhos comprados para revenda: entrada (compra) e saída (venda).
create table if not exists public.estoque_aparelhos (
  id uuid primary key default gen_random_uuid(),
  modelo text not null,
  marca text,
  data_entrada date not null default current_date,
  valor_compra numeric not null default 0,
  observacao text,
  status text not null default 'em_estoque', -- 'em_estoque' | 'vendido'
  data_saida date,
  valor_venda numeric,
  comprador text,
  criado_em timestamptz not null default now()
);

-- Peças compradas para o reparo, opcionalmente vinculadas a um aparelho do estoque.
create table if not exists public.estoque_pecas (
  id uuid primary key default gen_random_uuid(),
  aparelho_id uuid references public.estoque_aparelhos(id) on delete set null,
  nome_peca text not null,
  fornecedor text,
  valor numeric not null default 0,
  data_compra date not null default current_date,
  criado_em timestamptz not null default now()
);

-- Mesma política de acesso público usada na tabela "ordens" (sem login).
alter table public.estoque_aparelhos enable row level security;
alter table public.estoque_pecas enable row level security;

create policy "Permitir leitura pública" on public.estoque_aparelhos for select using (true);
create policy "Permitir inserção pública" on public.estoque_aparelhos for insert with check (true);
create policy "Permitir remoção pública" on public.estoque_aparelhos for delete using (true);
create policy "Permitir atualização pública" on public.estoque_aparelhos for update using (true);

create policy "Permitir leitura pública" on public.estoque_pecas for select using (true);
create policy "Permitir inserção pública" on public.estoque_pecas for insert with check (true);
create policy "Permitir remoção pública" on public.estoque_pecas for delete using (true);
create policy "Permitir atualização pública" on public.estoque_pecas for update using (true);

-- Sincronização em tempo real, igual à tabela "ordens".
alter publication supabase_realtime add table public.estoque_aparelhos;
alter publication supabase_realtime add table public.estoque_pecas;
