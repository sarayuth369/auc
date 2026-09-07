# Google Play Data Safety — AUC (AI Universal Converter)

Prepared from an actual read of the source and dependencies (`pubspec.yaml`, `lib/services/*`, `backend/src/*`, `AndroidManifest.xml`) — not guessed. Recheck this before submitting if the code changes.

Dependencies that touch data at all: `shared_preferences` (local storage), `http` (calls our own backend only), `share_plus` (native share sheet), `google_mobile_ads` (AdMob SDK). No analytics SDK, no crash-reporting SDK, no login/auth package, no database package.

## Data collected/shared — fill this into Play Console's Data Safety form

| Data type | Collected? | Shared with 3rd party? | Purpose | Required or optional | Can user request deletion? | Encrypted in transit |
|---|---|---|---|---|---|---|
| Name, email, address, phone, or other personal identifiers | **No** | — | — | — | — | — |
| Precise or approximate location | **No** | — | — | — | — | — |
| Financial info | **No** | — | — | — | — | — |
| Health/fitness | **No** | — | — | — | — | — |
| Photos, videos, audio, files/docs | **No** | — | — | — | — | — |
| Contacts, calendar | **No** | — | — | — | — | — |
| **App activity — other user-generated content** (the text you type to convert, e.g. "10 km to miles") | **Yes, but only when the on-device parser can't resolve it** (unfamiliar language / unknown unit) | Yes — to AUC's own Cloudflare Worker, which relays it to Google's Gemini API | App functionality (natural-language understanding only; math is done on-device) | Optional in practice — most conversions never leave the device; happens automatically only on fallback | Not retained by AUC beyond the single request (no query log/database); can't be individually "deleted" after the fact because nothing is stored | **Yes**, TLS/HTTPS end-to-end |
| **App activity — history/favorites you save** | Stored, but **on-device only** — never collected/transmitted by AUC | No | Let you revisit past conversions | Optional (user-generated, deletable anytime) | **Yes** — delete in-app or uninstall | N/A (never leaves device) |
| **Device or other IDs — Advertising ID** | **Yes**, via Google AdMob SDK | Yes — to Google/AdMob | Ad serving, ad measurement | Optional from the app's perspective (ads can fail to load without breaking the app); governed by the user's device-level Ad ID settings | Per Google's own AdMob/Ads data controls, not AUC's | Yes (AdMob SDK traffic is TLS) |
| App info & performance (crash logs, diagnostics) | **Not collected by AUC's own code** (no Crashlytics/Sentry/analytics SDK added). Google Play services and the AdMob SDK may generate their own standard diagnostics per Google's own disclosures — outside AUC's direct control. | Depends on Google/Play services' own policies | — | — | — | — |

## Encryption & account deletion questions in the Play form

- **"Is all user data encrypted in transit?"** → **Yes.** Every network call (Cloudflare Worker, Gemini via the Worker, AdMob SDK traffic) is HTTPS/TLS. There is no plaintext HTTP anywhere in the app.
- **"Do you provide a way for users to request data deletion?"** → There is no account and no server-side store of personal data to delete. On-device history/favorites are deletable in-app or by uninstalling. Recommended answer: **"No account creation is offered"** / data is not collected in a way that requires a deletion request flow, aside from on-device data the user already controls directly.
- **"Is data collection required for the app to function?"** → **No** for the AI-fallback text (the app's core deterministic conversions work fully offline); **No** for the Advertising ID (ads are supplementary monetization, not required functionality).

## AUC backend processing vs. AdMob SDK processing — kept separate on purpose

- **AUC backend (Cloudflare Worker → Gemini):** only ever receives the literal text you typed, only when local parsing fails, only to interpret language/units. It does not receive device identifiers, advertising IDs, location, or your saved history. See [backend/src/resolve.ts](../../backend/src/resolve.ts) and [backend/src/gemini.ts](../../backend/src/gemini.ts) for the exact request shape.
- **Google AdMob SDK:** operates independently, inside its own SDK code, per Google's own AdMob data disclosures. AUC does not pass any of your conversion text or history to AdMob, and AdMob does not see your conversion activity.

## Caveat

Google's own Gemini API terms of data use (e.g. whether/how input may be used to improve Google's models) are Google's to state and can change independently of this app; verify the current terms at the time of submission rather than relying solely on this document: <https://ai.google.dev/gemini-api/terms>. This document reflects what AUC's own code sends and does not send — it is not a substitute for the developer's final sign-off on the Play Console form, which is the developer's responsibility to Google.
