# Supabase

One project, shared by the portfolio and — later — app.mohamadhawa.com.
They share **Auth and Storage**, and nothing else.

| Schema | Owner | Exposed over the API |
|---|---|---|
| `public` | shared: `admins` and `is_admin()` only | yes (default) |
| `portfolio` | the portfolio: draft tables and `releases` | **yes — add it** |
| `app` | reserved for app.mohamadhawa.com; empty and closed | not until it has policies |

The rule every policy is written against: **the app will have public sign-up**, so
"signed in" will mean "has an app account". No portfolio policy trusts that on its
own. Writes need `public.is_admin()`, which reads a table only the service role can
change, and nothing reads `user_metadata`, which the user controls.

## Setting it up (once)

1. **Create the project** at supabase.com (free tier). Pick the region closest to
   Vercel's build region. Free projects pause after a week idle, which the public
   site doesn't notice (it's static) — the Studio just takes a few seconds to wake it.
2. **Run the migrations**, in order: open *SQL Editor*, paste each file in
   `migrations/` and run it.
3. **Expose the schema**: *Project Settings → Data API → Exposed schemas* → add
   `portfolio`.
4. **Close sign-up for now**: *Authentication → Sign In / Providers → Allow new
   users to sign up* → off. (Turn it on again when the app needs it. The portfolio
   stays safe either way, because `admins` decides; this just keeps the user list
   clean until then.)
5. **Create your account**: *Authentication → Users → Add user → Create new user*,
   with your email and a long password, and *Auto confirm* ticked.
6. **Make it staff**: in the SQL Editor —
   ```sql
   insert into public.admins (user_id, role)
   select id, 'owner' from auth.users where email = 'YOUR-EMAIL';
   ```
7. **Admin Vercel project**: import the same repo as a second project, with
   *Root Directory* `apps/web` (it picks up `apps/web/vercel.json`). Add the domain
   `admin.mohamadhawa.com` and these environment variables:
   - `SUPABASE_URL` — *Project Settings → Data API → URL*
   - `SUPABASE_ANON_KEY` — the **anon / publishable** key. Never the service-role key.
   - `STUDIO_EMAIL` — the email from step 5
   - `SITE_URL` — `https://mohamadhawa.com`

   The public project needs none of these and should not be given them.

## Checking the policies

```bash
npm run test:db
```

This applies every migration to a real Postgres (PGlite, in-process, no Docker) and
attacks it as a visitor, as an app user and as the owner — 14 tests. Each one was
confirmed by breaking the rule it guards and watching it fail. Do the same for any
new policy: a security test that can't fail is worse than none.

What the tests *can't* reach is Supabase's own configuration — exposed schemas,
the sign-up switch, bucket settings made in the dashboard. Those are the steps above.

## Rolling back a publish

Every publish is a row in `portfolio.releases` (the last 20 are kept).
`portfolio.rollback(<id>)` makes an old one current again **and resets the draft to
it**, so the next publish doesn't quietly re-ship the change you just undid.
