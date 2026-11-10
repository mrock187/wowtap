const grid = 64
const cells = 16
const tileSize = 1600 / 3

type Tile = { heights: Int16Array; ocean?: Uint16Array }
export type Terrain = (west: number, north: number) => { height: number; ocean: boolean } | undefined

export function readTerrain(data: Buffer): Terrain {
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
    const heights = Int16Array.from({ length: count }, (_, i) => data.readInt16LE(start + 8 + i * 2))
    let ocean: Uint16Array | undefined
    if (data.toString('ascii', next, next + 4) === 'EOAM') {
      if (next + 40 > data.length || data.readUInt32LE(next + 4) !== 32) {
        throw new Error(`Invalid WDL ocean payload ${index}`)
      }
      ocean = Uint16Array.from({ length: cells }, (_, i) => data.readUInt16LE(next + 8 + i * 2))
    }
    return { heights, ocean }
  })

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
    const height = northEdge * (1 - v) + southEdge * v
    const ocean = Boolean((tile.ocean?.[j] ?? 0) & (1 << i))
    return { height, ocean }
  }
}
