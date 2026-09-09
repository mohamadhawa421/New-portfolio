/**
 * The sound designer mode makes.
 *
 * Three elements, chosen by ear, and two of them are the same recording:
 *
 *   the wave    a cinematic shockwave — a sub drop with a long body of air
 *               falling away behind it. It is the launch, and then it is the
 *               freeze, because time closing around a blast is that same blast
 *               slowed, not a second sound laid over it.
 *   the strike  a sputtering arc, fired by the field rather than by the clock,
 *               so the strikes fall where the lightning is actually drawn and
 *               no two activations are alike.
 *   the rewind  the wave again, backwards and accelerating. Reversed, its tail
 *               becomes a rise and its transient comes last, so the crack lands
 *               as the final pieces settle.
 *
 * Synthesised sample by sample rather than sampled: no audio file in the build,
 * nothing to license, and the whole layer costs about 150k floats generated
 * once, on the click that asks for it.
 *
 * Every instant is derived from the beat designer-mode publishes and scheduled
 * in one pass on the audio clock — sample-accurate, and immune to whatever the
 * main thread is doing while the storm runs.
 */

type Ctx = AudioContext & { mhNoise?: AudioBuffer };

/**
 * The instants this needs. Structurally a subset of the Beat designer-mode
 * publishes, and deliberately not all of it: the phone's extra act, where the
 * sidebar is dragged out and resists, has no sound of its own. The blast is
 * already slowing across exactly that window, and the three elements chosen for
 * this — the wave, the strike, the rewind — do not include a fourth.
 */
export interface SoundBeat {
  freeze: number;
  decay: number;
  drift: number;
  /**
   * The frame the first piece turns for home, and the frame the last one lands.
   *
   * The rewind is written across exactly this window and nothing else decides
   * it. Before these existed the sound was hung off `drift`, which used to be
   * when the picture released everything — and when the picture stopped
   * releasing everything at once, the swell started a second and a half after
   * the first piece was already on its way back and the crack landed two
   * seconds after the last one had arrived.
   */
  homeward: number;
  landed: number;
  done: number;
}

export interface SoundShape {
  wave: number;
  fieldDecay: number;
  /** How long the pressure is felt before the force lands. */
  preload: number;
}

/**
 * Peak level on the site.
 *
 * Halved from where the audition left it. The sequence opens on a transient
 * that is deliberately the sharpest thing in it, and at the old level that
 * arrived as a shock rather than as a shockwave — an easter egg should not
 * make anyone put the laptop down. This puts the launch near -13dBFS and the
 * held field around -25, which is present without being startling.
 */
const LEVEL = 0.25;

/**
 * How far time slows once the field takes hold.
 *
 * Not a taste setting — it is fixed by where the wave has got to by the time
 * the picture stops. At the freeze the playhead sits about 0.47s into a 2.6s
 * blast, and the body of air there has closed to roughly 3.9kHz. Playing that
 * back at this rate lands it near 465Hz: low enough to read as time stopping,
 * high enough to still be a sound on a laptop speaker rather than a rumble.
 *
 * Slower drops it under the speaker; faster and the freeze does not read as a
 * freeze. The wave is nowhere near running out either way — across the whole
 * hold it spends about 0.75 seconds of the 2.6 it has.
 */
const FREEZE_RATE = 0.12;

/**
 * The shockwave's length, and the reason it is this long.
 *
 * The launch only ever uses the front of it, and the freeze creeps through the
 * next half second — so the rest exists for the rewind, which has to cross the
 * whole window the pieces take to come home. At 2.6 seconds there was not
 * enough material to do that at any speed worth calling a rewind: spreading a
 * short buffer over a long window forces the playback rate down, and the
 * restoration came out slower than real time. Four seconds of blast is what
 * lets the way back run faster than the way out.
 */
const WAVE_SECONDS = 4;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
/**
 * The mute gate, and the last thing before the speakers.
 *
 * A separate node rather than turning `master` down, because master carries the
 * sequence's own automation — it is set to LEVEL at the launch and ramped away
 * by end(). Muting by writing to that param would cancel the schedule, and
 * unmuting would then have to guess what the level was supposed to be at that
 * instant. A gate multiplying the finished mix has nothing to guess: the
 * schedule runs underneath it either way, so lifting the gate mid-storm lands
 * on exactly the level the storm had reached.
 *
 * Only the storm passes through here. The characters' strikes go straight to
 * the output (see spark) and stay audible: this control is only on screen while
 * the egg is running, and a mute that outlived it would leave them silenced by
 * a switch the visitor can no longer see.
 */
let gate: GainNode | null = null;
/**
 * What the blast does to the listener, in two nodes.
 *
 * Everything the storm plays goes through these on its way to the gate, and
 * one thing deliberately does not: the ringing. A blast loud enough to ring
 * the ears does not get quieter along with everything else — it *is* what is
 * left when everything else goes away — so the ring is wired past both of
 * these straight to the gate, and these two take the rest of the mix down and
 * shut the top off it for half a second.
 *
 * `muffle` is a lowpass sitting wide open at rest. Ducking on its own reads as
 * the volume being turned down, which is a mixing decision the ear hears as
 * one; taking the top off at the same time reads as hearing that has been
 * briefly overloaded, which is the thing being described. The two together are
 * "distant", and neither on its own is.
 */
let muffle: BiquadFilterNode | null = null;
let duck: GainNode | null = null;
/** The ringing's own level, past the duck, so `end` can still find it. */
let ringBus: GainNode | null = null;
/** Strike level, automated across the run so the arcs follow the storm. */
let arcBus: GainNode | null = null;
let stopped = true;
let voices: AudioScheduledSourceNode[] = [];
let lastStrike = 0;
/** And the last tear, throttled separately — they are different rates. */
let lastTear = 0;
/** And the last one of the final glitch's, which throttles separately. */
let lastFault = 0;
/** And the last surface that answered the front. */
let lastMaterial = 0;
/** Whether the output device has been forced open yet. */
let opened = false;

/* ---------------------------------------------------------------------- */
/* Mute                                                                    */
/* ---------------------------------------------------------------------- */

/**
 * Session-scoped, like the theme and the intro curtain: a choice about this
 * visit rather than a setting. Someone who silenced the storm once does not
 * want it back on the second activation, and does not need it remembered next
 * week either.
 */
const MUTE_KEY = 'mh-egg-muted';

let muted = readMuted();

function readMuted(): boolean {
  try {
    return sessionStorage.getItem(MUTE_KEY) === '1';
  } catch {
    // Private mode or storage disabled. Sound on, which is the default.
    return false;
  }
}

let waveBuf: AudioBuffer | null = null;
let backBuf: AudioBuffer | null = null;
let strikeBuf: AudioBuffer | null = null;
let faultBuf: AudioBuffer | null = null;

function context(): Ctx | null {
  if (ctx) return ctx;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  try {
    ctx = new Ctor() as Ctx;
  } catch {
    // No output device, or the browser refused. Silence is a fine outcome.
    return null;
  }

  gate = ctx.createGain();
  // Whatever the visitor settled on earlier in the session, before a sample
  // plays — an unmute ramp on the first storm of a muted session would be the
  // one thing the mute was meant to prevent.
  gate.gain.value = muted ? 0 : 1;
  gate.connect(ctx.destination);

  duck = ctx.createGain();
  duck.gain.value = 1;
  duck.connect(gate);

  muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  // Above hearing at rest, so it is not a tone control — it does nothing at
  // all until the blast closes it.
  muffle.frequency.value = 20000;
  muffle.Q.value = 0.4;
  muffle.connect(duck);

  ringBus = ctx.createGain();
  ringBus.gain.value = 1;
  ringBus.connect(gate);

  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(muffle);

  arcBus = ctx.createGain();
  arcBus.gain.value = 1;
  arcBus.connect(master);

  watchDevice(ctx);

  return ctx;
}

