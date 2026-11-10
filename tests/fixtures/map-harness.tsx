import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createAtlas } from '../../src/domain/atlas'
import type { Guess } from '../../src/engine/scoring'
import { MapBoard } from '../../src/components/map/MapBoard'
import { coordinateFixture } from './coordinates'
import '../../src/style.css'

const atlas = createAtlas(coordinateFixture.atlas)

function Harness() {
  const [guess, setGuess] = useState<Guess | null>(null)
  return (
    <main className="page">
      <h1>Fictional map renderer QA</h1>
      <MapBoard atlas={atlas} guess={guess} onPin={setGuess} />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Harness />)
