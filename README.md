# Azeroth Pinpoint

A static five-round daily map guessing game for World of Warcraft: Forever.

## Run the local Forever preview

Requires Node.js 20.19.x or 22.12+ and npm.

```sh
npm ci
npm run local:prepare
npm run dev:forever
```

Open [the local Forever preview](http://127.0.0.1:4175/). It uses three unlabeled map plates and 97 points of interest from Forever build 1.60.1.69913. [Source and coverage notes](docs/LOCAL_FOREVER.md)

## Verify and release

```sh
npx playwright install chromium
npm run verify:qa
```

Run `npm run dev:qa` for the independent fictional test expedition at [the QA preview](http://127.0.0.1:4174/). Build and preview the production output with `npm run build && npm run preview`.

Use `npm run verify` for official-content gates. See the [build status](docs/STATUS.md), [QA report and screenshots](docs/QA_REPORT.md), [data provenance](DATA_PROVENANCE.md), and [Cloudflare Pages release guide](docs/DEPLOY.md).
