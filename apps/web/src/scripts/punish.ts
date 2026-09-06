/**
 * A small consequence for an action the interface refused.
 *
 * The character behind designer mode is notionally watching, and when something
 * is submitted that cannot be accepted he takes it out on the pointer: a couple
 * of purple arcs, a shake of about a fifth of a second, and gone. It is a
 * personality layer and nothing else — the real error message, the field state
 * and everything a screen reader is told all happen exactly as before, and this
 * is on top.
 *
 * Only for a genuine refusal. Not a hover, not an ordinary press, not a
 * successful send, and not every keystroke that fails a check while it is still
 * being typed.
 */
import * as sound from './designer-sound';

/** How long the whole thing lasts, matched to the CSS below. */
export const PUNISH_MS = 380;

/*
 * Whether there is a drawn pointer to punish.
 *
 * The class the pointer sets on <html> when it takes over from the native
 * cursor, rather than the media query it consults before deciding to. They
 * usually agree, and when they do not it is the class that is true: a desktop
 * visitor whose pointer never started — reduced motion, or the script not
 * arriving — would otherwise be sent a punishment that nothing is listening
 * for, and get no answer at all to an action that was refused.
 */
const drawnPointer = () => document.documentElement.classList.contains('has-custom-cursor');
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Punishes the pointer, or the control that was pressed where there is none.
 *
 * The real cursor cannot be moved by a page, and should not be — so what shakes
 * is the pointer this site already draws, which is tracking the mouse anyway.
 * Nothing new is measured and nothing new runs between punishments.
 *
 * On a touch screen there is no pointer to punish, so the control that refused
 * takes it instead: the same arcs, the same shake, the same length.
 */
export function punish(target?: Element | null): void {
  const shakes = !reduced();

  if (drawnPointer()) {
    document.dispatchEvent(new CustomEvent('mh:punish', { detail: { shakes } }));
  } else if (target instanceof HTMLElement) {
    target.classList.remove('is-punished');
    // Flushed, so a second refusal restarts the animation rather than being
    // swallowed by the one still running.
    void target.offsetWidth;
    target.classList.add('is-punished');
    window.setTimeout(() => target.classList.remove('is-punished'), PUNISH_MS + 60);
  }

  /*
   * The sound is the storm's own strike, at a fraction of its level.
   *
   * Only when the page is already making sound: opening an audio device
   * because someone left a field empty would be a strange thing to do, and the
   * autoplay policy would refuse it as often as not. And never when the storm
   * has been muted — the mute is about this site's electricity, and this is
   * some of it.
   */
  if (!sound.isMuted()) sound.spark(0.1);
}
