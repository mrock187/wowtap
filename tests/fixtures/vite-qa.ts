import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { freezeSchedule } from '../../src/engine/schedule'
import { gameFixture } from './game'

export function qaFixtures(): Plugin {
  const allowedMaps = new Set(gameFixture.atlas.layers.map(layer => '/' + layer.image))
  const schedule = JSON.stringify(freezeSchedule(gameFixture, {
    startDate: '2026-11-01', days: 60, version: 'local-qa',
  }))
  return {
    name: 'azeroth-pinpoint-local-qa',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split('?')[0]
        if (path === '/game/schedule.json') {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(schedule)
          return
        }
        if (!path || !allowedMaps.has(path)) {
          next()
          return
        }
        try {
          const name = path.slice('/maps/'.length)
          const file = fileURLToPath(new URL('./maps/' + name, import.meta.url))
          const svg = await readFile(file, 'utf8')
          response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
          response.end(svg)
        } catch {
          response.statusCode = 404
          response.end('Missing QA map fixture')
        }
      })
    },
  }
}
