import { z } from 'zod'
import { createAtlas } from '../domain/atlas'
import { contentSchema, idSchema, type Content, type Location, type MapManifest } from '../domain/content'

const DAY_MS = 86_400_000
const ROUND_DIFFICULTIES = ['easy', 'medium', 'medium', 'hard', 'hard'] as const
const ROUND_COUNT = ROUND_DIFFICULTIES.length
const MAX_FREEZE_DAYS = 732
const MAX_FALLBACK_DAYS = 366
const calendarDate = z.iso.date()
const cooldownSchema = z.number().int().positive()

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`) / DAY_MS
}

const lastCalendarDay = dayNumber('9999-12-31')

export function utcDate(now: Date): string {
  return calendarDate.parse(now.toISOString().slice(0, 10))
}

function availableCooldown(size: number, requested: number): number {
  return Math.min(requested, Math.floor(size / ROUND_COUNT))
}

const seasonSchema = z.object({
  version: idSchema,
  startDate: calendarDate,
  content: contentSchema,
  requestedCooldownDays: cooldownSchema,
  cooldownDays: cooldownSchema,
  lineups: z.array(z.array(idSchema).length(ROUND_COUNT)).min(1).max(MAX_FREEZE_DAYS + MAX_FALLBACK_DAYS),
}).strict()

const scheduleSchema = z.object({
  schemaVersion: z.literal(1),
  seasons: z.array(seasonSchema).min(1),
}).strict().superRefine(({ seasons }, context) => {
  const versions = new Set<string>()
  const appearances = new Map<string, number>()
  let nextDay: number | undefined
  seasons.forEach((season, index) => {
    function issue(path: (string | number)[], message: string) {
      context.addIssue({ code: 'custom', path: ['seasons', index, ...path], message })
    }
    const start = dayNumber(season.startDate)
    if (versions.has(season.version)) issue(['version'], 'Duplicate puzzle version')
    versions.add(season.version)
    if (nextDay !== undefined && start !== nextDay) {
      issue(['startDate'], 'Frozen seasons must be contiguous and chronological')
    }
    nextDay = start + season.lineups.length
    if (nextDay - 1 > lastCalendarDay) issue(['lineups'], 'Frozen lineups extend beyond the supported UTC calendar')

    const ids = new Set(season.content.dataset.locations.map(location => location.id))
    if (season.cooldownDays !== availableCooldown(ids.size, season.requestedCooldownDays)) {
      issue(['cooldownDays'], 'Cooldown must fit the frozen inventory and requested limit')
    }
    season.lineups.forEach((lineup, offset) => {
      const day = start + offset
      const seen = new Set<string>()
      for (const id of lineup) {
        if (!ids.has(id)) issue(['lineups', offset], `Unknown location: ${id}`)
        if (seen.has(id)) {
          issue(['lineups', offset], `Duplicate location: ${id}`)
        } else if (day - (appearances.get(id) ?? -Infinity) < season.cooldownDays) {
          issue(['lineups', offset], `Cooldown violation: ${id}`)
        }
        seen.add(id)
        appearances.set(id, day)
      }
    })
  })
})

type Season = z.infer<typeof seasonSchema>
export type FrozenSchedule = z.infer<typeof scheduleSchema>

export type DailyPuzzle = {
  date: string
  version: string
  atlasVersion: string
  atlas: MapManifest
  rounds: Location[]
}

export function parseSchedule(input: unknown): FrozenSchedule {
  return scheduleSchema.parse(input)
}

function remember(seasons: Season[]): Map<string, number> {
  const appearances = new Map<string, number>()
  for (const season of seasons) {
    const start = dayNumber(season.startDate)
    season.lineups.forEach((lineup, offset) => {
      for (const id of lineup) appearances.set(id, start + offset)
    })
  }
  return appearances
}

function seededRank(key: string): number {
  let hash = 2166136261
  for (let index = 0; index < key.length; index++) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619)
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
  return (hash ^ (hash >>> 13)) >>> 0
}

const difficultyRank = { easy: 0, medium: 1, hard: 2 } as const

function generateRows(season: Season, lastSeen: Map<string, number>, count: number): string[][] {
  const atlas = createAtlas(season.content.atlas)
  const pool = season.content.dataset.locations.map(location => ({
    id: location.id,
    difficulty: difficultyRank[location.difficulty],
    region: atlas.path(location.mapId)[1].id,
  }))
  const firstDay = dayNumber(season.startDate) + season.lineups.length
  return Array.from({ length: count }, (_, offset) => {
    const day = firstDay + offset
    const available = pool.filter(({ id }) => day - (lastSeen.get(id) ?? -Infinity) >= season.cooldownDays)
    if (available.length < ROUND_COUNT) throw new Error('The frozen inventory cannot fill five distinct rounds')
    const byRegion = new Map<string, number>()
    return ROUND_DIFFICULTIES.map((difficulty, slot) => {
      const needSecondRegion = slot === ROUND_COUNT - 1 && byRegion.size === 1
        && available.some(({ region }) => !byRegion.has(region))
      let selected = 0
      let bestPreference = Infinity
      let bestTie = Infinity
      available.forEach((candidate, index) => {
        const previousRounds = byRegion.get(candidate.region) ?? 0
        const spreadPenalty = needSecondRegion && previousRounds > 0 ? 100 : 0
        const preference = spreadPenalty + 10 * Math.abs(candidate.difficulty - difficultyRank[difficulty]) + previousRounds
        const tie = seededRank(`${season.version}/${day}/${slot}/${candidate.id}`)
        const winsTie = tie < bestTie || (tie === bestTie && candidate.id < available[selected].id)
        if (preference < bestPreference || (preference === bestPreference && winsTie)) {
          selected = index
          bestPreference = preference
          bestTie = tie
        }
      })
      const [{ id, region }] = available.splice(selected, 1)
      lastSeen.set(id, day)
      byRegion.set(region, (byRegion.get(region) ?? 0) + 1)
      return id
    })
  })
}

const freezeOptions = z.object({
  startDate: calendarDate,
  days: z.number().int().min(1).max(MAX_FREEZE_DAYS),
  version: idSchema,
  requestedCooldownDays: cooldownSchema.default(90),
  publishedThrough: calendarDate.optional(),
}).strict()

export function freezeSchedule(
  content: Content,
  options: z.input<typeof freezeOptions>,
  previous?: FrozenSchedule,
): FrozenSchedule {
  const { startDate, days, version, requestedCooldownDays, publishedThrough } = freezeOptions.parse(options)
  if (dayNumber(startDate) + days - 1 > lastCalendarDay) {
    throw new Error('Frozen lineups extend beyond the supported UTC calendar')
  }
  const snapshot = contentSchema.parse(content)
  const cooldownDays = availableCooldown(snapshot.dataset.locations.length, requestedCooldownDays)
  if (cooldownDays < 1) throw new Error('At least five verified locations are required to freeze a schedule')
  snapshot.atlas.layers.sort((a, b) => a.id < b.id ? -1 : 1)
  snapshot.dataset.locations.sort((a, b) => a.id < b.id ? -1 : 1)

  const seasons = previous ? parseSchedule(previous).seasons : []
  const last = seasons.at(-1)
  if (last) {
    const protectedThrough = publishedThrough ?? utcDate(new Date())
    if (startDate <= protectedThrough) throw new Error('A new season must begin after the published-through UTC date')
    const missing = dayNumber(startDate) - dayNumber(last.startDate) - last.lineups.length
    if (missing < 0) throw new Error('A new season cannot overlap frozen lineups')
    if (missing > MAX_FALLBACK_DAYS) throw new Error('A new season exceeds the previous fallback horizon')
    last.lineups.push(...generateRows(last, remember(seasons), missing))
  }
  const season: Season = { version, startDate, content: snapshot, requestedCooldownDays, cooldownDays, lineups: [] }
  season.lineups = generateRows(season, remember(seasons), days)
  return parseSchedule({ schemaVersion: 1, seasons: [...seasons, season] })
}

export function readPuzzle(schedule: FrozenSchedule, date: string): DailyPuzzle | undefined {
  if (!calendarDate.safeParse(date).success) return undefined
  let index = schedule.seasons.length - 1
  while (index >= 0 && schedule.seasons[index].startDate > date) index--
  const season = schedule.seasons[index]
  if (!season) return undefined
  const offset = dayNumber(date) - dayNumber(season.startDate)
  const extra = offset - season.lineups.length + 1
  if (extra > MAX_FALLBACK_DAYS) return undefined
  const ids = extra > 0
    ? generateRows(season, remember(schedule.seasons), extra).at(-1)!
    : season.lineups[offset]
  const locations = new Map(season.content.dataset.locations.map(location => [location.id, location]))
  return structuredClone({
    date,
    version: season.version,
    atlasVersion: season.content.atlas.version,
    atlas: season.content.atlas,
    rounds: ids.map(id => locations.get(id)!),
  })
}
