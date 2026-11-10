# Azeroth Pinpoint: Codex build pack

This is a **build instruction pack**, not the implemented game. It is designed to make Codex implement a complete zero-recurring-cost daily pin-guessing game for WoW: Forever with a dependency graph and gated tests.

## Lowest-friction use

1. Create an empty local project folder/repository in Codex and copy these five files into the root (keep `BUILD_GRAPH.md` and `ACCEPTANCE_TESTS.md` in the root initially; Codex may move them into `docs/`).
2. Open the repository in Codex and paste this exact instruction:
   **"Read `CODEX_MASTER_PROMPT.md`, `AGENTS.md`, `BUILD_GRAPH.md`, and `ACCEPTANCE_TESTS.md`. Implement the project all the way through the graph; do not stop at planning. Work autonomously, run and repair each test gate, and report only actual blockers requiring my approval. Never spend money or publish uncertain copyrighted assets."**
3. Let Codex operate on the local repository. Later, you may need to authorize an art/publication decision and connect a free Cloudflare account if you choose to put the site online.

You can alternatively paste `CODEX_MASTER_PROMPT.md` directly into a Codex session with an empty repository, without copying the pack. The prompt instructs Codex to generate its own persistent graph and test files.

## Files

- `CODEX_MASTER_PROMPT.md` — complete self-contained master instruction, including features, limits, graph and test loop.
- `AGENTS.md` — concise durable per-repository directives recognized by Codex.
- `BUILD_GRAPH.md` — implement/test dependency graph with owner boundaries.
- `ACCEPTANCE_TESTS.md` — acceptance criteria and browser test paths.
- `README.md` — setup.

## A realistic limitation

OpenMap's open-source code and map geometry may be usable, but the WoW artwork itself is Blizzard's. Codex must not infer redistribution permission from MIT and should not silently publish it. If rights cannot be confirmed, the correct result is a locally testable app and a documented publication blocker, not an invented “success”. Likewise no coding agent can connect your Cloudflare account without access/authorization.
