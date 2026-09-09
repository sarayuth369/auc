import { classifyRtdn, decodeRtdnPayload, FREE_ENTITLEMENT } from './billing';
import { buildPublicConfig } from './config';
import { corsHeaders } from './cors';
import { errorBody } from './errors';
import { PRIVACY_POLICY_HTML } from './privacy-policy-html';
import { checkRateLimit, type RateLimitEntry } from './ratelimit';
import { defaultCryptoPriceProvider, resolveConversion, type ResolveEnv } from './resolve';

export interface Env extends ResolveEnv {}

// Module-scoped: persists only for the lifetime of one Worker isolate.
// Best-effort abuse protection without adding infrastructure (see ratelimit.ts).
const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = corsHeaders();

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, service: 'auc-backend' }, 200, headers);
    }

    if (url.pathname === '/api/config' && request.method === 'GET') {
      // Public runtime config only - never touches GEMINI_API_KEY. The only
      // location signal used is Cloudflare's own request.cf.country (never
      // the raw IP, never logged) - just to pick a curated UI language.
      return json(buildPublicConfig(env, request.cf?.country as string | undefined), 200, headers);
    }

    if (url.pathname === '/privacy-policy' && request.method === 'GET') {
      // Public, unauthenticated static page - no Cloudflare Access, no
      // secrets, nothing dynamic. Must be reachable from a plain browser
      // link (Google Play, About screen) with zero login.
      return new Response(PRIVACY_POLICY_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=UTF-8', ...headers },
      });
    }

    if (url.pathname === '/api/crypto-health' && request.method === 'GET') {
      // Internal observability only (task section 46): per-provider
      // success/failure counts and current cooldown state, so it's obvious
      // which crypto market-data provider is having trouble. No secrets,
      // no user data - just provider names and counters.
      return json({ providers: defaultCryptoPriceProvider.getProviderStats() }, 200, headers);
    }

    if (url.pathname === '/api/billing/entitlement' && request.method === 'GET') {
      // Foundation only: no persistent entitlement store exists yet, so the
      // only honest answer is "free" - never fabricate a premium grant.
      // Wiring this to real state requires a purchase-token-keyed store
      // populated by a verified /api/billing/verify or RTDN call.
      return json(FREE_ENTITLEMENT, 200, headers);
    }

    if (url.pathname === '/api/billing/verify' && request.method === 'POST') {
      // Foundation only: verifying a purchase token requires calling the
      // Google Play Developer API (subscriptionsv2.get) with a service
      // account (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, a future Worker secret -
      // never committed, never returned here). No insecure fake
      // verification is implemented - this is an honest "not implemented."
      return json(
        errorBody('NOT_IMPLEMENTED', 'Purchase verification is not implemented yet.'),
        501,
        headers,
      );
    }

    if (url.pathname === '/api/billing/rtdn' && request.method === 'POST') {
      // Google requires a fast 2xx ack regardless of whether we can fully
      // process the notification yet - a non-2xx makes Pub/Sub retry
      // indefinitely. RTDN is only ever a "something changed" signal; the
      // real implementation must still call the Play Developer API for the
      // authoritative state before updating any stored entitlement.
      let envelope: unknown;
      try {
        envelope = await request.json();
      } catch {
        return json({ ok: true }, 200, headers);
      }
      const payload = decodeRtdnPayload(envelope);
      if (payload) {
        const eventType = classifyRtdn(payload);
        // Not yet wired to a verifier/store - see module doc in billing.ts.
        console.log('RTDN received (not yet processed):', eventType ?? 'unknown');
      }
      return json({ ok: true }, 200, headers);
    }

    if (url.pathname === '/api/resolve' && request.method === 'POST') {
      const contentType = request.headers.get('Content-Type') ?? '';
      if (!contentType.toLowerCase().includes('application/json')) {
        return json(errorBody('INVALID_INPUT', 'Content-Type must be application/json.'), 400, headers);
      }

      const clientKey = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (!checkRateLimit(rateLimitStore, clientKey, Date.now(), RATE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
        return json(errorBody('RATE_LIMITED', 'Too many requests. Please slow down.'), 429, headers);
      }

      let rawBody: unknown;
      try {
        rawBody = await request.json();
      } catch {
        return json(errorBody('INVALID_INPUT', 'Request body must be valid JSON.'), 400, headers);
      }

      const outcome = await resolveConversion(rawBody, env, { fetchImpl: fetch });
      return json(outcome.body, outcome.status, headers);
    }

    return json(errorBody('INVALID_INPUT', 'Not found.'), 404, headers);
  },
};
