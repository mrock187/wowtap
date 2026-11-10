# Local preview and Cloudflare Pages release

## Current release state

**INCOMPLETE / PUBLICATION_BLOCKED.** The app mechanics pass with a clearly marked fictional QA atlas. The production bundle contains zero Forever map assets and zero verified locations. It displays an unavailable state. The candidate source and rights findings are in [DATA_PROVENANCE.md](../DATA_PROVENANCE.md).

## Preview and verification

Use Node.js 20.19.x or 22.12+ and npm.

```sh
npm ci
npx playwright install chromium
npm run verify:qa
npm run dev:qa
```

Open http://127.0.0.1:4174/ to play the fictional QA expedition. This route exists only in the loopback QA dev server. Stop it before running Playwright again.

Build and preview the production files with `npm run build && npm run preview`. The default preview URL is http://127.0.0.1:4173/. Preview reproduces static behavior. Pages applies the `_headers` rules at deployment.

`npm run verify:qa` includes lint, typecheck, unit tests, fixture-map decode, dataset intake check, build, desktop/mobile Playwright, size audit and a production-preview smoke test. `npm run verify` additionally requires passing real data, map and package gates.

## Prepare authorized content

1. Supply a label-free Forever world atlas, both continent layers, and verified zone and city detail where available. Stage its files under versioned paths in `public/maps/` and its exact-build manifest at `public/game/atlas.json`. Record publication evidence, original sources, transformations, checked dates, and each image's path and SHA-256 in [the provenance ledger](../DATA_PROVENANCE.md). The layer manifest's `assetSha256` must match the deployed bytes.
2. Follow [location intake](../data/README.md) to review exact-build answer points or areas. Stage the reviewed dataset at `public/game/locations.json`, run `npm run data:validate` and `npm run maps:audit`, and visually audit each real layer for labels, calibration and coverage.
3. Freeze the season with `npx tsx scripts/schedule/freeze.ts YYYY-MM-DD season-v1`. Choose a start date that is active at launch. The default horizon is 730 days. For extensions, retain the previously deployed `public/game/schedule.json` and all of its map assets. Use a new version and new paths for changed images. See [engine notes](ENGINE.md).
4. Run `npm run verify`, then play a full official round set locally and record real atlas screenshots and alignment samples in the [QA report](QA_REPORT.md).

Use original publication approval or equivalent license evidence covering hosting and any image edits. A tool's license only covers the material within its stated scope.

## Human-only publication

After asset approval and a passing release preflight, sign in to a **Free** Cloudflare account and authorize a Pages deployment. In **Workers & Pages**, create a **Pages Direct Upload** project and upload the verified `dist/` folder. Select **Deploy site**, then verify the assigned `.pages.dev` URL. For a package above the dashboard's 1,000-file limit, use the documented Wrangler Direct Upload route after signing in. [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

Use the included `.pages.dev` hostname and static assets. Pages Free supports 20,000 files per site, 25 MiB per file, and 500 builds per month. Static requests are free and unlimited when they invoke no Functions. These limits were checked November 10, 2026. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) · [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)

After upload, check the published UTC date, map requests, and one full daily on desktop and mobile. The scheduled answer data is included in the static client payload, so someone inspecting it can recover solutions.
