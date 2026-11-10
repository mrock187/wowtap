import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createAtlas } from '../../domain/atlas'
import type { Location } from '../../domain/content'
import { scoreGuess } from '../../engine/scoring'
import type { DailyPuzzle } from '../../engine/schedule'
import type { GameAction, GameRecord } from '../../storage/journal'
import { MapBoard } from '../map/MapBoard'
import { Compass } from '../Shell'
import { formatDate, scoreSymbol, shareText } from './resultText'
import './game.css'

const category: Record<Location['category'], string> = {
  city: 'City', landmark: 'Landmark', settlement: 'Settlement',
  'dungeon-entrance': 'Dungeon entrance', npc: 'Character',
}
const number = (value: number) => value.toLocaleString('en-US')

type ExpeditionProps = {
  puzzle: DailyPuzzle
  record: GameRecord
  practice: boolean
  onAction: (action: GameAction) => void
  onReturn: () => void
}

export function Expedition({ puzzle, record, practice, onAction, onReturn }: ExpeditionProps) {
  const atlas = useMemo(() => createAtlas(puzzle.atlas), [puzzle])
  const scores = useMemo(
    () => record.guesses.map((guess, index) => scoreGuess(atlas, puzzle.rounds[index], guess)),
    [atlas, puzzle, record.guesses],
  )
  const count = record.guesses.length
  const total = scores.reduce((sum, score) => sum + score.points, 0)
  const round = record.revealing ? count - 1 : count
  const location = puzzle.rounds[round]
  const score = scores[round]
  const title = useRef<HTMLHeadingElement>(null)

  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [puzzle.date, round, record.revealing])

  if (!location) {
    return (
      <Result
        puzzle={puzzle}
        scores={scores.map(result => result.points)}
        practice={practice}
        onReturn={onReturn}
      />
    )
  }

  return (
    <section className="expedition" aria-label={practice ? 'Practice expedition' : 'Daily expedition'}>
      <div className="expedition-meta">
        <button className="button quiet" onClick={onReturn}>← Daily atlas</button>
        <p>{practice ? 'Practice · ' : ''}<time dateTime={puzzle.date}>{formatDate(puzzle.date)}</time> · UTC</p>
      </div>
      <div className="question">
        <div>
          <p className="eyebrow">Round {round + 1} of 5 <span aria-hidden="true">·</span> {category[location.category]}</p>
          <h1 ref={title} tabIndex={-1}>{location.name}</h1>
        </div>
        <ol className="round-track" aria-label="Round progress">
          {puzzle.rounds.map((_, index) => (
            <li key={index} aria-current={round === index ? 'step' : undefined} className={index < count ? 'done' : ''}>
              <span className="sr-only">Round </span>{index + 1}
            </li>
          ))}
        </ol>
      </div>
      <div className="expedition-grid">
        <MapBoard
          key={`${puzzle.date}:${round}:${record.revealing}`}
          atlas={atlas}
          guess={record.revealing ? record.guesses[round] : record.pending}
          onPin={guess => onAction({ type: 'pin', round: count, guess })}
          reveal={score && { mapId: location.mapId, answers: location.answers, closest: score.answer }}
        />
        <aside className="round-panel" aria-label={record.revealing ? 'Round result' : 'Pin and confirm'}>
          <p className="eyebrow">{record.revealing ? 'Location revealed' : 'Your guess'}</p>
          {score ? (
            <>
              <div className="round-score"><strong>{number(score.points)}</strong><span> / 5,000</span></div>
              <p>{score.error < .05 ? 'On the mark' : `${number(Math.round(score.error * 10) / 10)} atlas units away`}</p>
              {score.precisionCapped && <p className="round-note">The detailed map earns full precision for this location.</p>}
              {score.differentContinent && <p className="round-note">Your pin was on a different landmass.</p>}
              <p className="round-note">{location.explanation}</p>
              <button className="button primary" onClick={() => onAction({ type: 'next', round: count })}>
                {count === 5 ? 'See results' : 'Next round'} <span aria-hidden="true">→</span>
              </button>
            </>
          ) : (
            <>
              <h2>{record.pending ? 'Pin placed' : 'Mark your location'}</h2>
              <p>{record.pending ? 'Move your pin anywhere on the map until you’re ready.' : 'Tap the atlas to drop a pin. Use the detailed maps for a closer look.'}</p>
              <button
                className="button primary"
                disabled={!record.pending}
                onClick={() => onAction({ type: 'confirm', round: count })}
              >Confirm pin</button>
            </>
          )}
          <div className="running-total"><span>Expedition total</span><strong>{number(total)} / 25,000</strong></div>
        </aside>
      </div>
    </section>
  )
}

function Result({ puzzle, scores, practice, onReturn }: {
  puzzle: DailyPuzzle; scores: number[]; practice: boolean; onReturn: () => void
}) {
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const title = useRef<HTMLHeadingElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const shareLabel = useId()
  const total = scores.reduce((sum, score) => sum + score, 0)
  const text = shareText(puzzle.date, scores)
  useEffect(() => { title.current?.focus() }, [])
  useEffect(() => { if (shareState === 'manual') field.current?.select() }, [shareState])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setShareState('copied')
    } catch {
      setShareState('manual')
    }
  }

  return (
    <section className="result-card" aria-labelledby="result-title">
      <Compass className="result-compass" size={70} />
      <p className="eyebrow">{practice ? 'Practice result' : 'Expedition complete'} · {formatDate(puzzle.date)}</p>
      <h1 ref={title} tabIndex={-1} id="result-title">{number(total)}<small> / 25,000</small></h1>
      <ol className="result-rounds" aria-label="Scores by round">
        {scores.map((score, index) => (
          <li key={index}><span>Round {index + 1}</span><strong><span aria-hidden="true">{scoreSymbol(score)}</span> {number(score)}</strong></li>
        ))}
      </ol>
      {practice && <p className="round-note">Practice rounds are kept separate from your official result and streak.</p>}
      <div className="result-actions">
        {!practice && <button className="button primary" onClick={() => { void copy() }}>Share result</button>}
        <button className="button" onClick={onReturn}>Back to daily atlas</button>
      </div>
      {shareState === 'copied' && <p role="status" className="share-status">Result copied.</p>}
      {shareState === 'manual' && (
        <div className="share-fallback">
          <label id={shareLabel} htmlFor="share-text">Copy your spoiler-free result</label>
          <textarea ref={field} aria-labelledby={shareLabel} id="share-text" readOnly value={text} rows={3} />
        </div>
      )}
    </section>
  )
}
