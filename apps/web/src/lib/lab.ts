/**
 * The Design Lab, and everything in it.
 *
 * Deliberately not in the CMS, and not in `content.ts` beside it.
 *
 * Everything `content.ts` serves is client work that Strapi owns: a project
 * there has a brief, a role, constraints and metrics, because somebody paid
 * for it and the case study is the account of what was delivered. None of that
 * is true here. These are personal explorations with no client, no brief and
 * no results — and giving them the same shape as a case study is exactly the
 * thing this section must not do, whatever the page looks like. Two content
 * models, because there are two kinds of work.
 *
 * It is a plain module rather than a collection for the same reason: adding an
 * experiment is adding an object to `EXPERIMENTS` and four images to
 * `public/lab/`, with no schema migration, no export step and no CMS restart.
 * The index and the project pages both build themselves from whatever is in
 * here — the count decides whether there is a featured slot, whether the
 * filters appear at all, and what "next experiment" points at.
 */

/* ---------------------------------------------------------------- */
/* The character                                                     */
/* ---------------------------------------------------------------- */

/**
 * What he is doing, rather than which file he is in.
 *
 * The page asks for a role — the pose that belongs beside a piece of
 * reasoning — and this decides which artwork answers it. Swapping the art for
 * one of these is a one-line change here and nothing anywhere else.
 */
export type LabPose = 'lab' | 'explaining' | 'thinking' | 'idea' | 'skeptical';

export interface PoseArt {
  src: string;
  width: number;
  height: number;
  /** What he is doing. He is the aside, not the content — see CharacterAside. */
  alt: string;
}

/**
 * The artwork behind each role.
 *
 * This table is the only place a filename appears, so giving a role new art is
 * a one-line change here. `idea` and `skeptical` still borrow from the poses
 * that exist; when their own artwork arrives it lands in `public/` and this is
 * the only file that has to know.
 */
export const POSES: Record<LabPose, PoseArt> = {
  lab: {
    src: '/character-lab.webp',
    width: 560,
    height: 526,
    alt: 'Mohamad Hawa, illustrated, holding a flask in one hand and Figma in the other',
  },
  explaining: {
    src: '/character-explaining.webp',
    width: 560,
    height: 587,
    alt: 'Mohamad Hawa, illustrated, presenting something to one side',
  },
  thinking: {
    src: '/character-thinking.webp',
    width: 560,
    height: 662,
    alt: 'Mohamad Hawa, illustrated, thinking it over',
  },
  idea: {
    src: '/character-presenting.webp',
    width: 560,
    height: 510,
    alt: 'Mohamad Hawa, illustrated, landing on an idea',
  },
  skeptical: {
    src: '/character-lost.webp',
    width: 560,
    height: 523,
    alt: 'Mohamad Hawa, illustrated, unconvinced',
  },
};

/* ---------------------------------------------------------------- */
/* Shapes                                                            */
/* ---------------------------------------------------------------- */

/**
 * The kind of experiment, which is also the filter.
 *
 * A closed set on purpose. Free text would give five experiments six
 * categories and a filter bar nobody can use.
 */
export type LabKind = 'Redesign' | 'Feature' | 'UX' | 'Interaction' | 'Concept';

export const KIND_ORDER: LabKind[] = [
  'Redesign',
  'Feature',
  'UX',
  'Interaction',
  'Concept',
];

export interface LabImage {
  src: string;
  alt: string;
  /**
   * The artwork's own pixels. Required rather than optional: the comparison
   * reserves its box from this ratio before a byte of image arrives, which is
   * what stops the page jumping as the two halves load. See LabCompare.
   */
  width: number;
  height: number;
}

/** One block of prose under its own heading. */
export interface LabNote {
  heading: string;
  body: string;
}

/** One step of a flow, numbered by position. */
export interface LabStep {
  title: string;
  body: string;
  /**
   * The screen this step is describing, when there is one.
   *
   * Optional because a flow is an argument first and a gallery second: a step
   * that is reasoning rather than a screen should not have to invent a picture
   * to earn its place in the list.
   */
  shot?: LabImage;
}

