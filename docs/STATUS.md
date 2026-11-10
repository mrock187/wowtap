# Build status

**INCOMPLETE / PUBLICATION_BLOCKED.** Five-round gameplay passed with the isolated QA atlas. The production build has zero Forever map images and zero verified gameplay locations. The official daily requires an exact-build, rights-cleared atlas and audited coordinates.

| Gate | Status | Evidence |
| --- | --- | --- |
| G0–G2 | Passed | Source and hosting review, clean scaffold, nine transform and schema tests. |
| G3Q / G4Q | Passed | Five fictional QA layers and eight location intake tests. |
| G3 | Blocked | Zero approved real map assets. [Map audit](research/MAPS.md) |
| G4 | Blocked | Zero verified playable locations. [Location audit](research/LOCATIONS.md) |
| G5 | Passed | Thirty-eight schedule and scoring tests. [Engine](ENGINE.md) |
| G6–G8 | Passed with QA fixtures | Desktop/mobile map navigation, complete daily, local journal, offline scoring, cross-tab submission and automated accessibility. [QA report](QA_REPORT.md) |
| G9Q | Passed | Static build, size audit and loopback production smoke test. |
| G9 | Blocked | Official atlas, dataset and schedule absent. |
| G10 | Blocked | Real content, publication rights and deployment authorization required. [Release guide](DEPLOY.md) |

The worktree manager could not attach this Windows checkout. Cartography, data and engine work ran in parallel with disjoint file ownership in the same repository.

## Real Forever local preview

The local-only snapshot is playable with `npm run dev:forever` after `npm run local:prepare`. It has three real unlabeled plates and 97 source-backed points on the two continents, pinned to Forever build 1.60.1.69913. The public release remains blocked. [Local preview and coverage](LOCAL_FOREVER.md)
