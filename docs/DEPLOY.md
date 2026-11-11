# GitHub Pages deployment

WoWtap is published from the public [mrock187/wowtap repository](https://github.com/mrock187/wowtap). The project site is configured at [mrock187.github.io/wowtap](https://mrock187.github.io/wowtap/).

The GitHub Actions workflow verifies the application, audits the real content and asset hashes, builds with the repository path, and publishes the static output using GitHub Pages. Standard public GitHub runners and the included Pages hostname meet the zero-cost hosting target. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

## Local verification

```sh
npm ci
npx playwright install chromium
npm run verify
```

To preview the same repository path on Windows PowerShell, set `$env:PAGES_BASE_PATH='/wowtap/'`, then run `npm run build` and `npm run preview`. Visit `http://127.0.0.1:4173/wowtap/`.

A complete published play-through can be checked with `npx tsx scripts/pages/playthrough.ts https://mrock187.github.io/wowtap/`.

## Content updates

The committed `public/game/` files hold the frozen schedule and reviewed dataset. The terrain images are under `public/maps/`. Keep old images at their original paths and checksums. New content versions must preserve previously published puzzles.

`npm run publish:prepare` stages the initial local snapshot and refuses to overwrite different published bytes. After initial publication, use the schedule extension process in [engine notes](ENGINE.md) and review new asset evidence in [the provenance ledger](../DATA_PROVENANCE.md).

The preview includes 97 locations on three terrain views for Forever build 1.60.1.69913. Separate zone/city layers, NPC precision content and additional regions remain open product work.
