import { mkdirSync, writeFileSync } from 'node:fs'
import { createAtlas } from '../../src/domain/atlas'
import { coordinateFixture } from '../../tests/fixtures/coordinates'

const atlas = createAtlas(coordinateFixture.atlas)
const output = new URL('../../tests/fixtures/maps/', import.meta.url)
mkdirSync(output, { recursive: true })

const definitions = `
  <defs>
    <linearGradient id="water" x2="0.75" y2="1">
      <stop stop-color="#214947"/><stop offset="1" stop-color="#182e35"/>
    </linearGradient>
    <linearGradient id="land" x2="0.8" y2="1">
      <stop stop-color="#d9c28c"/><stop offset="0.55" stop-color="#b4ab78"/><stop offset="1" stop-color="#a08862"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#e9d6a7" stroke-width="0.5" opacity="0.32"/>
    </pattern>
    <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse">
      <path d="M0 5L5 0" stroke="#5b523b" stroke-width="0.3" opacity="0.38"/>
    </pattern>
    <g id="peak">
      <path d="M-8 5L-1-8 5 1 9 5Z" fill="#807b5f" stroke="#655d48" stroke-width="0.7"/>
      <path d="M-4-2L-1-8 2-3 0-4-1-2Z" fill="#f1e2b6"/>
    </g>
    <g id="pine">
      <path d="M0-5L3 1H1L4 4H-4L-1 1H-3Z" fill="#5f7354"/>
      <path d="M0 3V5" stroke="#685c43"/>
    </g>
    <path id="west-shore" d="M153 158l17-12 31 2 21-11 26 2 26-13 21 4 27-7 30 16 31-8 23 13 10 23 24 10-8 27 18 16-1 34 20 17-4 28-24 11-8 19 13 13-3 36-14 18-24 4-11 23-28 9-22-14-24 7-25 28-23 2-23-10-8-22-28-17-22 8-14-18-18 3-17-31 15-25-9-16 10-31-20-31 9-27-20-17-4-24 13-17-12-12z"/>
    <path id="east-shore" d="M680 100l25-8 25 13 21-10 28 22 20 1 11 19 32 8 14 21-11 19-27 3 12 25-13 13 6 24-13 21 9 13-18 37 14 23 26 15-3 31-23 14-4 21 22 25-7 18-23 4-23-21-19 9-19-15-34 9-16-18-4-23-30-10 4-30-25-17 2-30-22-25 13-23-9-28 10-24-20-26 13-35 26-15-7-21 18-18 22 5z"/>
    <clipPath id="land-mask"><use href="#west-shore"/><use href="#east-shore"/></clipPath>
  </defs>`

function symbols(id: string, points: Array<[number, number, number]>) {
  return points.map(([x, y, scale]) => `<use href="#${id}" transform="translate(${x} ${y}) scale(${scale})"/>`).join('\n')
}

