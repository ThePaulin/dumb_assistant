import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import type { InterpretationProposal } from '@/domain/proposal';
import { extractJsonObject, validateProposal } from '@/domain/proposal';
import {
  interpretationMessages,
  proposalJsonSchemaForRequest,
  type InterpretationContext,
} from '@/inference/prompt';

const KEYCHAIN_KEY = 'openrouter-user-api-key-v1';
const OPENROUTER_BASE = 'https://openrouter.ai';

type OpenRouterCompletion = {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
  };
};

export type RemoteInterpretation = {
  proposal: InterpretationProposal;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
};

function base64Url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    const value = (a << 16) | (b << 8) | c;
    output += alphabet[(value >> 18) & 63];
    output += alphabet[(value >> 12) & 63];
    if (index + 1 < bytes.length) output += alphabet[(value >> 6) & 63];
    if (index + 2 < bytes.length) output += alphabet[value & 63];
  }
  return output;
}

async function keyHash(key: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key);
}

async function exchangeCode(code: string, verifier: string): Promise<void> {
  const response = await fetch(`${OPENROUTER_BASE}/api/v1/auth/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
  });
  const payload = (await response.json()) as { key?: string; error?: { message?: string } };
  if (!response.ok || !payload.key) {
    throw new Error(payload.error?.message ?? `OpenRouter key exchange failed (${response.status}).`);
  }
  await SecureStore.setItemAsync(KEYCHAIN_KEY, payload.key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function connectOpenRouter(): Promise<void> {
  const verifier = base64Url(Crypto.getRandomBytes(64));
  const challenge = base64Url(
    new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(verifier))),
  );
  const state = base64Url(Crypto.getRandomBytes(24));
  const callbackUrl = Linking.createURL('oauth/openrouter');
  const authUrl = new URL(`${OPENROUTER_BASE}/auth`);
  authUrl.searchParams.set('callback_url', callbackUrl);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('key_label', 'Dumb Assistant');
  authUrl.searchParams.set('state', state);

  const result = await WebBrowser.openAuthSessionAsync(authUrl.toString(), callbackUrl);
  if (result.type !== 'success') throw new Error('OpenRouter connection was cancelled.');
  const redirect = new URL(result.url);
  if (redirect.searchParams.get('state') !== state) throw new Error('OAuth state did not match.');
  const code = redirect.searchParams.get('code');
  if (!code) throw new Error('OpenRouter did not return an authorization code.');

  await exchangeCode(code, verifier);
}

/** Official no-callback PKCE fallback for providers that reject a native custom scheme. */
export async function beginOpenRouterCopyCode(): Promise<string> {
  const verifier = base64Url(Crypto.getRandomBytes(64));
  const challenge = base64Url(
    new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(verifier))),
  );
  const authUrl = new URL(`${OPENROUTER_BASE}/auth`);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('key_label', 'Dumb Assistant');
  await WebBrowser.openBrowserAsync(authUrl.toString());
  return verifier;
}

export async function finishOpenRouterCopyCode(code: string, verifier: string): Promise<void> {
  if (!code.trim() || !verifier) throw new Error('Paste the authorization code from OpenRouter.');
  await exchangeCode(code.trim(), verifier);
}

export async function isOpenRouterConnected(): Promise<boolean> {
  return Boolean(await SecureStore.getItemAsync(KEYCHAIN_KEY));
}

export async function disconnectOpenRouter(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYCHAIN_KEY);
}

export async function openOpenRouterKeySettings(): Promise<void> {
  const key = await SecureStore.getItemAsync(KEYCHAIN_KEY);
  if (!key) throw new Error('OpenRouter is not connected.');
  await Linking.openURL(`${OPENROUTER_BASE}/keys/${await keyHash(key)}`);
}

export async function interpretWithOpenRouter(
  transcript: string,
  context: InterpretationContext,
  model = 'openai/gpt-5.2',
): Promise<RemoteInterpretation> {
  const key = await SecureStore.getItemAsync(KEYCHAIN_KEY);
  if (!key) throw new Error('Connect OpenRouter before using remote interpretation.');

  const response = await fetch(`${OPENROUTER_BASE}/api/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-OpenRouter-Title': 'Dumb Assistant',
    },
    body: JSON.stringify({
      model,
      messages: interpretationMessages(transcript, context),
      temperature: 0,
      provider: { require_parameters: true },
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'interpretation_proposal_v1',
          strict: true,
          schema: proposalJsonSchemaForRequest,
        },
      },
    }),
  });
  const payload = (await response.json()) as OpenRouterCompletion & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? `OpenRouter request failed (${response.status}).`);
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned no proposal.');
  const validated = validateProposal(extractJsonObject(content));
  if (!validated.ok) throw new Error(`OpenRouter returned an invalid proposal: ${validated.errors.join(' ')}`);

  return {
    proposal: validated.value,
    model: payload.model ?? model,
    ...(payload.usage?.prompt_tokens === undefined ? {} : { promptTokens: payload.usage.prompt_tokens }),
    ...(payload.usage?.completion_tokens === undefined
      ? {}
      : { completionTokens: payload.usage.completion_tokens }),
    ...(payload.usage?.cost === undefined ? {} : { costUsd: payload.usage.cost }),
  };
}
