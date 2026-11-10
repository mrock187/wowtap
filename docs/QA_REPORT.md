# QA report

## G1 scaffold, November 10, 2026

Windows, Node 20.19.0, npm 11.14.1. `npm ci --prefer-offline --no-audit` installed 213 packages. `npm audit` reported zero vulnerabilities. `npm run lint`, `npm run typecheck`, and `npm run build` exited 0. Vite emitted 224.08 kB of JavaScript (69.61 kB gzip) and a 0.38 kB HTML entry. `npm run dev` started on loopback and an HTTP request to / returned 200 with the project title. The scaffold loads no third-party runtime assets. Browser QA remains pending.

## G2 coordinate contract, November 10, 2026

`npm run lint`, `npm run typecheck`, and `npm run test` exited 0. Vitest passed nine tests for nested transforms, inverse corners and off-layer coordinates, and validation failures. The fixture is synthetic and lives under `tests/fixtures/`. Calibrating actual Forever imagery is a separate content gate.

## G3–G6 content and map gate, November 10, 2026

G3 Chromium audit decoded five 1000 × 600 fictional map files (40,165 bytes total; largest 11,136 bytes). Default real audit reported missing approved atlas and zero layers. G4 technical intake passed eight unit tests and the release validator reported missing real atlas and locations. G5 passed 38 engine tests. See the [map audit](research/MAPS.md), [location audit](research/LOCATIONS.md), and [engine notes](ENGINE.md).

`npm run lint`, `npm run typecheck`, `npm run test` (59 tests) and `npm.cmd run test:e2e -- map.spec.ts` (four Chromium cases) passed. Desktop 1440 × 900 exercised wheel, drag and zoom controls. iPhone-sized 390 × 844 Chromium emulation exercised CDP pinch and touchscreen taps. Both tested world reset, city drill-down, pin preservation on back, keyboard placement and image-failure retry.

Manually inspected fictional fixture captures: [desktop world](qa/fixture-world-desktop.png), [desktop zone](qa/fixture-zone-desktop.png), [mobile city](qa/fixture-city-mobile.png). These captures verify the renderer using original test artwork.
