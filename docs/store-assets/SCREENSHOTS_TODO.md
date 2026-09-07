# Store screenshots — capture checklist

I verified all 5 of these screens live during Phase 3 (rendered correctly, real UI, no crashes, no fake data) using the built `app-release.apk` running via `flutter run -d web-server` in this session's browser preview. I could not persist those renders as actual PNG files with the tools available in this session — Flutter's web build here uses the DOM/HTML renderer (no `<canvas>` element to extract pixels from), and no OS-level screenshot tool was available to save the rendered pane to disk.

**Nothing else was skipped or blocked by this** — the app, both release builds, and every other Phase 3 deliverable are complete. This is the one item that needs a real device/emulator (or you running the web build yourself and using your browser's own screenshot).

## What to capture (exact inputs, in order)

Install `build/app/outputs/flutter-apk/app-release.apk` on a device or emulator, or run `flutter run -d chrome` yourself, then capture:

1. **Home conversion** — type `10 km to miles`, tap Convert, screenshot the result card.
2. **Thai local unit conversion** — type `3 ไร่ 2 งาน to square meters`, tap Convert, screenshot the result (`5600 m²`).
3. **Scientific/engineering conversion** — type `100 psi to kPa`, tap Convert, screenshot the result (`689.47573 kPa`).
4. **AI fallback** — type a request the on-device parser can't resolve, e.g. `10 kilomètres en miles` (French) or `1 bigha to square meters` (regional, triggers the clarification card instead of a guessed number — either is a valid "AI fallback" shot). Wait for the loading spinner to resolve, then screenshot.
5. **History / Favorites** — after a few conversions, open the History icon (top-right, clock icon) and screenshot the list; optionally a second shot of Favorites (star icon) with at least one starred entry.

## Play Store screenshot requirements (current at time of writing)

- PNG (24-bit, no alpha) or JPEG
- Each side between 320px and 3840px
- Longest side no more than **2×** the shortest side (e.g. 1080×2160 is fine; 1080×2400 is not)
- Minimum 2 screenshots required, up to 8

Save the finished files into this folder (`docs/store-assets/`) as `screenshot-1-home.png` … `screenshot-5-history.png` so they sit next to this checklist and the privacy policy.
