import type { Location } from '../../src/domain/content'
import { coordinateFixture } from './coordinates'

const { atlas, dataset } = coordinateFixture
const source = dataset.locations[0].source

function location(
  id: string, name: string, mapId: string, difficulty: Location['difficulty'],
  x: number, y: number, category: Location['category'] = 'landmark',
): Location {
  return {
    id, name, mapId, difficulty, category, source, confidence: 'verified',
    precision: mapId === 'citadel' ? 'city' : 'standard',
    explanation: 'This fictional checkpoint is part of the local QA atlas.',
    answers: [{ kind: 'point', point: { x, y } }],
  }
}

export const gameFixture = {
  atlas,
  dataset: {
    ...dataset,
    version: 'playthrough-qa',
    locations: [
      location('north-spire', 'North Spire', 'east', 'easy', .50, .23),
      location('salt-crossing', 'Salt Crossing', 'west', 'easy', .44, .61, 'settlement'),
      location('stonecourt', 'Stonecourt', 'highlands', 'easy', .43, .60, 'city'),
      location('archford', 'Archford', 'highlands', 'medium', .25, .75, 'settlement'),
      location('tide-watch', 'Tide Watch', 'east', 'medium', .31, .57),
      location('amber-gate', 'Amber Gate', 'west', 'medium', .62, .46, 'dungeon-entrance'),
      location('glass-ridge', 'Glass Ridge', 'east', 'medium', .55, .68),
      location('ivy-bridge', 'Ivy Bridge', 'highlands', 'medium', .68, .32),
      location('keeper-vale', 'Keeper Vale', 'citadel', 'hard', .49, .35, 'npc'),
      location('the-lamplighter', 'The Lamplighter', 'citadel', 'hard', .70, .73, 'npc'),
      location('quiet-vault', 'Quiet Vault', 'highlands', 'hard', .17, .38, 'dungeon-entrance'),
      location('morning-hollow', 'Morning Hollow', 'east', 'hard', .70, .46),
      location('rune-well', 'Rune Well', 'west', 'hard', .29, .68),
    ],
  },
}

export const qaDate = '2026-11-10'