/**
 * Safari lets go of the output, and does not say so.
 *
 * On macOS an AudioContext that has been open for a while — a tab left in the
 * background, the machine asleep, another app taking the device, a Bluetooth
 * output going away — is moved to `suspended` or to WebKit's own `interrupted`
 * state. Nothing throws and nothing logs: every source still starts, still
 * runs its envelope and still stops, into a context that is not advancing. The
 * site simply goes quiet, and stays quiet for the life of the tab, which is
 * why it looked like it needed the whole browser restarted.
 *
 * Nothing here creates a context or plays anything; it only asks a context we
 * already have to come back. `resume()` is allowed without a gesture when the
 * page is visible and focused, and the gesture listeners below are the fallback
 * for the case where it is not — they are passive, capture-phase and never
 * consume the event, so nothing else on the page notices them.
 */
function watchDevice(audio: Ctx): void {
  const revive = () => {
    if (!ctx || ctx !== audio) return;
    if (audio.state === 'running' || audio.state === 'closed') return;
    void audio.resume().catch(() => {
      // Not allowed yet. The next gesture will be.
    });
  };

  audio.addEventListener('statechange', () => {
    // Only when the page is in front: reviving a backgrounded tab's context is
    // both refused and the wrong thing to want.
    if (document.visibilityState === 'visible') revive();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') revive();
  });

  window.addEventListener('focus', revive);
  window.addEventListener('pageshow', revive);
  for (const type of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(type, revive, { passive: true, capture: true });
  }
}

/** Whether the storm is currently silenced. */
export function isMuted(): boolean {
  return muted;
}

/**
 * Silences or restores the storm, without touching what it is playing.
 *
 * Ramped over 120ms rather than set: a gain step lands on whatever part of a
 * waveform happens to be passing and that discontinuity is a click. Short
 * enough to read as instant, long enough to be inaudible as a move of its own.
 */
export function setMuted(next: boolean): void {
  muted = next;

  try {
    if (next) sessionStorage.setItem(MUTE_KEY, '1');
    else sessionStorage.removeItem(MUTE_KEY);
  } catch {
    // Not fatal — the choice simply does not outlive this page.
  }

  if (!ctx || !gate) return;
  const t = ctx.currentTime;
  gate.gain.cancelScheduledValues(t);
  gate.gain.setValueAtTime(gate.gain.value, t);
  gate.gain.linearRampToValueAtTime(next ? 0 : 1, t + 0.12);
}

/* ---------------------------------------------------------------------- */
/* Synthesis                                                               */
/* ---------------------------------------------------------------------- */

/**
 * A Chamberlin state-variable filter: two numbers of state, and a resonance
 * control a one-pole cannot give. Everything below is noise pushed through one
 * of these with the cutoff moving, which is what separates air from hiss.
 */
function svf(rate: number, q: number) {
  let low = 0;
  let band = 0;
  const ceiling = rate * 0.22;
  return (x: number, fc: number) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, ceiling)) / rate);
    low += f * band;
    const high = x - low - q * band;
    band += f * high;
    return { low, band };
  };
}

const fall = (k: number, p: number) => Math.pow(1 - k, p);

/**
 * The shockwave.
 *
 * A sub dropping from 88Hz, a wide body of air closing from 6.4kHz behind it,
 * and a resonant tail underneath. Deliberately bright: the freeze plays this
 * back at an eighth of its speed, and anything not brilliant to begin with
 * lands below hearing once it has been dropped that far.
 */
function makeWave(audio: BaseAudioContext): AudioBuffer {
  const sr = audio.sampleRate;
  const buffer = audio.createBuffer(1, Math.floor(sr * WAVE_SECONDS), sr);
  const d = buffer.getChannelData(0);
  const n = d.length;

  const air = svf(sr, 0.55);
  const tail = svf(sr, 1.4);
  let phase = 0;

  for (let i = 0; i < n; i += 1) {
    const k = i / n;
    const t = i / sr;

    const f = 88 * Math.pow(0.26, Math.min(1, t / 0.95));
    phase += (2 * Math.PI * f) / sr;
    const sub = Math.sin(phase) * fall(k, 0.85) * 1.25;

    const w = Math.random() * 2 - 1;
    const body = air(w, 6400 * Math.pow(0.05, k) + 140).low * fall(k, 1.7) * 1.25;
    const ring = tail(w, 320 + 900 * fall(k, 3)).band * fall(k, 1.2) * 0.45;
    const snap = t < 0.02 ? (Math.random() * 2 - 1) * (1 - t / 0.02) * 0.8 : 0;

    d[i] = Math.tanh((sub + body + ring + snap) * 1.1) * 0.92;
  }

  return buffer;
}

/** The same wave, back to front. Its transient ends up last. */
function reverse(audio: BaseAudioContext, src: AudioBuffer): AudioBuffer {
  const buffer = audio.createBuffer(1, src.length, audio.sampleRate);
  const d = buffer.getChannelData(0);
  const s = src.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = s[s.length - 1 - i];
  return buffer;
}

/**
 * The strike: an arc that keeps breaking and re-striking.
 *
 * The gate is what makes it electrical rather than a burst of noise — the
 * source cuts in and out every couple of milliseconds at random, which is how
 * an arc behaves and nothing like a filtered click.
 */
function makeStrike(audio: BaseAudioContext): AudioBuffer {
  const sr = audio.sampleRate;
  const buffer = audio.createBuffer(1, Math.floor(sr * 0.6), sr);
  const d = buffer.getChannelData(0);
  const n = d.length;

  const arc = svf(sr, 0.16);
  let gate = 0;

  for (let i = 0; i < n; i += 1) {
    const k = i / n;
    if (i % 90 === 0) gate = Math.random() < 0.62 ? 1 : 0.12;
    const w = (Math.random() * 2 - 1) * gate;
    d[i] = Math.tanh(arc(w, 3200 + Math.random() * 4200).band * fall(k, 2.2) * 2.4) * 0.85;
  }

  return buffer;
}

/**
 * The last failure, which is a different kind of failure.
 *
 * The tears that travel with the front are contacts arcing — the strike buffer
 * sped up, which is what an arc sounds like when there is no time for its
 * body. The one at the end is not an arc. Everything has landed, nothing is
 * moving, and what breaks up is the picture itself, so this is built to sound
 * like a signal rather than like a spark: a sharp dry transient and then a
 * couple of dozen milliseconds of quantised noise, dropping away steeply
 * enough that there is no tail to notice.
 *
 * The quantising is the whole character. The noise is sampled and held at
 * about five kilohertz and rounded to six bits before it is filtered, so what
 * comes out has the stepped, slightly metallic edge of something being decoded
 * badly — which is the sound of the same event the eye is being shown, and not
 * a second spark after the storm is over.
 */
