/**
 * The sandbox state, and the only thing undo has to understand.
 *
 * The rule the whole feature rests on: **the real page is read, never
 * written**. What the designer changes is this object — a map of node id to
 * the properties they have overridden — and the sandbox is that map applied
 * to the iframe as inline styles. Nothing here is persisted, nothing is sent
 * anywhere, and the iframe is a throwaway document: reloading it or leaving
 * the Club restores the portfolio exactly, because the portfolio was never
 * the thing being edited.
 *
 * Overrides rather than a full description of every node, which is what makes
 * reset trivial and undo cheap. A node with no entry here is untouched and is
 * rendering whatever the real page renders; clearing an entry is the same as
 * never having made it. There is no need to record what the original was,
 * because the original is still there, in the document, being the default.
 *
 * History is whole snapshots rather than inverse operations. For a sandbox
 * this size that is the right trade by a wide margin: a snapshot is a few
 * kilobytes of JSON, and "undo is restoring the previous map" cannot drift out
 * of step with the forward operation the way a hand-written inverse can. The
 * classic bug in an operation-based history — an inverse that is subtly not
 * the inverse, discovered ten steps later — simply cannot happen here.
 */

import type { ClubType } from './schema';

/** Everything any node can carry. All optional: absent means untouched. */
export interface Props {
  /** Offset from where layout put it, in CSS pixels. Never absolute position. */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  visible?: boolean;
  opacity?: number;
  radius?: number;
  bg?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  align?: string;
  text?: string;
  src?: string;
  fit?: string;
  /*
   * Horizontal and vertical padding, separately.
   *
   * One `padding` field was a trap: it was seeded from `paddingTop`, which is
   * 0 on a button whose real padding is `0 22px` — so the field read zero,
   * and typing anything into it wrote that value to all four sides and
   * reshaped the button. Figma shows the pair for the same reason.
   */
  padX?: number;
  padY?: number;
  gap?: number;
  /** Set on nodes the designer added, so the sandbox knows to build them. */
  created?: CreatedSpec;
}

/**
 * A thing that did not exist in the portfolio.
 *
 * Shapes, text and frames the designer adds are described here rather than
 * adopted, because there is no element to adopt. They are rebuilt from this on
 * every apply, which means undoing a creation is deleting a key and redoing it
 * is putting the key back — the same mechanism as every other edit, with no
 * special case anywhere else in the system.
 */
export interface CreatedSpec {
  kind: 'rect' | 'ellipse' | 'text' | 'frame';
  /** Which section it was dropped into, and where inside it. */
  section: string;
  left: number;
  top: number;
}

export interface SandboxState {
  /** node id → the properties overridden on it. */
  overrides: Record<string, Props>;
  /** Creation order for nodes the designer added, so z-order is stable. */
  addedOrder: string[];
}

export const emptyState = (): SandboxState => ({ overrides: {}, addedOrder: [] });

const clone = (s: SandboxState): SandboxState => JSON.parse(JSON.stringify(s)) as SandboxState;

/** How many steps back the Club remembers. Deep enough to explore, bounded. */
const HISTORY_LIMIT = 80;

type Listener = (state: SandboxState, reason: string) => void;

export class Store {
  private state: SandboxState = emptyState();
  private past: SandboxState[] = [];
  private future: SandboxState[] = [];
  private listeners = new Set<Listener>();

  /** The state a reset returns to. Empty, because empty means "the portfolio". */
  get current(): SandboxState {
    return this.state;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(reason: string): void {
    for (const fn of this.listeners) fn(this.state, reason);
  }

  /**
   * One undoable step.
   *
   * The snapshot goes on the past stack *before* the change, and the future is
   * dropped — which is the standard shape and the one users expect: editing
   * after an undo forks, it does not interleave.
   */
  commit(reason: string, mutate: (draft: SandboxState) => void): void {
    this.past.push(clone(this.state));
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];

    const draft = clone(this.state);
    mutate(draft);
    this.state = draft;
    this.emit(reason);
  }

  /**
   * A change that is still happening.
   *
   * Dragging writes on every pointer move and must not leave eighty entries in
   * the history for one gesture. The drag calls this while it runs and
   * `commit` once when the pointer comes up — so undo steps back over whole
   * gestures, which is what a designer means by "undo that move".
   */
  live(reason: string, mutate: (draft: SandboxState) => void): void {
    const draft = clone(this.state);
    mutate(draft);
    this.state = draft;
    this.emit(reason);
  }

  /** Opens a gesture: records where it started so `live` can be undone as one. */
  beginGesture(): void {
    this.past.push(clone(this.state));
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
  }

  undo(): boolean {
    const prev = this.past.pop();
    if (!prev) return false;
    this.future.push(clone(this.state));
    this.state = prev;
    this.emit('undo');
    return true;
  }

  redo(): boolean {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(clone(this.state));
    this.state = next;
    this.emit('redo');
    return true;
  }

  /**
   * A new document: state and history both gone.
   *
   * Distinct from `reset`, and the difference matters. Reset is an edit — it
   * undoes to the redesign you had. This is changing page, where the previous
   * page's history describes ids that no longer exist, so keeping it would
   * offer an undo that reaches into a document the designer has left.
   */
  clear(): void {
    this.state = emptyState();
    this.past = [];
    this.future = [];
    this.emit('clear');
  }

  /** Back to the portfolio as it ships. Undoable, like everything else. */
  reset(): void {
    this.commit('reset', (draft) => {
      draft.overrides = {};
      draft.addedOrder = [];
    });
  }

  /** Read one node's overrides without being able to write them by accident. */
  propsOf(id: string): Props {
    return this.state.overrides[id] ?? {};
  }

  /** The single call every property control makes. */
  set(id: string, patch: Props, reason = 'set', live = false): void {
    const apply = (draft: SandboxState): void => {
      draft.overrides[id] = { ...(draft.overrides[id] ?? {}), ...patch };
    };
    if (live) this.live(reason, apply);
    else this.commit(reason, apply);
  }
}

/** Which properties a type is allowed to have, re-exported for convenience. */
export type { ClubType };
