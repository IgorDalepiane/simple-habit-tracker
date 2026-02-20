# Simple Habit Tracker

Mini app web para marcar hábitos diários (até 2) e ver histórico. Pensado para duas pessoas (você e um amigo) usarem pelo mesmo link no celular.

- **Check diário**: escolher "Eu" ou "Amigo", marcar se fez cada hábito hoje.
- **Histórico**: ver seus checks, do amigo ou de todos.
- Funciona no Safari no iPhone; dá para adicionar à tela inicial como "app".

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
2. **SQL Editor** → New query → cole o conteúdo de `supabase/migrations/001_initial.sql` → Run.
3. **Settings → API**: anote **Project URL** e **Publishable API Key** (ou anon key).

### 3. Configurar o app

Copie o exemplo e preencha com sua URL e chave:

```bash
cp .env.example .env
```

Edite `.env`:

```
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publishable
```

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
