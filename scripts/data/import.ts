import { writeFile } from 'node:fs/promises'
import { importObservations } from './observations'
import { readJson } from './read-json'

try {
  const paths = process.argv.slice(2)
  if (paths.length !== 3) {
    throw new Error('Usage: tsx scripts/data/import.ts <atlas.json> <observations.json> <output.json>')
  }
  const [atlasPath, observationsPath, outputPath] = paths
  const [atlas, observations] = await Promise.all([readJson(atlasPath), readJson(observationsPath)])
  const dataset = importObservations(atlas, observations)
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, { flag: 'wx' })
  console.log(`Imported ${dataset.locations.length} verified-source rows into ${outputPath}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
