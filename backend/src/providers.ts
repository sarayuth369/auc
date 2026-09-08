import type { RawResolveOutput } from './gemini';
import type { WorkersAiBinding } from './cloudflare-ai';

/** Non-secret request context a provider needs to resolve one request. */
export interface ProviderRequest {
  text: string;
  apiKey: string;
  model: string;
  fetchImpl: typeof fetch;
  /** Workers AI binding (env.AI), only used by CloudflareProvider. */
  ai?: WorkersAiBinding;
}

/**
 * A pluggable AI backend that turns free text into a RawResolveOutput.
 * Add a new provider by implementing this interface and registering it in
 * `provider-registry.ts` - nothing else in the request pipeline changes.
 */
export interface AIProvider {
  resolve(request: ProviderRequest): Promise<RawResolveOutput>;
}
