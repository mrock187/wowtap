import { fileURLToPath } from 'node:url'
import { locationDatasetSchema, mapManifestSchema } from '../../src/domain/content'
import { auditLocationContent, validateAnswerAreas } from './audit'
import { readJson } from './read-json'

const atlasPath = new URL('../../public/game/atlas.json', import.meta.url)
const datasetPath = new URL('../../public/game/locations.json', import.meta.url)

try {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && args[0] !== '--allow-missing')) {
    throw new Error('Usage: tsx scripts/data/validate.ts [--allow-missing]')
  }
  const [atlas, dataset] = await Promise.all([readJson(atlasPath, true), readJson(datasetPath, true)])
  if (atlas === undefined || dataset === undefined) {
    if (atlas !== undefined) mapManifestSchema.parse(atlas)
    if (dataset !== undefined) validateAnswerAreas(locationDatasetSchema.parse(dataset).locations)
    const missing = [
      ...(atlas === undefined ? [fileURLToPath(atlasPath)] : []),
      ...(dataset === undefined ? [fileURLToPath(datasetPath)] : []),
    ]
    console.log(`Location audit BLOCKED. Missing ${missing.join(', ')}.`)
    if (!(args[0] === '--allow-missing' && missing.length === 2)) process.exitCode = 2
  } else {
    const { blockers, report } = auditLocationContent(atlas, dataset)
    console.log(JSON.stringify(report, null, 2))
    if (blockers.length) {
      console.log(`Location audit BLOCKED. ${blockers.join('. ')}.`)
      process.exitCode = 2
    } else {
      console.log('Location audit passed.')
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
