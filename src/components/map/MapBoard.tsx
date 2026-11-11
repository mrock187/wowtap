import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { detailTerrain } from '../../content/terrainDetail'
import type { Atlas } from '../../domain/atlas'
import type { Answer, MapLayer, Point } from '../../domain/content'
import type { Guess } from '../../engine/scoring'
import { constrain, frameSize, type Frame } from './camera'
import { MapArtwork } from './MapArtwork'
import { worldProjection } from './worldProjection'
import './map.css'

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

function initialFrame(id: string, { left, top, width, height }: ReturnType<Atlas['bounds']>): Frame {
  return { id, center: { x: left + width / 2, y: top + height / 2 }, zoom: 1 }
}

export function MapBoard({ atlas, guess, onPin, reveal }: MapBoardProps) {
  const world = useMemo(() => worldProjection(atlas), [atlas])
  const [frames, setFrames] = useState(() => [
    initialFrame(atlas.world.id, world?.bounds ?? atlas.bounds(atlas.world.id)),
  ])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [images, setImages] = useState<Record<string, 'loaded' | 'error'>>({})
  const [retry, setRetry] = useState(0)
  const clipId = useId()
  const regionClip = useId()
  const svg = useRef<SVGSVGElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const moved = useRef(false)
  const start = useRef<Point | null>(null)

  // Reveal on the whole atlas so answers and guesses in different regions remain visible.
  // The reveal mounts a separate board so its initial view cannot influence guessing.
  const active = frames[frames.length - 1]
  const layer = atlas.layer(active.id)
  const projection = active.id === atlas.world.id ? world : null
  const extent = atlas.bounds(active.id)
  const display = projection?.bounds ?? extent
  const fullWidth = Boolean(world && layer.kind === 'continent')
  const { width, height } = frameSize(display, size, active.zoom, fullWidth)
  const frame = constrain(active, display, { width, height })
  const terrain = import.meta.env.DEV && import.meta.env.MODE === 'local-forever'
  const detail = detailTerrain(layer)
  const image = terrain && layer.uiMapId ? `terrain/${layer.uiMapId}.png` : layer.image
  const [cropLeft, cropTop, cropRight, cropBottom] = layer.imageCrop ?? [0, 0, 1, 1]
  const imageWidth = extent.width / (cropRight - cropLeft)
  const imageHeight = extent.height / (cropBottom - cropTop)
  const left = frame.center.x - width / 2
  const top = frame.center.y - height / 2
  const unit = 1 / (Math.min(size.width / width, size.height / height) || 1)
  const detailStatus = detail && images[detail.image]
  const imageStatus = detailStatus === 'loaded' ? detailStatus : images[image]
  const artwork = {
    extent,
    x: extent.left - cropLeft * imageWidth,
    y: extent.top - cropTop * imageHeight,
    width: imageWidth,
    height: imageHeight,
  }
  function toDisplay(mapId: string, point: Point) {
    const canonical = atlas.toWorld(mapId, point)
    return projection?.project(canonical) ?? canonical
  }

  const shownGuess = guess ? toDisplay(guess.mapId, guess.point) : null
  const shownAnswer = reveal && (projection?.project(reveal.closest) ?? reveal.closest)
  const details = atlas.children(layer.id).map(child => ({
    child, center: toDisplay(child.id, { x: .5, y: .5 }),
  })).filter(({ center }) => center.x >= left && center.x <= left + width
    && center.y >= top && center.y <= top + height)

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

  function fromClient(client: Point): Point | null {
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return null
    const point = new DOMPoint(client.x, client.y).matrixTransform(matrix.inverse())
    return { x: point.x, y: point.y }
  }

  function updateFrame(update: (current: Frame) => Frame) {
    setFrames(current => {
      const previous = constrain(current[current.length - 1], display, { width, height })
      const next = update(previous)
      return [...current.slice(0, -1), constrain(next, display, frameSize(display, size, next.zoom, fullWidth))]
    })
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
        const previous = constrain(current[current.length - 1], display, { width, height })
        const zoom = clamp(previous.zoom * (event.deltaY > 0 ? .8 : 1.25), 1, layer.maxZoom)
        const scale = previous.zoom / zoom
        const next = constrain({
          ...previous, zoom,
          center: {
            x: anchor.x + (previous.center.x - anchor.x) * scale,
            y: anchor.y + (previous.center.y - anchor.y) * scale,
          },
        }, display, frameSize(display, size, zoom, fullWidth))
        return [...current.slice(0, -1), next]
      })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [display, size, width, height, fullWidth, layer.maxZoom])

  function pin(position: Point) {
    if (reveal || imageStatus !== 'loaded') return
    const point = atlas.fromWorld(frame.id, projection?.unproject(position) ?? position)
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
      zoomBy(multiplier, fromClient(before) ?? undefined, after.x - before.x, after.y - before.y)
      return
    }
    if (start.current && Math.hypot(client.x - start.current.x, client.y - start.current.y) > 5) moved.current = true
    if (moved.current) zoomBy(1, undefined, client.x - previous.x, client.y - previous.y)
  }

  function pointerUp(event: PointerEvent<SVGSVGElement>) {
    if (!pointers.current.delete(event.pointerId) || pointers.current.size || moved.current) return
    const position = fromClient({ x: event.clientX, y: event.clientY })
    if (!position || imageStatus !== 'loaded') return
    if (position.x < left || position.x > left + width || position.y < top || position.y > top + height) return
    // Use the actual tap position so touch target adjustment cannot open a nearby layer.
    const detail = details.find(({ center }) => Math.abs(position.x - center.x) <= 22 * unit
      && Math.abs(position.y - center.y) <= 22 * unit)
    if (detail) enter(detail.child.id)
    else pin(position)
  }

  function enter(id: string) {
    const bounds = atlas.bounds(id)
    const next = initialFrame(id, bounds)
    if (world && atlas.layer(id).kind === 'continent' && size.width > 680) {
      const fit = frameSize(bounds, size, 1, true)
      next.zoom = clamp(fit.width / bounds.width * .8, 1, Math.min(2.5, atlas.layer(id).maxZoom))
    }
    setFrames(current => [...current, next])
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
    else if (event.key === 'Home') updateFrame(() => initialFrame(frame.id, display))
    else if (event.key === 'Enter' || event.key === ' ') pin(frame.center)
    else return
    event.preventDefault()
  }

  return (
    <section className="atlas" aria-label={reveal ? 'Answer atlas' : 'Guess atlas'}>
      <div className="map-toolbar">
        {frames.length > 1 && <button className="map-control" onClick={back}>← Back</button>}
        {frames.length > 1 && <div className="map-breadcrumb" aria-label="Current map level">
          {frames.map((item, index) => (
            <span key={item.id}>{index > 0 && <span aria-hidden="true"> / </span>}{layerTitle[atlas.layer(item.id).kind]}</span>
          ))}
        </div>}
        <div className="map-zoom" aria-label="Zoom controls">
          <button className="map-control" aria-label="Zoom out" disabled={frame.zoom <= 1} onClick={() => zoomBy(1 / 1.4)}>−</button>
          <button className="map-control" aria-label="Zoom in" disabled={frame.zoom >= layer.maxZoom} onClick={() => zoomBy(1.4)}>+</button>
          <button className="map-control map-reset" onClick={() => updateFrame(() => initialFrame(frame.id, display))}>Fit</button>
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
          <defs>
            <clipPath id={clipId}><rect x={left} y={top} width={width} height={height} /></clipPath>
            <clipPath id={regionClip}><rect x={extent.left} y={extent.top} width={extent.width} height={extent.height} /></clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
          <g clipPath={fullWidth ? `url(#${regionClip})` : undefined}>
          <MapArtwork
            key={`${image}:${retry}`}
            {...artwork}
            projection={projection}
            href={`${import.meta.env.BASE_URL}${image}${retry ? `?retry=${retry}` : ''}`}
            onLoad={() => setImages(current => ({ ...current, [image]: 'loaded' }))}
            onError={() => setImages(current => ({ ...current, [image]: 'error' }))}
          />
          {detail && detailStatus !== 'error' && (
            <MapArtwork
              key={`${detail.image}:${retry}`}
              {...artwork}
              href={`${import.meta.env.BASE_URL}${detail.image}${retry ? `?retry=${retry}` : ''}`}
              opacity={detailStatus === 'loaded' ? 1 : 0}
              onLoad={() => setImages(current => ({ ...current, [detail.image]: 'loaded' }))}
              onError={() => setImages(current => ({ ...current, [detail.image]: 'error' }))}
            />
          )}
          </g>
          {imageStatus === 'loaded' && details.map(({ child, center }) => {
            const label = child.kind === 'city' ? 'Enter detailed map' : `Open ${child.kind} map`
            return (
              <g
                key={child.id} className="map-portal" role="button" aria-label={label} tabIndex={0}
                transform={`translate(${center.x} ${center.y}) scale(${unit})`}
                onClick={event => {
                  if (event.detail === 0) enter(child.id)
                }}
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
          {shownAnswer && shownGuess && (
            <line className="map-answer-line" x1={shownGuess.x} y1={shownGuess.y} x2={shownAnswer.x} y2={shownAnswer.y} />
          )}
          {reveal?.answers.map((answer, index) => {
            if (answer.kind === 'point') {
              const point = toDisplay(reveal.mapId, answer.point)
              return <circle key={index} className="map-answer-point" cx={point.x} cy={point.y} r={8 * unit} />
            }
            const points = answer.vertices.map(vertex => toDisplay(reveal.mapId, vertex))
            return <polygon key={index} className="map-answer-area" points={points.map(point => `${point.x},${point.y}`).join(' ')} />
          })}
          {shownGuess && (
            <g className="map-pin" aria-label="Your pin" transform={`translate(${shownGuess.x} ${shownGuess.y}) scale(${unit})`}>
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
                delete next[image]
                if (detail) delete next[detail.image]
                return next
              })
              setRetry(value => value + 1)
            }}>Retry map</button>
          </div>
        )}
      </div>
      {reveal && <p className="map-caption">Gold marks the accepted answer. Red marks your pin.</p>}
    </section>
  )
}
