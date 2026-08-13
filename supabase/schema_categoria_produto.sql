-- Rode este script no Supabase (SQL Editor → New query → colar → Run).
-- Aditivo — roda depois de tudo que você já rodou antes.
--
-- Adiciona uma categoria ao estoque de revenda, já que agora não é só celular:
-- acessórios, notebooks, videogames e outros eletrônicos também entram.

alter table public.estoque_aparelhos
  add column if not exists categoria text not null default 'celular';
