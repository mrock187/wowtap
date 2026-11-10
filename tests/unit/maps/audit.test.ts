import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { auditMaps } from '../../../scripts/maps/audit'
import { freezeSchedule } from '../../../src/engine/schedule'
import { coordinateFixture } from '../../fixtures/coordinates'

let root: string
const dimensions = async () => ({ width: 1000, height: 600 })
const fixtureSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"/>'

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'azeroth-map-audit-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('map asset audit', () => {
  it('blocks a missing real atlas before invoking the image decoder', async () => {
    const checkImage = vi.fn<(bytes: Buffer, mime: string) => ReturnType<typeof dimensions>>(dimensions)
    const report = await auditMaps(root, false, checkImage)
    expect(report.files).toBe(0)
    expect(report.issues).toEqual([{ severity: 'BLOCKED', message: expect.stringContaining('atlas.json') }])
    expect(checkImage).not.toHaveBeenCalled()
  })

  it('inventories the five isolated fixtures and passes them to the decoder', async () => {
    const repo = fileURLToPath(new URL('../../../', import.meta.url))
    const checkImage = vi.fn<(bytes: Buffer, mime: string) => ReturnType<typeof dimensions>>(dimensions)
    const report = await auditMaps(repo, true, checkImage)
    expect(report.issues).toEqual([])
    expect(report.files).toBe(5)
    expect(report.bytes).toBeGreaterThan(report.maxBytes)
    expect(report.assets.map(({ layer }) => layer.kind).sort()).toEqual(['city', 'continent', 'continent', 'world', 'zone'])
    expect(checkImage).toHaveBeenCalledTimes(5)
    expect(checkImage.mock.calls.every(call => call[1] === 'image/svg+xml')).toBe(true)
  })

  it('fails missing, unlisted, mislabeled, or mis-sized fixture assets', async () => {
    const folder = join(root, 'tests', 'fixtures', 'maps')
    await mkdir(folder, { recursive: true })
    await writeFile(join(folder, 'world.svg'), fixtureSvg)
    await writeFile(join(folder, 'extra.svg'), fixtureSvg)
    await writeFile(join(folder, 'citadel.svg'), fixtureSvg.replace('/>', '><text>answer</text></svg>'))
    const report = await auditMaps(root, true, async () => ({ width: 500, height: 600 }))
    expect(report.issues.map(issue => issue.message)).toEqual(expect.arrayContaining([
      'maps/extra.svg: unlisted map asset',
      'maps/world.svg: decoded 500×600, manifest declares 1000×600',
      'maps/highlands.svg: image is missing',
      expect.stringContaining('SVG contains text'),
    ]))
  })

  it('blocks default assets with fixture or missing rights and stale provenance hashes', async () => {
    const manifest = structuredClone(coordinateFixture.atlas)
    manifest.layers[0].uiMapId = 947
    manifest.layers[1].uiMapId = 1414
    manifest.layers[4].uiMapId = 1415
    await mkdir(join(root, 'public', 'game'), { recursive: true })
    await mkdir(join(root, 'public', 'maps'), { recursive: true })
    await writeFile(join(root, 'public', 'game', 'atlas.json'), JSON.stringify(manifest))
    await writeFile(join(root, 'public', 'maps', 'world.svg'), fixtureSvg)
    const digest = createHash('sha256').update(fixtureSvg).digest('hex')
    await writeFile(join(root, 'DATA_PROVENANCE.md'), `maps/world.svg ${digest.replace(/^./, digit => digit === '0' ? '1' : '0')}`)
    const report = await auditMaps(root, false, dimensions)
    expect(report.issues.map(issue => issue.message)).toEqual(expect.arrayContaining([
      'maps/world.svg: unexpected asset rights status "fixture"',
      'maps/world.svg: synthetic client build',
      expect.stringContaining('SHA-256 together in DATA_PROVENANCE.md'),
    ]))
    const assetPath = join(root, 'public', report.assets[0].layer.image)
    expect(await readFile(assetPath, 'utf8')).toBe(fixtureSvg)
  })

  it('audits historical assets outside the current atlas and detects a changed image', async () => {
    const content = structuredClone(coordinateFixture)
    const build = '1.60.1.70245'
    const digest = createHash('sha256').update(fixtureSvg).digest('hex')
    content.atlas.build = build
    content.dataset.build = build
    for (const layer of content.atlas.layers) {
      layer.rights = 'approved'
      layer.assetSha256 = digest
      layer.source = { ...layer.source, build }
    }
    content.atlas.layers[0].uiMapId = 947
    content.atlas.layers[0].image = 'maps/old-world.svg'
    content.atlas.layers[1].uiMapId = 1414
    content.atlas.layers[4].uiMapId = 1415
    const location = content.dataset.locations[0]
    content.dataset.locations = Array.from({ length: 5 }, (_, index) => ({
      ...location,
      id: `qa-${index}`,
      name: `QA ${index}`,
      source: { ...location.source, build },
    }))
    const published = freezeSchedule(content, { startDate: '2026-01-01', days: 1, version: 'first' })
    content.atlas.layers[0].image = 'maps/world.svg'
    const schedule = freezeSchedule(content, {
      startDate: '2026-01-02', days: 1, version: 'second', publishedThrough: '2026-01-01',
    }, published)
    await mkdir(join(root, 'public', 'game'), { recursive: true })
    await mkdir(join(root, 'public', 'maps'), { recursive: true })
    const images = [...content.atlas.layers.map(layer => layer.image), 'maps/old-world.svg']
    await Promise.all(images.map(image => writeFile(join(root, 'public', image), fixtureSvg)))
    await writeFile(join(root, 'DATA_PROVENANCE.md'), images.map(image => `${image} ${digest}`).join('\n'))
    await writeFile(join(root, 'public', 'game', 'atlas.json'), JSON.stringify(content.atlas))
    await writeFile(join(root, 'public', 'game', 'schedule.json'), JSON.stringify(schedule))

    expect((await auditMaps(root, false, dimensions)).issues).toEqual([])
    await writeFile(join(root, 'public', 'maps', 'old-world.svg'), fixtureSvg + '\n')
    expect((await auditMaps(root, false, dimensions)).issues).toContainEqual({
      severity: 'BLOCKED', message: 'maps/old-world.svg: asset bytes must match the manifest assetSha256',
    })
  })
})
