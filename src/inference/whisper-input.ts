export const WHISPER_SAMPLE_RATE_HZ = 16_000;
export const WHISPER_WINDOW_SECONDS = 30;
export const WHISPER_WINDOW_SAMPLES = WHISPER_SAMPLE_RATE_HZ * WHISPER_WINDOW_SECONDS;

/** The v0.9 Whisper exports use a fixed 30-second encoder input. */
export function normalizeWhisperWaveform(waveform: Float32Array): Float32Array {
  if (waveform.length === WHISPER_WINDOW_SAMPLES) return waveform;
  const normalized = new Float32Array(WHISPER_WINDOW_SAMPLES);
  normalized.set(waveform.subarray(0, WHISPER_WINDOW_SAMPLES));
  return normalized;
}

export function hasAudibleSignal(waveform: Float32Array, minimumPeak = 0.001): boolean {
  for (const sample of waveform) {
    if (Math.abs(sample) >= minimumPeak) return true;
  }
  return false;
}