export interface LabExperiment {
  slug: string;
  /** The product or surface being explored. */
  title: string;
  kind: LabKind;
  /** Every label this answers to. The first is `kind`. Drives the filters. */
  kinds: LabKind[];
  /** One line, in the index and under the title. The idea, not a summary. */
  statement: string;
  /** Two or three sentences. What this is and why it exists. */
  summary: string;

  /**
   * The index preview, and it wins wherever it is set.
   *
   * With nothing here the index builds its own thumbnail out of `before` and
   * `after` side by side, which says what an experiment is at a glance and is
   * the right default. It is only a default though: two full screenshots
   * shrunk into one small frame can come out as noise rather than a picture,
   * and an entry whose subject has a cleaner single image deserves to use it.
   * Setting this is that override — the diptych still appears on the project
   * page, where it has the room to be read.
   */
  cover?: LabImage;

  /**
   * The comparison. Optional: a feature concept has nothing to compare
   * against, and forcing one produces a slider with two identical halves.
   */
  before?: LabImage;
  after?: LabImage;
  /** What the two halves are called. Defaults to Original / Exploration. */
  beforeLabel?: string;
  afterLabel?: string;

  /** What the product is, and which part of it this touches. */
  context?: string;
  /** Why this one. Stated as a personal reason, because it is one. */
  motive?: string;

  /** The body, in order. Each experiment brings the sections it needs. */
  notes: LabNote[];
  /** How it works, when there is a flow worth walking through. */
  flow?: LabStep[];
  /** What I would validate. Never a metric — see the note in the page. */
  testing?: string[];

  /** The honest conclusion. Three fields, none of them a victory lap. */
  reflection?: {
    likes: string;
    doubts: string;
    next: string;
  };

  /** Bigger in the index, if the collection is large enough to have a lead. */
  featured?: boolean;
  /** Clearly not real work yet. Drives the badge on the index. */
  placeholder?: boolean;
}

/* ---------------------------------------------------------------- */
/* The experiments                                                   */
/* ---------------------------------------------------------------- */

/**
 * The experiments, in the order they are shown.
 *
 * There is one, and the page is built for that rather than pretending
 * otherwise — see `labShape` below. Adding the next is adding an object here
 * and its images to `public/lab/<slug>/`; the landing page changes shape on
 * its own at two, three and four entries, and nothing has to be switched on.
 */
