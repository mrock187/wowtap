# Local WoW: Forever preview

```sh
npm ci
npm run local:prepare
npm run dev:forever
```

Open [the local preview](http://127.0.0.1:4175/). The prepare command downloads four pinned and SHA-256-checked inputs when the review cache is absent. The prepared schedule and maps live under the Git-ignored `.local/forever/` directory. The loopback dev server serves them in `local-forever` mode. The production build uses the separate `public/` content pipeline.

The schedule uses the September 22, 2026 Forever snapshot, client build 1.60.1.69913. It includes 97 points of interest drawn from the client’s AreaPOI table. There are 49 in Kalimdor and 48 in Eastern Kingdoms, comprising six capitals, 54 settlements, and 37 curated landmarks. The pool excludes legacy NPC spawns, instance ghost-return coordinates, ambiguous landmarks, and POIs outside the supported plates. It runs for 730 days with a 12-day minimum repeat gap. Repeating preparation preserves the local schedule.

The three maps cover Azeroth, Kalimdor, and Eastern Kingdoms. The detailed plates inspected during intake have baked-in labels and remain outside the local guessing pool. Zephras Isle and detailed zone and city layers are unavailable in this snapshot. The installed client was on 1.60.1.70888 during source review.

Peligaming’s source data supplies the 1002 × 668 world frame, native AreaPOI positions and UiMap transforms. OpenMap’s three hand-cleaned plates have matching dimensions. Comparing each cleaned plate with the equivalent labelled snapshot gave mean RGB channel differences of 10.85–11.95 at zero offset, versus 15.76–18.54 with ±5 px shifts. Continent view windows crop the overlapping ocean areas in the browser while keeping the source images registered to the canonical frame. [Pinned client data](https://github.com/peligwen/peligaming/tree/d5259f6dfec9016e6a2d26f94a8d58cf577438ca/public/tools/wow-forever/data/world-map) · [Cleaned atlas source](https://github.com/openmap-world/openmap/tree/d6cdee5569f5ac458b87ae5908730ee4c73e60d5/art/edits)

Desktop and mobile Chromium each completed all five real-source rounds with 25,000 points and zero page or network errors. The local evidence includes `.local/forever/world-desktop.png` and `.local/forever/continent-mobile.png`. These captures and source art remain in the ignored workspace directory.
