# Daily engine

## UTC schedule

The application selects the date with `utcDate(new Date())`. Its date boundary is UTC midnight. Each lineup holds five distinct location IDs. The versioned static manifest also snapshots the matching location data, source notes, accepted geometry, and atlas manifest. Published entries stay playable after a location is corrected or removed as long as their referenced map images remain available at their frozen asset paths.

The generator prefers easy, medium, medium, hard, hard. Among equally suitable entries it favors the landmass with fewer rounds on that date. When the final slot is the only chance to include another available landmass, that slot favors geographic spread. Inventory can require a different mix.

The cooldown is a minimum gap in UTC days between appearances of a location ID. It is the smaller of the requested gap and `floor(eligible locations / 5)`. A consecutive window of that length has no repeats. A 90-day gap needs 450 eligible locations. Under five locations the generator reports that the pool is too small. The default request is 90 days, and the daily and cooldown checks apply across season boundaries.

## Freezing and extending

Feed reviewed, version-matched content to `freezeSchedule(content, { startDate, days: 730, version })`, then serialize the result to the production schedule JSON. Validate a serialized schedule with `parseSchedule`. The generator sorts sources by ID and uses a stable seeded rank for ties.

For each extension, load the existing deployed manifest and pass it as the third argument to `freezeSchedule`. Choose a start date on or after the end of the explicit schedule and after the current UTC day. The extension retains every existing lineup and snapshot. A gap before the new season is filled with the previous season's deterministic fallback lineups. The optional `publishedThrough` cutoff supports replaying a historical build and must reflect the true UTC publication horizon. Each season needs a unique version. Keep historical assets at their original paths and use different paths when their contents change.

If the static manifest expires before an extension is published, the client can generate another 366 days using the last frozen pool and the same selection algorithm. The schema version identifies that fallback algorithm. Preserve its behavior when introducing a new scheduling strategy. Once that fallback period expires, a later date has no daily puzzle.

## Points

A guess keeps its layer and normalized point. The engine projects the guess and each accepted answer to the root atlas and measures the shortest Euclidean distance in atlas units. Polygon interiors and boundaries count as zero error. If multiple answer points or areas are valid, the closest geometry determines the score.

The geographic score is `round(5000 × max(0, 1 − error / radius)²)`, with a radius of one quarter of the full atlas diagonal. A guess on another landmass earns 20% of that score, capped at 500. For a city-precision answer, guesses from the world, continent, or zone layers are capped at 3,000, 3,500, and 4,000 points respectively. Another city's detail layer also has a 4,000-point cap. The target city's detail layer allows up to 5,000. Five rounds give a maximum of 25,000 points.
