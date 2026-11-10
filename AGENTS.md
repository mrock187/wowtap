# AGENTS.md — durable instructions for Azeroth Pinpoint

Mission: Implement and verify a real, polished five-round WoW: Forever daily map-guessing game. Never merely generate a plan. Follow CODEX_MASTER_PROMPT.md (this repository's product specification) and docs/BUILD_GRAPH.md.

## Autonomy
- Work independently with sensible defaults. Ask only for genuinely required user access/authorization (hosting credentials, protected-asset publication rights, or paid actions—do not incur any paid action).
- Prefer a static Cloudflare Pages Free deployment with no Functions, database, login, runtime AI, or paid services. No automatic charges/upgrades.
- Keep `docs/STATUS.md`, `docs/DECISIONS.md`, `tasks/status.json` as persistent, accurate state. Do not claim tests or deployment are done without evidence. Use small commits and resume from existing status.
- Use 3 or fewer parallel subagents on independent G3/G4/G5 work. Assign file ownership and separate worktrees where supported. Integrate only after contracts and unit tests pass. If unavailable, follow DAG serially.
- Respect proprietary artwork and third-party Terms; MIT code != copyright permission for Blizzard textures. Do not scrape Wowhead without confirmed permission or deploy questionable art. Maintain `DATA_PROVENANCE.md`.

## Critical engineering contracts
- Coordinates are canonical, viewport-independent and transformed from nested zone/city references. No false meter-scale distances.
- A question's answer must never be leaked by a label, overlay, auto-center, map-layer availability, or UI state before confirmation.
- Today is UTC; published historical puzzles are immutable across content updates. No data fabrication.
- Testing is continuous at each dependency gate. Fix and retest before advancing. Add regression tests for each discovered bug.
- Public app must not contain test-only shortcut buttons or fabricated location fixtures.

## Recommended commands (create matching npm scripts)
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run data:validate`
- `npm run maps:audit`
- `npm run build`
- `npm run test:e2e`
- `npm run pages:preflight`
- `npm run verify` (runs all necessary gates)

## Delivery
Show actual implementation, verification output and screenshots in `docs/QA_REPORT.md`, license / rights status, free-tier asset limits, working local preview command, and exact minimal human-only release steps. Report CODE_COMPLETE/PUBLICATION_BLOCKED when appropriate; never substitute a placeholder map and call it release-ready.
