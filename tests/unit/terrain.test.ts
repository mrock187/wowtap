import { describe, expect, it } from 'vitest'
import { readTerrain } from '../../scripts/local/wdl'

function terrainTile() {
  const offsets = 64 * 64 * 4
  const tile = 8 + offsets
  const sea = tile + 8 + 1090
  const data = Buffer.alloc(sea + 40)
  data.write('FOAM', 0)
  data.writeUInt32LE(offsets, 4)
  data.writeUInt32LE(tile, 8 + (32 * 64 + 32) * 4)
  data.write('ERAM', tile)
  data.writeUInt32LE(1090, tile + 4)
  for (let y = 0; y < 17; y++) {
    for (let x = 0; x < 17; x++) data.writeInt16LE(10 * x + 20 * y, tile + 8 + (y * 17 + x) * 2)
  }
  data.write('EOAM', sea)
  data.writeUInt32LE(32, sea + 4)
  data.writeUInt16LE(1, sea + 8)
  return data
}

describe('Forever terrain', () => {
  it('interpolates elevation and selects the matching ocean bit', () => {
    const sample = readTerrain(terrainTile())
    const water = sample(-50 / 3, -50 / 3)
    expect(water?.height).toBeCloseTo(15)
    expect(water?.ocean).toBe(true)
    const land = sample(-50, -50 / 3)
    expect(land?.height).toBeCloseTo(25)
    expect(land?.ocean).toBe(false)
    expect(sample(1000, 1000)).toBeUndefined()
  })

  it('rejects invalid chunk lengths and offsets', () => {
    const data = terrainTile()
    expect(() => readTerrain(data.subarray(0, 9))).toThrow(/chunk/)
    data.writeUInt32LE(data.length, 8 + (32 * 64 + 32) * 4)
    expect(() => readTerrain(data)).toThrow(/height tile/)
  })

  it('uses measured midpoint heights in detail renders and preserves the shared cell edge', () => {
    const data = terrainTile()
    const midpoint = 8 + 64 * 64 * 4 + 8 + 17 * 17 * 2
    data.writeInt16LE(140, midpoint)
    const sample = readTerrain(data, true)
    expect(sample(-50 / 3, -50 / 3)?.height).toBeCloseTo(140)
    expect(sample(0, -50 / 3)?.height).toBeCloseTo(10)
    expect(sample(-100 / 3, -50 / 3)?.land).toBeCloseTo(.5)
    expect(readTerrain(data)(-50 / 3, -50 / 3)?.height).toBeCloseTo(15)
  })
})
