export function scoreSymbol(score: number): string {
  if (score >= 4500) return '🟩'
  if (score >= 3000) return '🟨'
  if (score >= 1000) return '🟧'
  return '⬛'
}

export function shareText(date: string, scores: number[]): string {
  const total = scores.reduce((sum, score) => sum + score, 0)
  return `Azeroth Pinpoint ${date} | ${total}/25000 | ${scores.map(scoreSymbol).join('')}`
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'))
}
