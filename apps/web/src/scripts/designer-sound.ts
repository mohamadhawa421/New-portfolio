/**
 * The sound designer mode makes.
 *
 * Synthesised rather than sampled: the whole layer is one voice, a crack, a
 * breath of air, a spark and a sigh, and shapes that short cost nothing to
 * generate and nothing to download. There is no audio file in the build.
 *
 * Restrained, but not inaudible — and the first version was inaudible.
 *
 * It was built almost entirely below 100Hz: a voice settling at 52Hz and
 * falling to 28, held around -29dBFS. That is a band a laptop speaker does not
 * reproduce at all, so on the machine most visitors are using, an easter egg
 * with a full sound design made no sound whatsoever. Rendering it offline and
 * measuring only what survives a 200Hz highpass is what showed it.
 *
 * The shape is unchanged; where the energy sits is not. The filter over the
 * held voice opens far enough to let a dozen harmonics through, the air moved
 * up into the band small speakers are best at, and the sigh came up out of the
 * sub. Peak is now around -10dBFS on a 150ms transient at the launch, the held
 * field sits near -25, and the last thing that happens is still the quietest.
 * Loud enough to be there, quiet enough to ignore.
 *
 * The context is created on the click that starts the sequence and never
 * before, which is both the autoplay policy and the right manners: nothing on
 * this site makes a noise until someone has asked it to.
 *
 * ---------------------------------------------------------------------------
 *
 * One piece, not five cues.
 *
 * The old version fired a swell, then some ticks, then a sigh on a timer of its
 * own — a release at 2500ms against a decay that begins at 2400 is a
 * coincidence, not an arrangement — and then stopped, leaving five more seconds
 * of storm to play out in silence. Every instant here is instead derived from
 * the same beat the picture runs on, and scheduled in one pass on the audio
 * clock, which is sample-accurate and does not drift the way a setTimeout does.
 *
 * The five phases are one continuous gesture rather than five sounds:
 *
 *   launch    a crack, and a voice at 210Hz — concentrated power let go
 *   crossing  that same voice falling and closing as the edge crosses and slows
 *   held      it settles at 52Hz and stays: the field, with air over it
 *   arcs      a spark each time the field draws one, through a bus that follows
 *             the storm's own strength, so they thin out as it does
 *   release   the voice drains on exactly the curve the field drains on, and a
 *             sigh as the first pieces are let go
 *
 * Nothing ends on a bang. The last thing that happens is the quietest.
 */

type Ctx = AudioContext & { mhNoise?: AudioBuffer };

/** The instants this needs. Structurally the Beat designer-mode publishes. */
export interface SoundBeat {
  /** Mobile only: the sidebar is grabbed and starts resisting. */
  fight?: number;
  /** Everything stops at once and the field comes up. */
  freeze: number;
  /** The power starts running out. */
  decay: number;
  /** Pieces begin drifting home. */
  drift: number;
  /** Nothing is left. */
  done: number;
}

export interface SoundShape {
  /** How long the leading edge takes to cross the viewport. */
  wave: number;
  /** How long the field takes to exhaust itself once it starts. */
  fieldDecay: number;
}

/** TEMPORARY — remove with the diagnostic in play(). */
function report(message: string): void {
  console.info(`[designer sound] ${message}`);
  document.dispatchEvent(new CustomEvent('mh:sound-report', { detail: message }));
}

/**
 * TEMPORARY. A plain loud beep, to tell "this machine plays Web Audio" apart
 * from "the egg's sound is too quiet to notice". Nothing else uses it.
 */
export function testTone(): void {
  const audio = context();
  if (!audio || !master) {
    report('test tone: no context');
    return;
  }
  if (audio.state === 'suspended') void audio.resume();

  const t = audio.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(1, t);

  const osc = audio.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 440;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.5);
  report(`test tone: state=${audio.state} rate=${audio.sampleRate}`);
}

let ctx: Ctx | null = null;
let master: GainNode | null = null;
/** Spark level, automated across the sequence so ticks follow the storm. */
let arcBus: GainNode | null = null;
let stopped = true;
/** Everything scheduled by the current run, so end() can cut it short. */
let voices: AudioScheduledSourceNode[] = [];
/** Guards the spark against a burst of arcs landing on the same frame. */
let lastTick = 0;

