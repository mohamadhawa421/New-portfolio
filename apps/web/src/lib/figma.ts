/**
 * Where the design lives, per project.
 *
 * One master Figma file holds every project in this portfolio, and each case
 * study opens it at its own frame. So there are exactly two things to know per
 * project — the file and the node to start on — and the file is the same
 * string every time. `MASTER_FILE_URL` holds it once; a project only overrides
 * `fileUrl` if its design genuinely lives somewhere else.
 *
 * Nothing here is invented. Every field below is empty until the real links
 * exist, and empty is a state the component renders deliberately rather than a
 * value it tries to use.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Filling this in
 * ────────────────────────────────────────────────────────────────────────
 * Paste the master file URL into MASTER_FILE_URL, then paste each project's
 * "Copy link to selection" URL into its `frameUrl`. That is the whole job:
 * `startingNodeId` is read out of that URL by `parseFigmaUrl`, so there is no
 * node id to transcribe by hand and no chance of mistyping one.
 *
 * A frame URL looks like:
 *
 *   https://www.figma.com/design/<fileKey>/<name>?node-id=101-205&t=…
 *                                 ^^^^^^^^^ the file      ^^^^^^^ the frame
 *
 * If a project's `frameUrl` is from a different file than the master, that
 * file wins for that project — which is what makes the "one master file"
 * arrangement a convention here rather than a constraint.
 */

/** The master file every project opens by default. Empty until it exists. */
export const MASTER_FILE_URL =
  'https://www.figma.com/design/fxIEjD7LMBBdeDC4CtlD8D/Portfolio-projects---iframe?node-id=0-1&t=0SGl1kXLiJr5aLo9-1';

/**
 * How the embed is configured, in one place.
 *
 * These are Figma's own embed parameters. They are here rather than inline in
 * the component so the behaviour of every explorer on the site can be changed
 * without touching markup.
 */
export const EMBED_OPTIONS = {
  /**
   * Figma draws its own zoom and pan controls inside the frame.
   *
   * This is why the chrome around the canvas has no zoom buttons of its own.
   * The embed exposes no scripting API for zoom — its postMessage channel
   * carries prototype events and nothing that sets a viewport — so a pair of
   * plus/minus buttons in our own header would be two controls that cannot do
   * anything. Figma's are real, and they are already in the right place.
   */
  viewportControls: true,
  /**
   * The page switcher is off.
   *
   * With one master file holding every project, the page list is a way to
   * wander out of the case study you are reading and into another one with no
   * indication that you have — and, more to the point, the file is private
   * working material. Each explorer opens at its project's frame and stays
   * there. There is deliberately no route out of the embed into Figma: the
   * site offers no link to the file, and this switch closes the one way the
   * embed would otherwise provide.
   */
  pageSelector: false,
  /** Figma's own footer bar. Off: the surrounding page is the frame. */
  footer: false,
  /**
   * Follows the visitor's system setting rather than the site's theme toggle.
   *
   * The theme is baked into the iframe URL, so matching the site's own
   * light/dark switch would mean reloading the embed — and losing whatever
   * the visitor had panned to — every time they flipped it. `system` is the
   * closest thing to right that costs nothing.
   */
  theme: 'system' as 'system' | 'light' | 'dark',
  /**
   * Identifies this site to Figma. Required by the embed, and not a secret —
   * it is visible in the iframe URL of every page that carries one.
   */
  embedHost: 'mohamad-hawa-portfolio',
} as const;

/** One project's explorer, as configured. */
export interface FigmaProject {
  /** Shown in the header and in the placeholder. */
  projectName: string;
  /**
   * The file this project's design lives in. Empty means "use the master".
   * Only set this for a project whose design is genuinely elsewhere.
   */
  fileUrl?: string;
  /**
   * "Copy link to selection" from Figma, pasted whole.
   *
   * Both the file and the starting node are read out of this, so it is the
   * only field that normally needs filling in.
   */
  frameUrl: string;
  /**
   * The frame to open on, if it is ever known without a URL to read it from.
   * Leave empty and let `frameUrl` supply it — this exists for the case where
   * somebody has a node id and no link.
   */
  startingNodeId?: string;
  /**
   * Whether this project gets an explorer at all.
   *
   * A project with `enabled: false` renders nothing, in development or in
   * production, however complete its links are. A project with `enabled: true`
   * and no links yet shows the placeholder in development and nothing in
   * production — see `explorerFor` for why.
   */
  enabled: boolean;
}

