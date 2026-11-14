/**
 * HEXORCIST — Zero-Dependency WebAudio Tactile & Diagnostic Synthesizer
 * + Procedural Lo-Fi Synthwave / Chill Ambient Music Engine (Zero Copyrighted Audio).
 */

export type HexSoundCue =
  | "CLICK"
  | "FAULT_ALERT"
  | "EXORCISM_CHIME"
  | "ESCROW_DEPOSIT"
  | "AUTOPSY_SCAN";

let sharedAudioCtx: AudioContext | null = null;
let mutedState = false;
let chillMusicEnabled = true;

// Procedural Chill Ambient Music Engine State
const CHILL_MUSIC_GAIN = 0.08;
const CHILL_BPM = 78;
const EIGHTH_NOTE_SEC = 60 / CHILL_BPM / 2; // ~0.3846s per 8th note
const STEPS_PER_CHORD = 8; // 1 full 4/4 bar (~3.08s) per chord at 78 BPM

interface ChillChordSpec {
  name: string;
  bassHz: number;
  padHz: readonly number[];
  shimmerHz: number;
}

// Warm Lo-Fi Synthwave / Ambient Tech Progression: Fmaj7 -> Em7 -> Dm7 -> Cmaj7
const CHILL_CHORD_PROGRESSION: readonly ChillChordSpec[] = [
  { name: "Fmaj7", bassHz: 87.31, padHz: [174.61, 220.0, 261.63, 329.63], shimmerHz: 523.25 },
  { name: "Em7", bassHz: 82.41, padHz: [164.81, 196.0, 246.94, 293.66], shimmerHz: 493.88 },
  { name: "Dm7", bassHz: 73.42, padHz: [146.83, 174.61, 220.0, 261.63], shimmerHz: 440.0 },
  { name: "Cmaj7", bassHz: 65.41, padHz: [130.81, 164.81, 196.0, 246.94], shimmerHz: 392.0 },
];

let musicMasterGain: GainNode | null = null;
let musicSchedulerTimer: ReturnType<typeof setInterval> | null = null;
let musicCleanupTimeout: ReturnType<typeof setTimeout> | null = null;
let musicNextNoteTime = 0;
let musicStepCounter = 0;
let musicPlaying = false;
let musicSessionToken = 0;
let cachedShakerBuffer: AudioBuffer | null = null;
let cachedShakerCtx: AudioContext | null = null;

function ensureRawAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtxCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxCtor) return null;

  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioCtxCtor();
    } catch {
      return null;
    }
  }

  if (sharedAudioCtx.state === "suspended") {
    void sharedAudioCtx.resume().catch(() => {
      // Ignore browser autoplay policy suspension until user gesture
    });
  }

  return sharedAudioCtx;
}

function getAudioContext(): AudioContext | null {
  if (mutedState) return null;
  return ensureRawAudioContext();
}

export function isSoundMuted(): boolean {
  return mutedState;
}

export function setSoundMuted(muted: boolean): void {
  mutedState = muted;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("hexorcist_sound_muted", muted ? "1" : "0");
    } catch {
      // Ignore storage access errors in restricted sandboxes
    }
  }

  if (musicMasterGain && sharedAudioCtx && musicPlaying) {
    const now = sharedAudioCtx.currentTime;
    const target = muted || !chillMusicEnabled ? 0.0001 : CHILL_MUSIC_GAIN;
    musicMasterGain.gain.cancelScheduledValues(now);
    musicMasterGain.gain.setValueAtTime(Math.max(0.0001, musicMasterGain.gain.value), now);
    musicMasterGain.gain.linearRampToValueAtTime(target, now + 0.25);
  }
}

export function initSoundPreferenceFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = window.localStorage.getItem("hexorcist_sound_muted");
    if (saved === "1") {
      mutedState = true;
    }
    const savedMusic = window.localStorage.getItem("hexorcist_chill_music");
    if (savedMusic === "0") {
      chillMusicEnabled = false;
    }
  } catch {
    // Ignore storage access errors
  }
  return mutedState;
}

export function isChillMusicEnabled(): boolean {
  return chillMusicEnabled;
}

export function setChillMusicEnabled(enabled: boolean): void {
  chillMusicEnabled = enabled;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("hexorcist_chill_music", enabled ? "1" : "0");
    } catch {
      // Ignore storage access errors
    }
  }
}

export function isChillBackgroundMusicPlaying(): boolean {
  return musicPlaying;
}

function getOrCreateShakerBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedShakerBuffer && cachedShakerCtx === ctx) {
    return cachedShakerBuffer;
  }
  const durationSec = 0.085;
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = buffer.getChannelData(0);

  let seed = 0x51f2a9;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const white = (seed / 0xffffffff) * 2 - 1;
    const progress = i / length;
    const windowEnv = Math.sin(Math.PI * Math.min(1, progress * 1.15)) * (1 - progress * 0.72);
    channel[i] = white * Math.max(0, windowEnv);
  }

  cachedShakerBuffer = buffer;
  cachedShakerCtx = ctx;
  return buffer;
}

function connectWithOptionalPan(
  ctx: AudioContext,
  source: AudioNode,
  destination: AudioNode,
  panValue: number
): void {
  if (typeof ctx.createStereoPanner === "function") {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(panValue, ctx.currentTime);
    source.connect(panner);
    panner.connect(destination);
  } else {
    source.connect(destination);
  }
}

function scheduleChillChordBar(
  ctx: AudioContext,
  bus: GainNode,
  chord: ChillChordSpec,
  startTime: number,
  barDurationSec: number
): void {
  // 1. Warm Low-Pass Filtered Stereo-Detuned Triangle + Sine Pad
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.Q.setValueAtTime(0.85, startTime);
  padFilter.frequency.setValueAtTime(680, startTime);
  padFilter.frequency.linearRampToValueAtTime(1180, startTime + barDurationSec * 0.45);
  padFilter.frequency.linearRampToValueAtTime(640, startTime + barDurationSec + 0.55);

  const padEnv = ctx.createGain();
  const padStopTime = startTime + barDurationSec + 0.6;
  padEnv.gain.setValueAtTime(0.0001, startTime);
  padEnv.gain.linearRampToValueAtTime(0.42, startTime + 0.58);
  padEnv.gain.linearRampToValueAtTime(0.32, startTime + barDurationSec * 0.82);
  padEnv.gain.exponentialRampToValueAtTime(0.0001, padStopTime);

  padFilter.connect(padEnv);
  padEnv.connect(bus);

  const perVoiceGain = 0.22;

  chord.padHz.forEach((freqHz) => {
    const oscTri = ctx.createOscillator();
    const triGain = ctx.createGain();
    oscTri.type = "triangle";
    oscTri.frequency.setValueAtTime(freqHz, startTime);
    oscTri.detune.setValueAtTime(-6, startTime);
    triGain.gain.setValueAtTime(perVoiceGain, startTime);
    oscTri.connect(triGain);
    connectWithOptionalPan(ctx, triGain, padFilter, -0.26);
    oscTri.start(startTime);
    oscTri.stop(padStopTime + 0.02);

    const oscSine = ctx.createOscillator();
    const sineGain = ctx.createGain();
    oscSine.type = "sine";
    oscSine.frequency.setValueAtTime(freqHz, startTime);
    oscSine.detune.setValueAtTime(6, startTime);
    sineGain.gain.setValueAtTime(perVoiceGain * 0.92, startTime);
    oscSine.connect(sineGain);
    connectWithOptionalPan(ctx, sineGain, padFilter, 0.26);
    oscSine.start(startTime);
    oscSine.stop(padStopTime + 0.02);
  });

  // 2. Soft Sub-Bass Root Note (F2 -> E2 -> D2 -> C2)
  const bassFilter = ctx.createBiquadFilter();
  bassFilter.type = "lowpass";
  bassFilter.frequency.setValueAtTime(215, startTime);

  const bassEnv = ctx.createGain();
  const bassStopTime = startTime + barDurationSec + 0.18;
  bassEnv.gain.setValueAtTime(0.0001, startTime);
  bassEnv.gain.linearRampToValueAtTime(0.36, startTime + 0.16);
  bassEnv.gain.linearRampToValueAtTime(0.24, startTime + barDurationSec * 0.75);
  bassEnv.gain.exponentialRampToValueAtTime(0.0001, bassStopTime);

  const subOsc = ctx.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(chord.bassHz, startTime);

  const upperBassOsc = ctx.createOscillator();
  const upperBassGain = ctx.createGain();
  upperBassOsc.type = "triangle";
  upperBassOsc.frequency.setValueAtTime(chord.bassHz * 2, startTime);
  upperBassGain.gain.setValueAtTime(0.18, startTime);

  subOsc.connect(bassFilter);
  upperBassOsc.connect(upperBassGain);
  upperBassGain.connect(bassFilter);
  bassFilter.connect(bassEnv);
  bassEnv.connect(bus);

  subOsc.start(startTime);
  upperBassOsc.start(startTime);
  subOsc.stop(bassStopTime + 0.02);
  upperBassOsc.stop(bassStopTime + 0.02);

  // 3. Delicate Ambient Harmonic Shimmer on Beat 3
  const shimmerStart = startTime + EIGHTH_NOTE_SEC * 4;
  const shimmerDur = EIGHTH_NOTE_SEC * 3.4;
  const shimmerOsc = ctx.createOscillator();
  const shimmerFilter = ctx.createBiquadFilter();
  const shimmerEnv = ctx.createGain();

  shimmerOsc.type = "sine";
  shimmerOsc.frequency.setValueAtTime(chord.shimmerHz, shimmerStart);
  shimmerFilter.type = "lowpass";
  shimmerFilter.frequency.setValueAtTime(1450, shimmerStart);

  shimmerEnv.gain.setValueAtTime(0.0001, shimmerStart);
  shimmerEnv.gain.linearRampToValueAtTime(0.075, shimmerStart + 0.09);
  shimmerEnv.gain.exponentialRampToValueAtTime(0.0001, shimmerStart + shimmerDur);

  shimmerOsc.connect(shimmerFilter);
  shimmerFilter.connect(shimmerEnv);
  connectWithOptionalPan(ctx, shimmerEnv, bus, 0.18);

  shimmerOsc.start(shimmerStart);
  shimmerOsc.stop(shimmerStart + shimmerDur + 0.02);
}

