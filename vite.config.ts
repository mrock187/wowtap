import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { qaFixtures } from './tests/fixtures/vite-qa'

export default defineConfig(({ command, mode, isPreview }) => ({
  plugins: [react(), command === 'serve' && mode === 'qa' && !isPreview && qaFixtures()],
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
}))
