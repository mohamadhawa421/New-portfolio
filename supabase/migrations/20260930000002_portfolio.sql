-- =====================================================================
-- The portfolio's content.
--
-- Two halves with different audiences:
--
--   draft tables   what the Studio edits. Staff only. anon has no grant at
--                  all, so a draft cannot leak through a missing policy —
--                  the table is simply not there for a visitor.
--   releases       immutable published snapshots. Anyone may read the
--                  current one; that is what the public build reads.
--
-- Relational where things are queried, ordered or linked (projects, blocks,
-- tags, media); JSONB where a shape is fixed by a template and never queried
-- field by field (a page's copy, a block's content).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Draft tables
-- ---------------------------------------------------------------------

-- Global values: name, contact details, availability, SEO defaults.
create table portfolio.settings (
  id         boolean primary key default true check (id),   -- exactly one row
  fields     jsonb not null default '{}' check (jsonb_typeof(fields) = 'object'),
  seo        jsonb not null default '{}' check (jsonb_typeof(seo) = 'object'),
  updated_at timestamptz not null default now()
);

-- One row per page template. The set of keys is the set of routes.
create table portfolio.pages (
  key        text primary key check (key in ('home', 'work', 'about', 'contact', 'lab')),
  fields     jsonb not null default '{}' check (jsonb_typeof(fields) = 'object'),
  seo        jsonb not null default '{}' check (jsonb_typeof(seo) = 'object'),
  updated_at timestamptz not null default now()
);

-- Metadata for every file in the portfolio-media bucket.
create table portfolio.media (
  id         uuid primary key default gen_random_uuid(),
  path       text not null unique,                 -- object name inside the bucket
  mime       text not null,
  bytes      integer not null check (bytes > 0),
  width      integer check (width > 0),
  height     integer check (height > 0),
  alt        text not null default '',
  focus      text,                                 -- CSS object-position, e.g. '58% 30%'
  sha256     text unique,                          -- dedupes re-uploads of the same file
  created_at timestamptz not null default now()
);

