import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Cover, Shell } from './components/Shell'
import { Expedition } from './components/game/Expedition'
import { formatDate } from './components/game/resultText'
import { MapArtwork } from './components/map/MapArtwork'
import { worldProjection } from './components/map/worldProjection'
import { loadSchedule } from './content/loadSchedule'
import { createAtlas } from './domain/atlas'
import { readPuzzle, utcDate, type DailyPuzzle, type FrozenSchedule } from './engine/schedule'
import { createJournalStore, playAction, recordFor, startRecord, streaks, type GameRecord } from './storage/journal'

const store = createJournalStore()

type Loading = { state: 'loading' | 'missing' | 'error' } | { state: 'ready'; schedule: FrozenSchedule }
type Active = { date: string; mode: 'official' | 'history' } | { date: string; mode: 'practice'; record: GameRecord }

export function App() {
  const [data, setData] = useState<Loading>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [today, setToday] = useState(() => utcDate(new Date()))
  const [active, setActive] = useState<Active | null>(null)
  const journal = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const history = useRef<HTMLDialogElement>(null)
  const historyTitle = useId()

  useEffect(() => {
    const controller = new AbortController()
    loadSchedule(controller.signal).then(schedule => {
      if (!controller.signal.aborted) setData(schedule ? { state: 'ready', schedule } : { state: 'missing' })
    }, () => {
      if (!controller.signal.aborted) setData({ state: 'error' })
    })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    const tick = () => setToday(utcDate(new Date()))
    const interval = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  const schedule = data.state === 'ready' ? data.schedule : null
  const todayPuzzle = useMemo(() => schedule && readPuzzle(schedule, today), [schedule, today])
  const live = active?.mode === 'official' && active.date !== today ? null : active
  const liveDate = live?.date
  const livePuzzle = useMemo(() => schedule && liveDate && readPuzzle(schedule, liveDate), [schedule, liveDate])
  const dailyRecord = todayPuzzle ? recordFor(journal, todayPuzzle) : undefined
  const liveRecord = livePuzzle ? recordFor(journal, livePuzzle) : undefined

  const completed = useMemo(() => {
    if (!schedule) return []
    return Object.keys(journal).filter(date => date <= today && journal[date].guesses.length === 5).flatMap(date => {
      const puzzle = readPuzzle(schedule, date)
      return puzzle && recordFor(journal, puzzle) ? [puzzle] : []
    }).sort((a, b) => b.date.localeCompare(a.date))
  }, [journal, schedule, today])
  const stats = streaks(completed.map(puzzle => puzzle.date), today)
  const qa = import.meta.env.DEV && import.meta.env.MODE === 'qa'
  const localForever = import.meta.env.DEV && import.meta.env.MODE === 'local-forever'
  const todayAtlas = useMemo(() => todayPuzzle && createAtlas(todayPuzzle.atlas), [todayPuzzle])

  function start() {
    if (!todayPuzzle) return
    setActive({ date: todayPuzzle.date, mode: 'official' })
    void store.update(todayPuzzle)
  }

  function openHistory(puzzle: DailyPuzzle, practice: boolean) {
    history.current?.close()
    setActive(practice
      ? { date: puzzle.date, mode: 'practice', record: startRecord(puzzle.version) }
      : { date: puzzle.date, mode: 'history' })
  }

  function retry() {
    setData({ state: 'loading' })
    setAttempt(value => value + 1)
  }

  let record = live?.mode === 'practice' ? live.record : liveRecord
  if (live?.mode === 'history' && record?.revealing) record = { ...record, revealing: false }

  return (
    <Shell actions={
      <>
        <button className="header-button" onClick={() => history.current?.showModal()}>Journal</button>
        <dialog className="help-dialog" ref={history} aria-labelledby={historyTitle}>
          <p className="eyebrow">Cartographer’s log</p>
          <h2 id={historyTitle}>Your journal</h2>
          <dl className="journal-stats">
            <div><dt>Completed</dt><dd>{stats.completed}</dd></div>
            <div><dt>Current streak</dt><dd>{stats.current}</dd></div>
            <div><dt>Best streak</dt><dd>{stats.best}</dd></div>
          </dl>
          <h3>Past expeditions</h3>
          {completed.some(puzzle => puzzle.date < today) ? (
            <ul className="history-list">
              {completed.filter(puzzle => puzzle.date < today).map(puzzle => (
                <li key={puzzle.date}>
                  <time dateTime={puzzle.date}>{formatDate(puzzle.date)}</time>
                  <button className="button" onClick={() => openHistory(puzzle, false)}>View result</button>
                  <button className="button" onClick={() => openHistory(puzzle, true)}>Practice</button>
                </li>
              ))}
            </ul>
          ) : <p>Completed expeditions appear here after their UTC day ends.</p>}
          <form method="dialog"><button className="button primary">Close journal</button></form>
        </dialog>
      </>
    }>
      {qa && <p className="qa-banner">Local QA · Fictional atlas and locations</p>}
      {localForever && <p className="qa-banner">Local preview · WoW: Forever {schedule?.seasons[0].content.atlas.build}</p>}
      {live && livePuzzle && record ? (
        <Expedition
          key={`${live.date}:${live.mode}`}
          puzzle={livePuzzle}
          record={record}
          practice={live.mode === 'practice'}
          onReturn={() => setActive(null)}
          onAction={action => {
            if (live.mode === 'official') void store.update(livePuzzle, action)
            if (live.mode === 'practice') {
              setActive(current => current?.mode === 'practice' && current.date === live.date
                ? { ...current, record: playAction(current.record, action) } : current)
            }
          }}
        />
      ) : (
        <Cover map={todayAtlas && <CoverMap atlas={todayAtlas} localForever={localForever} />}>
          {todayPuzzle ? (
            <div className="cover-status">
              <p className="cover-date"><time dateTime={today}>{formatDate(today)}</time> · UTC</p>
              <button className="button primary cover-start" onClick={start}>
                {dailyRecord?.guesses.length === 5 && !dailyRecord.revealing ? 'View today’s result'
                  : dailyRecord ? 'Resume expedition' : 'Begin expedition'} <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : (
            <div className="cover-status" role="status">
              {data.state === 'loading' && 'Opening the atlas…'}
              {data.state === 'missing' && 'Today’s expedition is unavailable while the Forever atlas is in preparation.'}
              {data.state === 'ready' && 'The atlas has no expedition for this UTC date.'}
              {data.state === 'error' && <>The atlas could not load. <button className="button" onClick={retry}>Try again</button></>}
            </div>
          )}
        </Cover>
      )}
    </Shell>
  )
}

function CoverMap({ atlas, localForever }: { atlas: ReturnType<typeof createAtlas>; localForever: boolean }) {
  const world = atlas.world
  const extent = atlas.bounds(world.id)
  const projection = worldProjection(atlas)
  const display = projection?.bounds ?? extent
  const path = localForever && world.uiMapId ? `terrain/${world.uiMapId}.png` : world.image

  return (
    <svg className="cover-map" viewBox={`0 0 ${display.width} ${display.height}`} aria-hidden="true">
      <MapArtwork extent={extent} projection={projection} width={extent.width} height={extent.height}
        href={import.meta.env.BASE_URL + path} />
    </svg>
  )
}
