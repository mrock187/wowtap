import { z } from 'zod'
import { idSchema, pointSchema } from '../domain/content'
import type { Guess } from '../engine/scoring'
import type { DailyPuzzle } from '../engine/schedule'

const guessSchema = z.object({ mapId: idSchema, point: pointSchema }).strict()
const gameCore = z.object({
  version: idSchema,
  guesses: z.array(guessSchema).max(5),
  revealing: z.boolean(),
})
const gameSchema = gameCore.extend({ pending: guessSchema.nullable() }).refine(
  game => (!game.revealing || game.guesses.length > 0)
    && (!game.pending || (!game.revealing && game.guesses.length < 5)),
)
const dateSchema = z.iso.date()
export type GameRecord = z.infer<typeof gameSchema>
export type Journal = Record<string, GameRecord>

export type GameAction =
  | { type: 'pin'; round: number; guess: Guess }
  | { type: 'confirm'; round: number }
  | { type: 'next'; round: number }

export function startRecord(version: string): GameRecord {
  return { version, guesses: [], pending: null, revealing: false }
}

export function recordFor(journal: Journal, puzzle: DailyPuzzle): GameRecord | undefined {
  const record = journal[puzzle.date]
  if (record?.version !== puzzle.version) return
  const valid = (guess: Guess) => puzzle.atlas.layers.some(layer => layer.id === guess.mapId)
  if (!record.guesses.every(valid) || (record.pending && !valid(record.pending))) return
  return record
}

export function playAction(record: GameRecord, action: GameAction): GameRecord {
  if (action.round !== record.guesses.length) return record
  if (action.type === 'next') return record.revealing ? { ...record, revealing: false } : record
  if (record.revealing || record.guesses.length === 5) return record
  if (action.type === 'pin') return { ...record, pending: action.guess }
  if (!record.pending) return record
  return { ...record, guesses: [...record.guesses, record.pending], pending: null, revealing: true }
}

export function decodeJournal(raw: string | null): Journal {
  if (!raw) return {}
  try {
    const input: unknown = JSON.parse(raw)
    const envelope = z.object({ schemaVersion: z.union([z.literal(1), z.literal(2)]), games: z.record(z.string(), z.unknown()) }).safeParse(input)
    if (!envelope.success) return {}
    const valid: Journal = {}
    for (const [date, game] of Object.entries(envelope.data.games)) {
      if (!dateSchema.safeParse(date).success) continue
      const legacy = envelope.data.schemaVersion === 1 ? gameCore.safeParse(game) : null
      const candidate = legacy?.success ? { ...legacy.data, pending: null } : game
      const parsed = gameSchema.safeParse(candidate)
      if (parsed.success) valid[date] = parsed.data
    }
    return valid
  } catch {
    return {}
  }
}

export function streaks(dates: string[], today: string) {
  const completed = [...new Set(dates)].filter(date => date <= today).sort()
  const day = (date: string) => Date.parse(date) / 86_400_000
  let best = 0
  let run = 0
  let last = -Infinity
  for (const date of completed) {
    const current = day(date)
    run = current === last + 1 ? run + 1 : 1
    best = Math.max(best, run)
    last = current
  }
  return { completed: completed.length, best, current: last >= day(today) - 1 ? run : 0 }
}

export const JOURNAL_KEY = 'azeroth-pinpoint-journal'
const SCHEMA_VERSION = 2

export function createJournalStore() {
  let memoryOnly = false
  function read(): Journal | undefined {
    if (memoryOnly) return undefined
    try {
      return decodeJournal(window.localStorage.getItem(JOURNAL_KEY))
    } catch {
      memoryOnly = true
      return undefined
    }
  }

  let snapshot = read() ?? {}
  const listeners = new Set<() => void>()

  function notify(journal: Journal) {
    snapshot = journal
    for (const listener of listeners) listener()
  }

  function onStorage(event: StorageEvent) {
    if (event.key === JOURNAL_KEY || event.key === null) notify(read() ?? snapshot)
  }

  function subscribe(listener: () => void) {
    if (listeners.size === 0) window.addEventListener('storage', onStorage)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) window.removeEventListener('storage', onStorage)
    }
  }

  async function update(puzzle: DailyPuzzle, action?: GameAction) {
    function write() {
      const previous = read() ?? snapshot
      const stored = recordFor(previous, puzzle)
      const base = stored ?? startRecord(puzzle.version)
      const next = action ? playAction(base, action) : base
      if (next === stored) {
        if (JSON.stringify(previous) !== JSON.stringify(snapshot)) notify(previous)
        return
      }
      const journal = { ...previous, [puzzle.date]: next }
      try {
        if (!memoryOnly) {
          window.localStorage.setItem(JOURNAL_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, games: journal }))
        }
      } catch {
        memoryOnly = true
      }
      notify(journal)
    }
    try {
      if (navigator.locks) {
        await navigator.locks.request(JOURNAL_KEY, write)
        return
      }
    } catch {
      // Browsers without a working Web Locks implementation use a synchronous write.
    }
    write()
  }

  return { getSnapshot: () => snapshot, subscribe, update }
}