function context(): Ctx | null {
  if (ctx) return ctx;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  try {
    ctx = new Ctor() as Ctx;
  } catch {
    // No output device, or the browser refused. The sequence is silent, which
    // is a perfectly good outcome.
    return null;
  }

  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  arcBus = ctx.createGain();
  arcBus.gain.value = 1;
  arcBus.connect(master);

  return ctx;
}

/** A second of noise, made once and reused by the crack, the air and the ticks. */
function noiseBuffer(audio: Ctx): AudioBuffer {
  if (audio.mhNoise) return audio.mhNoise;
  const buffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  audio.mhNoise = buffer;
  return buffer;
}

/**
 * Creates the context, inside the gesture that asked for it.
 *
 * Separate from play() because unlocking audio and starting the piece are two
 * different things: this has to happen in the click handler itself, while the
 * piece wants to begin from its own clock a moment later.
 */
export function unlock(): void {
  const audio = context();
  if (!audio) return;
  stopped = false;
  if (audio.state === 'suspended') void audio.resume();
}

/** Fades out and lets everything ring off rather than cutting it. */
export function end(): void {
  if (!ctx || !master || stopped) return;
  stopped = true;

  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
  master.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

  // Stopped after the fade, not during it: cutting a voice mid-cycle is a
  // click, which is the one sound this whole layer is trying not to make.
  for (const voice of voices) {
    try {
      voice.stop(t + 0.4);
    } catch {
      // Already stopped, or never started. Either way there is nothing to do.
    }
  }
  voices = [];
}

/**
 * One spark. Fired from the field each time it draws an arc.
 *
 * The field already paces these — one per arc, and the gaps stretch from three
 * quarters of a second to three as the power goes — so this only has to refuse
 * the pathological case of two landing on the same frame. Everything else about
 * how often they happen, and how loud they are by then, is decided by the
 * picture and by the bus they run through.
 */
export function tick(): void {
  const audio = context();
  if (!audio || !arcBus || stopped) return;

  const t = audio.currentTime;
  if (t - lastTick < 0.055) return;
  lastTick = t;

  const src = audio.createBufferSource();
  src.buffer = noiseBuffer(audio);
  src.playbackRate.value = 0.8 + Math.random() * 0.6;

  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2600 + Math.random() * 3200;
  filter.Q.value = 9;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.03 + Math.random() * 0.02, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.05);

  src.connect(filter).connect(gain).connect(arcBus);
  src.start(t);
  src.stop(t + 0.16);
}

/**
 * Schedules the whole sequence against the beat the picture is running.
 *
 * Everything below is placed in one pass, in absolute audio time, so the sound
 * cannot drift from the visuals no matter what the main thread is doing. The
 * only thing that happens afterwards is the sparks, which are the one part
 * whose timing genuinely belongs to the picture.
 */
