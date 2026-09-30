/**
 * The parts of a Supabase project the migrations lean on, recreated in PGlite:
 * the API roles, auth.users, auth.uid() reading the JWT claim the way GoTrue
 * sets it, and the two Storage tables. Deliberately minimal — anything it got
 * wrong would surface as a migration failing on the real project, not as a
 * false pass here.
 */

export const OWNER = '00000000-0000-4000-8000-000000000001';
export const APP_USER = '00000000-0000-4000-8000-000000000002';

export async function stubSupabase(pg) {
  await pg.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;

    create schema storage;
    create table storage.buckets (
      id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id), name text
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
}
