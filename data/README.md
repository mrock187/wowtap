# Location intake

The daily dataset is currently empty. No example coordinates in the test suite are eligible for a real puzzle.

Collect records against the exact client build in the approved atlas. Document the entity identity, observed spawn or area, UiMap and build, date checked, supporting source URL, and the permission basis in the source ledger. Observe a moving NPC's whole relevant path or exclude the NPC. Use a covered city UiMap for city precision. If the client emits a different UiMap, resolve its transform and check alignment before recording answers. A coordinate imported from a different edition requires independent verification in Forever.

## Normalize a reviewed observation file

An observation file is UTF-8 JSON with these top-level fields.

| Field | Value |
| --- | --- |
| `edition` | `wow-forever` |
| `build` | Exact build identifier from the matching atlas |
| `version` | New version slug for the dataset |
| `atlasVersion` | Matching atlas version slug |
| `observations` | Array of reviewed entries |

An entry takes the location fields documented in `src/domain/content.ts`. Supply `uiMapId` in place of `mapId` and omit `confidence`. Supply all `answers` on that same map as percentage coordinates from 0 to 100, with X increasing east/right and Y increasing south/down on the source image. Each point has the shape `{ "kind": "point", "point": { "x": number, "y": number } }`. An area uses `kind: "polygon"` and a `vertices` array ordered along its boundary, without a repeated closing point. A stationary spawn set uses one point per confirmed spawn.

The `source` object adds `method`, either `client-observation` for directly observed rows or `reviewed-forever-source` for an exact-build source reviewed for location meaning, alignment, and reuse. Use the reference field to describe the supporting record. Retain the underlying evidence in the source ledger. The importer divides percentages by 100, resolves atlas layer IDs, validates the exact build and version, sorts by ID, and writes to a new path. It makes no network requests.

```sh
npx tsx scripts/data/import.ts public/game/atlas.json path/to/observations.json path/to/staged-locations.json
```

Review the staged dataset and its evidence before placing it at `public/game/locations.json`. Keep prior published dataset versions and schedule snapshots.

```sh
npx tsx scripts/data/validate.ts
```

The audit reports counts by category, difficulty, continent, and zone, plus city NPC, multiple-answer and area counts. It requires five rows and observed coverage of Kalimdor and Eastern Kingdoms, using Forever UiMap IDs 1414 and 1415. Missing files or insufficient coverage return exit code 2. Malformed content or invalid geometry returns 1. The software-only `--allow-missing` flag tolerates absence of both files and preserves the BLOCKED audit output.
