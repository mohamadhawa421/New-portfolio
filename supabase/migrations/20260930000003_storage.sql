-- =====================================================================
-- Portfolio media in Storage.
--
-- The bucket is named for its product because Storage, like Auth, is shared
-- with app.mohamadhawa.com — the app will have buckets of its own, and a
-- bucket called "media" would be ambiguous the day it does.
--
-- Public read: these images are published on the website anyway, and object
-- names are uuid-prefixed so an unpublished draft image is only reachable by
-- someone who already has its URL. Writes are staff only. The size cap and
-- the MIME list are enforced by Storage itself, not by the Studio.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-media',
  'portfolio-media',
  true,
  15728640, -- 15 MB
  array['image/webp', 'image/png', 'image/jpeg', 'image/avif', 'image/gif', 'video/mp4']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Listing the bucket is staff only; public URLs do not need a select policy.
create policy "portfolio-media: staff list"
  on storage.objects for select to authenticated
  using (bucket_id = 'portfolio-media' and (select public.is_admin()));

create policy "portfolio-media: staff upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio-media' and (select public.is_admin()));

create policy "portfolio-media: staff replace"
  on storage.objects for update to authenticated
  using (bucket_id = 'portfolio-media' and (select public.is_admin()))
  with check (bucket_id = 'portfolio-media' and (select public.is_admin()));

create policy "portfolio-media: staff delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio-media' and (select public.is_admin()));
