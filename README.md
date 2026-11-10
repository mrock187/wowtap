# Azeroth Pinpoint

A static five-round daily map guessing game for World of Warcraft: Forever. The game code is playable with isolated local QA fixtures. Official puzzles are unavailable pending a rights-cleared, calibrated Forever atlas and verified location data.

## Run locally

Requires Node.js 20.19.x or 22.12+ and npm.

```sh
npm ci
npm run dev:qa
```

Open http://127.0.0.1:4174/ to play the fictional test expedition. For a production preview, run `npm run build && npm run preview`.

## Verify and release

```sh
npx playwright install chromium
npm run verify:qa
```

Use `npm run verify` for the official-content gates. See the [build status](docs/STATUS.md), [QA report and screenshots](docs/QA_REPORT.md), [data provenance](DATA_PROVENANCE.md), and [Cloudflare Pages release guide](docs/DEPLOY.md).
