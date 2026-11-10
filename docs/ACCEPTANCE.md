# Acceptance and testing matrix

Mark each test PASS, FAIL or BLOCKED with date, command/URL and artifact path in `docs/QA_REPORT.md`. Do not fabricate test results.

## Data/source
- Exact Forever version distinguished from retail/classic; references/source provenance recorded.
- Assets are approved for intended distribution or public deploy is visibly blocked.
- Fully unlabeled world, continent, zone and available city views; inspect screenshots visually; no icons that disclose answer.
- All points have verified coordinates, valid parent map reference, clear location name and category; all unknowns excluded from schedule.
- Dataset spans both continents, covers zones where source supports it, and includes detailed-city NPC examples where available. Publish actual counts, not aspirational counts.
- Map atlas/world/continent/zone/city projection round trips have bounded error; accept nearest legal NPC spawn area.

## Puzzles/scoring
- Same UTC date + schedule version => same 5 IDs on every device, in all timezones.
- December 31/January 1, leap days, DST, UTC rollover tested.
- Updating source location dataset does NOT revise already published puzzle dates.
- No duplicate questions in same day; documented dynamic cooldown (no impossible 90-day claim with fewer than 450 records).
- All 5 questions playable end-to-end; scores in [0,5000], daily score in [0,25000], same guess independent of zoom/viewport.
- City-map granularity rewards precise clicks in a city; coarse guesses still earn partial credit; wrong continent penalized.
- No answers/city labels given away by prompt-specific centering, overlays or choices.

## UX + state
- Desktop width 1440px; mobile width 390px and at least one small-phone viewport.
- Pan, wheel, pinch or pinch fallback, zoom controls, city enter/back, keyboard traversal, pin move/confirm, reveal work.
- Under slow network/reduced assets, visual progress and recoverable errors shown.
- Refresh mid-round: game recovers without double-score; completed game cannot be scored again.
- Browser localStorage disabled and corrupted data gracefully handled; no crash or infinite loop.
- Sharing includes date/total/emoji but no target names, coords or official solution link.
- Screenreader labels, focus visibility, color contrast, 44px recommended touch targets, reduced-motion supported.
- Map imagery loads only relevant detail; no broken image/404 or JS console errors.

## Release/cost
- `npm ci && npm run verify` from clean checkout succeeds.
- `dist/` contains a static app and authorized assets only; no server functions and no secret tokens.
- Verify real Cloudflare Pages Free limits from docs; local script counts all output files and enforces max 20,000 and 25 MiB/file; report total MB.
- No paid plan, storage/database, paid API, backend, dynamic request billing, hosting card, cron job or unapproved deployment.
- `docs/DEPLOY.md` includes all credentials/permissions needed and a clearly separated single manual step for actual publication.
- Mark honest release status: GAME_READY/DEPLOY_READY, PUBLICATION_BLOCKED, or INCOMPLETE with specific evidence.

## Representative browser E2E paths

1. Fresh browser: world view; five rounds; correct reveal and final 25,000 max; result share.
2. NPC in city: zoom to zone; enter city, place detailed pin, back and return; submit; correct score.
3. Coarse guess: world/zone pin outside city, still submit; partial score.
4. Wrong-continent pin: sensible score, reveal true continent.
5. Refresh immediately before and after confirmation: no duplicate scoring.
6. Completed game reload, reset browser clock, alternate locale: no illicit replay of official current-day score.
7. Exact next UTC midnight: prior game kept; next puzzle unlocked.
8. No network during play after cached app/loaded map: deterministic local engine; graceful failure if assets unavailable.
9. Small screen zoom/back button/nav and iPhone touch tests; no clipped confirm/results.
10. All user-facing names hidden on base map until reveal; visual spot-check with QA screenshots.