function makeFault(audio: BaseAudioContext): AudioBuffer {
  const sr = audio.sampleRate;
  const buffer = audio.createBuffer(1, Math.floor(sr * 0.14), sr);
  const d = buffer.getChannelData(0);
  const n = d.length;

  const edge = svf(sr, 0.2);
  /** The rate it fails at, and the depth it fails to. */
  const hold = Math.max(4, Math.round(sr / 5200));
  const steps = Math.pow(2, 5);

  let held = 0;

  for (let i = 0; i < n; i += 1) {
    const k = i / n;
    if (i % hold === 0) held = Math.round((Math.random() * 2 - 1) * steps) / steps;

    /*
     * The transient, which is half a millisecond and no more.
     *
     * A crack has to arrive before anything is heard about it. Everything
     * after this is the recovery, and the recovery is the part that has to
     * stay small.
     */
    const hit = i < sr * 0.0012 ? 2.4 : 0;
    const body = edge(held, 2600 + 3800 * (1 - k)).band;

    /*
     * A steep decay and only as much saturation as the transient needs.
     *
     * The first shape here fell as the fifth power and was driven hard into
     * the tanh, and the two together flattened it: measured in five
     * millisecond blocks it lost three decibels over its first twenty, which
     * is a burst rather than a crack. At the seventh power and two-thirds of
     * the drive it loses eight over the same twenty, is twenty down by thirty
     * milliseconds and forty down by sixty — an attack, and then nothing.
     */
    d[i] = Math.tanh((body + hit) * fall(k, 7.2) * 2.2) * 0.9;
  }

  return buffer;
}

function build(audio: BaseAudioContext): void {
  if (waveBuf) return;
  waveBuf = makeWave(audio);
  backBuf = reverse(audio, waveBuf);
  strikeBuf = makeStrike(audio);
  faultBuf = makeFault(audio);
}

/**
 * Makes the buffers before anybody has touched anything.
 *
 * There is already a warm-up on hover — see `warm` below — and on a desktop
 * with a mouse it does the job: the pointer crosses the portrait long before
 * the press, and by the time the click lands there is nothing left to build.
 * Two cases never get it. A touch screen has no hover to speak of: pointerenter
 * fires as part of the tap itself, so the synthesis lands inside the same
 * gesture it was meant to precede. And a keyboard press never generates one at
 * all.
 *
 * It is worth removing from both. Measured on this page, building the four
 * buffers is about 75ms — a quarter of a million samples, each through a
 * state-variable filter — which at 60Hz is four and a half frames of nothing
 * happening between the press and the wave, landing on the one frame of the
 * whole sequence that most needs to be on time.
 *
 * Nothing about the sound changes. These are the same samples from the same
 * generators, made earlier.
 *
 * An OfflineAudioContext is used purely as a buffer factory, and that is the
 * difference between this and `warm`. Opening a real context is the right
 * thing to do on hover, where a press is plainly coming and the platform
 * should start finding an output device; doing it on a timer after page load,
 * for every visitor, most of whom will never click the portrait, is not. An
 * offline context asks for no device and starts no audio thread. AudioBuffers
 * are not bound to the context that made them, so these play on the real one
 * when it eventually arrives, and its rate need not match: a buffer carries
 * its own sampleRate and the source node resamples, so the pitch and the
 * length are what they were written to be. Every generator here derives its
 * coefficients from the rate it is handed.
 */
export function prime(): void {
  if (waveBuf) return;

  const Offline =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!Offline) return;

  try {
    build(new Offline(1, 1, 44100));
  } catch {
    // No offline context, or the rate was refused. Hover or the click will
    // build them, exactly as they did before this existed.
  }
}


/* ---------------------------------------------------------------------- */
/* Transport                                                               */
/* ---------------------------------------------------------------------- */

/**
 * Builds everything that can be built before anyone has committed to anything.
 *
 * Called on hover. A context created outside a gesture starts suspended, which
 * is fine — what matters is that it exists and that four seconds of blast have
 * already been synthesised, so the press that follows has nothing left to do
 * but resume.
 */
export function warm(): void {
  const audio = context();
  if (!audio) return;
  build(audio);
}

/**
 * Opens the audio device, inside the gesture that asked for it.
 *
 * Resuming is not enough on its own. A context that has never produced a sample
 * has not necessarily opened an output device, and opening one can take a
 * noticeable fraction of a second — which is heard as the sound arriving late
 * while the wave has already crossed the screen. Playing one silent sample
 * forces the device open now, on the press, rather than on the click.
 */
export function unlock(): void {
  const audio = context();
  if (!audio || !master) return;
  stopped = false;
  if (audio.state === 'suspended') void audio.resume();
  build(audio);

  if (opened) return;
  opened = true;
  const silence = audio.createBuffer(1, 1, audio.sampleRate);
  const src = audio.createBufferSource();
  src.buffer = silence;
  src.connect(master);
  src.start(0);
}

/** Fades out and lets everything ring off rather than cutting it. */
export function end(): void {
  if (!ctx || !master || stopped) return;
  stopped = true;

  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
  master.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

  /*
   * And the ring with it, because it is the one voice master does not carry.
   *
   * Also the duck and the muffle back to neutral: if the storm is cut off
   * between the blast and the recovery, whatever they were mid-ramp would
   * otherwise still be there the next time anything plays.
   */
  for (const node of [ringBus, duck]) {
    if (!node) continue;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(Math.max(node.gain.value, 0.0001), t);
    node.gain.exponentialRampToValueAtTime(node === duck ? 1 : 0.0001, t + 0.35);
  }
  if (muffle) {
    muffle.frequency.cancelScheduledValues(t);
    muffle.frequency.setValueAtTime(muffle.frequency.value, t);
    muffle.frequency.exponentialRampToValueAtTime(20000, t + 0.35);
  }

  // Stopped after the fade, never during it: cutting a voice mid-cycle is a
  // click, which is the one sound this layer is trying not to make.
  for (const voice of voices) {
    try {
      voice.stop(t + 0.4);
    } catch {
      // Already stopped, or never started.
    }
  }
  voices = [];
}

/**
 * A single strike, for something other than the storm.
 *
 * The characters use this — once as they arrive, once whenever they are asked
 * to say something else. Quieter and quicker than the field's own arcs, and
 * routed straight to the output rather than through the buses the sequence
 * automates, because those are ramped to nothing when the storm ends and
 * anything left on them would be silent for the rest of the visit.
 *
 * It refuses rather than builds. If the visitor has not pressed anything yet
 * there is no context to play through and no right to create one, so the
 * character simply arrives without a sound — which is the correct outcome, not
 * a degraded one. In practice the first press anywhere on the page has already
 * opened the device long before anyone scrolls this far.
 */
export function spark(level = 0.3): void {
  if (!ctx || ctx.state !== 'running' || !strikeBuf) return;

  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = strikeBuf;
  // Faster than the storm's, so it reads as a tick rather than a strike.
  src.playbackRate.value = 1.15 + Math.random() * 0.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);

  src.connect(gain).connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.4);
}

/**
 * The real thing: a crack and a roll behind it.
 *
 * spark() is a tick — right for a character arriving and for the small
 * punishments, and far too small for the moment he actually loses his temper.
 * This is the same two buffers the storm is built from, played the way weather
 * plays them: the arc slowed until it breaks rather than clicks, and the
 * shockwave stretched to a fifth of its speed under a lowpass that closes over
 * two seconds, which is what turns a bang into a rumble rolling away.
 *
 * Routed straight to the output like spark(), and refusing for the same reason
 * — if nothing has been pressed yet there is no device open and no right to
 * open one.
 */
