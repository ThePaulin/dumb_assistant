import { describe, expect, it } from 'vitest';

import { hasAudibleSignal, normalizeWhisperWaveform, WHISPER_WINDOW_SAMPLES } from './whisper-input';

describe('normalizeWhisperWaveform', () => {
  it('pads short recordings with silence to the fixed Whisper window', () => {
    const result = normalizeWhisperWaveform(new Float32Array([0.25, -0.5]));
    expect(result).toHaveLength(WHISPER_WINDOW_SAMPLES);
    expect(Array.from(result.slice(0, 3))).toEqual([0.25, -0.5, 0]);
  });

  it('truncates recordings longer than the fixed Whisper window', () => {
    const input = new Float32Array(WHISPER_WINDOW_SAMPLES + 4).fill(0.75);
    expect(normalizeWhisperWaveform(input)).toHaveLength(WHISPER_WINDOW_SAMPLES);
  });

  it('distinguishes a zero-filled capture from audible input', () => {
    expect(hasAudibleSignal(new Float32Array(100))).toBe(false);
    expect(hasAudibleSignal(new Float32Array([0, 0.002, 0]))).toBe(true);
  });
});
