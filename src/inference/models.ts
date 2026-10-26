import { models } from 'react-native-executorch';

export const WHISPER_MODEL = models.speech_to_text.whisper_tiny_en({ quant: true });
export const WHISPER_BASE_MODEL = models.speech_to_text.whisper_base_en({ quant: true });
export const LANGUAGE_MODEL = models.llm.qwen2_5_0_5b({ quant: true });

export const WHISPER_SOURCES = [WHISPER_MODEL.modelSource, WHISPER_MODEL.tokenizerSource];
export const LANGUAGE_MODEL_SOURCES = [
  LANGUAGE_MODEL.modelSource,
  LANGUAGE_MODEL.tokenizerSource,
  LANGUAGE_MODEL.tokenizerConfigSource,
];
