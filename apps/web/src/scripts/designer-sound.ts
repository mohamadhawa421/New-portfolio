/**
 * The sound designer mode makes.
 *
 * Synthesised rather than sampled: the whole layer is a surge, a crackle, a
 * tick and a sigh, and four short shapes cost nothing to generate and nothing
 * to download. There is no audio file in the build.
 *
 * It is deliberately near the floor of audible. This is a portfolio, not a
 * game — the sound is there to make the field feel electrical if you happen to
 * have the volume up, and to be entirely missable if you do not. Peak gain on
 * the loudest element is 0.06.
 *
 * The context is created on the click that starts the sequence and never
 * before, which is both the autoplay policy and the right manners: nothing on
 * this site makes a noise until someone has asked it to.
 */

type Ctx = AudioContext & { mhNoise?: AudioBuffer };

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let stopped = true;

function context(): Ctx | null {
  if (ctx) return ctx;

  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
  return ctx;
}

/** A second of noise, made once and reused by every crackle and tick. */
function noiseBuffer(audio: Ctx): AudioBuffer {
  if (audio.mhNoise) return audio.mhNoise;
  const buffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  audio.mhNoise = buffer;
  return buffer;
}

/** Opens the gate. Called from the click, so the context is allowed to start. */
export function begin(): void {
  const audio = context();
  if (!audio || !master) return;

  stopped = false;
  if (audio.state === 'suspended') void audio.resume();

  master.gain.cancelScheduledValues(audio.currentTime);
  master.gain.setValueAtTime(0.0001, audio.currentTime);
  master.gain.exponentialRampToValueAtTime(1, audio.currentTime + 0.08);
}

/** Fades out and lets everything ring off rather than cutting it. */
export function end(): void {
  if (!ctx || !master || stopped) return;
  stopped = true;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
  master.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
}

/** The low swell that leaves with the wave. */
export function surge(): void {
  const audio = context();
  if (!audio || !master || stopped) return;
  const t = audio.currentTime;

  const osc = audio.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(38, t);
  osc.frequency.exponentialRampToValueAtTime(190, t + 0.26);

  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(420, t);
  filter.frequency.exponentialRampToValueAtTime(1500, t + 0.2);
  filter.Q.value = 6;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.06, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);

  osc.connect(filter).connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.7);
}

/** One small spark. Fired from the field when it draws an arc. */
export function tick(): void {
  const audio = context();
  if (!audio || !master || stopped) return;
  const t = audio.currentTime;

  const src = audio.createBufferSource();
  src.buffer = noiseBuffer(audio);
  src.playbackRate.value = 0.8 + Math.random() * 0.6;

  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2600 + Math.random() * 3200;
  filter.Q.value = 9;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.012 + Math.random() * 0.01, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.05);

  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  src.stop(t + 0.16);
}

/**
 * The strain of something being pulled that does not want to go.
 *
 * Mobile only, under the menu's fight: a low tone that climbs while it is
 * losing, with a slow wobble on it so it reads as tension rather than a note.
 */
export function strain(durationMs: number): void {
  const audio = context();
  if (!audio || !master || stopped) return;
  const t = audio.currentTime;
  const seconds = durationMs / 1000;

  const osc = audio.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(74, t);
  osc.frequency.linearRampToValueAtTime(126, t + seconds);

  const wobble = audio.createOscillator();
  wobble.type = 'sine';
  wobble.frequency.value = 7.5;
  const wobbleDepth = audio.createGain();
  wobbleDepth.gain.value = 9;
  wobble.connect(wobbleDepth).connect(osc.frequency);

  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.032, t + 0.18);
  gain.gain.setValueAtTime(0.032, t + seconds - 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);

  osc.connect(filter).connect(gain).connect(master);
  osc.start(t);
  wobble.start(t);
  osc.stop(t + seconds + 0.05);
  wobble.stop(t + seconds + 0.05);
}

/** The power going out of it. */
export function release(): void {
  const audio = context();
  if (!audio || !master || stopped) return;
  const t = audio.currentTime;

  const osc = audio.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.5);

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.038, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);

  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.65);
}
