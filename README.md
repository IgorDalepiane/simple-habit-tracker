# Simple Habit Tracker

App de hábitos para duas pessoas (Igor e Vinicius): login com senha, cadastro de hábitos por usuário, check diário e histórico em calendário com streak.

- **Login**: dois usuários (Igor / Vinicius); senha criada na primeira vez e usada nas próximas (encriptada no banco com bcrypt).
- **Hábitos**: cada usuário cadastra e remove os próprios hábitos.
- **Hoje**: marcar/desmarcar o que fez hoje.
- **Histórico**: calendário com bolhas coloridas (verde = tudo feito, laranja = parcial, vermelho = nada); clique no dia para ver detalhes em popup; filtro Igor / Vinicius / Todos.
- **Streak**: contagem de dias em sequência permitindo até 2 “skips” (dias sem marcar) por semana.
- Tema branco e laranja; no celular pode adicionar à tela inicial.

**Stack:** React + Vite + Supabase (conexão via `@supabase/supabase-js` no browser; não usa connection string direta do Postgres).

## Como hospedar e manter os dados

- **Frontend**: GitHub Pages (build React com Vite, estático, grátis).
- **Banco**: Supabase (PostgreSQL na nuvem, grátis).  
  O app usa a **REST API do Supabase** (URL + chave publishable/anon), não a connection string do Postgres. A connection string é para backends que conectam direto ao banco; no React usamos só a URL e a API key.

## Setup rápido

### 1. Clonar e instalar

```bash
git clone <url-do-repo>
cd simple-habit-tracker
npm install
```

Se ainda não tiver repositório Git na pasta:

```bash
git init
```

### 2. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (gratuito).
2. Rode as migrations no banco de **prod** (escolha uma das opções abaixo).
3. **Settings → API**: anote **Project URL** e **Publishable API Key** (ou anon key).

#### Rodar migrations no banco de prod

**Opção A – Pelo painel (mais simples)**  
No Supabase: **SQL Editor** → New query. Copie o conteúdo de `supabase/migrations/001_initial.sql`, cole no editor e clique em **Run**. Depois faça o mesmo com `002_users_and_habits_per_user.sql` (sempre nessa ordem).

**Opção B – Pela CLI**  
Na pasta do projeto, vincule o projeto remoto (uma vez; vai pedir a senha do banco) e envie as migrations:

```bash
npx supabase link --project-ref SEU_PROJETO_REF
npm run db:push
```

O `SEU_PROJETO_REF` é o ID do projeto na URL do painel (ex.: `https://supabase.com/dashboard/project/xxxxx` → o `xxxxx`).

### 3. Configurar o app

```bash
cp .env.example .env
```

Edite o `.env` com a **Project URL** e a **Publishable API Key** (Settings → API no painel Supabase).

### 4. Rodar localmente

```bash
npm run dev
```

Acesse o endereço que o Vite mostrar (ex.: `http://localhost:5173`).

### 5. Deploy no GitHub Pages

1. Crie um repositório no GitHub e envie o código (não commite o `.env`).
2. **Settings → Pages** → Build and deployment → **Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions** → New repository secret:
   - `SUPABASE_URL`: sua Project URL.
   - `SUPABASE_ANON_KEY`: sua Publishable/anon key.
4. A cada push em `main`/`master` o workflow faz o build (com as env vars dos secrets) e o deploy. O site fica em `https://<seu-usuario>.github.io/simple-habit-tracker/`.

### 6. iPhone

Abra o link no Safari e use **Compartilhar → Adicionar à Tela de Início**.

## Estrutura do projeto

- `src/App.jsx` – app React (hábitos, check, histórico)
- `src/utils/supabase.js` – cliente Supabase (usa `VITE_SUPABASE_*` do `.env`)
- `src/index.css` – estilos
- `supabase/migrations/001_initial.sql` – tabelas e RLS
- `vite.config.js` – base path para GitHub Pages

## Personalizar os nomes dos hábitos

No Supabase: **Table Editor** → tabela `habits` → edite a coluna `name` das duas linhas.

## Licença

MIT.