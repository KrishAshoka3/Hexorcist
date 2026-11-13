/**
 * HEXORCIST — Zero-Dependency WebAudio Tactile & Diagnostic Synthesizer
 * Pure oscillator/envelope synthesis via browser AudioContext (zero external or copyrighted audio).
 */

export type HexSoundCue =
  | "CLICK"
  | "FAULT_ALERT"
  | "EXORCISM_CHIME"
  | "ESCROW_DEPOSIT"
  | "AUTOPSY_SCAN";

let sharedAudioCtx: AudioContext | null = null;
let mutedState = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || mutedState) return null;
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
}

export function initSoundPreferenceFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = window.localStorage.getItem("hexorcist_sound_muted");
    if (saved === "1") {
      mutedState = true;
    }
  } catch {
    // Ignore storage access errors
  }
  return mutedState;
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