function scheduleBrushedShakerPulse(
  ctx: AudioContext,
  bus: GainNode,
  stepInBar: number,
  startTime: number
): void {
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getOrCreateShakerBuffer(ctx);

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  const isOffBeat = stepInBar % 2 === 1;
  bandpass.frequency.setValueAtTime(isOffBeat ? 6200 : 5200, startTime);
  bandpass.Q.setValueAtTime(1.25, startTime);

  const shakerGain = ctx.createGain();
  const peak = isOffBeat ? 0.11 : stepInBar === 0 || stepInBar === 4 ? 0.065 : 0.045;
  const swungStart = isOffBeat ? startTime + 0.014 : startTime;

  shakerGain.gain.setValueAtTime(0.0001, swungStart);
  shakerGain.gain.linearRampToValueAtTime(peak, swungStart + 0.008);
  shakerGain.gain.exponentialRampToValueAtTime(0.0001, swungStart + 0.078);

  noiseSource.connect(bandpass);
  bandpass.connect(shakerGain);
  connectWithOptionalPan(ctx, shakerGain, bus, isOffBeat ? -0.14 : 0.12);

  noiseSource.start(swungStart);
  noiseSource.stop(swungStart + 0.088);
}

/**
 * Starts the pure WebAudio procedural chill ambient background soundtrack
 * (Fmaj7 -> Em7 -> Dm7 -> Cmaj7 @ 78 BPM, balanced ~0.08 master gain).
 */
export function startChillBackgroundMusic(): boolean {
  if (!chillMusicEnabled) return false;
  const ctx = ensureRawAudioContext();
  if (!ctx) return false;

  if (musicPlaying && musicMasterGain) {
    const now = ctx.currentTime;
    const target = mutedState ? 0.0001 : CHILL_MUSIC_GAIN;
    musicMasterGain.gain.cancelScheduledValues(now);
    musicMasterGain.gain.setValueAtTime(Math.max(0.0001, musicMasterGain.gain.value), now);
    musicMasterGain.gain.linearRampToValueAtTime(target, now + 0.6);
    return true;
  }

  if (musicSchedulerTimer) {
    clearInterval(musicSchedulerTimer);
    musicSchedulerTimer = null;
  }
  if (musicCleanupTimeout) {
    clearTimeout(musicCleanupTimeout);
    musicCleanupTimeout = null;
  }
  if (musicMasterGain) {
    try {
      musicMasterGain.disconnect();
    } catch {
      // Ignore already-disconnected node
    }
    musicMasterGain = null;
  }

  const sessionToken = ++musicSessionToken;
  const bus = ctx.createGain();
  const now = ctx.currentTime;
  const targetGain = mutedState ? 0.0001 : CHILL_MUSIC_GAIN;

  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.linearRampToValueAtTime(targetGain, now + 1.35);
  bus.connect(ctx.destination);

  musicMasterGain = bus;
  musicPlaying = true;
  musicStepCounter = 0;
  musicNextNoteTime = now + 0.06;

  const scheduleAheadWindowSec = 0.36;
  const barDurationSec = STEPS_PER_CHORD * EIGHTH_NOTE_SEC;

  const schedulerTick = () => {
    if (!musicPlaying || sessionToken !== musicSessionToken || !sharedAudioCtx || !musicMasterGain) {
      return;
    }
    if (sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume().catch(() => {});
    }

    while (musicNextNoteTime < sharedAudioCtx.currentTime + scheduleAheadWindowSec) {
      const stepInBar = musicStepCounter % STEPS_PER_CHORD;
      if (stepInBar === 0) {
        const chordIdx =
          Math.floor(musicStepCounter / STEPS_PER_CHORD) % CHILL_CHORD_PROGRESSION.length;
        scheduleChillChordBar(
          sharedAudioCtx,
          musicMasterGain,
          CHILL_CHORD_PROGRESSION[chordIdx],
          musicNextNoteTime,
          barDurationSec
        );
      }

      scheduleBrushedShakerPulse(
        sharedAudioCtx,
        musicMasterGain,
        stepInBar,
        musicNextNoteTime
      );

      musicNextNoteTime += EIGHTH_NOTE_SEC;
      musicStepCounter += 1;
    }
  };

  schedulerTick();
  musicSchedulerTimer = setInterval(schedulerTick, 120);
  return true;
}

