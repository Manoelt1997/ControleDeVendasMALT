# Controle de Compra e Reparo de Celulares

App para avaliar compra, reparo e revenda de celulares com defeito. Feito em
React + Vite, com banco de dados **Supabase** (dados sincronizados em tempo
real entre celular, computador e qualquer aparelho) e busca automática de
**foto de referência do modelo na Wikipédia**.

## 1. Criar o banco de dados (Supabase — grátis)

1. Crie uma conta em https://supabase.com (dá pra logar com GitHub) e crie um
   projeto novo (escolha uma senha de banco qualquer, só guarde ela).
2. No painel do projeto, vá em **SQL Editor** → **New query**, cole o
   conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql) deste
   projeto e clique em **Run**. Isso cria a tabela `ordens`, as permissões e
   liga a sincronização em tempo real.
3. Vá em **Project Settings → API** e copie dois valores:
   - **Project URL**
   - **anon public key**

## 2. Configurar o app com essas chaves

Copie `.env.example` para `.env` e cole os dois valores:

```
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-public
```

## 3. Rodar local (no computador, pra testar)

```
npm install
npm run dev
```

Abre em `http://localhost:5173`. Teste registrando uma ordem — se aparecer no
painel do Supabase (Table Editor → ordens), está tudo certo.

## 4. Publicar de graça (Vercel — leva ~2 minutos)

1. Crie uma conta em https://vercel.com (dá pra logar com GitHub).
2. Suba esta pasta pra um repositório novo no GitHub (ou arraste a pasta
   direto no painel da Vercel, em "Add New Project" → "Deploy" sem precisar
   de Git).
3. A Vercel detecta que é um projeto Vite automaticamente.
4. **Antes de clicar em Deploy** (ou depois, em Project Settings →
   Environment Variables), adicione as mesmas duas variáveis do `.env`:
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Sem isso o app publica,
   mas não salva nada.
5. Em ~1 minuto você recebe uma URL tipo `https://seu-projeto.vercel.app` —
   funciona em qualquer navegador, computador ou celular, e os dados
   sincronizam sozinhos entre todos eles.

Netlify funciona do mesmo jeito (netlify.com → "Add new site"; comando de
build `npm run build`, pasta de saída `dist`; variáveis de ambiente em Site
settings → Environment variables).

## Instalar no celular como app (sem precisar de APK/loja)

1. Abra a URL publicada no **Chrome do Android**.
2. Toque no menu (⋮) → **"Adicionar à tela inicial"** (ou vai aparecer um
   banner automático oferecendo instalar).
3. Pronto — fica um ícone na tela inicial, abre em tela cheia.

No iPhone (Safari): compartilhar (□↑) → **"Adicionar à Tela de Início"**.

## Sobre os dados e a sincronização em tempo real

Os dados agora ficam no Supabase (banco Postgres na nuvem), não mais no
navegador. Isso significa:

- Você registra uma ordem no celular e ela aparece **na hora** no
  computador (e vice-versa), sem precisar recarregar a página.
- Todos os aparelhos que abrirem o link veem os mesmos dados.
- **Importante sobre segurança:** como o app não tem tela de login, a chave
  usada no navegador (`anon key`) fica visível pra quem inspecionar o
  código — ou seja, qualquer pessoa com o link do site consegue ver e editar
  os dados. Pra uso pessoal ou de uma equipe pequena e de confiança isso
  costuma ser aceitável. Se no futuro você quiser exigir senha pra acessar,
  é só pedir que eu adiciono autenticação (o Supabase já suporta login por
  e-mail/senha ou Google de graça).

## Sobre a referência de preço de revenda por modelo

A lista de modelos com faixa de preço de revenda (usada quando não há
comparável regional nem preço de mercado informado) cobre os lançamentos
recentes mais comuns e também modelos mais antigos que costumam aparecer em
troca por aparelhos com defeito: iPhone 8, 8 Plus, X, XR, XS, XS Max, Galaxy
A15, A17, S20, S25, A30 e A30s, entre outros. Foi pesquisada em 09/08/2026 em
fontes como Trocafone, Trocafy, Canaltech, TechTudo, TechLoad, Zoom e
Buscapé — modelos mais antigos têm faixas de preço mais largas, porque o
mercado de usado antigo é menos padronizado (depende muito do estado da
bateria e da tela). Se um modelo que você compra com frequência ainda não
estiver na lista, me avise o nome exato que eu pesquiso e adiciono.

## Sobre a foto automática do modelo

Ao digitar o modelo no campo "Marca e modelo do celular", o app busca uma
foto de referência na Wikipédia (gratuito, sem chave de API). Limitações
importantes:

- Cobre bem os modelos mais populares (iPhone, Galaxy, Redmi, Moto etc.),
  mas pode não achar nada pra lançamentos muito recentes, variantes
  regionais ou nomes digitados de forma incomum — nesses casos o app volta
  pro ícone ilustrado.
- É uma foto de **referência do modelo em geral**, não do aparelho físico
  específico que você comprou (cor, estado, etc. podem ser diferentes).
- Depende de licenciamento livre da própria Wikipédia — não guardamos nem
  redistribuímos as imagens, só mostramos o link direto da fonte.

## Quer expandir o app no futuro?

O projeto está organizado de um jeito simples de continuar crescendo:

- `src/App.jsx` — toda a lógica e telas (form, cálculo, histórico).
- `src/supabaseClient.js` — conexão com o banco.
- `supabase/schema.sql` — estrutura do banco (adicione colunas/tabelas aqui
  conforme for crescendo).

Ideias de próximos passos (é só pedir quando quiser):
- Login por usuário (cada técnico vê só as próprias ordens, ou todos veem
  tudo mas sabe quem registrou o quê).
- Editar uma ordem já registrada, não só remover.
- Exportar o histórico em Excel/PDF.
- Gráficos de lucro por mês/marca.
- Upload de foto real do aparelho (tirada por você), além da foto de
  referência da Wikipédia.

## Quer um .apk de verdade (Google Play / instalação direta)?

Depois que o site estiver publicado, a forma mais rápida de gerar um `.apk`
assinado sem precisar instalar Android Studio é o **PWABuilder**
(https://www.pwabuilder.com): cole a URL do site, ele detecta o manifest que
já está configurado neste projeto e gera o pacote Android pronto pra
instalar ou publicar na Play Store.
