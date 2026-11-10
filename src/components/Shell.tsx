import { useId, useRef, type ReactNode } from 'react'

export function Compass({ className, size = 46 }: { className?: string; size?: number }) {
  return (
    <svg className={className} aria-hidden="true" width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="24" stroke="currentColor" opacity=".55" />
      <circle cx="32" cy="32" r="19" stroke="currentColor" strokeDasharray="1 3" opacity=".55" />
      <path d="M32 3 38 26 61 32 38 38 32 61 26 38 3 32 26 26Z" stroke="currentColor" />
      <path d="M32 3V32L38 26ZM61 32H32L38 38ZM32 61V32L26 38ZM3 32H32L26 26Z" fill="currentColor" />
      <path d="m16 16 7 3m25-3-7 3m7 29-7-3m-25 3 7-3" stroke="currentColor" opacity=".65" />
      <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
  )
}

export function HelpButton() {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  return (
    <>
      <button className="header-button" onClick={() => dialog.current?.showModal()}>How to play</button>
      <dialog ref={dialog} aria-labelledby={title} className="help-dialog">
        <p className="eyebrow">Field guide</p>
        <h2 id={title}>Read the terrain</h2>
        <ol>
          <li>Find each of the five named places on the unlabeled atlas. Follow the coastlines, hills, and other landforms.</li>
          <li>Drag to pan and scroll or pinch to zoom. Use the detail controls to open a region, zone, or city.</li>
          <li>Place a pin and confirm. Closer guesses earn up to 5,000 points. For precision targets, use the city map to earn full credit.</li>
        </ol>
        <p>With the map focused, use arrow keys to pan, + and − to zoom, and Enter to place a pin at the center. Error is measured in atlas units.</p>
        <p>New expeditions open at midnight UTC. Your results and streak are stored in this browser.</p>
        <form method="dialog"><button className="button primary">Back to the atlas</button></form>
      </dialog>
    </>
  )
}

export function Shell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <Compass />
            <div><strong>Azeroth Pinpoint</strong><span>THE DAILY ATLAS</span></div>
          </div>
          <nav aria-label="Game information"><HelpButton />{actions}</nav>
        </div>
      </header>
      <main className="page">{children}</main>
      <footer className="site-footer">
        <span>Independent fan project for World of Warcraft: Forever</span>
        <span>World of Warcraft © Blizzard Entertainment</span>
      </footer>
    </>
  )
}

export function Cover({ children, map }: { children: ReactNode; map?: string }) {
  return (
    <section className="cover" aria-labelledby="cover-title">
      {map && <img className="cover-map" src={map} alt="" />}
      <div className="cover-copy">
        <p className="eyebrow"><span aria-hidden="true">✦</span> A daily expedition</p>
        <h1 id="cover-title">Find your way<br className="cover-break" /> across Azeroth.</h1>
        <p className="cover-deck">Five places. One unlabeled map. How close can you get?</p>
        {children}
      </div>
      {!map && <div className="cover-ornament" aria-hidden="true"><Compass size={312} /></div>}
    </section>
  )
}
