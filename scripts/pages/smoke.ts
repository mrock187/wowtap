import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { preview } from 'vite'

const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } })
const address = server.httpServer.address()
if (!address || typeof address === 'string') throw new Error('Static preview did not bind to TCP')
const origin = `http://127.0.0.1:${address.port}`
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

try {
  browser = await chromium.launch()
  const page = await browser.newPage()
  const errors: string[] = []
  const requests = new Set<string>()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()) })
  page.on('request', request => {
    requests.add(request.url())
    if (new URL(request.url()).origin !== origin) errors.push(`Unexpected origin: ${request.url()}`)
  })
  const response = await page.goto(origin)
  if (response?.status() !== 200) throw new Error('Production preview did not return HTTP 200')
  const hasSchedule = existsSync(new URL('../../dist/game/schedule.json', import.meta.url))
  if (hasSchedule) {
    await page.getByRole('button', { name: 'Begin expedition' }).click()
    await page.getByRole('button', { name: 'Open continent map' }).first().waitFor()
  } else {
    await page.getByText('Today’s expedition is unavailable while the Forever atlas is in preparation.').waitFor()
  }
  if (await page.getByText('Local QA · Fictional atlas and locations').count()) throw new Error('Fixture UI in production')
  if (errors.length) throw new Error(errors.join('\n'))

  const timings = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    return {
      domReady: Math.round(navigation.domContentLoadedEventEnd),
      load: Math.round(navigation.loadEventEnd),
    }
  })
  console.log(`PASS production preview (Chromium loopback): ${requests.size} same-origin requests, DOM ready ${timings.domReady} ms, load ${timings.load} ms.`)
} finally {
  await browser?.close()
  await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
}