/**
 * Smoothly fades out and stops the procedural chill background music.
 */
export function stopChillBackgroundMusic(fadeOutSec = 1.6): void {
  const sessionToken = ++musicSessionToken;
  musicPlaying = false;

  if (musicSchedulerTimer) {
    clearInterval(musicSchedulerTimer);
    musicSchedulerTimer = null;
  }
  if (musicCleanupTimeout) {
    clearTimeout(musicCleanupTimeout);
    musicCleanupTimeout = null;
  }

  const busToFade = musicMasterGain;
  musicMasterGain = null;

  if (!busToFade || !sharedAudioCtx) {
    return;
  }

  const safeFade = Math.max(0.08, fadeOutSec);
  const now = sharedAudioCtx.currentTime;
  try {
    busToFade.gain.cancelScheduledValues(now);
    busToFade.gain.setValueAtTime(Math.max(0.0001, busToFade.gain.value), now);
    busToFade.gain.exponentialRampToValueAtTime(0.0001, now + safeFade);
  } catch {
    // Ignore AudioParam scheduling edge cases
  }

  musicCleanupTimeout = setTimeout(() => {
    try {
      busToFade.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    if (sessionToken === musicSessionToken) {
      musicCleanupTimeout = null;
    }
  }, Math.ceil((safeFade + 0.25) * 1000));
}

function scheduleTone(
  ctx: AudioContext,
  freqHz: number,
  startTime: number,
  durationSec: number,
  peakGain: number,
  wave: OscillatorType = "sine",
  endFreqHz?: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = wave;
  osc.frequency.setValueAtTime(freqHz, startTime);
  if (endFreqHz !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreqHz), startTime + durationSec);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.012, durationSec * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.01);
}

export function playHexSound(cue: HexSoundCue): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  switch (cue) {
    case "CLICK": {
      scheduleTone(ctx, 880, now, 0.026, 0.028, "triangle", 520);
      break;
    }

    case "FAULT_ALERT": {
      // Subtle dual-pulse diagnostic fault warning
      scheduleTone(ctx, 415.3, now, 0.11, 0.055, "sawtooth", 311.13);
      scheduleTone(ctx, 311.13, now + 0.12, 0.16, 0.055, "triangle", 233.08);
      break;
    }

    case "AUTOPSY_SCAN": {
      // Telemetry diagnostic sweep blip
      scheduleTone(ctx, 523.25, now, 0.06, 0.035, "sine", 783.99);
      scheduleTone(ctx, 783.99, now + 0.065, 0.075, 0.035, "sine", 1046.5);
      break;
    }

    case "ESCROW_DEPOSIT": {
      // Clean two-note FinTech escrow vault confirmation
      scheduleTone(ctx, 587.33, now, 0.08, 0.042, "triangle");
      scheduleTone(ctx, 880.0, now + 0.075, 0.14, 0.045, "sine");
      break;
    }

    case "EXORCISM_CHIME": {
      // Ascending C-major harmonic triad confirming 100% ECU health restoration
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        scheduleTone(ctx, freq, now + idx * 0.065, 0.22, 0.048, "sine");
      });
      break;
    }
  }
}
