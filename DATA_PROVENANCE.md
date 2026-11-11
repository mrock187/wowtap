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

## WoWtap publication authorization

On November 10, 2026 the project owner requested publication on GitHub Pages, following the instruction to proceed with the artwork despite the earlier rights checkpoint. The published package contains the generated WDL terrain rasters and the reviewed AreaPOI dataset. Asset status is recorded as `user-authorized`. This records the owner's publication instruction and leaves upstream ownership and terms with their original sources. The cleaned OpenMap plates stay in the ignored local cache.

| Published image | SHA-256 |
| --- | --- |
| maps/forever-69913-terrain-v1/947.png | f39d76b1366559f519574c8b384aca12b54457a49932e524680d9e4b3c1e90c5 |
| maps/forever-69913-terrain-v1/1414.png | 55c2219022ff6437ebb80a1029d4d79cc88a25caa58038cf6be42f8cfdbfd64f |
| maps/forever-69913-terrain-v1/1415.png | a5e9a0b3174458c698e233accc8ba6d44a397bb61f12bc917f7fef41dc5a1e8e |
| maps/forever-69913-terrain-detail-v1/1414.png | 2e18ec61ce5be86db14bbe2e99bf33309e84b92e2c39b399a457e60a8ffb51f7 |
| maps/forever-69913-terrain-detail-v1/1415.png | 05e0c4b4fd4fccfc5ac1e3636208e1663c17ff25de9232a07fda088f3f5ea014 |

The two detail rasters use the same build-pinned WDL sources and continent image rectangles as the original release. The additional shading incorporates the WDL midpoint samples. No placement data is read. The detail manifest binds the new rasters to the corresponding frozen image digests.
