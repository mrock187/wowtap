import { chromium, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapManifestSchema, type MapLayer } from '../../src/domain/content'
import { coordinateFixture } from '../../tests/fixtures/coordinates'

const maxFiles = 20_000
const maxFileBytes = 25 * 1024 ** 2
const mimeTypes: Record<string, string> = {
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

type Dimensions = { width: number; height: number }
type ImageCheck = (bytes: Buffer, mime: string) => Promise<Dimensions>
type AuditIssue = { severity: 'BLOCKED' | 'FAIL'; message: string }
type Asset = {
  layer: MapLayer
  bytes: number
  sha256: string
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function missing(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function inventory(root: string, issues: AuditIssue[]) {
  const files = new Map<string, number>()

  async function visit(path: string, relativePath: string) {
    const info = await lstat(path)
    if (info.isDirectory()) {
      for (const entry of (await readdir(path)).sort()) {
        await visit(join(path, entry), `${relativePath}/${entry}`)
      }
    } else if (info.isFile()) {
      files.set(relativePath, info.size)
    } else {
      issues.push({ severity: 'FAIL', message: `${relativePath}: expected a regular file or directory` })
    }
  }

  try {
    await visit(root, 'maps')
  } catch (error) {
    if (!missing(error)) throw error
  }
  return files
}

function inspectSvg(bytes: Buffer) {
  const xml = bytes.toString('utf8')
  if (!/^\s*<svg\b/i.test(xml)) throw new Error('SVG must begin with an SVG root')
  if (/<(?:[\w.-]+:)?(?:text|tspan|textpath|foreignobject|script|image|iframe|a)\b/i.test(xml)) {
    throw new Error('SVG contains text, an embedded image, a link or executable content')
  }
  if (/<!DOCTYPE|\bon\w+\s*=|@import|\bhref\s*=\s*['"]\s*(?!#)|\burl\(\s*(?!#)/i.test(xml)) {
    throw new Error('SVG contains active or external references')
  }
}

export async function auditMaps(root: string, fixture: boolean, checkImage: ImageCheck) {
  const issues: AuditIssue[] = []
  const assets: Asset[] = []
  const folder = fixture ? join(root, 'tests', 'fixtures', 'maps') : join(root, 'public', 'maps')
  const files = await inventory(folder, issues)
  const bytes = [...files.values()].reduce((sum, size) => sum + size, 0)
  const maxBytes = [...files.values()].reduce((max, size) => Math.max(max, size), 0)

  if (files.size > maxFiles || maxBytes > maxFileBytes) {
    issues.push({ severity: 'FAIL', message: 'Map files exceed the Pages Free file count or per-file size limit' })
  }

  const report = () => ({ fixture, files: files.size, bytes, maxBytes, assets, issues })
  let manifest: unknown = coordinateFixture.atlas
  if (!fixture) {
    try {
      manifest = JSON.parse(await readFile(join(root, 'public', 'game', 'atlas.json'), 'utf8'))
    } catch (error) {
      issues.push(missing(error)
        ? { severity: 'BLOCKED', message: 'Missing public/game/atlas.json and its approved Forever calibration' }
        : { severity: 'FAIL', message: `Cannot read public/game/atlas.json: ${message(error)}` })
      return report()
    }
  }

  const parsed = mapManifestSchema.safeParse(manifest)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({ severity: 'FAIL', message: `${issue.path.join('.')}: ${issue.message}` })
    }
    return report()
  }

  const { layers } = parsed.data
  const listed = new Set(layers.map(layer => layer.image))
  for (const file of files.keys()) {
    if (!listed.has(file)) issues.push({ severity: 'FAIL', message: `${file}: unlisted map asset` })
  }

  let provenance: string[] = []
  if (!fixture) {
    try {
      provenance = (await readFile(join(root, 'DATA_PROVENANCE.md'), 'utf8')).split(/\r?\n/)
    } catch (error) {
      if (!missing(error)) throw error
    }
    if (!layers.some(layer => layer.kind === 'world' && layer.uiMapId === 947)) {
      issues.push({ severity: 'BLOCKED', message: 'The Forever world overview (UiMap 947) is absent' })
    }
    for (const id of [1414, 1415]) {
      if (!layers.some(layer => layer.kind === 'continent' && layer.uiMapId === id)) {
        issues.push({ severity: 'BLOCKED', message: `Required Forever continent UiMap ${id} is absent` })
      }
    }
  }

  for (const layer of layers) {
    if (layer.rights !== (fixture ? 'fixture' : 'approved')) {
      issues.push({ severity: 'BLOCKED', message: `${layer.image}: unexpected asset rights status "${layer.rights}"` })
    }
    if (!fixture && layer.source.build.startsWith('0.')) {
      issues.push({ severity: 'FAIL', message: `${layer.image}: synthetic client build` })
    }
    const size = files.get(layer.image)
    if (size === undefined) {
      issues.push({ severity: 'FAIL', message: `${layer.image}: image is missing` })
      continue
    }
    if (size > maxFileBytes) continue

    const data = await readFile(join(folder, layer.image.slice('maps/'.length)))
    const sha256 = createHash('sha256').update(data).digest('hex')
    assets.push({ layer, bytes: size, sha256 })
    if (!fixture && !provenance.some(line => line.includes(layer.image) && line.includes(sha256))) {
      issues.push({ severity: 'BLOCKED', message: `${layer.image}: record the image path and SHA-256 together in DATA_PROVENANCE.md` })
    }

    try {
      const mime = mimeTypes[extname(layer.image)]
      if (mime === 'image/svg+xml') inspectSvg(data)
      const { width, height } = await checkImage(data, mime)
      if (width !== layer.width || height !== layer.height) {
        throw new Error(`decoded ${width}×${height}, manifest declares ${layer.width}×${layer.height}`)
      }
    } catch (error) {
      issues.push({ severity: 'FAIL', message: `${layer.image}: ${message(error)}` })
    }
  }
  return report()
}

async function run() {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args[0] !== undefined && args[0] !== '--fixtures')) {
    throw new Error('Usage: npm run maps:audit [-- --fixtures]')
  }
  const fixture = args[0] === '--fixtures'
  const root = fileURLToPath(new URL('../../', import.meta.url))
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    let imagePage: Page | undefined
    const report = await auditMaps(root, fixture, async (data, mime) => {
      if (!browser) {
        browser = await chromium.launch()
        imagePage = await browser.newPage({ offline: true })
      }
      if (!imagePage) throw new Error('Chromium image page did not start')
      return imagePage.evaluate(async (src) => {
        const image = new Image()
        image.src = src
        await image.decode()
        return { width: image.naturalWidth, height: image.naturalHeight }
      }, `data:${mime};base64,${data.toString('base64')}`)
    })

    const state = report.issues.some(issue => issue.severity === 'FAIL')
      ? 'FAIL'
      : report.issues.length ? 'BLOCKED' : 'PASS'
    const kinds = ['world', 'continent', 'zone', 'city'].map(kind =>
      `${kind}=${report.assets.filter(asset => asset.layer.kind === kind).length}`,
    ).join(', ')
    console.log(`${state} ${fixture ? 'fictional QA atlas' : 'Forever atlas'} — ${report.files} map files, ${report.bytes} bytes, max ${report.maxBytes} bytes`)
    console.log(`Layers with files: ${kinds}`)
    for (const { layer, bytes, sha256 } of report.assets) {
      console.log(`${layer.id}: ${layer.width}×${layer.height}, ${bytes} bytes, SHA-256 ${sha256}`)
      console.log(`  ${layer.rights}, build ${layer.source.build}, ${layer.source.reference}, ${layer.source.url}`)
    }
    for (const issue of report.issues) console.error(`${issue.severity} ${issue.message}`)
    if (!fixture) console.log('Release also requires label-free screenshot review and documented approval for every published image.')
    if (state !== 'PASS') process.exitCode = 1
  } finally {
    await browser?.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(error => {
    console.error(message(error))
    process.exitCode = 1
  })
}
