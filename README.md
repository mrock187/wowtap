# WoWtap

A daily five-round map guessing game for World of Warcraft: Forever.

[Play WoWtap](https://mrock187.github.io/wowtap/)

The preview has 97 locations across Kalimdor and the Eastern Kingdoms. The map uses actual terrain elevation and ocean data, with village artwork and labels omitted.

## Run locally

Requires Node.js 20.19.x or 22.12+ and npm.

```sh
npm ci
npm run dev
```

For verification, install Chromium with `npx playwright install chromium`, then run `npm run verify`.

See the [build status](docs/STATUS.md), [QA report](docs/QA_REPORT.md), [source provenance](DATA_PROVENANCE.md), and [deployment guide](docs/DEPLOY.md).
