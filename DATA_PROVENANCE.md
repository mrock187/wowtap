# Data provenance

No third-party code, data files, or map images are included at this gate.

| Source | Acquisition and scope | Local development | Public redistribution |
| --- | --- | --- | --- |
| [OpenMap source](https://github.com/openmap-world/openmap/tree/d6cdee5569f5ac458b87ae5908730ee4c73e60d5) | Read the pinned public repository's license, asset notice and Forever Lua headers. Forever place/zone tooling identifies client build 1.60.1.70245. | Code and data tables covered by the upstream MIT notice can be evaluated. | Retain MIT copyright and license when reusing tables or tools. Record the derivation of any client-derived rows. |
| [OpenMap Forever texture notice](https://github.com/openmap-world/openmap/blob/d6cdee5569f5ac458b87ae5908730ee4c73e60d5/OpenMap/Media/Textures/Forever/NOTICE.md) | Read notice only. World and continent lettering is handled by separately drawn labels and edits of Blizzard art. | Requires a documented basis for any proposed artwork use. | Permission unresolved for Blizzard textures, edits and masks, as well as art contributed specifically to OpenMap. |
| [Peligaming source](https://github.com/peligwen/peligaming/tree/d5259f6dfec9016e6a2d26f94a8d58cf577438ca) | Read the license and map build script. Uses pinned client metadata, BLP map tiles, legacy Classic DB spawns and Forever observations. | Reference the MIT tool code. Verify observations and version before admitting any location. | Its license excludes the WoW Forever map art and client-derived data. No legacy spawn import planned. |
| [Wowhead map notes](https://www.wowhead.com/forever/classicplus-world-map-outro) | Read the editorial reference. | Reference for coverage only. | No extraction, hotlinking or redistribution. |
| [Blizzard launch](https://worldofwarcraft.blizzard.com/en-us/news/24315820/world-of-warcraft-forever-now-live) and [legal FAQ](https://www.blizzard.com/en-us/legal/c1ae32ac-7ff9-4ac3-a03b-fc04b8697010/blizzard-legal-faq) | Confirmed the game edition and Zephras Isle. Reviewed the fansite policy for an explicit basis to host map textures in the game. | Version and rights reference. | Release requires a documented basis covering the specific atlas and derivative assets. |

OpenMap describes its dungeon entrance points as ghost-return locations and may group nearby wings. A coordinate must match the location described by the question before it can become eligible.

## Implementation inventory

- `tests/fixtures/maps/`: five original fictional SVGs used by the isolated loopback QA server. Build 0.0.0.1 is a schema-test sentinel. Production inventory is zero Forever map assets, zero approved derivatives and zero verified answer entries. [Map evidence](docs/research/MAPS.md) · [Location evidence](docs/research/LOCATIONS.md)
- `public/favicon.svg` and the compass interface ornament are original project graphics. They contain no imported Warcraft art.
- A published image must have release approval, an exact-build atlas layer, and a SHA-256 recorded in both its manifest and this ledger. Retain each historical image at its frozen path and digest.

## Local-only Forever assets

The local-only workflow loads the three OpenMap cleaned overview plates and selected Peligaming AreaPOI data into `.local/forever/`. Exact upstream paths, revisions and SHA-256 values are pinned in `scripts/local/content.ts`. The imagery and derivative data are served by the explicitly selected loopback preview. Their distribution status is unchanged. [Local source and calibration audit](docs/LOCAL_FOREVER.md)

## Terrain-only presentation

The local preview renders three hillshade plates using the build-pinned WDL sources documented in [Local WoW: Forever preview](docs/LOCAL_FOREVER.md). Source files, generated rasters, and local captures live under the ignored `.local/terrain/` and `.local/forever/` paths. Only terrain heights and ocean masks contribute to the basemap.
