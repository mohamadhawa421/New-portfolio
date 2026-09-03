# Mohamad Hawa — portfolio

Astro front end, Strapi CMS, deployed as a fully static site. Built from the
Claude Design prototype in [`design-source/`](design-source/).

```
apps/
  web/    Astro 5 — the public site
  cms/    Strapi 5 — the local admin, plus the SQLite database that holds the content
design-source/   The original .dc.html prototype, kept for reference
```

## How this is wired

There is **no server and no database in production**. The content lives in a
SQLite file in this repo, and the deployed site is plain HTML:

```
apps/cms/data/portfolio.db          working database — NOT committed
apps/cms/public/uploads/            the images (committed)
        │
        │  npm run export  — boots Strapi in-process, reads the database,
        │                    writes a snapshot, copies the images, and
        │                    refreshes the sanitised database copy
        ▼
apps/cms/data/portfolio.public.db   same content, credentials stripped (committed)
apps/web/src/data/content.json      snapshot (committed)
apps/web/public/media/              images the site serves (generated)
        │
        │  astro build
        ▼
apps/web/dist/                      static HTML, deployed to Vercel
```

### Why there are two database files

The working database holds your Strapi admin account — email and password hash —
plus any API tokens. None of that is needed to build the site, and none of it
belongs in a repository, so it is gitignored.

`npm run export` writes `portfolio.public.db` alongside it: a byte-for-byte copy
with every credential-bearing table emptied and the free pages vacuumed. That is
the file that gets committed and the one Vercel builds from. The export refuses
to finish if any of those tables still has rows in it.

On a fresh clone (or on Vercel) there is no working database, so the first
`npm run dev:cms`, `npm run seed` or `npm run export` copies the public one into
place. All the content is there; Strapi just asks you to create an admin account
the first time you open the panel.

Vercel runs `npm run build:site`, which does the export and then the build. It
needs no environment variables, no network access and no database — which is why
it runs on the free tier.

## Editing content

```bash
npm run dev:cms
```

Open `http://localhost:1337/admin`, make your changes, then:

```bash
npm run export
```

That rewrites `apps/web/src/data/content.json`, refreshes
`apps/web/public/media/`, and updates the sanitised `portfolio.public.db`.
Commit and push — Vercel rebuilds from there:

```bash
git add -A && git commit -m "Update content" && git push
```

To see changes locally before pushing, `npm run refresh` exports and starts the
site in one go, or run `npm run dev:web` in a second terminal — Astro reloads
when the snapshot changes.

> The export fails loudly if an image referenced by the database is missing from
> `apps/cms/public/uploads/`, so a broken deploy is caught locally rather than
> shipping a page of broken images.

## Requirements

Node 20–22. Strapi 5 refuses to start on Node 24+, so the version is pinned in
`.nvmrc` / `.node-version`.

Node 22 is installed here via Homebrew, but `node@22` is **keg-only** — Homebrew
does not put it on your `PATH`, so a fresh terminal will say
`command not found: node`. Fix it once with:

```bash
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc
```

## First run on a new machine

```bash
npm install
```

The site builds immediately — the snapshot is committed, so you do not need the
CMS to work on the front end.

To use the admin, create `apps/cms/.env` from the example and fill in every
`CHANGE_ME` with a random value:

```bash
cp apps/cms/.env.example apps/cms/.env
```

Generate one with `node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"`.
Then `npm run dev:cms` and create the admin account it prompts for. That account
lives only in your local `portfolio.db`, which is deliberately not committed — so
each machine creates its own.

## The content model

Single types — one record each, all copy editable:

| Type | What it holds |
| --- | --- |
| **Site settings** | Name, role, location, email, WhatsApp number, availability flag, portrait, logos, contact mode, whether the intro animation plays |
| **Home page** | Hero, section headings, the manifesto line (split into its white and grey halves), the about teaser, stats |
| **Work page** | Heading and intro for the work index |
| **About page** | Bio paragraphs, stats, work history, skill tags |
| **Contact page** | Contact copy plus every label, placeholder, error and confirmation string in the enquiry form, and the budget bands |

Collection types:

| Type | What it holds |
| --- | --- |
| **Project** | Everything on a card *and* the full case study: brief, problem constraints, approach, decisions, gallery, metrics, reflection |
| **Service** | The "Four ways to work together" list. Each links to the contact form with itself preselected |
| **Process step** | The "How I work" list |

Ordering is by the `order` field, lowest first. On a Project it also drives the
`01 / 02 / 03` numbering and the "Next project" link; `featured` picks which one
gets the large 16:9 treatment on the home page.

Only **published** entries are exported. A draft stays out of the build.

## Design decisions worth knowing

**The CSS is a direct port.** Values come from the prototype's inline styles —
`clamp()` scales, the `cubic-bezier` easings, the spring `linear()` curve for
button presses. They live in `apps/web/src/styles/tokens.css`; component rules
live in each component's scoped `<style>` block. There is no Tailwind.

**The prototype was a single-page app; this is not.** Each of its five views is
a real route (`/`, `/work`, `/work/[slug]`, `/about`, `/contact`), so pages are
linkable, crawlable, and work without JavaScript.

**Navigation is a centred pill above 768px and a burger → sidebar below.** The
pill overlapped the fixed logo on phones, which is what the breakpoint fixes.
The sidebar traps focus, locks body scroll, closes on Escape / scrim / link, and
closes itself if the viewport crosses the breakpoint — a phone rotated to
landscape would otherwise be left scroll-locked.

**The enquiry form sends nothing.** It composes the message and hands it to
WhatsApp or the visitor's mail app, exactly as designed, so the reassurance line
in the form stays true. Selecting a service on the home page links to
`/contact?service=…`, which the form reads on load.

**The case studies carry the real project content.** It was imported from the
previous Next.js portfolio by `apps/cms/scripts/import-legacy.js`, which parses
that repo's `lib/project-data.ts` rather than retyping it. Research findings
became the numbered constraints, `finalSolutions` became the outcome cards, and
timeline/scope/impact became the three metrics. Nothing was invented: the only
authored strings are the metric labels, which restate the sentence they came
from. Image captions are empty because the old site had none.

**JavaScript is enhancement only.** Reveal-on-scroll elements are hidden by CSS
that only applies once a tiny inline script confirms scripting is on, so nothing
is invisible without it. `prefers-reduced-motion` skips the intro and all
reveals.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | The site, from the current snapshot |
| `npm run dev:cms` | Strapi admin at `localhost:1337` |
| `npm run export` | Read the database → snapshot + media. Run after every content edit |
| `npm run refresh` | Export, then start the site |
| `npm run build:site` | Export then build — what Vercel runs |
| `npm run preview` | Serve the built site |
| `npm run seed` | Reload the original design content (run with Strapi stopped; `-- --force` overwrites) |

## Deploying

Vercel is configured by [`vercel.json`](vercel.json): build `npm run build:site`,
output `apps/web/dist`. Push to the default branch and it rebuilds.

Set `SITE_URL` in Vercel's environment variables to the production origin so
canonical URLs and `sitemap.xml` are right. Nothing else is needed.
