import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { Content, Location } from '../../../src/domain/content'
import { freezeSchedule, parseSchedule, readPuzzle, utcDate } from '../../../src/engine/schedule'
import { coordinateFixture } from '../../fixtures/coordinates'

const DAY_MS = 86_400_000
const startDate = '2024-02-27'
const options = { startDate, days: 15, version: 'fixture-one' }
const difficulties = ['easy', 'medium', 'medium', 'hard', 'hard'] as const

function makeContent(count: number): Content {
  const fixture = structuredClone(coordinateFixture)
  const base = fixture.dataset.locations[0]
  fixture.dataset.locations = Array.from({ length: count }, (_, index): Location => ({
    ...base,
    id: `fixture-${index}`,
    name: `Fixture ${index}`,
    difficulty: difficulties[index % difficulties.length],
    category: 'landmark',
    mapId: index % 2 === 0 ? 'highlands' : 'east',
    precision: 'standard',
    answers: [{ kind: 'point', point: { x: (index * 17) % 97 / 100, y: .5 } }],
  }))
  return fixture
}

function dateAfter(days: number): string {
  return utcDate(new Date(Date.parse(startDate) + days * DAY_MS))
}

describe('UTC daily boundaries', () => {
  it.each([
    ['2024-02-28T23:59:59.999Z', '2024-02-28'],
    ['2024-02-29T00:00:00.000Z', '2024-02-29'],
    ['2024-12-31T18:59:59.999-05:00', '2024-12-31'],
    ['2024-12-31T19:00:00.000-05:00', '2025-01-01'],
    ['2026-03-08T01:59:59-05:00', '2026-03-08'],
    ['2026-03-08T03:00:00-04:00', '2026-03-08'],
    ['2026-11-01T01:30:00-04:00', '2026-11-01'],
    ['2026-11-01T01:30:00-05:00', '2026-11-01'],
    ['2026-11-09T17:00:00-07:00', '2026-11-10'],
    ['2026-11-10T13:00:00+13:00', '2026-11-10'],
  ])('selects %s as %s', (timestamp, day) => expect(utcDate(new Date(timestamp))).toBe(day))
})

