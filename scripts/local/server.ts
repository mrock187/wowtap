import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import { z } from 'zod'
import { parseSchedule } from '../../src/engine/schedule'
import { art, build } from './content'

export const localSchedule = new URL('../../.local/forever/schedule.json', import.meta.url)
export const terrainManifest = new URL('../../.local/terrain/derived/manifest.json', import.meta.url)
const terrainSchema = z.object({
  build: z.literal(build),
  records: z.array(z.object({ id: z.number(), sha256: z.string().regex(/^[0-9a-f]{64}$/) })),
})

export function localForever(): Plugin {
  const raw = readFileSync(localSchedule, 'utf8')
  const schedule = parseSchedule(JSON.parse(raw))
  const files = new Map<string, Buffer>()
  for (const season of schedule.seasons) {
    for (const layer of season.content.atlas.layers) {
      if (layer.rights !== 'local-only') throw new Error('Expected a local Forever map')
      const image = readFileSync(new URL(layer.image, localSchedule))
      if (createHash('sha256').update(image).digest('hex') !== layer.assetSha256) {
        throw new Error(`Local map checksum changed: ${layer.image}`)
      }
      files.set('/' + layer.image, image)
    }
  }
  const terrain = terrainSchema.parse(JSON.parse(readFileSync(terrainManifest, 'utf8')))
  for (const plate of art) {
    const record = terrain.records.find(entry => entry.id === plate.uiMapId)
    const filename = `${plate.uiMapId}.png`
    const image = readFileSync(new URL(filename, terrainManifest))
    if (createHash('sha256').update(image).digest('hex') !== record?.sha256) {
      throw new Error(`Terrain checksum changed: ${filename}`)
    }
    files.set('/terrain/' + filename, image)
  }
  return {
    name: 'azeroth-pinpoint-local-forever',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0]
        const image = path ? files.get(path) : undefined
        if (path === '/game/schedule.json' || image) {
          response.setHeader('Cache-Control', 'no-store')
          response.setHeader('Content-Type', image ? 'image/png' : 'application/json; charset=utf-8')
          response.end(image ?? raw)
          return
        }
        next()
      })
    },
  }
}
