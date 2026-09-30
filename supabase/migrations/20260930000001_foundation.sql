-- =====================================================================
-- Foundation: who may do what, and where each product keeps its data.
--
-- One Supabase project is shared by two products:
--
--   portfolio   mohamadhawa.com + admin.mohamadhawa.com (this migration)
--   app         app.mohamadhawa.com (reserved; nothing is created in it yet)
--
-- They share Auth, and nothing else. That sharing is the one thing every
-- policy below is written against: the app will have public sign-up, so
-- "authenticated" will mean *any person with an app account*. No portfolio
-- policy may therefore trust the authenticated role on its own — every write
-- goes through public.is_admin(), which reads a table only the service role
-- can change. Signing up for the app can never make someone a portfolio
-- editor, and nothing reads user_metadata, which the user controls.
--
-- Custom schemas are not reachable over the API until they are listed under
-- Project Settings → API → Exposed schemas. Expose `portfolio`; do not expose
-- `app` until it has tables and policies of its own.
-- =====================================================================

create schema if not exists portfolio;
create schema if not exists app;

-- The app schema is reserved and closed. When app.mohamadhawa.com exists it
-- grants what it needs, in its own migrations.
revoke all on schema app from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------

-- Portfolio staff. Written by the service role only (SQL editor, or a
-- trusted script) — there is no policy that lets anyone insert here.
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- A signed-in person can see whether *they* are staff, which is how the
-- Studio decides between the editor and the door. Nobody can see the list.
create policy "admins: read own row"
  on public.admins for select to authenticated
  using (user_id = auth.uid());

revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

-- The one question every portfolio policy asks. SECURITY DEFINER so it can
-- read admins regardless of the caller's own grants; empty search_path so a
-- caller cannot shadow `admins` with a table of their own.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------

create or replace function portfolio.touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
