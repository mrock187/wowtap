# Forever map inventory and intake

## Current coverage

The workspace contains **0 approved Forever map images** and no real atlas manifest. World, continent, zone and city imagery are all blocked. No Blizzard textures, modified textures, contributed OpenMap artwork or data from a protected website were downloaded for this work.

The isolated technical atlas contains **5 original fictional SVGs** for one world, two continents, one zone and one city. It lives under `tests/fixtures/maps/` and is served by the QA development server. Chromium decoded all five images at 1,000 × 600. Total size is 40,165 bytes and the largest is 11,136 bytes. The assets share the fixture's canonical world plane, adding terrain, roads and settlement geometry as the map deepens. The world, both continents, zone and city were visually inspected for labels and markers in a Chromium contact sheet. Real Forever coverage and screenshot review remain blocked.

| Gate | Command | Result |
| --- | --- | --- |
| Fixture rendering and map audit | `npm run maps:audit -- --fixtures` | PASS. Five decodable assets with matching manifest dimensions. |
| Real atlas intake | `npm run maps:audit` | BLOCKED (exit 1). Missing `public/game/atlas.json`, zero real files and zero bytes. |
| Audit regressions | `npx vitest run tests/unit/maps` | PASS. Four cases. |

PowerShell users can run `npm.cmd run maps:audit -- --fixtures` to preserve the flag separator. Playwright's Chromium installation is required for decoding assets. Regenerate the fictional SVGs with `npx tsx scripts/maps/draw-fixtures.ts`.

## Source findings

OpenMap uses Azeroth UiMap 947 as its world plane and places child images using `C_Map.GetMapRectOnMap`. Its city chain explicitly inserts the containing zone because city map IDs can be parented to the continent. Its draw path selects replacement art tiles and builds runtime labels and icons separately. The source is useful for deriving rectangles. Some replacement tiles and banners derive from Blizzard textures and need an independent basis for reuse. The asset notice also identifies artist-specific contributions made available to OpenMap. [OpenMap stitch source](https://github.com/openmap-world/openmap/blob/d6cdee5569f5ac458b87ae5908730ee4c73e60d5/OpenMap/Map/Stitch.lua) · [OpenMap texture notice](https://github.com/openmap-world/openmap/blob/d6cdee5569f5ac458b87ae5908730ee4c73e60d5/OpenMap/Media/Textures/Forever/NOTICE.md)

Peligaming reads `UiMap`, `UiMapAssignment`, art dimensions, tile indexes and explored-overlay offsets from a pinned client build. That provides a second approach for checking source dimensions and transforms. Its license separates its MIT build code from client-derived WoW data and artwork. [Peligaming pipeline](https://github.com/peligwen/peligaming/blob/d5259f6dfec9016e6a2d26f94a8d58cf577438ca/scripts/fetch-wow-forever-map.mjs) · [Peligaming license](https://github.com/peligwen/peligaming/blob/d5259f6dfec9016e6a2d26f94a8d58cf577438ca/LICENSE)

## Intake for real assets

1. Provide a label-free Forever atlas with a documented rights basis covering each image and derivative. Include world UiMap 947 and continent UiMaps 1414 and 1415. Record any optional regions lacking imagery or calibration, including Zephras Isle when unavailable. Supply city or zone detail only where it has a verified transform and approved artwork.
2. Record source URLs, the exact Forever build, file SHA-256 hashes, the acquisition and transformation process, and rights evidence in [the provenance ledger](../../DATA_PROVENANCE.md). Put each path beginning with `maps/` and its checksum on the same ledger line. Preserve upstream notices and attribution required by each approval.
3. Place the strict `MapManifest` in `public/game/atlas.json` and its referenced files in `public/maps/`. Provide a world-space rectangle for each layer derived from a verified client map API or equivalent source. To express a child's rectangle in its chosen parent's frame, subtract the parent's origin from each corresponding edge and divide by the parent's width or height. Check multiple identifiable geographic control points and keep art crop coordinates synchronized with the answer layer. A city crop must fit its chosen zone rectangle. Exclude unsupported rotations, projections or overlaps with no validated placement. Flatten only approved label-free layers into the final image and use WebP or AVIF if practical.
4. Run `npm run maps:audit` and capture real in-app world, continent, zone and city screenshots. Visually inspect every layer for baked text, symbols and map markers, compare shared coastlines and landmarks across levels, and record coverage gaps. The CLI checks file inventory, byte limits, manifest build and rights metadata, provenance hashes and browser decoding. Visual review and confirmation of rights evidence are separate release gates.

The separate local preview uses three cleaned Forever overview plates. The local inventory and calibration evidence are in [the local Forever preview guide](../LOCAL_FOREVER.md).