const overview = `
  <path fill="url(#water)" d="M0 0H1000V600H0z"/>
  <path fill="url(#grid)" d="M0 0H1000V600H0z"/>
  <g fill="none" stroke="#80a096" stroke-width="1.3" opacity="0.38">
    <path d="M48 117q46 14 93 0M441 110q49 18 94 1m-27 13q57 19 102 1M95 505q51 13 95-1m196 10q40 11 87 0m422-355q31 10 64 0M527 399q29 10 54 0m-34 15q36 11 67 0"/>
    <path d="M167 417q31 20 74 31m197-292q35 20 43 42m137-40q10-23 48-35m184 307q20 24 1 49"/>
  </g>
  <g fill="url(#land)" stroke-linejoin="round">
    <g stroke="#769482" stroke-width="12" opacity="0.25"><use href="#west-shore"/><use href="#east-shore"/></g>
    <g stroke="#dfc995" stroke-width="2.5"><use href="#west-shore"/><use href="#east-shore"/></g>
    <path d="M114 327l12-12 11 5 6 16-13 11-14-4zM860 317l14-7 15 13-3 19-13 2-12-12zM174 480l16-14 19 12 1 13-26 7z"/>
  </g>
  <g clip-path="url(#land-mask)">
    <g opacity="0.7">
      <path d="M134 210Q210 185 263 220T390 237L452 218V287Q402 312 341 278T212 294L148 310Z" fill="#89916b"/>
      <path d="M226 135Q263 151 310 147T407 190L435 213 387 226 343 195 291 188 241 214 169 183Z" fill="#a49f76"/>
      <path d="M244 366Q295 328 374 366L440 343 424 445 361 438 320 423 257 459Z" fill="#c2a374"/>
      <path d="M639 155Q695 138 749 188T854 201L829 290 797 305Q753 263 728 248T641 244Z" fill="#82916b"/>
      <path d="M677 364Q719 315 786 359L833 341 847 435 802 472 757 425 690 447Z" fill="#c7a276"/>
    </g>
    <path d="M150 178Q200 203 247 182T347 156 423 194m-269-6q69 39 106 12t92-26 70 34m-269-7q59 35 113 13t87-24 69 33m-242 107q54-26 112-1t109 16m-217 2q62-21 106-1t97 13m280-173q54-17 103 30t79 8m-187-26q57-15 103 33t90 10m-151 97q50-27 98 16t63-3m-144 6q34-17 80 23t62 3" fill="none" stroke="#736b55" stroke-width="0.8" opacity="0.55"/>
    <path d="M188 135Q243 146 260 177T309 202 351 216 379 262 452 301M734 102q-11 42 14 76t-5 74 4 59 63 60" fill="none" stroke="#5e8883" stroke-width="3.5"/>
    <path d="M165 301Q238 257 282 266T352 275 444 246m233 34q40 3 52 34t73 44" fill="none" stroke="#e3cb98" stroke-width="2.1" stroke-dasharray="4 2"/>
    ${symbols('peak', [[187,181,1],[205,174,1.5],[222,180,1],[313,159,1.2],[333,154,1.4],[350,163,1.1],[353,182,0.8],[291,363,1.2],[313,354,1.6],[335,370,1.1],[690,179,1.2],[711,173,1.5],[734,193,0.9],[758,402,1.2],[778,404,1.3],[803,424,1]])}
    ${symbols('pine', [[186,241,1],[196,234,1],[201,248,1],[213,242,1],[223,230,1],[409,250,1.4],[413,259,1.1],[421,246,1.2],[424,256,1],[664,228,1.3],[677,224,1.2],[680,234,1],[691,225,1.4],[696,237,1],[799,260,1],[809,258,1.2],[811,267,1.1]])}
  </g>`

const regional = `
  <g clip-path="url(#land-mask)">
    <g fill="none" stroke="#766e53" stroke-width="0.6" opacity="0.65">
      <path d="M162 329q42-31 84-18t76 24 84-18m-237 22q43-26 72-15t78 23 81-15m-168 33q36-20 86 2t53 1m297-78q50-4 67 35t67 39m-131-62q50 0 60 30t60 40"/>
    </g>
    ${symbols('pine', [[276,280,0.62],[281,284,0.68],[286,279,0.7],[290,284,0.58],[295,281,0.7],[318,315,0.66],[324,311,0.66],[330,315,0.7],[343,323,0.75],[350,318,0.78],[698,304,0.7],[703,302,0.65],[710,305,0.7],[716,306,0.7]])}
    <path d="M217 297q16-17 28-7t10 18q-12 14-26 9t-12-20zM713 384q11-20 25-17t14 15q-15 18-28 17t-11-15z" fill="#6b9990" stroke="#bfc49a" stroke-width="1"/>
  </g>`

const uplands = `
  <g clip-path="url(#land-mask)">
    <path d="M208 221Q243 235 263 222t38-8 36 14 35-8L369 263Q345 276 320 254T264 262 207 251Z" fill="url(#hatch)" opacity="0.63"/>
    <path d="M224 259q28-31 49-35 33-7 56 5t49 9m-58-11q12-34 31-44l24-20" fill="none" stroke="#ebe1bb" stroke-width="1.7"/>
    <path d="M281 233q14-8 25-1t-1 8q-17 5-24 0t0-7zm45-33q8-9 17-8t3 9q-8 8-15 6t-5-7z" fill="#8b9b79" stroke="#727d61" stroke-width="0.5"/>
    ${symbols('pine', [[307,246,0.44],[310,244,0.45],[312,248,0.42],[314,245,0.47],[318,247,0.48],[326,238,0.49],[329,239,0.47],[332,237,0.42],[349,236,0.49],[352,235,0.42],[355,238,0.49],[358,236,0.42]])}
  </g>`

