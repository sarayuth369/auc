import { DEFAULT_MODEL } from './gemini';

/** Bump when the shape or meaning of the public config payload changes. */
export const CONFIG_VERSION = 1;

export interface PublicAiConfig {
  enabled: boolean;
  provider: string;
  model: string;
  timeoutMs: number;
}

export interface ConfigEnv {
  AI_ENABLED?: string;
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  AI_TIMEOUT_MS?: string;
  /** Legacy var name, still honored if AI_MODEL isn't set. */
  GEMINI_MODEL?: string;
}

const DEFAULT_PROVIDER = 'gemini';
const DEFAULT_TIMEOUT_MS = 25000;

/**
 * Builds the public `/api/config` payload. This is the ONLY thing that may
 * ever cross into Flutter about AI configuration - it must never include
 * GEMINI_API_KEY or any other secret, by construction (it isn't read here).
 */
export function buildPublicConfig(env: ConfigEnv): { configVersion: number; ai: PublicAiConfig } {
  const timeoutMs = Number(env.AI_TIMEOUT_MS);
  return {
    configVersion: CONFIG_VERSION,
    ai: {
      enabled: env.AI_ENABLED !== 'false',
      provider: env.AI_PROVIDER?.trim() || DEFAULT_PROVIDER,
      model: env.AI_MODEL?.trim() || env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    },
  };
}
