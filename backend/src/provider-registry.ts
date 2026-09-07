import { resolveWithGemini } from './gemini';
import type { AIProvider, ProviderRequest } from './providers';

class GeminiProvider implements AIProvider {
  resolve({ text, apiKey, model, fetchImpl }: ProviderRequest) {
    return resolveWithGemini(text, apiKey, model, fetchImpl);
  }
}

export class UnsupportedProviderError extends Error {}

// Add a new provider here (e.g. 'openai', 'anthropic') once it has a real
// AIProvider implementation - the rest of the request pipeline is already
// provider-agnostic and needs no changes.
const PROVIDERS: Record<string, AIProvider> = {
  gemini: new GeminiProvider(),
};

export function getProvider(name: string): AIProvider {
  const provider = PROVIDERS[name.trim().toLowerCase()];
  if (!provider) {
    throw new UnsupportedProviderError(`AI provider "${name}" is not supported.`);
  }
  return provider;
}