export const EXPERIMENTS: LabExperiment[] = [
  {
    slug: 'spotify-session',
    title: 'Spotify',
    kind: 'Feature',
    kinds: ['Feature', 'UX', 'Concept'],
    statement: 'What if discovery started with the moment you are in, rather than the catalogue?',
    summary:
      "Spotify is built around content you already have a name for — a playlist, an album, an artist, something you played last week. This explores a second way in: describe the moment instead, and have a session built around it. An independent exploration, not an official redesign, and nothing here shipped.",
    /*
     * The index shows this rather than the pair.
     *
     * Two full application screenshots shrunk into one small frame came out as
     * noise — a wall of album art and sidebar at thumbnail size, unreadable
     * and indistinguishable from any other music app. The wordmark says what
     * the experiment is about in one glance, which is all a cover has to do.
     * The comparison is still the first thing on the project page, where it
     * has the room to be read.
     *
     * Cropped to 16:9, and written at twice that. The source is 1.41:1, which
     * rendered as a 1139x810 slab of black with a small mark adrift in the
     * middle — taller than anything else on the page. A 2.81:1 band was tried
     * first, matching the diptych it replaces exactly, and overshot the other
     * way into a letterbox strip. The wordmark is centred, so a vertical crop
     * only ever takes empty ground.
     *
     * 2x because the plate is 1139 CSS pixels wide, which is 2278 device
     * pixels on a 2x display; a 1440-wide file was being stretched over it and
     * the mark came out soft. Flat green on flat black is the one kind of
     * artwork that survives being upscaled — lanczos has two colours and a
     * hard edge to work with rather than a photograph's detail.
     */
    cover: {
      src: '/lab/spotify/cover.webp',
      alt: 'Spotify — the subject of this exploration',
      width: 2880,
      height: 1620,
    },

    /*
     * One box, and both captures already fill it.
     *
     * The real Spotify window is 1440x684 and the exploration was 1440x1024.
     * The first attempt padded the shorter one out to 1024 with black, which
     * kept the scale honest but left a band of empty ground under one half of
     * the divider — visible, and it made the two sides look like different
     * kinds of thing.
     *
     * Cropping the exploration to the same 1440x684 is better on both counts:
     * the halves are now identical in size and scale with nothing added, and
     * what the crop removes is the bottom of a row that is already the same on
     * both sides. The comparison is about the top of the screen — the question,
     * the field, the chips — and all of that is above the cut.
     */
    before: {
      src: '/lab/spotify/before.webp',
      alt: 'Spotify as it is today: the home screen opening on rows of playlists and recently played albums',
      width: 1440,
      height: 684,
    },
    after: {
      src: '/lab/spotify/after.webp',
      alt: 'The exploration: a home screen opening on the question "What are we listening to?" with a search field and mood chips above the usual rows',
      width: 1440,
      height: 684,
    },
    beforeLabel: 'Spotify today',
    afterLabel: 'My exploration',

    context:
      "Spotify's home is organised around things that already have names: playlists, albums, artists, recently played, and mixes built from all of it. That is an enormous amount of content and it works — as long as you can name what you want. The part I looked at is the first ten seconds, before you have named anything.",
    motive:
      'Because of how often I open it knowing exactly how I want to feel and not at all what I want to hear. The catalogue cannot answer that question, so I end up scrolling until something looks close enough. I wanted to see what it would take to ask the other question first.',

    notes: [
      {
        heading: 'What I changed',
        body: "The home screen opens on a question — \u201cWhat are we listening to?\u201d — with a free-text field under it and four mood chips beside a fifth that opens the real thing: Build my own session. Everything Spotify already shows is still there, directly underneath. This is an additional door, not a replacement for the room.",
      },
      {
        heading: 'Why',
        body: "The inputs are about the listener, not about music. Not \u201cwhich genre\u201d but how you feel, what you are doing, how much energy you want, whether you want something familiar or something new, and how long you have. That is information a recommender can actually use and a person can actually answer — nobody knows what genre they are in the mood for, but everybody knows they are driving.",
      },
      {
        heading: 'Why the result explains itself',
        body: "The finished session carries the five choices back as tags: Chill, Driving, Medium energy, Mostly new, 1h 14min. It is the smallest thing that stops a personalised result being a black box — you can see what produced it, and you can see which input to change when it is wrong.",
      },
    ],

    flow: [
      {
        title: 'Describe the moment',
        body: "Five questions, all of them about the listener. Mood and activity are icons rather than a list to read; energy and adventurousness are sliders, because both are a position between two ends rather than a choice from a set; length is a row of chips ending in No limit. Structured inputs and a free-text field together, so it reads as describing something rather than filling in a form.",
        shot: {
          src: '/lab/spotify/create-session.webp',
          alt: 'The session sheet: mood and activity as icon rows, energy and adventurousness as sliders, duration as chips, and a Create my session button',
          width: 1440,
          height: 1024,
        },
      },
      {
        title: 'See what it made, and why',
        body: 'The session arrives with its inputs shown as tags and the first four tracks visible before anything plays. Two ways out: start it, or make another one. Showing the tracklist first is the part I care about — it is the moment you find out whether the thing understood you, and it costs nothing to look.',
        shot: {
          src: '/lab/spotify/session-created.webp',
          alt: 'The finished session: the tags Chill, Driving, Medium energy, Mostly new and 1h 14min above a numbered tracklist',
          width: 1440,
          height: 1024,
        },
      },
      {
        title: 'Listen to it as a session',
        body: 'A dedicated playing state rather than a return to the normal player — large artwork, the controls, and the context still visible. The session should feel like something that was assembled for this hour, and it stops feeling like that the moment it dissolves back into the same chrome as everything else.',
        shot: {
          src: '/lab/spotify/player.webp',
          alt: 'The session playing: large album artwork, playback controls and the session context alongside',
          width: 1440,
          height: 1024,
        },
      },
      {
        title: 'Keep the queue legible',
        body: 'Up next is given real room instead of being a panel you go looking for. If the pitch is that the sequence was deliberately assembled around your answers, then the sequence has to be the thing you can see.',
        shot: {
          src: '/lab/spotify/up-next.webp',
          alt: 'The expanded Up next queue showing the order of the session with artwork, titles and artists',
          width: 1440,
          height: 1024,
        },
      },
    ],

    testing: [
      'Does anyone understand what "Build my own session" will do before they press it?',
      'Is describing a moment actually faster than finding a playlist that already fits it?',
      'Do five inputs feel like being understood, or like being interviewed?',
      'Does "Mostly new" get moved, or does everyone leave it where it starts?',
      'Does the finished session feel different from a mix Spotify would have offered anyway?',
      'Would anyone come back to it a second week, or is it a thing you try once?',
      'Does showing the tracklist before playing build trust, or just add a step?',
    ],

    reflection: {
      likes:
        'The shift in who speaks first. Spotify opens with "here is what we have"; this opens with "tell me what this is for", and the five tags on the result keep that promise visible instead of asking you to trust it.',
      doubts:
        'That it is five questions to avoid one scroll. The honest risk is that describing a moment is more work than recognising a playlist, and recognition is very fast — I have not shown that the trade is worth making, only that it is buildable. I am also not convinced the sliders earn their place over two more icon rows.',
      next:
        'Whether anyone uses it twice. Everything else is detail: if the second session never gets created, the interaction model is wrong and no amount of tuning the inputs fixes that.',
    },

    featured: true,
  },
];

