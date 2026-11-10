import { existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { qaFixtures } from './tests/fixtures/vite-qa'

export default defineConfig(({ command, mode, isPreview }) => {
  const qa = command === 'serve' && mode === 'qa' && !isPreview
  const hasSchedule = qa || existsSync(new URL('./public/game/schedule.json', import.meta.url))
  return {
    define: { __HAS_GAME_SCHEDULE__: JSON.stringify(hasSchedule) },
    plugins: [react(), qa && qaFixtures()],
    server: { host: '127.0.0.1', strictPort: true },
    preview: { host: '127.0.0.1', strictPort: true },
  }
})
