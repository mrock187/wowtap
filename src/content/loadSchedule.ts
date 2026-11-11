import { parseSchedule, type FrozenSchedule } from '../engine/schedule'

export async function loadSchedule(signal?: AbortSignal): Promise<FrozenSchedule | null> {
  if (!__HAS_GAME_SCHEDULE__) return null
  const response = await fetch(import.meta.env.BASE_URL + 'game/schedule.json', { signal, headers: { Accept: 'application/json' } })
  if (response.status === 404 || response.headers.get('content-type')?.startsWith('text/html')) return null
  if (!response.ok) throw new Error(`Atlas request failed (${response.status})`)

  const schedule = parseSchedule(await response.json())
  const rights = import.meta.env.DEV && import.meta.env.MODE === 'qa' ? 'fixture'
    : import.meta.env.DEV && import.meta.env.MODE === 'local-forever' ? 'local-only' : 'approved'
  const allowed = rights === 'approved' ? ['approved', 'user-authorized'] : [rights]
  if (schedule.seasons.some(season => season.content.atlas.layers.some(layer => !allowed.includes(layer.rights)))) {
    throw new Error('Atlas includes unapproved assets')
  }
  return schedule
}