export function thunder(level = 0.55): void {
  if (!ctx || ctx.state !== 'running' || !strikeBuf || !waveBuf) return;

  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = level;
  out.connect(ctx.destination);

  /*
   * The distance, which is the whole difference between a bang and thunder.
   *
   * A delay with its own lowpass inside the feedback path: each repeat is
   * darker and quieter than the one before it, which is what air does to sound
   * on the way back from whatever it bounced off. Without the filter in the
   * loop it is a slapback and it sounds like a room; with it, the tail rolls
   * away rather than repeating.
   */
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.34;
  const back = ctx.createGain();
  back.gain.value = 0.46;
  const dark = ctx.createBiquadFilter();
  dark.type = 'lowpass';
  dark.frequency.value = 620;
  const send = ctx.createGain();
  send.gain.value = 0.75;
  echo.connect(dark).connect(back).connect(echo);
  echo.connect(out);
  send.connect(echo);

  // The strike. Slow enough that the gaps in the arc are audible as breaks.
  const crack = ctx.createBufferSource();
  crack.buffer = strikeBuf;
  crack.playbackRate.value = 0.36 + Math.random() * 0.07;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(1, t);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  crack.connect(cg);
  cg.connect(out);
  cg.connect(send);
  crack.start(t);
  crack.stop(t + 1.4);

  /*
   * The roll. It arrives with the crack rather than after it — distance is
   * what separates the two in the sky, and this one is directly overhead — and
   * then takes three seconds to leave, with the lowpass closing the whole way
   * so it is losing its top end as it goes rather than simply getting quieter.
   */
  const roll = ctx.createBufferSource();
  roll.buffer = waveBuf;
  roll.playbackRate.value = 0.14;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1100, t);
  lp.frequency.exponentialRampToValueAtTime(140, t + 2.6);
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0.0001, t);
  rg.gain.exponentialRampToValueAtTime(0.95, t + 0.05);
  // Held most of the way out and then let go, rather than decaying from the
  // start: thunder does not fade evenly, it keeps arriving and then stops.
  rg.gain.exponentialRampToValueAtTime(0.34, t + 1.5);
  rg.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  roll.connect(lp).connect(rg);
  rg.connect(out);
  rg.connect(send);
  roll.start(t);
  roll.stop(t + 3.4);

  // The echo is let go of after the tail is inaudible, or the feedback loop
  // would sit in the graph for the rest of the visit going quietly round.
  window.setTimeout(() => {
    try {
      back.gain.value = 0;
      out.disconnect();
      echo.disconnect();
    } catch {
      // Already torn down with the context.
    }
  }, 5200);
}

/**
 * Tears the whole thing down, for a page that is going away.
 *
 * end() fades and lets the voices ring off, which is right when the sequence is
 * being dismissed and the page is staying. It is wrong when the document is
 * being replaced: a reload mid-storm left several seconds of scheduled blast
 * still queued on a context nothing was holding any more, and it played on
 * over the top of the new page. Sources scheduled into the future do not care
 * that the document that scheduled them is gone.
 *
 * So this stops rather than fades, and closes the context outright. Everything
 * is nulled behind it so that a page restored from the back-forward cache
 * builds a fresh one on the next press instead of reaching for a closed one.
 */
export function shutdown(): void {
  stopped = true;
  opened = false;

  for (const voice of voices) {
    try {
      voice.stop();
    } catch {
      // Already stopped, or never started.
    }
  }
  voices = [];

  const dying = ctx;
  ctx = null;
  master = null;
  gate = null;
  arcBus = null;
  waveBuf = null;
  backBuf = null;
  strikeBuf = null;

  if (dying && dying.state !== 'closed') void dying.close().catch(() => {});
}

/**
 * One strike, fired by the field each time it draws an arc.
 *
 * Split from the wave on purpose. The lightning is not on the clock: the field
 * decides when it reaches, and the gaps between reaches stretch from three
 * quarters of a second to three as the power goes. So the strikes land where
 * the picture actually draws them, in a different pattern every activation, and
 * each is pitched and weighted differently so a run never repeats itself.
 */
export function tick(strength = 1): void {
  const audio = context();
  if (!audio || !arcBus || !strikeBuf || stopped) return;

  const t = audio.currentTime;
  // Two arcs reported on one frame would stack into a single louder crack
  // rather than reading as two.
  if (t - lastStrike < 0.055) return;
  lastStrike = t;

  const src = audio.createBufferSource();
  src.buffer = strikeBuf;
  src.playbackRate.value = 0.82 + Math.random() * 0.5;

  /*
   * As loud as the arc is bright.
   *
   * It used to be a random 0.62 to 1.0, which meant a nearly invisible arc at
   * the end of the decay could crack louder than the first one out of the
   * character. The field passes in the alpha it is actually drawing with, so
   * the sound of a strike is the strike: full when the arc is, and a whisper
   * when it is a whisper. The remaining randomness is grain, not level.
   */
  const gain = audio.createGain();
  gain.gain.value = (0.78 + Math.random() * 0.22) * Math.max(0.05, Math.min(1, strength));

  src.connect(gain).connect(arcBus);
  src.start(t);
  src.stop(t + 0.9);
  voices.push(src);
}

/**
 * The screen tearing, heard.
 *
 * The picture's glitch is a display failing for four frames, so this is the
 * sound of a contact failing for the same four: the arc buffer, played at two
 * to three times its rate so the whole of its gated crackle lands inside a
 * tenth of a second, and high-passed so nothing of the arc's body comes with
 * it. What is left is the top of a spark and none of the thump — a tick, not
 * a crack.
 *
 * A sixth of the wave's level at its loudest, and less than a tenth at the
 * edges of the page, which is the whole brief for it: the tear is a detail on
 * the wave and the moment it can be listened to on its own it has stopped
 * being one.
 *
 * The picture already caps itself at twelve tears spread along the front, and
 * this refuses anything inside forty milliseconds of the last regardless — two
 * that land together are not two sounds, they are one louder one, and a run of
 * them is the machine-gun this effect fails as.
 */
export function crackle(strength = 1): void {
  const audio = context();
  if (!audio || !master || !strikeBuf || stopped) return;

  const t = audio.currentTime;
  if (t - lastTear < 0.04) return;
  lastTear = t;

  const src = audio.createBufferSource();
  src.buffer = strikeBuf;
  src.playbackRate.value = 2.1 + Math.random() * 0.9;

  /*
   * Nothing below three kilohertz.
   *
   * The arc buffer has a body to it because an arc does; a screen does not,
   * and left in, that body is what makes a glitch sound like a small
   * explosion. Twelve of them over half a second with any weight at all also
   * queue up behind the wave's own low end and turn the front to mud.
   */
  const air = audio.createBiquadFilter();
  air.type = 'highpass';
  air.frequency.value = 3000;
  air.Q.value = 0.7;

  const gain = audio.createGain();
  const level = 0.17 * Math.max(0.06, Math.min(1, strength));
  gain.gain.setValueAtTime(level, t);
  // Ninety milliseconds, ramped out rather than cut, so the tail is a
  // contact settling and not a gate closing.
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

  src.connect(air).connect(gain).connect(master);
  src.start(t);
  src.stop(t + 0.16);
  voices.push(src);
}