export function play(beat: SoundBeat, shape: SoundShape): void {
  const audio = context();
  if (!audio || !master || !arcBus) {
    report('no audio context — Web Audio unavailable or refused');
    return;
  }

  stopped = false;
  if (audio.state === 'suspended') void audio.resume();

  /*
   * TEMPORARY. Reports why nothing was heard, if nothing was heard.
   *
   * The sequence renders correctly offline — measured, phase by phase — and is
   * still silent on a real machine, which means the fault is in the live
   * context rather than in the schedule. This says which.
   */
  report(`state=${audio.state} rate=${audio.sampleRate} t0=${audio.currentTime.toFixed(3)}`);
  window.setTimeout(() => {
    report(
      `+300ms state=${audio.state} t=${audio.currentTime.toFixed(3)} ` +
        `master=${master!.gain.value.toFixed(4)}`
    );
  }, 300);

  const t0 = audio.currentTime;
  /** An instant from the beat, in audio time. */
  const at = (ms: number) => t0 + ms / 1000;

  const freeze = at(beat.freeze);
  const decay = at(beat.decay);
  const drift = at(beat.drift);
  const crossed = at(shape.wave);
  /** The moment the field is spent. The same instant the picture goes dark. */
  const spent = at(beat.decay + shape.fieldDecay);

  // The gate. Fast, because the first thing through it is a transient and a
  // 80ms ramp would take the edge off the one moment that needs an edge.
  master.gain.cancelScheduledValues(t0);
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(1, t0 + 0.015);

  /* ---- The voice ----------------------------------------------------- */

  /*
   * Launch, crossing and hold are one oscillator, because they are one event.
   *
   * It leaves at 210Hz with a bright filter and falls the whole way down as the
   * edge crosses the screen and slows, arriving at 52Hz by the freeze — where
   * it stops falling and simply holds, which is the field. Cross-fading three
   * separate voices to do this would put two seams in the one gesture that must
   * not have any.
   */
  const body = audio.createOscillator();
  body.type = 'sawtooth';
  body.frequency.setValueAtTime(210, t0);
  body.frequency.exponentialRampToValueAtTime(96, crossed);
  body.frequency.exponentialRampToValueAtTime(52, freeze);
  body.frequency.setValueAtTime(52, decay);
  body.frequency.exponentialRampToValueAtTime(28, spent);

  const tone = audio.createBiquadFilter();
  tone.type = 'lowpass';
  tone.Q.value = 4;
  tone.frequency.setValueAtTime(2600, t0);
  tone.frequency.exponentialRampToValueAtTime(900, crossed);
  tone.frequency.exponentialRampToValueAtTime(820, freeze);
  tone.frequency.setValueAtTime(820, decay);
  tone.frequency.exponentialRampToValueAtTime(220, spent);

  const bodyGain = audio.createGain();
  bodyGain.gain.setValueAtTime(0.0001, t0);
  // The surge. Everything after this is the sound of it being spent.
  bodyGain.gain.exponentialRampToValueAtTime(0.17, t0 + 0.03);
  bodyGain.gain.exponentialRampToValueAtTime(0.08, crossed);
  bodyGain.gain.exponentialRampToValueAtTime(0.055, freeze);
  bodyGain.gain.setValueAtTime(0.055, decay);
  // Drains on exactly the curve the field drains on.
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, spent);

  /*
   * Two modulations, and neither is a note.
   *
   * A fast wobble on the filter reads as current — the field being unstable
   * rather than sustained — and a slow one on the level makes it breathe, so it
   * is something being held rather than something being played. Both are small
   * enough that they are only audible as texture.
   */
  const flutter = audio.createOscillator();
  flutter.type = 'sine';
  flutter.frequency.value = 6.5;
  const flutterDepth = audio.createGain();
  flutterDepth.gain.value = 80;
  flutter.connect(flutterDepth).connect(tone.frequency);

  const breathe = audio.createOscillator();
  breathe.type = 'sine';
  breathe.frequency.value = 0.33;
  const breatheDepth = audio.createGain();
  breathe.connect(breatheDepth).connect(bodyGain.gain);

  /*
   * The breath has to be taken away as well, or the field never stops.
   *
   * An oscillator wired to a gain param sums with that param rather than
   * scaling it, so the ramp to silence above only moves the middle of the
   * wobble: rendering this offline showed the voice still pulsing at 0.006
   * every three seconds, long after the picture had gone dark, right through
   * the settling and out to the end. Silence has to be scheduled on the depth
   * too. Linear, because a ramp to nothing cannot be exponential.
   */
  breatheDepth.gain.setValueAtTime(0.012, t0);
  breatheDepth.gain.setValueAtTime(0.012, decay);
  breatheDepth.gain.linearRampToValueAtTime(0, spent);

  body.connect(tone).connect(bodyGain).connect(master);

  /* ---- The crack ----------------------------------------------------- */

  /*
   * The transient the voice cannot supply on its own. Filtered noise falling
   * from 3800 to 1400 in a seventh of a second: short, sharp, and over before
   * the eye has finished registering that the wave has left.
   */
  const crack = audio.createBufferSource();
  crack.buffer = noiseBuffer(audio);

  const crackTone = audio.createBiquadFilter();
  crackTone.type = 'bandpass';
  crackTone.Q.value = 1.2;
  crackTone.frequency.setValueAtTime(3800, t0);
  crackTone.frequency.exponentialRampToValueAtTime(1400, t0 + 0.14);

  const crackGain = audio.createGain();
  crackGain.gain.setValueAtTime(0.0001, t0);
  crackGain.gain.exponentialRampToValueAtTime(0.13, t0 + 0.006);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);

  crack.connect(crackTone).connect(crackGain).connect(master);

  /* ---- The air ------------------------------------------------------- */

  /*
   * What makes the hold atmospheric rather than merely low. A wide, quiet band
   * of noise that arrives just before everything stops and leaves as the power
   * does — the room the field is standing in.
   */
  const air = audio.createBufferSource();
  air.buffer = noiseBuffer(audio);
  air.loop = true;

  const airTone = audio.createBiquadFilter();
  airTone.type = 'bandpass';
  airTone.frequency.value = 1300;
  airTone.Q.value = 0.5;

  const airGain = audio.createGain();
  airGain.gain.setValueAtTime(0.0001, t0);
  airGain.gain.exponentialRampToValueAtTime(0.022, freeze);
  airGain.gain.setValueAtTime(0.022, decay);
  // Out slightly ahead of the voice, so the last thing left is the low end.
  airGain.gain.exponentialRampToValueAtTime(0.0001, at(beat.decay + shape.fieldDecay * 0.8));

  air.connect(airTone).connect(airGain).connect(master);

  /* ---- The sparks ---------------------------------------------------- */

  /*
   * The bus every arc runs through, so their loudness is not a per-spark
   * decision. It holds while the field does and is gone before the field
   * finishes dying — which matches the picture, where the long reaches out of
   * the character are the first thing the storm cannot afford any more.
   */
  arcBus.gain.cancelScheduledValues(t0);
  arcBus.gain.setValueAtTime(1, t0);
  arcBus.gain.setValueAtTime(1, decay);
  arcBus.gain.exponentialRampToValueAtTime(0.0001, at(beat.decay + shape.fieldDecay * 0.75));

  /* ---- The release --------------------------------------------------- */

  /*
   * A sigh as the first pieces are let go, not a bang as the storm ends. It
   * sits on `drift`, which is the instant the picture releases them, and it is
   * quieter than the launch by a factor of two and a half.
   */
  const sigh = audio.createOscillator();
  sigh.type = 'sine';
  sigh.frequency.setValueAtTime(260, drift);
  sigh.frequency.exponentialRampToValueAtTime(70, drift + 0.9);

  const sighGain = audio.createGain();
  sighGain.gain.setValueAtTime(0.0001, drift);
  sighGain.gain.exponentialRampToValueAtTime(0.07, drift + 0.06);
  sighGain.gain.exponentialRampToValueAtTime(0.0001, drift + 0.9);

  sigh.connect(sighGain).connect(master);

  /* ---- The fight, on a phone only ------------------------------------ */

  /*
   * The strain of something being pulled that does not want to go. It runs for
   * exactly as long as the sidebar resists — from the grab to the freeze — so
   * it ends on the same frame the fight is lost rather than on a duration
   * written down separately and hoped for.
   */
  if (beat.fight != null) {
    const from = at(beat.fight);
    const held = (beat.freeze - beat.fight) / 1000;

    const strain = audio.createOscillator();
    strain.type = 'triangle';
    strain.frequency.setValueAtTime(74, from);
    strain.frequency.linearRampToValueAtTime(126, from + held);

    const wobble = audio.createOscillator();
    wobble.type = 'sine';
    wobble.frequency.value = 7.5;
    const wobbleDepth = audio.createGain();
    wobbleDepth.gain.value = 9;
    wobble.connect(wobbleDepth).connect(strain.frequency);

    const strainTone = audio.createBiquadFilter();
    strainTone.type = 'lowpass';
    strainTone.frequency.value = 900;

    const strainGain = audio.createGain();
    strainGain.gain.setValueAtTime(0.0001, from);
    strainGain.gain.exponentialRampToValueAtTime(0.06, from + 0.18);
    strainGain.gain.setValueAtTime(0.06, from + held - 0.12);
    strainGain.gain.exponentialRampToValueAtTime(0.0001, from + held);

    strain.connect(strainTone).connect(strainGain).connect(master);

    strain.start(from);
    wobble.start(from);
    strain.stop(from + held + 0.05);
    wobble.stop(from + held + 0.05);
    voices.push(strain, wobble);
  }

  /* ---- Start, and hand every voice an end ---------------------------- */

  const finish = at(beat.done);

  body.start(t0);
  flutter.start(t0);
  breathe.start(t0);
  crack.start(t0);
  air.start(t0);
  sigh.start(drift);

  body.stop(finish);
  flutter.stop(finish);
  breathe.stop(finish);
  crack.stop(t0 + 0.2);
  air.stop(finish);
  sigh.stop(drift + 1);

  voices = voices.concat([body, flutter, breathe, crack, air, sigh]);
}
