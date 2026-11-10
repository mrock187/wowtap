# Decisions

- Use Vite, React and TypeScript for a static, same-origin client. Ship local dependencies and static assets only.
- Keep the actual atlas and location acceptance gates separate from software QA using isolated fixtures. A fixture-enabled QA build can exercise interactions. The default build must require validated game content to offer a daily.
- Treat source-version identity, baked labels and asset permissions as explicit content checks. Never promote legacy coordinates or ghost-return points into the schedule by assumption.
