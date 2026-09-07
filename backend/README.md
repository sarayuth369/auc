# AUC Backend — AI Resolver (Cloudflare Worker)

Structured natural-language unit-conversion resolver. Gemini understands the
request; it never computes the final number — that stays in the Flutter
`ConversionEngine`. This Worker only turns free text into an `AiIntent`-shaped
JSON payload (or a clarification/error), with dimension checks and
region-clarification guards on top of Gemini's output.

## Install

```bash
cd backend
npm install
```

## Local dev

```bash
npm run dev
```

Requires a `GEMINI_API_KEY` available locally. Create `backend/.dev.vars`
(git-ignored) with:

```
GEMINI_API_KEY=your-local-key
```

## Gemini secret setup (production)

Never put the key in `wrangler.toml`, source, or the Flutter app.

```bash
wrangler secret put GEMINI_API_KEY
```

## Test

```bash
npm run typecheck
npm test
```

## Deploy

```bash
npm run deploy
```