/**
 * A surface answering the front that just reached it.
 *
 * The quietest layer in the sequence and the most numerous, so its whole
 * design is about not being noticed individually. What it contributes is
 * grain: eight small material responses spread across the six hundred
 * milliseconds the pressure is building, each at the frame its own element
 * starts to rise, so the swell has things happening inside it rather than
 * being one smooth ramp.
 *
 * Weight decides the character, because that is what weight does. A chip
 * answers high and briefly — a light thing struck rings and stops — and a
 * full-width cover answers low and takes longer to give up, which is the same
 * distinction the picture is already drawing with `light` and `inertia`. The
 * numbers come straight off the element, so the two cannot disagree.
 *
 * `force` is the pressure left where it stands, so a surface at the edge of
 * the page is quieter than one under the click for the same reason it bends
 * less. Forty-five milliseconds of throttle: eight of these inside 600ms is
 * one every seventy-five at worst, and two that land together are one event.
 */
export function material(heft = 0, force = 1): void {
  const audio = context();
  if (!audio || !master || !strikeBuf || stopped) return;

  const t = audio.currentTime;
  if (t - lastMaterial < 0.045) return;
  lastMaterial = t;

  const weight = Math.max(0, Math.min(1, heft));

  const src = audio.createBufferSource();
  src.buffer = strikeBuf;
  // Heavy things are slower as well as lower: the same material read at a
  // different speed, rather than two different materials.
  src.playbackRate.value = (1.5 - weight * 0.95) * (0.92 + Math.random() * 0.16);

  const body = audio.createBiquadFilter();
  body.type = 'bandpass';
  body.frequency.value = 1400 - weight * 1140;
  body.Q.value = 1.6;

  const gain = audio.createGain();
  // A twentieth of the impact at its loudest. This is grain, not an event.
  const level = 0.055 * (0.35 + 0.65 * Math.max(0, Math.min(1, force)));
  const span = 0.09 + weight * 0.13;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(level, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + span);

  src.connect(body).connect(gain).connect(master);
  src.start(t);
  src.stop(t + span + 0.05);
  voices.push(src);
}

/**
 * The screen giving out one last time, heard.
 *
 * The same picture as the tear and a different sound on purpose, because it is
 * a different event: the tears are a front crossing things, this is the frame
 * itself failing once after everything has stopped. Its buffer is quantised
 * rather than arced (see makeFault) and it is played close to its own rate
 * rather than at two or three times it, so where the tear is a tick this is a
 * dry crack with a very short broken-up edge on it.
 *
 * Roughly a fifth of the impact, which puts it above the tears and a long way
 * under the wave. It can be the loudest thing in the room at the moment it
 * lands, because by then nothing else is playing — but the room by then is
 * nearly silent, and a fifth of the impact into silence is a detail, not an
 * event.
 *
 * Fifty milliseconds of throttle, because the final glitch scatters fourteen
 * elements across a hundred and ten and the portrait's own comes last: without
 * it this would be a burst of clicks where the picture is one failure.
 */
export function fault(strength = 1): void {
  const audio = context();
  if (!audio || !master || !faultBuf || stopped) return;

  const t = audio.currentTime;
  if (t - lastFault < 0.05) return;
  lastFault = t;

  const src = audio.createBufferSource();
  src.buffer = faultBuf;
  // A little either side of its own rate, so the repeats inside the scatter
  // are the same failure and not the same recording.
  src.playbackRate.value = 0.94 + Math.random() * 0.26;

  /*
   * Above fourteen hundred, which is a long way below the tear's cut.
   *
   * The tear is high-passed at three kilohertz to keep it off the wave's low
   * end; nothing is competing with this one, and taking that much out of it
   * would leave a hiss where the brief says a dry crack.
   */
  const air = audio.createBiquadFilter();
  air.type = 'highpass';
  air.frequency.value = 1400;
  air.Q.value = 0.6;

  const gain = audio.createGain();
  const level = 0.22 * Math.max(0.1, Math.min(1, strength));
  gain.gain.setValueAtTime(level, t);
  // The buffer's own decay has it near nothing by seventy milliseconds; this
  // is the guarantee that there is no tail at all by a hundred and ten.
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

  src.connect(air).connect(gain).connect(master);
  src.start(t);
  src.stop(t + 0.18);
  voices.push(src);
}

/**
 * Schedules the wave against the beat the picture is running.
 *
 * Placed in one pass, in absolute audio time. The only thing that happens
 * afterwards is the strikes, whose timing belongs to the field.
 */
