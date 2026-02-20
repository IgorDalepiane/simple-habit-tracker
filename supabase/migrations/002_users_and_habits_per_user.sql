-- Habitos por usuario (Igor / Vinicius)
alter table public.habits add column if not exists user_name text;
-- Atribuir os 2 habitos existentes: primeiro a Igor, segundo a Vinicius
update public.habits set user_name = 'Igor' where id = (select id from public.habits order by sort_order asc limit 1);
update public.habits set user_name = 'Vinicius' where id = (select id from public.habits order by sort_order asc limit 1 offset 1);
alter table public.habits alter column user_name set not null;
alter table public.habits add constraint habits_user_check check (user_name in ('Igor', 'Vinicius'));

-- Check_ins: permitir Igor e Vinicius
alter table public.check_ins drop constraint if exists check_ins_user_name_check;
alter table public.check_ins add constraint check_ins_user_name_check check (user_name in ('Igor', 'Vinicius'));
update public.check_ins set user_name = 'Igor' where user_name = 'eu';
update public.check_ins set user_name = 'Vinicius' where user_name = 'amigo';

-- Credenciais: senha encriptada por usuario (apenas 2 usuarios)
create table if not exists public.user_credentials (
  name text primary key check (name in ('Igor', 'Vinicius')),
  password_hash text,
  created_at timestamptz default now()
);

alter table public.user_credentials enable row level security;
create policy "Allow all user_credentials" on public.user_credentials for all using (true) with check (true);

-- Extensao para hash de senha (bcrypt)
create extension if not exists pgcrypto;

-- RPC: verificar se usuario ja tem senha
create or replace function public.has_password(user_name text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select coalesce((select password_hash is not null and password_hash != '' from user_credentials where name = user_name), false);
$$;

-- RPC: definir senha (primeira vez ou trocar)
create or replace function public.set_password(user_name text, plain_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if user_name is null or plain_password is null or length(trim(plain_password)) < 1 then
    raise exception 'Nome e senha sao obrigatorios';
  end if;
  if user_name not in ('Igor', 'Vinicius') then
    raise exception 'Usuario invalido';
  end if;
  insert into user_credentials (name, password_hash)
  values (user_name, crypt(plain_password, gen_salt('bf')))
  on conflict (name) do update set password_hash = crypt(plain_password, gen_salt('bf'));
end;
$$;

-- RPC: validar login (retorna true se senha correta)
create or replace function public.check_password(user_name text, plain_password text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from user_credentials
    where name = user_name and password_hash = crypt(plain_password, password_hash)
  );
$$;

-- Garantir linhas para os 2 usuarios (senha null ate definirem)
insert into user_credentials (name) values ('Igor'), ('Vinicius')
on conflict (name) do nothing;
