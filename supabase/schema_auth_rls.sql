-- Rode este script no Supabase (SQL Editor → New query → colar → Run).
--
-- Até agora, as políticas de acesso (RLS) das suas tabelas liberavam leitura e
-- escrita pra QUALQUER UM que tivesse a chave anon (que fica visível no
-- navegador) — ok pra um app sem login, mas agora que o app tem tela de
-- entrada, faz sentido também travar isso no banco: mesmo que alguém pegue
-- sua chave anon e chame a API do Supabase direto (sem passar pelo app),
-- só funciona se essa pessoa estiver autenticada.
--
-- Isso é "defesa em profundidade": a tela de login já impede o acesso casual,
-- e este script garante que o banco em si também exige uma conta válida.

-- ---------- ordens (calculadora) ----------
drop policy if exists "Permitir leitura pública" on public.ordens;
drop policy if exists "Permitir inserção pública" on public.ordens;
drop policy if exists "Permitir remoção pública" on public.ordens;
drop policy if exists "Permitir atualização pública" on public.ordens;

create policy "Permitir leitura autenticada" on public.ordens for select using (auth.uid() is not null);
create policy "Permitir inserção autenticada" on public.ordens for insert with check (auth.uid() is not null);
create policy "Permitir remoção autenticada" on public.ordens for delete using (auth.uid() is not null);
create policy "Permitir atualização autenticada" on public.ordens for update using (auth.uid() is not null);

-- ---------- estoque_aparelhos ----------
drop policy if exists "Permitir leitura pública" on public.estoque_aparelhos;
drop policy if exists "Permitir inserção pública" on public.estoque_aparelhos;
drop policy if exists "Permitir remoção pública" on public.estoque_aparelhos;
drop policy if exists "Permitir atualização pública" on public.estoque_aparelhos;

create policy "Permitir leitura autenticada" on public.estoque_aparelhos for select using (auth.uid() is not null);
create policy "Permitir inserção autenticada" on public.estoque_aparelhos for insert with check (auth.uid() is not null);
create policy "Permitir remoção autenticada" on public.estoque_aparelhos for delete using (auth.uid() is not null);
create policy "Permitir atualização autenticada" on public.estoque_aparelhos for update using (auth.uid() is not null);

-- ---------- estoque_pecas ----------
drop policy if exists "Permitir leitura pública" on public.estoque_pecas;
drop policy if exists "Permitir inserção pública" on public.estoque_pecas;
drop policy if exists "Permitir remoção pública" on public.estoque_pecas;
drop policy if exists "Permitir atualização pública" on public.estoque_pecas;

create policy "Permitir leitura autenticada" on public.estoque_pecas for select using (auth.uid() is not null);
create policy "Permitir inserção autenticada" on public.estoque_pecas for insert with check (auth.uid() is not null);
create policy "Permitir remoção autenticada" on public.estoque_pecas for delete using (auth.uid() is not null);
create policy "Permitir atualização autenticada" on public.estoque_pecas for update using (auth.uid() is not null);

-- ---------- estoque_servicos ----------
drop policy if exists "Permitir leitura pública" on public.estoque_servicos;
drop policy if exists "Permitir inserção pública" on public.estoque_servicos;
drop policy if exists "Permitir remoção pública" on public.estoque_servicos;
drop policy if exists "Permitir atualização pública" on public.estoque_servicos;

create policy "Permitir leitura autenticada" on public.estoque_servicos for select using (auth.uid() is not null);
create policy "Permitir inserção autenticada" on public.estoque_servicos for insert with check (auth.uid() is not null);
create policy "Permitir remoção autenticada" on public.estoque_servicos for delete using (auth.uid() is not null);
create policy "Permitir atualização autenticada" on public.estoque_servicos for update using (auth.uid() is not null);
