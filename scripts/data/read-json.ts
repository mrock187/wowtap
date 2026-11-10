import { readFile } from 'node:fs/promises'

export async function readJson(path: string | URL, optional = false): Promise<unknown> {
  const raw = await readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (optional && error.code === 'ENOENT') return undefined
    throw error
  })
  if (raw === undefined) return undefined
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, '')) as unknown
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}`, { cause: error })
  }
}