-- Case studies and Design Lab experiments. One table, because both are
-- "a piece of work with a page", and they differ in blocks, not in kind of row.
create table portfolio.projects (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('case', 'lab')),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text not null check (length(btrim(title)) > 0),
  summary          text not null default '',
  discipline       text not null default '',
  role             text not null default '',
  template         text not null default 'classic'
                   check (template in ('classic', 'image-led', 'feature', 'lab', 'custom')),
  sort_order       integer not null default 0,     -- order on the work / lab index
  selected_order   integer,                        -- null = not in Selected Work
  featured         boolean not null default false,
  visible          boolean not null default true,
  cover_media_id   uuid references portfolio.media (id) on delete set null,
  chip             jsonb not null default '{}' check (jsonb_typeof(chip) = 'object'),
  fields           jsonb not null default '{}' check (jsonb_typeof(fields) = 'object'),
  seo              jsonb not null default '{}' check (jsonb_typeof(seo) = 'object'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table portfolio.project_tags (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references portfolio.projects (id) on delete cascade,
  label      text not null check (length(btrim(label)) > 0),
  sort_order integer not null default 0
);

create index project_tags_project on portfolio.project_tags (project_id, sort_order);

-- A project page is an ordered list of these. The types are the sections the
-- two real templates already have, plus the few general ones a new project
-- needs. Adding a type is a migration, on purpose: the renderer has to know it.
create table portfolio.blocks (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references portfolio.projects (id) on delete cascade,
  type       text not null check (type in (
               -- case study
               'brief', 'problem', 'approach', 'decisions', 'gallery', 'metrics', 'reflection',
               -- design lab
               'lab.idea', 'lab.problem', 'lab.compare', 'lab.changed', 'lab.how', 'lab.test',
               'lab.reflection',
               -- shared
               'text', 'image', 'two-column', 'quote', 'video', 'figma'
             )),
  sort_order integer not null default 0,
  visible    boolean not null default true,
  content    jsonb not null default '{}' check (jsonb_typeof(content) = 'object'),
  settings   jsonb not null default '{}' check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);

create index blocks_project on portfolio.blocks (project_id, sort_order);

-- Ordered lists that belong to a page rather than to a project.
create table portfolio.lists (
  id         uuid primary key default gen_random_uuid(),
  list_key   text not null check (list_key in (
               'services', 'process', 'home.stats', 'about.stats',
               'about.experience', 'about.skills', 'contact.budget'
             )),
  sort_order integer not null default 0,
  visible    boolean not null default true,
  content    jsonb not null default '{}' check (jsonb_typeof(content) = 'object'),
  updated_at timestamptz not null default now()
);

create index lists_key on portfolio.lists (list_key, sort_order);

-- Controlled design changes. A value is a *token name* from the site's own
-- scales, never a raw CSS value — which is what keeps the design system
-- intact however much is edited.
create table portfolio.styles (
  element_key text not null,                          -- the data-edit key on the page
  prop        text not null check (prop in ('space', 'radius', 'type', 'color', 'align', 'fit')),
  token       text not null check (token ~ '^[a-z0-9-]+$'),
  primary key (element_key, prop)
);

create trigger settings_touch before update on portfolio.settings for each row execute function portfolio.touch();
create trigger pages_touch    before update on portfolio.pages    for each row execute function portfolio.touch();
create trigger projects_touch before update on portfolio.projects for each row execute function portfolio.touch();
create trigger blocks_touch   before update on portfolio.blocks   for each row execute function portfolio.touch();
create trigger lists_touch    before update on portfolio.lists    for each row execute function portfolio.touch();

-- ---------------------------------------------------------------------
-- Releases
-- ---------------------------------------------------------------------

create table portfolio.releases (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,
  summary     jsonb not null default '[]' check (jsonb_typeof(summary) = 'array'),
  snapshot    jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  is_current  boolean not null default false,
  restored_from bigint references portfolio.releases (id) on delete set null
);

-- At most one current release.
create unique index releases_one_current on portfolio.releases (is_current) where is_current;

-- ---------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------

grant usage on schema portfolio to anon, authenticated;

-- Draft tables: staff only. authenticated gets the grant, RLS narrows it to
-- is_admin(); anon gets nothing, so there is no policy to get wrong.
do $$
declare t text;
begin
  foreach t in array array['settings', 'pages', 'media', 'projects', 'project_tags', 'blocks', 'lists', 'styles']
  loop
    execute format('alter table portfolio.%I enable row level security', t);
    execute format('revoke all on portfolio.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on portfolio.%I to authenticated', t);
    execute format(
      'create policy "staff only" on portfolio.%I for all to authenticated
         using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- Releases: everyone reads the current one, staff read all of them, and
-- nobody writes except through publish() / rollback() below.
alter table portfolio.releases enable row level security;
revoke all on portfolio.releases from public, anon, authenticated;
grant select on portfolio.releases to anon, authenticated;

create policy "current release is public"
  on portfolio.releases for select to anon, authenticated
  using (is_current);

create policy "staff read history"
  on portfolio.releases for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Publish and roll back
-- ---------------------------------------------------------------------

-- The whole draft, as one value. Ordering is explicit in every array so the
-- snapshot never depends on insertion order.
create or replace function portfolio.draft_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'version',  1,
    'settings', (select to_jsonb(s) - 'id' from portfolio.settings s),
    'pages',    coalesce((select jsonb_agg(to_jsonb(p) order by p.key) from portfolio.pages p), '[]'),
    'media',    coalesce((select jsonb_agg(to_jsonb(m) order by m.path) from portfolio.media m), '[]'),
    'projects', coalesce((select jsonb_agg(to_jsonb(p) order by p.kind, p.sort_order, p.slug) from portfolio.projects p), '[]'),
    'tags',     coalesce((select jsonb_agg(to_jsonb(t) order by t.project_id, t.sort_order, t.id) from portfolio.project_tags t), '[]'),
    'blocks',   coalesce((select jsonb_agg(to_jsonb(b) order by b.project_id, b.sort_order, b.id) from portfolio.blocks b), '[]'),
    'lists',    coalesce((select jsonb_agg(to_jsonb(l) order by l.list_key, l.sort_order, l.id) from portfolio.lists l), '[]'),
    'styles',   coalesce((select jsonb_agg(to_jsonb(s) order by s.element_key, s.prop) from portfolio.styles s), '[]')
  );
$$;

revoke all on function portfolio.draft_snapshot() from public, anon, authenticated;

-- How many releases to keep. Enough to walk back a bad week; not a CMS
-- history system.
create or replace function portfolio.keep_releases()
returns integer language sql immutable as $$ select 20 $$;

create or replace function portfolio.publish(summary jsonb default '[]')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if not exists (select 1 from portfolio.settings) then
    raise exception 'nothing to publish: settings are empty';
  end if;

  update portfolio.releases set is_current = false where is_current;

  insert into portfolio.releases (created_by, summary, snapshot, is_current)
  values (auth.uid(), coalesce(summary, '[]'), portfolio.draft_snapshot(), true)
  returning id into new_id;

  delete from portfolio.releases
  where id not in (
    select id from portfolio.releases order by id desc limit portfolio.keep_releases()
  );

  return new_id;
end;
$$;

-- Restoring a release is itself a release: the old snapshot becomes current
-- again under a new id, and the draft is reset to it — otherwise the next
-- publish would quietly re-ship the change that was just rolled back.
create or replace function portfolio.rollback(release_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  snap   jsonb;
  new_id bigint;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select snapshot into snap from portfolio.releases where id = release_id;
  if snap is null then
    raise exception 'no release %', release_id;
  end if;

  -- Children first, then parents; inserts in the reverse order.
  delete from portfolio.styles;
  delete from portfolio.lists;
  delete from portfolio.blocks;
  delete from portfolio.project_tags;
  delete from portfolio.projects;
  delete from portfolio.media;
  delete from portfolio.pages;
  delete from portfolio.settings;

  insert into portfolio.settings select * from jsonb_populate_record(null::portfolio.settings, (snap -> 'settings') || '{"id": true}');
  insert into portfolio.pages    select * from jsonb_populate_recordset(null::portfolio.pages,    snap -> 'pages');
  insert into portfolio.media    select * from jsonb_populate_recordset(null::portfolio.media,    snap -> 'media');
  insert into portfolio.projects select * from jsonb_populate_recordset(null::portfolio.projects, snap -> 'projects');
  insert into portfolio.project_tags select * from jsonb_populate_recordset(null::portfolio.project_tags, snap -> 'tags');
  insert into portfolio.blocks   select * from jsonb_populate_recordset(null::portfolio.blocks,   snap -> 'blocks');
  insert into portfolio.lists    select * from jsonb_populate_recordset(null::portfolio.lists,    snap -> 'lists');
  insert into portfolio.styles   select * from jsonb_populate_recordset(null::portfolio.styles,   snap -> 'styles');

  update portfolio.releases set is_current = false where is_current;

  insert into portfolio.releases (created_by, summary, snapshot, is_current, restored_from)
  values (auth.uid(), jsonb_build_array('Restored release ' || release_id), snap, true, release_id)
  returning id into new_id;

  delete from portfolio.releases
  where id not in (
    select id from portfolio.releases order by id desc limit portfolio.keep_releases()
  );

  return new_id;
end;
$$;

revoke all on function portfolio.publish(jsonb) from public, anon;
revoke all on function portfolio.rollback(bigint) from public, anon;
grant execute on function portfolio.publish(jsonb) to authenticated;
grant execute on function portfolio.rollback(bigint) to authenticated;