/**
 * Every project, keyed by the slug its page is built at.
 *
 * Nine have their frame and are on. The rest are off until theirs exists,
 * because with a master file configured an empty `frameUrl` resolves to the
 * master's first page rather than to nothing — see the note beside them.
 * Turning one on is a paste into `frameUrl` and a boolean, nothing else.
 *
 * A project that is off costs a visitor nothing: `explorerFor` returns
 * `show: false` in either environment, so the section is simply absent from
 * that page until its URL exists.
 */
export const figmaProjects: Record<string, FigmaProject> = {
  'rm-luxury': {
    projectName: 'RM Luxury',
    frameUrl:
      'https://www.figma.com/design/fxIEjD7LMBBdeDC4CtlD8D/Portfolio-projects---iframe?node-id=3-1923&t=0SGl1kXLiJr5aLo9-4',
    enabled: true,
  },
  'club-expert-phonak': {
    projectName: 'Club Expert+ — Phonak',
    frameUrl:
      'https://www.figma.com/design/fxIEjD7LMBBdeDC4CtlD8D/Portfolio-projects---iframe?node-id=3-1922&t=0SGl1kXLiJr5aLo9-4',
    enabled: true,
  },
  archlist: {
    projectName: 'Archlist',
    frameUrl:
      'https://www.figma.com/design/fxIEjD7LMBBdeDC4CtlD8D/Portfolio-projects---iframe?node-id=3-1921&t=0SGl1kXLiJr5aLo9-4',
    enabled: true,
  },
  tahweel: {
    projectName: 'Tahweel',
    frameUrl:
      'https://www.figma.com/design/fxIEjD7LMBBdeDC4CtlD8D/Portfolio-projects---iframe?node-id=3-1920&t=0SGl1kXLiJr5aLo9-4',
    enabled: true,
  },
  kanz: {
    projectName: 'Kanz',
    frameUrl:
      'https://www.figma.com/design/fxIEjD7LMBBdeDC4CtlD8D/Portfolio-projects---iframe?node-id=3-1918&t=0SGl1kXLiJr5aLo9-4',
    enabled: true,
  },
  rowad: {
    projectName: 'Rowad',
    frameUrl:
      'https://www.figma.com/design/fxIEjD7LMBBdeDC4CtlD8D/Portfolio-projects---iframe?node-id=1-23331&t=0SGl1kXLiJr5aLo9-4',
    enabled: true,
  },
  'lebanese-prime-minister': {
    projectName: 'Lebanese Prime Minister',
    frameUrl:
      'https://www.figma.com/design/fxIEjD7LMBBdeDC4CtlD8D/Portfolio-projects---iframe?node-id=1-23332&t=0SGl1kXLiJr5aLo9-4',
    enabled: true,
  },
  apamea: {
    projectName: 'Apamea',
    frameUrl:
      'https://www.figma.com/design/fxIEjD7LMBBdeDC4CtlD8D/Portfolio-projects---iframe?node-id=1-23333&t=0SGl1kXLiJr5aLo9-4',
    enabled: true,
  },
  mylebpass: {
    projectName: 'MyLebPass',
    frameUrl:
      'https://www.figma.com/design/fxIEjD7LMBBdeDC4CtlD8D/Portfolio-projects---iframe?node-id=3-1919&t=0SGl1kXLiJr5aLo9-4',
    enabled: true,
  },

  /*
   * No frame yet, so no explorer.
   *
   * These six are off rather than merely blank, because the master file now
   * has a URL and `explorerFor` falls back to it: an empty `frameUrl` no
   * longer means "nothing to show", it means "open the master at its first
   * page" — which would put the same wrong screen on six case studies.
   * `enabled` is the switch the file already has for exactly this. Paste a
   * "copy link to selection" URL into one of these and flip it to true.
   */
  'wise-academy': { projectName: 'Wise Academy', frameUrl: '', enabled: false },
  'kabbara-office': { projectName: 'Kabbara Office', frameUrl: '', enabled: false },
  'coding-lebanon': { projectName: 'Coding Lebanon', frameUrl: '', enabled: false },
  'wfk-law-firm': { projectName: 'WFK Law Firm', frameUrl: '', enabled: false },
  'shipment-share': { projectName: 'Shipment Share', frameUrl: '', enabled: false },
  shareb: { projectName: 'Shareb', frameUrl: '', enabled: false },
};

