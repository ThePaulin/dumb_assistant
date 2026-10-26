import { Directory, File, Paths } from 'expo-file-system';
import { decodeAudioData } from 'react-native-audio-api';

const ABANDONED_AUDIO_MAX_AGE_MS = 15 * 60 * 1000;

export async function decodeRecording(uri: string): Promise<Float32Array> {
  const audioBuffer = await decodeAudioData(uri, 16_000);
  if (audioBuffer.numberOfChannels === 1) return audioBuffer.getChannelData(0);

  const mono = new Float32Array(audioBuffer.length);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const samples = audioBuffer.getChannelData(channel);
    for (let index = 0; index < mono.length; index += 1) {
      mono[index] = (mono[index] ?? 0) + (samples[index] ?? 0) / audioBuffer.numberOfChannels;
    }
  }
  return mono;
}

export function deleteRecording(uri: string | null | undefined): void {
  if (!uri) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}

export function cleanupAbandonedAudio(now = Date.now()): number {
  let removed = 0;
  for (const folderName of ['Audio', 'ExpoAudio']) {
    const folder = new Directory(Paths.cache, folderName);
    if (!folder.exists) continue;
    for (const entry of folder.list()) {
      if (!(entry instanceof File)) continue;
      const modifiedAt = entry.modificationTime ?? now;
      if (now - modifiedAt > ABANDONED_AUDIO_MAX_AGE_MS) {
        entry.delete();
        removed += 1;
      }
    }
  }
  return removed;
}
