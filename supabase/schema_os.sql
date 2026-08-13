-- Rode este script no Supabase (SQL Editor → New query → colar → Run).
-- Roda depois de tudo que você já rodou antes (schema_estoque.sql, schema_servicos.sql,
-- schema_auth_rls.sql). É ADITIVO — não apaga nada do que já existe.
--
-- O que faz:
-- 1) Transforma a tabela de serviços numa Ordem de Serviço (OS) completa: categoria do
--    aparelho (celular/notebook/videogame), nº de série ou IMEI, cor, senha de desbloqueio,
--    checklist de entrada e fotos anexadas.
-- 2) Expande o campo de status pra um fluxo completo (Aguardando Avaliação → ... → Garantia)
--    em vez do simples "em andamento / concluído" de antes.
-- 3) Cria o bucket de armazenamento pras fotos das OS's.

-- ---------- 1) Novos campos na OS ----------
alter table public.estoque_servicos
  add column if not exists categoria text not null default 'celular', -- 'celular' | 'notebook' | 'videogame'
  add column if not exists numero_serie text,   -- IMEI (celular) ou nº de série (notebook/videogame)
  add column if not exists cor text,
  add column if not exists senha_desbloqueio text,
  add column if not exists checklist_entrada jsonb not null default '{}'::jsonb,
  add column if not exists fotos jsonb not null default '[]'::jsonb; -- [{ path, nome, criado_em }]

-- ---------- 2) Migra o status antigo pro novo fluxo ----------
-- Antes só existiam 'em_andamento' e 'concluido'. Agora o campo guarda uma das etapas:
-- aguardando_avaliacao, em_diagnostico, aguardando_aprovacao, aguardando_peca,
-- em_manutencao, pronto, entregue, garantia.
update public.estoque_servicos
  set status = 'aguardando_avaliacao'
  where status = 'em_andamento';

update public.estoque_servicos
  set status = 'entregue'
  where status = 'concluido';

-- ---------- 3) Bucket de fotos ----------
-- Bucket público pra leitura (as fotos aparecem direto no app sem precisar de link
-- assinado), mas upload/remoção continuam exigindo login — igual ao resto do sistema.
insert into storage.buckets (id, name, public)
  values ('os-fotos', 'os-fotos', true)
  on conflict (id) do nothing;

drop policy if exists "Leitura pública os-fotos" on storage.objects;
drop policy if exists "Upload autenticado os-fotos" on storage.objects;
drop policy if exists "Remoção autenticada os-fotos" on storage.objects;

create policy "Leitura pública os-fotos" on storage.objects
  for select using (bucket_id = 'os-fotos');

create policy "Upload autenticado os-fotos" on storage.objects
  for insert with check (bucket_id = 'os-fotos' and auth.uid() is not null);

create policy "Remoção autenticada os-fotos" on storage.objects
  for delete using (bucket_id = 'os-fotos' and auth.uid() is not null);
