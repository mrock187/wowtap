# Decisions

- Use Vite, React and TypeScript for a static, same-origin client. Ship local dependencies and static assets only.
- Keep the actual atlas and location acceptance gates separate from software QA using isolated fixtures. A fixture-enabled QA build can exercise interactions. The default build must require validated game content to offer a daily.
- Treat source-version identity, baked labels and asset permissions as explicit content checks. Never promote legacy coordinates or ghost-return points into the schedule by assumption.

## Coordinate contract

`src/domain/content.ts` is the shared contract. Atlas and dataset envelopes identify the exact Forever client build and dataset/atlas versions. Layer bounds are `[left, top, right, bottom]` in normalized parent coordinates with X right and Y down. The root fills its own rectangle. Children are axis-aligned. Real maps requiring another transform remain excluded until calibrated and supported. An image's source dimensions may differ from its placement rectangle. All guess and answer calculations compose layer transforms into world atlas units at the root's reference dimensions. Disjoint landmasses share an atlas plane and retain separate continent identities for scoring. A pin keeps the layer on which it was placed for precision policy. A location records verified point(s) or a polygon in its named layer, source URL, exact build, and audit date.

The software and real-content gates are recorded separately in `tasks/status.json`. Release preflight rejects unlisted images and compares the SHA-256 of every published map against the digest frozen into its season. Official seasons preserve historical asset paths. Browser tests use software fixtures served only by the loopback QA dev server.

An optional layer `imageCrop` defines a normalized rectangle in the original image that aligns with the playable layer bounds. The renderer scales and clips the original plate against that rectangle. The atlas transform continues to score against canonical positions inside the playable bounds.

The November 10 visual revision uses MapTap's map-first layout as a reference for a dark play surface, compact score and prominent target prompt. Local Forever gameplay now displays registered WDL-derived terrain. The visual layer shares the old atlas extent and leaves the frozen rounds, historical scores and accepted coordinates intact. [MapTap gameplay reference](https://maptap.gg/)

The project is named **WoWtap**. The owner requested a new public GitHub repository and publication through GitHub Pages on November 10, 2026. Generated terrain, the 97-location dataset and the frozen schedule are staged under `public/`. Runtime requests use Vite's configured base URL so project sites work under their repository path. The local storage key retains its original value for existing browser saves.

The Forever world overview renders the ocean strip between Kalimdor and the Eastern Kingdoms at 28% of its source width. Both landmasses retain their proportions. World taps invert the display projection into canonical coordinates before storage and scoring. Pins, region controls, and reveal overlays project from those same coordinates. The full-width round layout reserves a single row for the prompt and score on desktop. [MapTap](https://maptap.gg/) · [Krillion](https://krillion.io/) · [Fermi](https://fermi.gg/)
