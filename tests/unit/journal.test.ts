import { describe, expect, it } from 'vitest'
import { decodeJournal, playAction, startRecord, streaks } from '../../src/storage/journal'
import { shareText } from '../../src/components/game/resultText'

const guess = { mapId: 'world', point: { x: .4, y: .3 } }

describe('local journal', () => {
  it('locks a submission once and discards stale round actions', () => {
    const initial = startRecord('test-v1')
    const marked = playAction(initial, { type: 'pin', guess, round: 0 })
    const confirmed = playAction(marked, { type: 'confirm', round: 0 })
    expect(confirmed).toEqual({ ...initial, pending: null, guesses: [guess], revealing: true })
    expect(playAction(confirmed, { type: 'confirm', round: 0 })).toBe(confirmed)
    expect(playAction(confirmed, { type: 'pin', guess, round: 1 })).toBe(confirmed)
    expect(playAction(confirmed, { type: 'next', round: 1 }).revealing).toBe(false)
  })

  it('guards completed official games even after their final reveal', () => {
    const record = { ...startRecord('test-v1'), guesses: Array.from({ length: 5 }, () => guess) }
    expect(playAction(record, { type: 'pin', round: 5, guess })).toBe(record)
    expect(playAction(record, { type: 'confirm', round: 5 })).toBe(record)
  })

  it('migrates older records and salvages valid dates from damaged state', () => {
    const v1 = { version: 'test-v1', revealing: true, guesses: [guess] }
    const raw = JSON.stringify({ schemaVersion: 1, games: { '2026-11-09': v1, '2026-11-10': null, nonsense: v1 } })
    expect(decodeJournal(raw)).toEqual({ '2026-11-09': { ...v1, pending: null } })
    expect(decodeJournal('not json')).toEqual({})
  })

  it('uses contiguous UTC days and leaves today open until midnight', () => {
    expect(streaks(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-02')).toEqual({ completed: 3, best: 3, current: 3 })
    expect(streaks(['2024-02-28', '2024-02-29'], '2024-03-02')).toEqual({ completed: 2, best: 2, current: 0 })
  })

  it('shares exactly the date, total and five symbols', () => {
    expect(shareText('2026-11-10', [5000, 4250, 1500, 700, 5000]))
      .toBe('WoWtap 2026-11-10 | 16450/25000 | 🟩🟨🟧⬛🟩')
  })
})
