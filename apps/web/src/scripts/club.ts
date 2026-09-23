/**
 * Club mode: the site knowing it is being edited rather than visited.
 *
 * The Designers Club canvas is the real home page, running in a same-origin
 * iframe — the actual components, the actual inlined CSS, the actual content
 * and the actual character. That is the whole reason the sandbox looks like
 * the portfolio instead of like a mockup of it, and it is why nothing here
 * duplicates any markup.
 *
 * What it costs is this flag. A page that is being designed on is not being
 * used, and several of the site's own behaviours are actively wrong inside the
 * frame: reveals wait for an IntersectionObserver that never fires in a scaled
 * frame, so whole sections would sit at zero opacity; the pointer ring would
 * chase a cursor that belongs to the editor outside; the shockwave would fire
 * on the first click at the portrait, which in the Club is a selection; and the
 * intro curtain would play over the canvas every time it reloaded.
 *
 * So the flag is read once, from the query string, and written to the root
 * element before anything paints — see the inline primer in BaseLayout. Every
 * guard in the site reads it from there rather than re-parsing the URL, so a
 * client-side navigation cannot leave half the page in one mode and half in
 * the other.
 *
 * It is deliberately not persisted anywhere. Club mode belongs to one document
 * in one frame; a stored flag would leak the editor's behaviour into an
 * ordinary visit, which is the one thing this must never do.
 */

/**
 * Whether this document is the Club's canvas.
 *
 * Reads the attribute rather than the URL so it agrees with what the primer
 * decided, and so it stays true across a client-side navigation inside the
 * frame.
 */
export function isClub(): boolean {
  return document.documentElement.hasAttribute('data-club');
}

/**
 * Whether this document is the Club's *workspace* — the editor itself, rather
 * than the canvas inside it.
 *
 * The two are different documents and want opposite things. The canvas is the
 * portfolio and answers to `data-club`; the workspace is an ordinary page of
 * this site, so everything the site does runs there by default — including the
 * drawn pointer, which is exactly wrong in a design tool. A designer needs to
 * see where the hairline of a resize handle is, and the arrow the operating
 * system draws is the one every editor uses for that reason.
 */
export function isClubEditor(): boolean {
  return !!document.querySelector('[data-club-root]');
}

/**
 * The query flag the primer looks for, exported so the editor builds the
 * iframe's URL from the same constant rather than from a second string
 * literal that can drift from this one.
 */
export const CLUB_PARAM = 'club';
