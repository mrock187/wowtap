import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { deflateSync, crc32 } from 'node:zlib'
import { z } from 'zod'
import { art, build } from './content'
import { readTerrain } from './wdl'

const stage = new URL('../../.local/terrain/', import.meta.url)
const out = new URL('derived/', stage)
const files = [
  { map: 0, id: 775970, sha: '6e33f250ec81e0809b05a210754b2642758f0724b5c5da2fd5d8f4e661233fd7' },
  { map: 1, id: 782778, sha: '416bbfb7644cd01238022592fe75525e567ef02adc8a0e45724e3bc2a40a824a' },
]

type Sample = ReturnType<ReturnType<typeof readTerrain>>
type RGB = readonly [number, number, number]
type Region = {
  map: number
  sample: (x: number, y: number) => Sample
  bounds: readonly [number, number, number, number]
}
const projection = z.object({ ox: z.number(), oy: z.number(), s: z.number().positive(), maxX: z.number(), maxY: z.number() })
const sourceSchema = z.object({
  build: z.literal(build),
  maps: z.array(z.object({ id: z.number(), rect: z.tuple([z.number(), z.number(), z.number(), z.number()]) })),
  continents: z.record(z.string(), projection),
})

function encode(width: number, height: number, rows: Buffer) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  function chunk(name: string, payload: Buffer) {
    const result = Buffer.alloc(payload.length + 12)
    result.writeUInt32BE(payload.length)
    result.write(name, 4)
    payload.copy(result, 8)
    result.writeUInt32BE(crc32(result.subarray(4, 8 + payload.length)), 8 + payload.length)
    return result
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ])
}

function filterDetailRows(rows: Buffer, stride: number) {
  // PNG Sub filtering preserves the colors and compresses the smooth shading.
  for (let row = 0; row < rows.length; row += stride) {
    rows[row] = 1
    for (let i = row + stride - 1; i >= row + 4; i--) rows[i] -= rows[i - 3]
  }
}

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const ocean: RGB = [12, 39, 72]
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

async function terrainFile(file: typeof files[number], detail: boolean) {
  const path = new URL(`${file.id}.wdl`, stage)
  let data = await readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  if (!data) {
    const response = await fetch(`https://wago.tools/api/casc/${file.id}?version=${build}`, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`WDL source HTTP ${response.status}`)
    data = Buffer.from(await response.arrayBuffer())
    if (createHash('sha256').update(data).digest('hex') !== file.sha) throw new Error(`Unexpected WDL checksum: ${file.id}`)
    await writeFile(path, data)
  }
  if (createHash('sha256').update(data).digest('hex') !== file.sha) throw new Error(`Unexpected WDL checksum: ${file.id}`)
  return readTerrain(data, detail)
}

export async function prepareTerrain(raw: unknown, detail = false) {
  const source = sourceSchema.parse(raw)
  const directory = detail ? new URL('detail/', stage) : out
  await mkdir(directory, { recursive: true })
  const continents: Region[] = []
  for (const file of files) {
    const terrain = await terrainFile(file, detail)
    const frame = source.continents[file.map]
    if (!frame) throw new Error(`Missing terrain frame: ${file.map}`)
    const sample = (x: number, y: number) => terrain(frame.maxY - (x - frame.ox) / frame.s, frame.maxX - (y - frame.oy) / frame.s)
    const landmass = art.find(plate => plate.map === file.map)!
    continents.push({ map: file.map, sample, bounds: landmass.bounds })
  }
  const records = []
  for (const plate of art.filter(plate => !detail || plate.map !== null)) {
    const extent = source.maps.find(map => map.id === plate.uiMapId)?.rect
    if (!extent) throw new Error(`Missing art rectangle: ${plate.uiMapId}`)
    const [left, top, right, bottom] = extent
    const density = detail ? 5 : 2
    const width = Math.ceil((right - left) * density)
    const height = Math.ceil((bottom - top) * density)
    const stride = width * 3 + 1
    const rows = Buffer.alloc(stride * height)
    const color = (x: number, y: number): RGB => {
      const landmass = continents.find(region => plate.map === region.map || (plate.map === null
        && x >= region.bounds[0] && x <= region.bounds[2] && y >= region.bounds[1] && y <= region.bounds[3]))
      const sample = landmass?.sample
      const elevation: Sample = sample?.(x, y)
      if (!sample || !elevation) return ocean
      const coverage = elevation.land === undefined ? Number(!elevation.ocean) : clamp((elevation.land - .34) / .32)
      if (!coverage) return ocean
      const z = elevation.height
      const radius = detail ? .55 : .85
      const slopeX = (sample(x + radius, y)?.height ?? z) - (sample(x - radius, y)?.height ?? z)
      const slopeY = (sample(x, y + radius)?.height ?? z) - (sample(x, y - radius)?.height ?? z)
      const shade = .78 + .48 * (.5 + Math.atan((slopeX + slopeY) / (detail ? 35 : 48)) / Math.PI)
      const high = clamp((z - 70) / 520)
      const coastal = clamp((22 - z) / 32)
      const green = mix([63, 109, 74], [155, 135, 91], high)
      const land = mix(green, [143, 156, 104], coastal * .65)
      const summit = mix(land, [207, 218, 213], clamp((z - 730) / 600))
      const surface: RGB = [summit[0] * shade, summit[1] * shade, summit[2] * shade]
      return coverage === 1 ? surface : mix(ocean, surface, coverage)
    }
    for (let y = 0; y < height; y++) {
      const v = top + (y + .5) * (bottom - top) / height
      for (let x = 0; x < width; x++) {
        const u = left + (x + .5) * (right - left) / width
        const pixel = color(u, v)
        const start = y * stride + 1 + x * 3
        for (let channel = 0; channel < 3; channel++) rows[start + channel] = Math.round(Math.min(255, pixel[channel]))
      }
    }
    if (detail) filterDetailRows(rows, stride)
    const image = encode(width, height, rows)
    await writeFile(new URL(`${plate.uiMapId}.png`, directory), image)
    records.push({ id: plate.uiMapId, width, height, sha256: createHash('sha256').update(image).digest('hex') })
  }
  await writeFile(new URL('manifest.json', directory), JSON.stringify({ build, records }) + '\n')
  console.log(`Rendered ${records.length} terrain-only views from Forever ${build} elevation and ocean data.`)
}