/** What a Figma URL turns out to contain. */
export interface FigmaTarget {
  /** `design`, `file`, `board`, `proto`, `slides` — kept, because the embed
   *  host mirrors the same segment and a board is not a design file. */
  kind: string;
  /** The file key, which is what actually identifies the document. */
  key: string;
  /** The human-readable name segment. Cosmetic; the embed accepts anything. */
  name: string;
  /** The `node-id` from the query, normalised, or '' if the URL had none. */
  nodeId: string;
}

/**
 * Reads a Figma URL, and refuses to guess.
 *
 * Returns null for anything that is not recognisably a Figma file URL, which
 * is what stops a typo becoming an iframe pointed at nothing. Every caller
 * treats null as "not configured" and falls through to the placeholder.
 */
export function parseFigmaUrl(url: string): FigmaTarget | null {
  if (!url) return null;

  const path = /figma\.com\/(design|file|board|proto|slides)\/([A-Za-z0-9]+)(?:\/([^/?#]*))?/.exec(
    url
  );
  if (!path) return null;

  /*
   * The node id, in the two spellings Figma uses.
   *
   * A URL carries `node-id=101-205`; the same node is `101:205` everywhere
   * else in Figma's own interface and API, and people paste both. The embed
   * wants the hyphen, so that is what comes out of here regardless of what
   * went in.
   */
  const query = /[?&]node-id=([^&#]+)/.exec(url);
  const nodeId = query ? decodeURIComponent(query[1]).replace(/:/g, '-') : '';

  return { kind: path[1], key: path[2], name: path[3] || 'design', nodeId };
}

/** What the component needs in order to render one explorer. */
export interface FigmaExplorerData {
  projectName: string;
  /** The iframe source, or '' when there is nothing real to point at. */
  embedUrl: string;
  /** Whether a real embed is available, as opposed to the placeholder. */
  live: boolean;
  /** Whether to render anything at all. */
  show: boolean;
}

/** Builds the embed URL Figma actually serves. */
function embedUrlFor(target: FigmaTarget): string {
  const p = new URLSearchParams();
  p.set('embed-host', EMBED_OPTIONS.embedHost);
  if (target.nodeId) p.set('node-id', target.nodeId);
  p.set('viewport-controls', String(EMBED_OPTIONS.viewportControls));
  p.set('page-selector', String(EMBED_OPTIONS.pageSelector));
  p.set('footer', String(EMBED_OPTIONS.footer));
  p.set('theme', EMBED_OPTIONS.theme);

  return `https://embed.figma.com/${target.kind}/${target.key}/${encodeURIComponent(
    target.name
  )}?${p.toString()}`;
}

/**
 * Everything the component needs for one project, or a decision not to render.
 *
 * The three states this resolves to:
 *
 *   not enabled            → nothing, in either environment
 *   enabled, no links yet  → the placeholder in development, nothing in production
 *   enabled, links present → the live embed, in both
 *
 * The middle row is the one worth explaining. The brief asked for a
 * placeholder that makes it obvious *internally* that the data is temporary,
 * and this site is live — a "Ready for Figma source" panel on fifteen case
 * studies would read to a visiting client as work left unfinished. So the
 * placeholder is a development instrument: it occupies the exact box the embed
 * will, so the layout can be judged now, and it never ships. Flipping that is
 * one boolean if it turns out to be the wrong call.
 */
export function explorerFor(slug: string, isDev: boolean): FigmaExplorerData {
  const project = figmaProjects[slug];
  const off: FigmaExplorerData = {
    projectName: '',
    embedUrl: '',
    live: false,
    show: false,
  };

  if (!project || !project.enabled) return off;

  // The project's own file if it has one, the master otherwise, and the frame
  // link can name a file too — a "copy link to selection" URL always does.
  const frame = parseFigmaUrl(project.frameUrl);
  const file = parseFigmaUrl(project.fileUrl || MASTER_FILE_URL);
  const target = frame ?? file;

  if (!target) {
    return { projectName: project.projectName, embedUrl: '', live: false, show: isDev };
  }

  // A node id written by hand wins only where the frame URL had none, so
  // pasting a link over a stale hand-written id does the obvious thing.
  const nodeId = target.nodeId || project.startingNodeId?.replace(/:/g, '-') || '';
  const resolved: FigmaTarget = { ...target, nodeId };

  return {
    projectName: project.projectName,
    embedUrl: embedUrlFor(resolved),
    live: true,
    show: true,
  };
}
