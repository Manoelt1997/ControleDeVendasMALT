-- Rode este script no Supabase (SQL Editor → New query → colar → Run).
-- Este é ADITIVO: roda depois do schema_estoque.sql que você já rodou antes.
-- Cria a tabela de serviços de reparo (aparelhos de clientes) e permite que
-- uma peça comprada seja vinculada a um serviço, do mesmo jeito que já pode
-- ser vinculada a um aparelho do seu estoque de revenda.

create table if not exists public.estoque_servicos (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  aparelho text not null,
  defeito text,
  data_entrada date not null default current_date,
  valor_cobrado numeric,
  status text not null default 'em_andamento', -- 'em_andamento' | 'concluido'
  data_conclusao date,
  observacao text,
  criado_em timestamptz not null default now()
);

alter table public.estoque_servicos enable row level security;

create policy "Permitir leitura pública" on public.estoque_servicos for select using (true);
create policy "Permitir inserção pública" on public.estoque_servicos for insert with check (true);
create policy "Permitir remoção pública" on public.estoque_servicos for delete using (true);
create policy "Permitir atualização pública" on public.estoque_servicos for update using (true);

alter publication supabase_realtime add table public.estoque_servicos;

-- Adiciona a coluna de vínculo com serviço na tabela de peças que você já criou.
alter table public.estoque_pecas
  add column if not exists servico_id uuid references public.estoque_servicos(id) on delete set null;