describe('frozen daily schedules', () => {
  it('is reproducible across input ordering, serialization, and repeated lookup', () => {
    const content = makeContent(40)
    const first = freezeSchedule(content, options)
    content.dataset.locations.reverse()
    content.atlas.layers.reverse()
    const second = freezeSchedule(content, options)
    const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
    expect(digest(first)).toBe(digest(second))
    expect(digest(first.seasons[0].lineups)).toBe('80459b5e2731d2ced142e84cb3e011237f783f2ae1a5d0a463726bbe480a85e1')
    const offline = parseSchedule(JSON.parse(JSON.stringify(first)))
    expect(readPuzzle(offline, '2024-02-29')).toEqual(readPuzzle(first, '2024-02-29'))
    expect(readPuzzle(first, '2024-02-26')).toBeUndefined()
    expect(readPuzzle(first, '2024-02-30')).toBeUndefined()
  })

  it.each([5, 6, 9, 10, 14, 15, 20, 79, 150, 449, 450, 473])('fills five unique rounds per day for %s locations and respects feasible cooldown', size => {
    const expectedCooldown = Math.min(90, Math.floor(size / 5))
    const days = 2 * expectedCooldown + 7
    const schedule = freezeSchedule(makeContent(size), { ...options, days })
    const season = schedule.seasons[0]
    expect(season.cooldownDays).toBe(expectedCooldown)
    expect(season.lineups).toHaveLength(days)
    const seen = new Map<string, number>()
    season.lineups.forEach((ids, day) => {
      expect(new Set(ids).size).toBe(5)
      ids.forEach(id => {
        expect(day - (seen.get(id) ?? -Infinity)).toBeGreaterThanOrEqual(expectedCooldown)
        seen.set(id, day)
      })
    })
  })

  it('caps cooldown at the requested interval and favors difficulty mix and regional variety', () => {
    const schedule = freezeSchedule(makeContent(40), { ...options, requestedCooldownDays: 2 })
    expect(schedule.seasons[0].cooldownDays).toBe(2)
    const daily = readPuzzle(schedule, startDate)!
    expect(daily.rounds.map(location => location.difficulty)).toEqual(difficulties)
    expect(new Set(daily.rounds.map(location => location.mapId)).size).toBe(2)
  })

  it('prioritizes including a second region when exact difficulty preferences leave one region out', () => {
    const content = makeContent(30)
    content.dataset.locations.forEach((location, index) => {
      location.mapId = index === 0 ? 'east' : 'highlands'
      if (index === 0) location.difficulty = 'easy'
    })
    const schedule = freezeSchedule(content, options)
    const daily = readPuzzle(schedule, startDate)!
    expect(daily.rounds.map(location => location.mapId)).toEqual(['highlands', 'highlands', 'highlands', 'highlands', 'east'])
    expect(daily.rounds[4].difficulty).toBe('easy')
  })

  it('preserves cooldown across reproducible variations in inventory and difficulty mix', () => {
    let seed = 278931
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed
    }
    for (let trial = 0; trial < 12; trial++) {
      const content = makeContent(5 + random() % 140)
      for (const location of content.dataset.locations) {
        location.difficulty = difficulties[random() % difficulties.length]
        location.mapId = random() % 5 < 2 ? 'east' : 'highlands'
      }
      const requestedCooldownDays = 1 + random() % 90
      const schedule = freezeSchedule(content, { ...options, days: 40, requestedCooldownDays })
      expect(parseSchedule(JSON.parse(JSON.stringify(schedule)))).toEqual(schedule)
    }
  })

  it('fails explicitly below five and gracefully fills a single difficulty and landmass', () => {
    expect(() => freezeSchedule(makeContent(4), options)).toThrow(/At least five/)
    const content = makeContent(5)
    content.dataset.locations.forEach(location => {
      location.difficulty = 'hard'
      location.mapId = 'highlands'
    })
    const schedule = freezeSchedule(content, options)
    expect(readPuzzle(schedule, dateAfter(14))?.rounds).toHaveLength(5)
  })

  it('continues after the freeze using the same frozen source and policy', () => {
    const content = makeContent(33)
    const short = freezeSchedule(content, { ...options, days: 3 })
    const long = freezeSchedule(content, { ...options, days: 40 })
    for (const offset of [2, 3, 4, 7, 39]) {
      expect(readPuzzle(short, dateAfter(offset))).toEqual(readPuzzle(long, dateAfter(offset)))
    }
    expect(readPuzzle(short, dateAfter(368))).toBeDefined()
    expect(readPuzzle(short, dateAfter(369))).toBeUndefined()
  })

  it('materializes fallback history and preserves question, answer and atlas snapshots across updates', () => {
    const content = makeContent(20)
    const first = freezeSchedule(content, { ...options, days: 3 })
    const previousManifest = JSON.stringify(first)
    const fallback = readPuzzle(first, dateAfter(5))
    const firstDay = readPuzzle(first, dateAfter(0))
    const next = structuredClone(content)
    next.atlas.version = 'coordinates-qa-two'
    next.dataset.atlasVersion = next.atlas.version
    next.dataset.version = 'answers-qa-two'
    next.atlas.layers[0].width = 2000
    next.dataset.locations[0].name = 'Updated fixture name'
    next.dataset.locations[0].answers = [{ kind: 'point', point: { x: .9, y: .8 } }]
    const updated = freezeSchedule(next, {
      startDate: dateAfter(6), days: 3, version: 'fixture-two', publishedThrough: dateAfter(5),
    }, first)
    expect(JSON.stringify(first)).toBe(previousManifest)
    expect(readPuzzle(updated, dateAfter(5))).toEqual(fallback)
    expect(readPuzzle(updated, dateAfter(0))).toEqual(firstDay)
    expect(readPuzzle(updated, dateAfter(6))?.atlasVersion).toBe('coordinates-qa-two')
    expect(readPuzzle(updated, dateAfter(6))?.version).toBe('fixture-two')
  })

  it('rejects overlapping and backdated changes and invalid manifest data', () => {
    const content = makeContent(20)
    const schedule = freezeSchedule(content, options)
    const next = { ...options, version: 'fixture-two', publishedThrough: dateAfter(0) }
    expect(() => freezeSchedule(content, { ...next, startDate: dateAfter(1) }, schedule)).toThrow(/overlap/)
    expect(() => freezeSchedule(content, {
      ...next, startDate: dateAfter(18), publishedThrough: dateAfter(19),
    }, schedule)).toThrow(/published-through/)
    expect(() => freezeSchedule(content, { ...options, startDate: '9999-12-31' })).toThrow(/calendar/)
    const broken = structuredClone(schedule)
    broken.seasons[0].lineups[0][0] = broken.seasons[0].lineups[0][1]
    expect(() => parseSchedule(broken)).toThrow(/Duplicate location/)
  })

  it('protects its frozen data from mutations to source and lookup results', () => {
    const content = makeContent(10)
    const schedule = freezeSchedule(content, options)
    const initial = readPuzzle(schedule, startDate)!
    content.dataset.locations[0].name = 'external edit'
    const mutable = readPuzzle(schedule, startDate)!
    mutable.rounds[0].name = 'lookup edit'
    mutable.atlas.layers[0].height = 1
    expect(readPuzzle(schedule, startDate)).toEqual(initial)
  })
})
