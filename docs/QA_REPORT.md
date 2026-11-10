# QA report

## G1 scaffold, November 10, 2026

Windows, Node 20.19.0, npm 11.14.1. `npm ci --prefer-offline --no-audit` installed 213 packages. `npm audit` reported zero vulnerabilities. `npm run lint`, `npm run typecheck`, and `npm run build` exited 0. Vite emitted 224.08 kB of JavaScript (69.61 kB gzip) and a 0.38 kB HTML entry. `npm run dev` started on loopback and an HTTP request to / returned 200 with the project title. The scaffold loads no third-party runtime assets. Browser QA remains pending.

## G2 coordinate contract, November 10, 2026

`npm run lint`, `npm run typecheck`, and `npm run test` exited 0. Vitest passed nine tests for nested transforms, inverse corners and off-layer coordinates, and validation failures. The fixture is synthetic and lives under `tests/fixtures/`. Calibrating actual Forever imagery is a separate content gate.

## G3–G6 content and map gate, November 10, 2026

G3 Chromium audit decoded five 1000 × 600 fictional map files (40,165 bytes total; largest 11,136 bytes). Default real audit reported missing approved atlas and zero layers. G4 technical intake passed eight unit tests and the release validator reported missing real atlas and locations. G5 passed 38 engine tests. See the [map audit](research/MAPS.md), [location audit](research/LOCATIONS.md), and [engine notes](ENGINE.md).

`npm run lint`, `npm run typecheck`, `npm run test` (59 tests) and `npm.cmd run test:e2e -- map.spec.ts` (four Chromium cases) passed. Desktop 1440 × 900 exercised wheel, drag and zoom controls. iPhone 13 Chromium emulation (390 × 664 CSS px in the initial run) exercised CDP pinch and touchscreen taps. Both tested world reset, city drill-down, pin preservation on back, keyboard placement and image-failure retry.

Manually inspected fictional fixture captures: [desktop world](qa/fixture-world-desktop.png), [desktop zone](qa/fixture-zone-desktop.png), [mobile city](qa/fixture-city-mobile.png). These captures verify the renderer using original test artwork.

## G7 game integration, November 10, 2026

`npm run test` passed 64 unit tests. `npm.cmd run test:e2e -- game.spec.ts` passed four Chromium cases. Both projects completed five rounds with a 25,000 result using the fixture. Tests covered refresh before and after confirmation, the daily guard, clipboard fallback with five green squares, UTC midnight rollover, past results, non-scoring practice, and combined corrupt/quota-denied storage. The real-content release gate remains blocked.

## G8 browser regression, November 10, 2026

`npm run test:e2e` passed 12 tests in 24.8 s. Chromium ran at 1440 × 900 and 390 × 844, with an additional 320 × 700 mobile layout audit. Axe reported zero WCAG 2.0/2.1 A and AA violations on the tested lobby, help dialog and round screens. The full play-through observed zero page exceptions, asset HTTP errors or cross-origin requests. Both projects tested offline scoring and simultaneous confirmation in two tabs. A blocked map request recovered after Retry.

Fixture screen references: [desktop round](qa/game-world-desktop.png), [mobile reveal](qa/game-reveal-mobile.png), [mobile results](qa/game-results-mobile.png). Browser coverage is Chromium desktop and mobile emulation. Actual iOS Safari and real-content visual QA are pending.