const town = `
  <g transform="translate(220 165) scale(.08 .15)">
    <path d="M0 110Q200 180 353 154T630 131Q821 121 1000 54V0H0Z" fill="#aeae81"/>
    <path d="M0 434Q147 453 264 393t333 2 403 59v146H0Z" fill="#a4a576"/>
    <path d="M-14 133Q181 220 337 193t278-38q204-4 405-101m-1032 407q183 9 277-43t322 1 423 62" fill="none" stroke="#8b8c67" stroke-width="2"/>
    <path d="M-30 469Q96 434 130 333t196-122q113-9 164 51t140 32Q803 197 1015 230" fill="none" stroke="#b9c7a3" stroke-width="46"/>
    <path d="M-30 469Q96 434 130 333t196-122q113-9 164 51t140 32Q803 197 1015 230" fill="none" stroke="#719993" stroke-width="31"/>
    <path d="M250 307l90-52 142 44 136-16 157 57-47 87-205 18-84-38-134 13-80-49z" fill="#c4b189" stroke="#726b55" stroke-width="6" stroke-linejoin="round"/>
    <path d="M258 330l115 39 74-13 73 51 180-16m-363-117 36 95 22 44m124-6 28-81 81-29m-5 97-6 39M-20 398q122-21 233-46l53-23m435 68q115 10 317 98m-542-193q-60-19-75-74t-73-108" fill="none" stroke="#ede0ba" stroke-width="12" stroke-linecap="round"/>
    <g fill="#806b57" stroke="#665d4d" stroke-width="1.4">
      <path d="M285 336l19-12 18 7-8 15zm38 17 19-12 17 9-9 13zm36-54 26 9-7 15-18-2zm19 35 22-12 20 5-9 17zm34 30 28-5 22 17-23 13-22-9zm57 22 20 10 9 20-24 2-18-11zm48-57 27 3-14 27-26-7zm44 35 21-14 27 13-3 16-24 9zm49-30 17-15 25 7 8 16-23 9zm52 21 16-14 29 9 8 19-29 6zm5 58 35-6 9 12-18 12-29-3zm-91 6 20-9 16 9-13 12-25-2zm-247-32 23-7 14 12-12 10-23 4zm-34-8 17 2 11 16-19 6-18-12z"/>
    </g>
    <path d="M161 289l47-18m183-56 15 43m308 14 21 28m-596 51 29-31" stroke="#6d644e" stroke-width="12"/>
    <path d="M161 289l47-18m183-56 15 43m308 14 21 28m-596 51 29-31" stroke="#d5bf92" stroke-width="7"/>
    <path d="M795 324q90 31 133 10m-126 4q96 31 143 11m-131 3q82 30 132 12m-722 79q53 21 136 5m-140 9q50 23 132 9m-129 6q48 22 126 11" fill="none" stroke="#756e55" stroke-width="2" opacity="0.56"/>
    ${symbols('pine', [[257,182,1.3],[269,185,1.15],[278,180,1.1],[291,185,1.2],[760,436,1.5],[773,430,1.4],[787,436,1.3],[800,432,1.4],[810,442,1.3],[198,447,1.5],[210,451,1.3],[221,446,1.2]])}
  </g>`

for (const layer of coordinateFixture.atlas.layers) {
  const { left, top, width, height } = atlas.bounds(layer.id)
  const details = layer.kind === 'world' ? '' : regional
  const close = layer.kind === 'zone' || layer.kind === 'city' ? uplands : ''
  const city = layer.kind === 'city' ? town : ''
  const viewBox = [left, top, width, height].map(value => Number(value.toFixed(8))).join(' ')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layer.width}" height="${layer.height}" viewBox="${viewBox}" preserveAspectRatio="none">
  <!-- Original fictional artwork for local technical QA. -->
  ${definitions}
  ${overview}
  ${details}
  ${close}
  ${city}
</svg>
`
  writeFileSync(new URL(`${layer.id}.svg`, output), svg.replace(/^[ \t]+$/gm, ''), 'utf8')
}
