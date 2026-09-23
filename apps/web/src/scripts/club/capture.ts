/**
 * The export, performed inside the sandbox rather than outside it.
 *
 * This module runs in the *iframe's* document, not the editor's, and that is
 * the whole reason it exists as a separate file. Turning a DOM into a PNG
 * means walking every node, reading its computed style and inlining it into a
 * clone — and `getComputedStyle` belongs to a window. Called from the editor's
 * window on nodes that live in the frame's, the results are unreliable across
 * engines: same-origin access is permitted, so nothing throws, and what comes
 * back is a picture with half its styling missing. Running the capture in the
 * realm that owns the nodes removes the question entirely.
 *
 * It is loaded only in club mode — see the guard in BaseLayout — so the
 * library behind it is a chunk that an ordinary visit never fetches.
 *
 * The protocol is two messages. The editor asks, this answers with a data URL
 * or with an error, and the editor owns the download and the user-facing
 * wording. Nothing is uploaded anywhere: the bytes are made in the browser and
 * handed to the browser.
 */

/*
 * Marks the file as a module.
 *
 * Everything below is a side effect and the only `import` is a dynamic one
 * inside the handler, which leaves TypeScript treating this as a script in the
 * global scope — and then complaining that it cannot be imported. An empty
 * export is the documented way to say "this is a module that exports nothing".
 */
export {};

const ASK = 'club:capture';
const REPLY = 'club:captured';

interface AskMessage {
  type: typeof ASK;
  /** Device pixel ratio to render at, chosen by the editor from the page size. */
  scale: number;
}

function isAsk(data: unknown): data is AskMessage {
  return !!data && typeof data === 'object' && (data as AskMessage).type === ASK;
}

window.addEventListener('message', async (event: MessageEvent) => {
  /*
   * Same-origin only, and by identity rather than by string comparison.
   *
   * The frame and the editor are the same origin by construction, so anything
   * arriving from elsewhere is not the editor and has no business asking this
   * document to serialise itself.
   */
  if (event.origin !== window.location.origin) return;
  if (!isAsk(event.data)) return;

  const reply = (payload: Record<string, unknown>): void => {
    event.source?.postMessage({ type: REPLY, ...payload }, { targetOrigin: event.origin });
  };

  try {
    const { toPng } = await import('html-to-image');

    /*
     * Wait for the pictures before drawing any of them.
     *
     * `toPng` serialises whatever is in the document at the moment it runs, so
     * an image still in flight is captured as nothing. The sandbox flips every
     * lazy image to eager on load, but "started loading" is not "finished", and
     * the export is the one operation where a half-drawn page is permanent.
     *
     * `decode()` rather than a load listener: it resolves when the bytes are
     * decoded and ready to paint, which is the actual precondition, and it
     * rejects rather than hanging on an image that fails. Bounded by a race, so
     * one asset that never arrives costs its own space in the PNG and not the
     * whole export.
     */
    const ready = Array.from(document.images).map((picture) =>
      Promise.race([
        picture.decode().catch(() => undefined),
        new Promise((settle) => window.setTimeout(settle, 6000)),
      ])
    );
    await Promise.all(ready);

    const root = document.documentElement;
    /*
     * The whole page, not the visible part.
     *
     * `scrollHeight` on the root is the full document — which in the Club is
     * what the frame is already sized to, so this is simply the artboard. The
     * export is asked for explicitly and is meant to be the entire redesign
     * from hero to footer.
     */
    const width = root.scrollWidth;
    const height = root.scrollHeight;

    const dataUrl = await toPng(document.body, {
      width,
      height,
      pixelRatio: event.data.scale,
      /*
       * The body's own background is transparent on this site — the sections
       * paint themselves — so without this the PNG has a transparent band
       * wherever a section does not cover, which reads as a broken export.
       */
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
      /*
       * Anything the designer could not have put there.
       *
       * Selection marks live in the editor's overlay, outside this document,
       * so there is very little to strip — but a node that failed to load is
       * still worth dropping rather than exporting as a broken-image glyph.
       */
      filter: (node: HTMLElement) => {
        if (node.dataset?.clubOmit !== undefined) return false;
        if (node instanceof HTMLImageElement && node.naturalWidth === 0 && node.complete) return false;
        return true;
      },
    });

    reply({ ok: true, dataUrl, width, height });
  } catch (error) {
    reply({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
});