export function play(beat: SoundBeat, shape: SoundShape): void {
  const audio = context();
  if (!audio || !master || !arcBus) return;

  stopped = false;
  if (audio.state === 'suspended') void audio.resume();
  build(audio);
  if (!waveBuf || !backBuf) return;

  const t0 = audio.currentTime;
  const at = (ms: number) => t0 + ms / 1000;

  const freeze = at(beat.freeze);
  const decay = at(beat.decay);
  const drift = at(beat.drift);

  /*
   * Set, not ramped.
   *
   * There was a twelve millisecond fade here, and an exponential fade from
   * 0.0001 is inaudible for most of its length — measured, the output did not
   * cross a fiftieth of full scale until 7.9ms in. Twelve milliseconds is
   * nothing to wait for, but it was eating the front of the transient, which is
   * the one part of this sound that has to be instant. Nothing is playing yet,
   * so there is no click to avoid.
   */
  master.gain.cancelScheduledValues(t0);
  master.gain.setValueAtTime(LEVEL, t0);

  /* ---- Contact: the instant something enters the system --------------- */

  /*
   * The click is not a click.
   *
   * Everything else here develops — the pressure swells, the front travels,
   * the blast decays. This is the only event in the sequence with no duration
   * worth speaking of, and it exists because the picture has one too: the
   * flash is up and gone in 240ms and the arcs start at the portrait on the
   * first frame. Without it the sound begins with a swell, and a swell that
   * begins from nothing reads as something approaching rather than as the
   * moment of contact.
   *
   * Two milliseconds of very high, very quiet spark, and a fifth of a second
   * of nothing underneath it before the pressure takes over. It is under the
   * threshold of being identified as its own sound and over the threshold of
   * being missed if it is removed.
   */
  if (strikeBuf) {
    const spark = audio.createBufferSource();
    spark.buffer = strikeBuf;
    spark.playbackRate.value = 3.4;

    const bright = audio.createBiquadFilter();
    bright.type = 'highpass';
    bright.frequency.value = 4200;
    bright.Q.value = 0.7;

    const sparkGain = audio.createGain();
    sparkGain.gain.setValueAtTime(0.3, t0);
    sparkGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);

    spark.connect(bright).connect(sparkGain).connect(master);
    spark.start(t0);
    spark.stop(t0 + 0.09);
    voices.push(spark);
  }

  /* ---- The pressure, ahead of the force ------------------------------ */

  /*
   * The woomph, and it is now the longest thing in the sequence before the
   * crack.
   *
   * What the picture does before the shatter has changed completely, so this
   * had to. It used to lift everything a tenth of a second before throwing it,
   * and the numbers here were written against that: a fall to 31Hz over 340ms,
   * gone by 420, stopped at 460. The picture now takes 610ms to get from the
   * front reaching a thing to the force breaking it — the swell rolls across
   * the page, every letter and control rises and comes all the way back down,
   * and only then is it struck. Against that timing the old envelope left
   * about 150ms of silence sitting exactly where the settle is, which is the
   * one stretch the eye is following most closely.
   *
   * So it is derived from the preload rather than written down: it covers the
   * whole swell and is still sounding when the blast cuts it off, whatever the
   * picture's timing is retuned to.
   *
   * The shape is the shape of what is seen. It lands hard — two milliseconds
   * of attack, because the front does not swell in, it arrives — and the pitch
   * falls the whole way, which is a mass being loaded. The level rises to its
   * peak a little under halfway, where the front is mid-page and the most
   * things are moving at once, then eases back as they settle, and is still at
   * two thirds when the crack takes it. It never quite gets quiet, because
   * nothing on screen is ever quite still in that window either.
   */
  const swell = shape.preload / 1000;

  const press = audio.createOscillator();
  press.type = 'sine';
  press.frequency.setValueAtTime(96, t0);
  press.frequency.exponentialRampToValueAtTime(29, t0 + swell);

  const pressGain = audio.createGain();
  pressGain.gain.setValueAtTime(0.0001, t0);
  pressGain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.002);
  // The front crossing: most things are in the air at once around here.
  pressGain.gain.exponentialRampToValueAtTime(0.62, t0 + swell * 0.44);
  // And easing off as they come back down, without ever going quiet.
  pressGain.gain.exponentialRampToValueAtTime(0.4, t0 + swell * 0.82);
  // Cut by the crack rather than finishing ahead of it.
  pressGain.gain.exponentialRampToValueAtTime(0.0001, t0 + swell + 0.05);

  press.connect(pressGain).connect(master);
  press.start(t0);
  press.stop(t0 + swell + 0.09);

  /*
   * The air moving with it, rather than a tone on its own — and it opens as
   * the front crosses.
   *
   * The filter used to sit at a fixed 420Hz for the whole thing, which is a
   * hiss laid over the groan. What is on screen is a front travelling outward,
   * so the air travels with it: the cutoff climbs while the wave is crossing
   * and closes again as things settle, which is the only part of this layer
   * the ear can actually localise in time. Its length comes off the preload
   * with everything else.
   */
  if (strikeBuf) {
    const air = audio.createBufferSource();
    air.buffer = strikeBuf;
    air.playbackRate.value = 0.17;

    const airLow = audio.createBiquadFilter();
    airLow.type = 'lowpass';
    airLow.frequency.setValueAtTime(300, t0);
    airLow.frequency.exponentialRampToValueAtTime(760, t0 + swell * 0.44);
    airLow.frequency.exponentialRampToValueAtTime(240, t0 + swell);

    const airGain = audio.createGain();
    airGain.gain.setValueAtTime(0.0001, t0);
    airGain.gain.exponentialRampToValueAtTime(0.26, t0 + 0.01);
    airGain.gain.exponentialRampToValueAtTime(0.14, t0 + swell * 0.7);
    airGain.gain.exponentialRampToValueAtTime(0.0001, t0 + swell + 0.04);

    air.connect(airLow).connect(airGain).connect(master);
    air.start(t0);
    air.stop(t0 + swell + 0.08);
  }

  /* ---- The ground, flexing under all of it ---------------------------- */

  /*
   * The sheet being displaced, which is a body and not a tone.
   *
   * The picture's bend runs for almost exactly the preload — 620ms of ridge
   * crossing against 610ms of swell — and it is the one part of the sequence
   * that had no sound at all. A pressure pulse moving under a surface is heard
   * as the surface's own resonance being pushed around: a narrow band, low,
   * that shifts upward as the ridge passes and falls away behind it.
   *
   * A bandpass on the arc buffer at a quarter speed rather than an oscillator,
   * because a pure tone here is a sci-fi warp and the whole point is that this
   * should not be identifiable. What comes through is a hundred and ten hertz
   * of moving noise: felt on anything with a woofer, and on a laptop speaker
   * mostly a change in the weight of the pressure it is already hearing.
   *
   * A fifth of the pressure's level. It is underneath the layer it belongs to,
   * not beside it.
   */
  if (strikeBuf) {
    const ground = audio.createBufferSource();
    ground.buffer = strikeBuf;
    ground.playbackRate.value = 0.25;

    const flex = audio.createBiquadFilter();
    flex.type = 'bandpass';
    flex.frequency.setValueAtTime(84, t0);
    flex.frequency.exponentialRampToValueAtTime(190, t0 + swell * 0.5);
    flex.frequency.exponentialRampToValueAtTime(70, t0 + swell);
    flex.Q.value = 3.2;

    const groundGain = audio.createGain();
    groundGain.gain.setValueAtTime(0.0001, t0);
    groundGain.gain.exponentialRampToValueAtTime(0.13, t0 + 0.06);
    groundGain.gain.exponentialRampToValueAtTime(0.09, t0 + swell * 0.62);
    groundGain.gain.exponentialRampToValueAtTime(0.0001, t0 + swell + 0.03);

    ground.connect(flex).connect(groundGain).connect(master);
    ground.start(t0);
    ground.stop(t0 + swell + 0.08);
    voices.push(ground);
  }

  /* ---- The wave, and time closing around it -------------------------- */

  /*
   * Started a preload late, so its transient is the force landing rather than
   * the pressure arriving. Every ramp below is written against absolute times
   * and so still lands where it always did — only the source moves.
   */
  const blastAt = at(shape.preload);

  const wave = audio.createBufferSource();
  wave.buffer = waveBuf;
  wave.playbackRate.setValueAtTime(1, blastAt);
  // Reaches the held rate on the exact frame everything stops moving.
  wave.playbackRate.exponentialRampToValueAtTime(FREEZE_RATE, freeze);

  /*
   * The freeze is quieter as well as slower.
   *
   * Held at full level the blast simply continued at the same weight, and the
   * moment time stopped did not read as a drop in energy at all — measured, the
   * launch and the hold came back within three per cent of each other. The
   * transient gets its first fifth of a second at full level, then the level
   * settles with the speed, so what is left during the suspension is a presence
   * rather than a roar.
   */
  const waveGain = audio.createGain();
  /*
   * The first fifty milliseconds are louder than the rest of the storm.
   *
   * The transient is the contact — it is the only part of this that arrives
   * rather than develops, and at a flat opening level it was the same weight
   * as the roar behind it. A third above, for as long as it takes to hear it
   * and no longer, is the difference between a loud sound and a hit.
   */
  waveGain.gain.setValueAtTime(1.35, blastAt);
  waveGain.gain.setValueAtTime(1.35, blastAt + 0.05);
  waveGain.gain.linearRampToValueAtTime(1, blastAt + 0.16);
  waveGain.gain.setValueAtTime(1, blastAt + 0.18);
  waveGain.gain.exponentialRampToValueAtTime(0.55, freeze);
  waveGain.gain.setValueAtTime(0.55, decay);
  /*
   * It drains from the instant the field starts losing power, but it is not cut
   * off at the handover — it fades a full second past it, underneath the rewind.
   *
   * The reversed wave opens on the blast's dying tail and creeps through it at a
   * quarter speed, so it takes about half a second to become substantial. Ending
   * the held sound the moment the rewind began left a hole right where the first
   * pieces are let go. Overlapping them reads as the frozen sound releasing into
   * the rewind rather than being replaced by it, which is what the picture does
   * too.
   */
  waveGain.gain.exponentialRampToValueAtTime(0.0001, drift + 1);

  wave.connect(waveGain).connect(master);
  wave.start(blastAt);
  wave.stop(drift + 1.2);

  /* ---- The break itself, in three pieces ------------------------------ */

  /*
   * The blast buffer is the body and the scale. It is not the break.
   *
   * What it has is weight — a sub drop with a long body of air falling away
   * behind it — and weight tells the ear the event was large. It does not tell
   * the ear that something *came apart*, because nothing in it has a hard edge.
   * That is what these two add, both landing on the same frame the wave does
   * and both an order of magnitude shorter than it, so the peak has an inside.
   *
   * The crack first: the arc buffer at four times its rate through a high
   * bandpass, which is thirty milliseconds of structural snap and no body at
   * all. It is the layer that survives a phone speaker, where the sub simply
   * does not exist, and it is the reason the event still reads as a break
   * there rather than as a thud.
   */
  if (strikeBuf) {
    const crack = audio.createBufferSource();
    crack.buffer = strikeBuf;
    crack.playbackRate.value = 4;

    const edge = audio.createBiquadFilter();
    edge.type = 'bandpass';
    edge.frequency.setValueAtTime(2600, blastAt);
    edge.frequency.exponentialRampToValueAtTime(5200, blastAt + 0.03);
    edge.Q.value = 0.9;

    const crackGain = audio.createGain();
    crackGain.gain.setValueAtTime(0.62, blastAt);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, blastAt + 0.075);

    crack.connect(edge).connect(crackGain).connect(master);
    crack.start(blastAt);
    crack.stop(blastAt + 0.12);
    voices.push(crack);

    /*
     * And then the debris, which is the only part of this that is allowed to
     * take its time.
     *
     * Everything is in the air for a second and a half after the break and the
     * mix went straight from the transient to the held freeze, which is an
     * edit rather than an event. This is the material still moving: the same
     * buffer at half speed with the top rolled off, opening a moment *after*
     * the crack — never with it, or it is part of the transient instead of the
     * thing the transient threw.
     *
     * A twelfth of the crack's level and four hundred milliseconds long. It
     * should be impossible to point at and obvious if it is gone.
     */
    const debris = audio.createBufferSource();
    debris.buffer = strikeBuf;
    debris.playbackRate.value = 0.55;

    const settle = audio.createBiquadFilter();
    settle.type = 'lowpass';
    settle.frequency.setValueAtTime(2400, blastAt + 0.05);
    settle.frequency.exponentialRampToValueAtTime(600, blastAt + 0.45);
    settle.Q.value = 0.5;

    const debrisGain = audio.createGain();
    debrisGain.gain.setValueAtTime(0.0001, blastAt + 0.05);
    debrisGain.gain.exponentialRampToValueAtTime(0.05, blastAt + 0.11);
    debrisGain.gain.exponentialRampToValueAtTime(0.0001, blastAt + 0.46);

    debris.connect(settle).connect(debrisGain).connect(master);
    debris.start(blastAt + 0.05);
    debris.stop(blastAt + 0.5);
    voices.push(debris);
  }

  /* ---- And what it does to the ears ----------------------------------- */

  /*
   * The room going away for half a second.
   *
   * This is not a tone laid over the impact, it is the impact taking the rest
   * of the mix with it. Three things happen within about thirty milliseconds
   * of the crack: a thin high ring appears, everything else drops to a third,
   * and the top comes off everything else. Then all three unwind over the next
   * six hundred milliseconds and the storm is simply there again, still
   * running, having never stopped.
   *
   * That last part is why the duck is a duck and not a pause. Nothing is cut,
   * nothing is rescheduled, and the wave's own automation underneath is
   * untouched — it is only being listened to through something for a moment.
   * If the ducking were removed the sequence would be exactly what it was.
   *
   * The ring is deliberately not a sine. Two of them a few hertz apart beat
   * against each other slowly, which is what stops it reading as a
   * notification: a single clean tone at this frequency is a beep, and two
   * that drift are a sensation.
   *
   * Neither is loud, and the level is set with a safety margin rather than by
   * ear: together they peak around 0.066 against a blast that peaks near 0.34,
   * and the ear is roughly ten decibels more sensitive at six kilohertz than
   * at one, so a number that looks conservative on a meter is not
   * automatically conservative in a pair of headphones. The storm ducked to a
   * third sits at about 0.10 underneath it, which is the balance this wants:
   * the ring is the clearest thing in the moment without being the loudest
   * thing in the sequence.
   */
  const RING_IN = 0.03;
  /**
   * How long the hearing takes to come back, and it is the only clock here.
   *
   * The ring's fall and the storm's return are both written across exactly
   * this, in opposite directions, so there is no second number that could
   * drift out of step with the first.
   */
  const RING_FADE = 1.6;
  /**
   * The shape of the hearing coming back, as a curve rather than a hold.
   *
   * The half-window of silence that used to be here made the recovery a second
   * event: nothing, then a crossfade. What is wanted is one movement — the
   * ring is alone at the instant it arrives and the world is already on its
   * way back by the time the ring has lost anything at all.
   *
   * So the return is front-loaded against the ring's own linear fall. Read
   * against how much ring is left: at three quarters the world is at 0.15, at
   * a half it is at 0.45, at a quarter it is at 0.8, and by a tenth it is
   * fully back with the ring still faintly there over the top of it. The gap
   * between the two curves is the whole illusion — hearing does not return in
   * proportion to the damage, it returns faster than the ringing leaves.
   */
  const RETURN: Array<[number, number]> = [
    [0, 0],
    [0.25, 0.15],
    [0.5, 0.45],
    [0.75, 0.8],
    [0.9, 1],
  ];

  if (ringBus && duck && muffle) {
    const ringAt = blastAt + RING_IN;

    for (const [hz, level] of [
      [8150, 0.056],
      [8221, 0.035],
    ] as const) {
      const tone = audio.createOscillator();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(hz, ringAt);
      /*
       * And never quite still, because a held pitch is electronic.
       *
       * Not one slide but four short ones in alternating directions, a few
       * hertz each and at uneven lengths. A single ramp is a glide, which is a
       * musical gesture; this is a pitch refusing to settle, which is what the
       * sensation actually does. Nothing in it is nameable as an interval.
       */
      tone.frequency.linearRampToValueAtTime(hz + 9, ringAt + RING_FADE * 0.21);
      tone.frequency.linearRampToValueAtTime(hz - 6, ringAt + RING_FADE * 0.47);
      tone.frequency.linearRampToValueAtTime(hz + 4, ringAt + RING_FADE * 0.74);
      tone.frequency.linearRampToValueAtTime(hz - 11, ringAt + RING_FADE);

      const toneGain = audio.createGain();
      toneGain.gain.setValueAtTime(0.0001, ringAt);
      // Faster in than anything else in the sequence: it is a consequence of
      // the transient, so it has to arrive inside it.
      toneGain.gain.exponentialRampToValueAtTime(level, ringAt + 0.015);
      /*
       * Straight down, the whole way, and nothing else.
       *
       * Linear rather than exponential, because an exponential is already
       * inaudible a third of the way down — which would put silence exactly
       * where the world is supposed to be coming back and turn one event into
       * two. A straight line keeps the ring present for the whole of its own
       * fade, which is what the return curve above is measured against: at
       * every instant, how much ring is left is simply how much of the window
       * is left.
       */
      toneGain.gain.linearRampToValueAtTime(0, ringAt + RING_FADE);

      tone.connect(toneGain).connect(ringBus);
      tone.start(ringAt);
      tone.stop(ringAt + RING_FADE + 0.05);
      voices.push(tone);
    }

    /*
     * Everything else, gone — and then coming back the whole way up.
     *
     * This went from a third, to a twelfth, to nothing at all, and nothing at
     * all is right. A third is a mixing decision and a twelfth is a quiet
     * mixing decision. What is being described is a blast that took somebody's
     * hearing for a second, and for that second there is nothing else to hear:
     * the ring is not sitting on top of the storm, it has replaced it.
     *
     * It leaves zero immediately and climbs the curve above, which is ahead of
     * the ring the whole way — so the world is audibly returning while the
     * ring is still the loudest thing, and is fully back before the ring has
     * quite gone. That lead is what makes it a recovery rather than a
     * crossfade between two effects.
     *
     * And it overshoots. Coming back to exactly 1 and stopping is a fader
     * being restored; going a little past and settling is a room arriving all
     * at once and then finding its level, which is what the ear expects after
     * it has been shut out of something loud. Twelve per cent, on a wave that
     * is well into its own decay by this point, so nothing peaks.
     *
     * Both of these are also written at t0, not only at the blast. `end` puts
     * them back but it ramps, and a storm torn down mid-dip would otherwise
     * leave the next one starting through a closed filter for whatever was
     * left of that ramp.
     */
    /*
     * The ring's own bus, put back before anything is scheduled on it.
     *
     * `end` fades this to nothing along with everything else, because the ring
     * does not pass through master and would otherwise outlive a storm that
     * was cut short. It never put it back — so the first activation on a page
     * rang and every one after it was silent, which is not a subtle failure
     * and was not caught because a second storm was never listened to.
     *
     * Every node this function touches is now restored here rather than in
     * `end`: whatever state the last run left, the next one starts from the
     * same place.
     */
    ringBus.gain.cancelScheduledValues(t0);
    ringBus.gain.setValueAtTime(1, t0);

    duck.gain.cancelScheduledValues(t0);
    duck.gain.setValueAtTime(1, t0);
    duck.gain.setValueAtTime(1, blastAt);
    duck.gain.linearRampToValueAtTime(0, ringAt + 0.02);
    for (const [at, level] of RETURN) {
      if (at === 0) continue;
      duck.gain.linearRampToValueAtTime(level, ringAt + RING_FADE * at);
    }
    // The brief heavy moment, and then its own level.
    duck.gain.linearRampToValueAtTime(1.12, ringAt + RING_FADE * 0.96);
    duck.gain.linearRampToValueAtTime(1, ringAt + RING_FADE * 1.25);

    /*
     * And the top comes off with it, and comes back sooner than the level.
     *
     * Hearing returning is not a fader being pushed up: the dullness lifts
     * first and the loudness follows it. So this reopens across three fifths
     * of the window while the gain takes all of it — what comes back first is
     * distant and dull, and it is bright again before it is loud again.
     *
     * It matters less than it did now the duck reaches zero, because at the
     * bottom there is nothing passing through it to be filtered. What this
     * shapes now is the return.
     */
    muffle.frequency.cancelScheduledValues(t0);
    muffle.frequency.setValueAtTime(20000, t0);
    muffle.frequency.setValueAtTime(20000, blastAt);
    muffle.frequency.exponentialRampToValueAtTime(700, ringAt + 0.025);
    muffle.frequency.exponentialRampToValueAtTime(20000, ringAt + RING_FADE * 0.8);
  }

  /* ---- The strikes' level, which follows the storm ------------------- */

  /*
   * Not their timing — the field owns that, and now their level mostly too:
   * each strike is scaled by the alpha the arc is drawn with, so the fade is
   * already in the sound.
   *
   * What is left here is a floor under that, and it runs the full length of the
   * decay rather than stopping at seven tenths of it. It used to end early on
   * purpose — sound gone before the picture finished dying — but the strikes
   * are fired from the draw itself now, so an arc that is still visible in the
   * last third would have been drawn in silence. The two ends have to be the
   * same end.
   */
  arcBus.gain.cancelScheduledValues(t0);
  arcBus.gain.setValueAtTime(1, t0);
  arcBus.gain.setValueAtTime(1, decay);
  arcBus.gain.exponentialRampToValueAtTime(0.0001, at(beat.decay + shape.fieldDecay));

  /* ---- The rewind ---------------------------------------------------- */

  /*
   * The same wave backwards, swelling across exactly the window the pieces use
   * to come home — and it has to consume exactly its own length in that window,
   * or it runs out early or is cut off mid-air.
   *
   * It starts part way in. Reversed, the buffer opens on what was the blast's
   * dying tail, which is very nearly silence — so the rewind was inaudible for
   * its first four hundred milliseconds, exactly while the first pieces were
   * being let go. Skipping that head means the swell is already underway on the
   * frame the picture starts moving.
   */
  const REWIND_SKIP = 0.8;

  /*
   * The window is the picture's, exactly: from the frame the first piece turns
   * for home to the frame the last one lands. Nothing here is a tail added by
   * hand — `done` is that landing plus its own quiet, and the crack falls on
   * the landing itself.
   */
  const homeward = at(beat.homeward);
  const span = Math.max(1.2, (beat.landed - beat.homeward) / 1000);

  const back = audio.createBufferSource();
  back.buffer = backBuf;
  // Three times the held rate: the frozen sound already moving again.
  back.playbackRate.setValueAtTime(FREEZE_RATE * 3, homeward);
  /*
   * And the end rate is arithmetic, not taste.
   *
   * For a rate ramping exponentially from a to b over W, the buffer consumed is
   * W(b - a) / ln(b / a). There are 3.2 seconds of buffer left once the silent
   * head is skipped, and the window is now 4.22 — so b is 1.4, which spends
   * 3.23 of them. At the 1.55 this used to be, against the old and longer
   * window, it would now overrun by a quarter of a second and be cut off
   * mid-air. It still ends above real speed, so the way back is quicker than
   * the way out and the reversed transient — the crack, which comes last —
   * lands with the pieces.
   */
  back.playbackRate.exponentialRampToValueAtTime(1.4, homeward + span);

  /*
   * The level rides the material rather than sitting flat on top of it.
   *
   * Even after the skip, the reversed wave opens on the quietest part of the
   * blast and creeps through it at a quarter speed, so a flat gain left a hole
   * of about four hundred milliseconds right where the first pieces are being
   * let go — measured at a fiftieth of the level either side of it. Lifting the
   * opening and easing back as the material grows keeps one continuous swell
   * from the instant the picture starts moving to the crack at the end.
   *
   * Opening from 0.05 rather than from nothing: an exponential ramp starting at
   * 0.0001 spends almost the whole of its length inaudible — a quarter of the
   * way to 2.2 it has reached 0.004 — so what was meant to be a fast lift was
   * in practice a second gap on top of the quiet material.
   */
  const backGain = audio.createGain();
  backGain.gain.setValueAtTime(0.05, homeward);
  backGain.gain.exponentialRampToValueAtTime(1.6, homeward + 0.5);
  backGain.gain.exponentialRampToValueAtTime(1, homeward + span * 0.62);
  backGain.gain.setValueAtTime(1, homeward + span * 0.88);
  backGain.gain.exponentialRampToValueAtTime(0.0001, homeward + span + 0.5);

  back.connect(backGain).connect(master);
  back.start(homeward, REWIND_SKIP);
  back.stop(homeward + span + 0.7);

  voices = voices.concat([wave, back]);
}
