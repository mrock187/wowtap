# Decisions

- Use Vite, React and TypeScript for a static, same-origin client. Ship local dependencies and static assets only.
- Keep the actual atlas and location acceptance gates separate from software QA using isolated fixtures. A fixture-enabled QA build can exercise interactions. The default build must require validated game content to offer a daily.
- Treat source-version identity, baked labels and asset permissions as explicit content checks. Never promote legacy coordinates or ghost-return points into the schedule by assumption.

## Coordinate contract

`src/domain/content.ts` is the shared contract. Atlas and dataset envelopes identify the exact Forever client build and dataset/atlas versions. Layer bounds are `[left, top, right, bottom]` in normalized parent coordinates with X right and Y down. The root fills its own rectangle. Children are axis-aligned. Real maps requiring another transform remain excluded until calibrated and supported. An image's source dimensions may differ from its placement rectangle. All guess and answer calculations compose layer transforms into world atlas units at the root's reference dimensions. Disjoint landmasses share an atlas plane and retain separate continent identities for scoring. A pin keeps the layer on which it was placed for precision policy. A location records verified point(s) or a polygon in its named layer, source URL, exact build, and audit date.

The software and real-content gates are recorded separately in `tasks/status.json`. Release preflight rejects unlisted images and compares the SHA-256 of every published map against the digest frozen into its season. Official seasons preserve historical asset paths. Browser tests use software fixtures served only by the loopback QA dev server.

An optional layer `imageCrop` defines a normalized rectangle in the original image that aligns with the playable layer bounds. The renderer scales and clips the original plate against that rectangle. The atlas transform continues to score against canonical positions inside the playable bounds.
