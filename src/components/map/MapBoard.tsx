import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Atlas } from '../../domain/atlas'
import type { Answer, MapLayer, Point } from '../../domain/content'
import type { Guess } from '../../engine/scoring'
import './map.css'

type Frame = { id: string; center: Point; zoom: number }
type Reveal = { mapId: string; answers: Answer[]; closest: Point }
type MapBoardProps = {
  atlas: Atlas
  guess: Guess | null
  onPin: (guess: Guess) => void
  reveal?: Reveal
}

const layerTitle: Record<MapLayer['kind'], string> = {
  world: 'World', continent: 'Continent', zone: 'Zone', city: 'Detailed map',
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function initialFrame(atlas: Atlas, id: string): Frame {
  return { id, center: atlas.toWorld(id, { x: .5, y: .5 }), zoom: 1 }
}

function keepInside(atlas: Atlas, frame: Frame): Frame {
  const { left, top, width, height } = atlas.bounds(frame.id)
  const halfWidth = width / frame.zoom / 2
  const halfHeight = height / frame.zoom / 2
  return {
    ...frame,
    center: {
      x: clamp(frame.center.x, left + halfWidth, left + width - halfWidth),
      y: clamp(frame.center.y, top + halfHeight, top + height - halfHeight),
    },
  }
}

export function MapBoard({ atlas, guess, onPin, reveal }: MapBoardProps) {
  const [frames, setFrames] = useState(() => [initialFrame(atlas, atlas.world.id)])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [images, setImages] = useState<Record<string, 'loaded' | 'error'>>({})
  const [retry, setRetry] = useState(0)
  const clipId = useId()
  const svg = useRef<SVGSVGElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const moved = useRef(false)
  const start = useRef<Point | null>(null)

  // Reveal on the whole atlas so answers and guesses in different regions remain visible.
  // The reveal mounts a separate board so its initial view cannot influence guessing.
  const frame = frames[frames.length - 1]
  const layer = atlas.layer(frame.id)
  const extent = atlas.bounds(frame.id)
  const width = extent.width / frame.zoom
  const height = extent.height / frame.zoom
  const left = frame.center.x - width / 2
  const top = frame.center.y - height / 2
  const unit = 1 / (Math.min(size.width / width, size.height / height) || 1)
  const imageStatus = images[layer.id]
  const worldGuess = guess ? atlas.toWorld(guess.mapId, guess.point) : null

  useEffect(() => {
    const element = svg.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setSize({
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function toWorld(client: Point): Point | null {
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return null
    const point = new DOMPoint(client.x, client.y).matrixTransform(matrix.inverse())
    return { x: point.x, y: point.y }
  }

  function updateFrame(update: (current: Frame) => Frame) {
    setFrames(current => [...current.slice(0, -1), keepInside(atlas, update(current[current.length - 1]))])
  }

  function zoomBy(multiplier: number, anchor?: Point, dx = 0, dy = 0) {
    updateFrame(current => {
      const zoom = clamp(current.zoom * multiplier, 1, atlas.layer(current.id).maxZoom)
      const fixed = anchor ?? current.center
      const scale = current.zoom / zoom
      return {
        ...current, zoom,
        center: {
          x: fixed.x + (current.center.x - fixed.x - dx * unit) * scale,
          y: fixed.y + (current.center.y - fixed.y - dy * unit) * scale,
        },
      }
    })
  }

  // React's delegated wheel listener is passive. Listen on the viewport to prevent page
  // scrolling while an unmodified wheel gesture is zooming the atlas.
  useEffect(() => {
    const element = svg.current
    if (!element) return
    function onWheel(event: WheelEvent) {
      if (event.ctrlKey || event.metaKey) return
      event.preventDefault()
      const matrix = element?.getScreenCTM()
      if (!matrix) return
      const anchor = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
      setFrames(current => {
        const active = current[current.length - 1]
        const zoom = clamp(active.zoom * (event.deltaY > 0 ? .8 : 1.25), 1, atlas.layer(active.id).maxZoom)
        const scale = active.zoom / zoom
        const next = keepInside(atlas, {
          ...active, zoom,
          center: {
            x: anchor.x + (active.center.x - anchor.x) * scale,
            y: anchor.y + (active.center.y - anchor.y) * scale,
          },
        })
        return [...current.slice(0, -1), next]
      })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [atlas])

  function pin(world: Point | null) {
    if (reveal || !world || imageStatus !== 'loaded') return
    const point = atlas.fromWorld(frame.id, world)
    const epsilon = 1e-9
    if (point.x < -epsilon || point.x > 1 + epsilon || point.y < -epsilon || point.y > 1 + epsilon) return
    onPin({ mapId: frame.id, point: { x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) } })
  }

  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    const client = { x: event.clientX, y: event.clientY }
    if (!pointers.current.size) {
      moved.current = false
      start.current = client
    } else {
      moved.current = true
    }
    pointers.current.set(event.pointerId, client)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const client = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, client)
    const other = [...pointers.current].find(([id]) => id !== event.pointerId)?.[1]
    if (other) {
      const distance = Math.hypot(previous.x - other.x, previous.y - other.y)
      if (distance < 1) return
      const multiplier = Math.hypot(client.x - other.x, client.y - other.y) / distance
      const before = midpoint(previous, other)
      const after = midpoint(client, other)
      zoomBy(multiplier, toWorld(before) ?? undefined, after.x - before.x, after.y - before.y)
      return
    }
    if (start.current && Math.hypot(client.x - start.current.x, client.y - start.current.y) > 5) moved.current = true
    if (moved.current) zoomBy(1, undefined, client.x - previous.x, client.y - previous.y)
  }

  function pointerUp(event: PointerEvent<SVGSVGElement>) {
    if (!pointers.current.delete(event.pointerId)) return
    if (!pointers.current.size && !moved.current) pin(toWorld({ x: event.clientX, y: event.clientY }))
  }

  function enter(id: string) {
    setFrames(current => [...current, initialFrame(atlas, id)])
  }

  function back() {
    setFrames(current => current.length > 1 ? current.slice(0, -1) : current)
  }

  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget) return
    const arrows: Record<string, Point> = {
      ArrowLeft: { x: 36, y: 0 }, ArrowRight: { x: -36, y: 0 },
      ArrowUp: { x: 0, y: 36 }, ArrowDown: { x: 0, y: -36 },
    }
    if (event.key in arrows) {
      const offset = arrows[event.key]
      zoomBy(1, undefined, offset.x, offset.y)
    } else if (event.key === '+' || event.key === '=') zoomBy(1.4)
    else if (event.key === '-') zoomBy(1 / 1.4)
    else if (event.key === 'Home') updateFrame(() => initialFrame(atlas, frame.id))
    else if (event.key === 'Enter' || event.key === ' ') pin(frame.center)
    else return
    event.preventDefault()
  }

  return (
    <section className="atlas" aria-label={reveal ? 'Answer atlas' : 'Guess atlas'}>
      <div className="map-toolbar">
        <div className="map-breadcrumb" aria-label="Current map level">
          {frames.map((item, index) => (
            <span key={item.id}>{index > 0 && <span aria-hidden="true"> / </span>}{layerTitle[atlas.layer(item.id).kind]}</span>
          ))}
        </div>
        {frames.length > 1 && <button className="map-control" onClick={back}>← Back</button>}
        <div className="map-zoom" aria-label="Zoom controls">
          <button className="map-control" aria-label="Zoom out" disabled={frame.zoom <= 1} onClick={() => zoomBy(1 / 1.4)}>−</button>
          <button className="map-control" aria-label="Zoom in" disabled={frame.zoom >= layer.maxZoom} onClick={() => zoomBy(1.4)}>+</button>
          <button className="map-control map-reset" onClick={() => updateFrame(() => initialFrame(atlas, frame.id))}>Fit</button>
        </div>
      </div>
      <div className="map-canvas">
        <svg
          ref={svg}
          className="atlas-viewport"
          viewBox={`${left} ${top} ${width} ${height}`}
          role="group"
          aria-label={reveal ? 'Interactive revealed map' : 'Interactive unlabeled map'}
          tabIndex={0}
          onKeyDown={keyboard}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={event => { pointers.current.delete(event.pointerId) }}
          onLostPointerCapture={event => { pointers.current.delete(event.pointerId) }}
        >
          <defs><clipPath id={clipId}><rect x={left} y={top} width={width} height={height} /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}>
          <image
            key={`${layer.id}:${retry}`}
            href={`/${layer.image}${retry ? `?retry=${retry}` : ''}`}
            x={extent.left} y={extent.top} width={extent.width} height={extent.height}
            preserveAspectRatio="none"
            onLoad={() => setImages(current => ({ ...current, [layer.id]: 'loaded' }))}
            onError={() => setImages(current => ({ ...current, [layer.id]: 'error' }))}
          />
          {imageStatus === 'loaded' && atlas.children(layer.id).map(child => {
            const center = atlas.toWorld(child.id, { x: .5, y: .5 })
            if (center.x < left || center.x > left + width || center.y < top || center.y > top + height) return null
            const label = child.kind === 'city' ? 'Enter detailed map' : `Open ${child.kind} map`
            return (
              <g
                key={child.id} className="map-portal" role="button" aria-label={label} tabIndex={0}
                transform={`translate(${center.x} ${center.y}) scale(${unit})`}
                onPointerDown={event => event.stopPropagation()}
                onClick={() => enter(child.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    enter(child.id)
                  }
                }}
              >
                <rect x="-22" y="-22" width="44" height="44" fill="transparent" />
                <circle r="15" />
                <path d="M-6 0H6M0-6V6" />
              </g>
            )
          })}
          {reveal && worldGuess && (
            <line className="map-answer-line" x1={worldGuess.x} y1={worldGuess.y} x2={reveal.closest.x} y2={reveal.closest.y} />
          )}
          {reveal?.answers.map((answer, index) => {
            if (answer.kind === 'point') {
              const point = atlas.toWorld(reveal.mapId, answer.point)
              return <circle key={index} className="map-answer-point" cx={point.x} cy={point.y} r={8 * unit} />
            }
            const points = answer.vertices.map(vertex => atlas.toWorld(reveal.mapId, vertex))
            return <polygon key={index} className="map-answer-area" points={points.map(point => `${point.x},${point.y}`).join(' ')} />
          })}
          {worldGuess && (
            <g className="map-pin" aria-label="Your pin" transform={`translate(${worldGuess.x} ${worldGuess.y}) scale(${unit})`}>
              <path d="M0 0C-4-6-10-11-10-17a10 10 0 0 1 20 0C10-11 4-6 0 0Z" />
              <circle cy="-17" r="3" />
            </g>
          )}
          <g className="map-crosshair" aria-hidden="true" transform={`translate(${frame.center.x} ${frame.center.y}) scale(${unit})`}>
            <path d="M-9 0H-4M4 0H9M0-9V-4M0 4V9" />
          </g>
          </g>
        </svg>
        {imageStatus === undefined && <p className="map-message" role="status">Unfolding the map…</p>}
        {imageStatus === 'error' && (
          <div className="map-message" role="status">
            <p>This map could not load.</p>
            <button className="map-control" onClick={() => {
              setImages(current => {
                const next = { ...current }
                delete next[layer.id]
                return next
              })
              setRetry(value => value + 1)
            }}>Retry map</button>
          </div>
        )}
      </div>
      <p className="map-caption">
        {reveal ? 'Gold marks the accepted answer. Red marks your pin.' : 'Tap to place a pin. Drag to pan, scroll or pinch to zoom. Use + on the map to open detail.'}
      </p>
    </section>
  )
}
