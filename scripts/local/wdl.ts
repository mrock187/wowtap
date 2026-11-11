const grid = 64
const cells = 16
const tileSize = 1600 / 3

type Tile = { heights: Int16Array; ocean?: Uint16Array }
export type Terrain = (west: number, north: number) => { height: number; ocean: boolean; land?: number } | undefined

export function readTerrain(data: Buffer, includeMidpoints = false): Terrain {
  let table = -1
  for (let offset = 0; offset + 8 <= data.length;) {
    const size = data.readUInt32LE(offset + 4)
    if (offset + 8 + size > data.length) throw new Error('Invalid WDL chunk length')
    if (data.toString('ascii', offset, offset + 4) === 'FOAM' && size === grid * grid * 4) {
      table = offset + 8
      break
    }
    offset += 8 + size
  }
  if (table < 0) throw new Error('WDL tile table missing')
  const tiles: (Tile | undefined)[] = Array.from({ length: grid * grid }, (_, index) => {
    const start = data.readUInt32LE(table + index * 4)
    if (!start) return
    const count = (cells + 1) ** 2
    if (start + 8 + count * 2 > data.length || data.toString('ascii', start, start + 4) !== 'ERAM') {
      throw new Error(`Invalid WDL height tile ${index}`)
    }
    const size = data.readUInt32LE(start + 4)
    const next = start + 8 + size
    if (size < count * 2 || next > data.length) throw new Error(`Invalid WDL height payload ${index}`)
    const sampleCount = includeMidpoints ? count + cells ** 2 : count
    if (size < sampleCount * 2) throw new Error(`Missing WDL midpoint heights for tile ${index}`)
    const heights = Int16Array.from({ length: sampleCount }, (_, i) => data.readInt16LE(start + 8 + i * 2))
    let ocean: Uint16Array | undefined
    if (data.toString('ascii', next, next + 4) === 'EOAM') {
      if (next + 40 > data.length || data.readUInt32LE(next + 4) !== 32) {
        throw new Error(`Invalid WDL ocean payload ${index}`)
      }
      ocean = Uint16Array.from({ length: cells }, (_, i) => data.readUInt16LE(next + 8 + i * 2))
    }
    return { heights, ocean }
  })

  function landCell(x: number, y: number) {
    if (x < 0 || y < 0 || x >= grid * cells || y >= grid * cells) return 0
    const tile = tiles[Math.floor(y / cells) * grid + Math.floor(x / cells)]
    return tile && !((tile.ocean?.[y % cells] ?? 0) & (1 << (x % cells))) ? 1 : 0
  }

  return (west, north) => {
    const column = 32 - west / tileSize
    const row = 32 - north / tileSize
    if (column < 0 || column >= grid || row < 0 || row >= grid) return
    const tile = tiles[Math.floor(row) * grid + Math.floor(column)]
    if (!tile) return
    const x = (column % 1) * cells
    const y = (row % 1) * cells
    const i = Math.floor(x)
    const j = Math.floor(y)
    const u = x % 1
    const v = y % 1
    const nw = j * (cells + 1) + i
    const ne = nw + 1
    const sw = nw + cells + 1
    const se = sw + 1
    const northEdge = tile.heights[nw] * (1 - u) + tile.heights[ne] * u
    const southEdge = tile.heights[sw] * (1 - u) + tile.heights[se] * u
    let height = northEdge * (1 - v) + southEdge * v
    if (includeMidpoints) {
      const midpoint = tile.heights[(cells + 1) ** 2 + j * cells + i]
      const cornerMean = (tile.heights[nw] + tile.heights[ne] + tile.heights[sw] + tile.heights[se]) / 4
      // The midpoint contribution reaches zero smoothly at each shared cell edge.
      const weight = 256 * (u * (1 - u) * v * (1 - v)) ** 2
      height += (midpoint - cornerMean) * weight
    }
    const ocean = Boolean((tile.ocean?.[j] ?? 0) & (1 << i))
    if (includeMidpoints) {
      // Interpolate cell-center mask samples so diagonal shores have continuous edges.
      const centerX = column * cells - .5
      const centerY = row * cells - .5
      const left = Math.floor(centerX)
      const top = Math.floor(centerY)
      const fx = centerX - left
      const fy = centerY - top
      const north = landCell(left, top) * (1 - fx) + landCell(left + 1, top) * fx
      const south = landCell(left, top + 1) * (1 - fx) + landCell(left + 1, top + 1) * fx
      return { height, ocean, land: north * (1 - fy) + south * fy }
    }
    return { height, ocean }
  }
}
