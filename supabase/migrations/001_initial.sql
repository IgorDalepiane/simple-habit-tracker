-- Tabela de hábitos (máx. 2 no app)
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Hábito',
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Check-ins por dia e usuário
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_name text not null check (user_name in ('eu', 'amigo')),
  date date not null,
  created_at timestamptz default now(),
  unique(habit_id, user_name, date)
);

-- Índices para consultas rápidas
create index if not exists idx_check_ins_date on public.check_ins(date desc);
create index if not exists idx_check_ins_user_date on public.check_ins(user_name, date desc);

-- RLS: permitir leitura e escrita para anon (app compartilhado simples; restrinja depois se quiser)
alter table public.habits enable row level security;
alter table public.check_ins enable row level security;

create policy "Allow all on habits" on public.habits for all using (true) with check (true);
create policy "Allow all on check_ins" on public.check_ins for all using (true) with check (true);

-- Comentário: para produção com mais usuários, use auth.uid() nas policies.
