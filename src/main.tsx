import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>Azeroth Pinpoint</h1>
      <p>The Forever daily atlas is still in preparation.</p>
    </main>
  </StrictMode>,
)
