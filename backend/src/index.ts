import { buildPublicConfig } from './config';
import { corsHeaders } from './cors';
import { errorBody } from './errors';
import { PRIVACY_POLICY_HTML } from './privacy-policy-html';
import { checkRateLimit, type RateLimitEntry } from './ratelimit';
import { resolveConversion, type ResolveEnv } from './resolve';

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
      // Public runtime config only - never touches GEMINI_API_KEY.
      return json(buildPublicConfig(env), 200, headers);
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
