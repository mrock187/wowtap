import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Cover, Shell } from './components/Shell'
import './style.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')

createRoot(root).render(
  <StrictMode>
    <Shell>
      <Cover>
        <p className="cover-status">Today’s expedition is unavailable while the Forever atlas is in preparation.</p>
      </Cover>
    </Shell>
  </StrictMode>,
)