/* ---------------------------------------------------------------- */
/* Reading it                                                        */
/* ---------------------------------------------------------------- */

/** Zero-padded position in the index, e.g. "01". */
export const labNum = (i: number): string => (i < 9 ? `0${i + 1}` : String(i + 1));

export const getExperiments = (): LabExperiment[] => EXPERIMENTS;

export const getExperiment = (slug: string): LabExperiment | undefined =>
  EXPERIMENTS.find((x) => x.slug === slug);

/**
 * What shape the landing page takes, which is decided by how many there are.
 *
 * A section that is honest about being small reads better than one pretending
 * to be big. So the Lab has three layouts rather than one layout with things
 * switched off:
 *
 *   'solo'  — one experiment. No index, no filters, no "featured" label. The
 *             single entry *is* the page: shown at full width under the
 *             banner, with its own summary, and followed by a line saying
 *             plainly that it is the first. A ledger listing one row, or a
 *             lead with an empty list under it, both announce an absence.
 *
 *   'list'  — two or three. A ledger and nothing promoted: with two, picking a
 *             lead just makes the other one look like an afterthought.
 *
 *   'lead'  — four or more. One experiment leads and the rest form the index,
 *             because a featured item only means something against a field.
 *
 * Filters arrive separately and later — see `labFilters`.
 */
export type LabShape = 'solo' | 'list' | 'lead';

export function labShape(): LabShape {
  if (EXPERIMENTS.length <= 1) return 'solo';
  if (EXPERIMENTS.length < 4) return 'list';
  return 'lead';
}

/**
 * The one that leads, or nothing.
 *
 * In 'solo' this is the only experiment there is, and the page presents it as
 * the whole of itself rather than as a promoted item.
 */
export function featuredExperiment(): LabExperiment | undefined {
  const shape = labShape();
  if (shape === 'solo') return EXPERIMENTS[0];
  if (shape === 'list') return undefined;
  return EXPERIMENTS.find((x) => x.featured) ?? EXPERIMENTS[0];
}

/**
 * Whether the filters are worth showing.
 *
 * Two conditions, and both have to hold: enough entries that scanning them is
 * work, and enough distinct kinds that filtering removes anything. Five
 * experiments across one kind is a filter bar with one button.
 *
 * Five rather than four because by then one of them is leading, so four is a
 * filter bar over an index of three — and a control that hides two rows is
 * more furniture than the rows are.
 */
export function labFilters(): LabKind[] {
  if (EXPERIMENTS.length < 5) return [];
  const present = KIND_ORDER.filter((kind) =>
    EXPERIMENTS.some((x) => x.kinds.includes(kind))
  );
  return present.length >= 3 ? present : [];
}

/** The next one along, wrapping at the end. Undefined when it is the only one. */
export function nextExperiment(slug: string): LabExperiment | undefined {
  if (EXPERIMENTS.length < 2) return undefined;
  const i = EXPERIMENTS.findIndex((x) => x.slug === slug);
  if (i < 0) return undefined;
  return EXPERIMENTS[(i + 1) % EXPERIMENTS.length];
}
