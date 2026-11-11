import type { Atlas } from '../../domain/atlas'
import type { Point } from '../../domain/content'

type Bounds = ReturnType<Atlas['bounds']>
type Size = Pick<Bounds, 'width' | 'height'>
export type Frame = { id: string; center: Point; zoom: number }

export function frameSize(bounds: Size, viewport: Size, zoom: number, fullWidth: boolean): Size {
  if (!fullWidth || !viewport.width || !viewport.height) {
    return { width: bounds.width / zoom, height: bounds.height / zoom }
  }
  const scale = Math.min(viewport.width / bounds.width, viewport.height / bounds.height) * zoom
  return { width: viewport.width / scale, height: viewport.height / scale }
}

export function constrain(frame: Frame, bounds: Bounds, size: Size): Frame {
  const x = Math.max(0, (bounds.width - size.width) / 2)
  const y = Math.max(0, (bounds.height - size.height) / 2)
  const midX = bounds.left + bounds.width / 2
  const midY = bounds.top + bounds.height / 2
  return {
    ...frame,
    center: {
      x: Math.min(midX + x, Math.max(midX - x, frame.center.x)),
      y: Math.min(midY + y, Math.max(midY - y, frame.center.y)),
    },
  }
}
