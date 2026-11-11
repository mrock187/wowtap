import { useId, type SVGProps } from 'react'
import type { Atlas } from '../../domain/atlas'
import type { worldProjection } from './worldProjection'

type MapArtworkProps = SVGProps<SVGImageElement> & {
  extent: ReturnType<Atlas['bounds']>
  projection?: ReturnType<typeof worldProjection>
}

export function MapArtwork({ extent, projection, ...image }: MapArtworkProps) {
  const id = useId()
  if (!projection) return <image preserveAspectRatio="none" {...image} />

  return (
    <>
      <defs>
        <image id={id} preserveAspectRatio="none" {...image} />
        {projection.strips.map(({ x, width }, index) => (
          <clipPath key={x} id={`${id}-${index}`}>
            <rect x={x} width={width} y={extent.top} height={extent.height} />
          </clipPath>
        ))}
      </defs>
      {projection.strips.map(({ x, offset, scale }, index) => (
        <g key={x} transform={`matrix(${scale} 0 0 1 ${offset} 0)`} clipPath={`url(#${id}-${index})`}>
          <use href={`#${id}`} />
        </g>
      ))}
    </>
  )
}
