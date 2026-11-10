import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import { parseSchedule } from '../../src/engine/schedule'

export const localSchedule = new URL('../../.local/forever/schedule.json', import.meta.url)

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
