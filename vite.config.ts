import { existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { localForever, localSchedule, terrainManifest } from './scripts/local/server'
import { qaFixtures } from './tests/fixtures/vite-qa'

export default defineConfig(({ command, mode, isPreview }) => {
  const dev = command === 'serve' && !isPreview
  const qa = dev && mode === 'qa'
  const forever = dev && mode === 'local-forever'
  if (forever && (!existsSync(localSchedule) || !existsSync(terrainManifest))) {
    throw new Error('Run npm run local:prepare before starting the Forever preview')
  }
  const hasSchedule = qa || forever || existsSync(new URL('./public/game/schedule.json', import.meta.url))
  return {
    define: { __HAS_GAME_SCHEDULE__: JSON.stringify(hasSchedule) },
    plugins: [react(), qa && qaFixtures(), forever && localForever()],
    server: {
      host: '127.0.0.1',
      strictPort: true,
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local/**'] },
    },
    preview: { host: '127.0.0.1', strictPort: true },
  }
})
