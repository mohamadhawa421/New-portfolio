-- =====================================================================
-- SVG in the portfolio bucket.
--
-- The site's two logos are SVG, and the first migration run stopped on them.
-- SVG was left out at first because it is the one image type that can carry
-- script. It is allowed now, knowingly, because both halves of that risk are
-- closed elsewhere:
--
--   who can upload   staff only (the insert policy), so nobody can plant one
--   how it is shown  the site draws every image with <img>, which never runs
--                    script inside an SVG, and the files are served from
--                    supabase.co — no cookie of this site's is in scope there
--
-- If the Studio ever lets an SVG be *inlined* into a page, it has to be
-- sanitised on the way in first; <img> is what makes this safe, not the file.
-- =====================================================================

update storage.buckets
set allowed_mime_types = array[
  'image/webp', 'image/png', 'image/jpeg', 'image/avif', 'image/gif', 'image/svg+xml', 'video/mp4'
]
where id = 'portfolio-media';
