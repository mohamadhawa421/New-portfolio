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

/** The instants this needs. Structurally the Beat designer-mode publishes. */
export interface SoundBeat {
  fight?: number;
  freeze: number;
  decay: number;
  drift: number;
  done: number;
}

export interface SoundShape {
  wave: number;
  fieldDecay: number;
}

/** Peak level on the site. */
const LEVEL = 0.5;

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
/** Strike level, automated across the run so the arcs follow the storm. */
let arcBus: GainNode | null = null;
let stopped = true;
let voices: AudioScheduledSourceNode[] = [];
let lastStrike = 0;
/** Whether the output device has been forced open yet. */
let opened = false;

/* --- TEMPORARY, for ?sound-check. Removed once the delay is understood. --- */
let probe: AnalyserNode | null = null;

/** An analyser on the master bus, so the page can time its own first sample. */
export function probeNode(): AnalyserNode | null {
  const audio = context();
  if (!audio || !master) return null;
  if (!probe) {
    probe = audio.createAnalyser();
    probe.fftSize = 512;
    master.connect(probe);
  }
  return probe;
}

/** What the audio pipeline says about itself, at the moment of asking. */
export function stats(): Record<string, unknown> | null {
  if (!ctx) return null;
  return {
    state: ctx.state,
    rate: ctx.sampleRate,
    baseLatency: +(ctx.baseLatency ?? 0).toFixed(4),
    outputLatency: +(ctx.outputLatency ?? 0).toFixed(4),
    prebuilt: Boolean(waveBuf),
    clock: +ctx.currentTime.toFixed(3),
  };
}

let waveBuf: AudioBuffer | null = null;
let backBuf: AudioBuffer | null = null;
let strikeBuf: AudioBuffer | null = null;

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

  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  arcBus = ctx.createGain();
  arcBus.gain.value = 1;
  arcBus.connect(master);

  return ctx;
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
function makeWave(audio: Ctx): AudioBuffer {
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
function reverse(audio: Ctx, src: AudioBuffer): AudioBuffer {
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
function makeStrike(audio: Ctx): AudioBuffer {
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

function build(audio: Ctx): void {
  if (waveBuf) return;
  waveBuf = makeWave(audio);
  backBuf = reverse(audio, waveBuf);
  strikeBuf = makeStrike(audio);
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
 * One strike, fired by the field each time it draws an arc.
 *
 * Split from the wave on purpose. The lightning is not on the clock: the field
 * decides when it reaches, and the gaps between reaches stretch from three
 * quarters of a second to three as the power goes. So the strikes land where
 * the picture actually draws them, in a different pattern every activation, and
 * each is pitched and weighted differently so a run never repeats itself.
 */
export function tick(): void {
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

  const gain = audio.createGain();
  gain.gain.value = 0.62 + Math.random() * 0.38;

  src.connect(gain).connect(arcBus);
  src.start(t);
  src.stop(t + 0.9);
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

  /* ---- The wave, and time closing around it -------------------------- */

  const wave = audio.createBufferSource();
  wave.buffer = waveBuf;
  wave.playbackRate.setValueAtTime(1, t0);
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
  waveGain.gain.setValueAtTime(1, t0);
  waveGain.gain.setValueAtTime(1, t0 + 0.18);
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
  wave.start(t0);
  wave.stop(drift + 1.2);

  /* ---- The strikes' level, which follows the storm ------------------- */

  /*
   * Not their timing — the field owns that — only how loud they are by the
   * time they happen. They hold while the field does and are gone before it
   * finishes dying, which matches the picture: the long reaches out of the
   * character are the first thing the storm cannot afford any more.
   */
  arcBus.gain.cancelScheduledValues(t0);
  arcBus.gain.setValueAtTime(1, t0);
  arcBus.gain.setValueAtTime(1, decay);
  arcBus.gain.exponentialRampToValueAtTime(0.0001, at(beat.decay + shape.fieldDecay * 0.7));

  /* ---- The rewind ---------------------------------------------------- */

  /*
   * The same wave backwards, accelerating across the window the pieces use to
   * come home — and it has to consume exactly its own length in that window,
   * or it runs out early or is cut off mid-air.
   *
   * A tail is left at the end because the picture keeps one: pieces drift for
   * between 1.9 and 3 seconds, and the last of them are still settling after
   * the rest have arrived, so the sound finishes first and lets them land in
   * quiet. That leaves 3.5 seconds to play 2.6 seconds of buffer.
   *
   * It also starts part way in. Reversed, the buffer opens on what was the
   * blast's dying tail, which is very nearly silence — so the rewind was
   * inaudible for its first four hundred milliseconds, exactly while the first
   * pieces were being let go. Skipping that head means the swell is already
   * underway on the frame the picture starts moving.
   *
   * The pieces are released over the first 1240ms of this window and each takes
   * between 1.9 and 3 seconds, so the last of them lands at about 7.2 seconds —
   * and the crack has to land with them, not a second early. That sets the
   * window at four seconds and the tail at seven hundred milliseconds.
   *
   * For a rate ramping exponentially from a to b over W, the buffer consumed is
   * W(b - a) / ln(b / a). From three times the held rate to 1.55 over four
   * seconds that is 3.2 seconds, which is what is left of the blast after the
   * silent head is skipped. It ends above real speed rather than below it, so
   * the way back is quicker than the way out, and the reversed transient — the
   * crack, which comes last now — lands as the pieces do.
   */
  const REWIND_TAIL_MS = 700;
  const REWIND_SKIP = 0.8;
  const span = Math.max(1.2, (beat.done - beat.drift - REWIND_TAIL_MS) / 1000);

  const back = audio.createBufferSource();
  back.buffer = backBuf;
  // Three times the held rate: the frozen sound already moving again.
  back.playbackRate.setValueAtTime(FREEZE_RATE * 3, drift);
  back.playbackRate.exponentialRampToValueAtTime(1.55, drift + span);

  /*
   * The level rides the material rather than sitting flat on top of it.
   *
   * Even after the skip, the reversed wave opens on the quietest part of the
   * blast and creeps through it at a quarter speed, so a flat gain left a hole
   * of about four hundred milliseconds right where the first pieces are being
   * let go — measured at a fiftieth of the level either side of it. Lifting the
   * opening and easing back as the material grows keeps one continuous swell
   * from the instant the picture starts moving to the crack at the end.
   */
  /*
   * Opening from 0.05 rather than from nothing.
   *
   * An exponential ramp starting at 0.0001 spends almost the whole of its
   * length inaudible — a quarter of the way to 2.2 it has reached 0.004 — so
   * what was meant to be a fast lift was in practice a second gap on top of the
   * quiet material. Starting from a floor that can already be heard makes the
   * curve do what it looks like it does.
   */
  const backGain = audio.createGain();
  backGain.gain.setValueAtTime(0.05, drift);
  backGain.gain.exponentialRampToValueAtTime(1.6, drift + 0.5);
  backGain.gain.exponentialRampToValueAtTime(1, drift + span * 0.62);
  backGain.gain.setValueAtTime(1, drift + span * 0.88);
  backGain.gain.exponentialRampToValueAtTime(0.0001, drift + span + 0.5);

  back.connect(backGain).connect(master);
  back.start(drift, REWIND_SKIP);
  back.stop(drift + span + 0.7);

  voices = voices.concat([wave, back]);
}
