# Sprint 2.5 — Demo proof

This folder is **evidence** that the BestOffers increment runs end-to-end. It was captured from a
real local run of `npm run demo` (API on :3000, Expo Web on :8081), all offline with mock-Claude
(no API key).

## What's here
- **`api-flow-transcript.txt`** — full `intent → clarifier(×3) → ranked results` flow over HTTP
  (Arabic intent "ايفون 17 برو ماكس"). Shows the bounded clarifier (storage → color → budget,
  capped at 3) and 4 ranked offer cards (Eureka cheapest → X-cite → Best Al-Yousifi → Blink),
  each with a bilingual why-line citing a real attribute.
- **`served-web-index.html`** — the HTML actually served by Expo Web at `http://localhost:8081`
  (title "BestOffers").
- **`bundle-string-proof.txt`** — confirms the served JS bundle contains OUR screen's AR+EN strings
  (intent title, sector label, search CTA, searching state, deep-link CTA), i.e. the running web app
  is this codebase, not a placeholder.

## Why no PNG screenshot
Headless Chrome (`--screenshot`) renders this React-Native-Web + Hermes bundle as a blank frame in
this sandbox (RN-web mounts async after virtual-time fires). The bundle + served HTML + live API
transcript above are the equivalent proof. **To see pixels**, the PO runs locally:

```bash
npm install
npm run demo            # boots DB+seed+API+Expo Web; prints the URL (e.g. http://localhost:8081)
# open that URL in a browser → type "iPhone 17 Pro Max" → answer/skip chips → ranked cards
```

A shareable **static** build (no servers needed for the UI shell) is at `apps/mobile/dist/`
(`npm run demo:export`); it still calls the API on :3000 for live data.
