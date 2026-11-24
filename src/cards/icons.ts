// Mood icons for the QR cards, redrawn as SVG after the reference sheet
// (sun, rain cloud, sleepy cat, scribble, crown). Kawaii style: chunky dark outline,
// rosy cheeks. All share a 200×200 viewBox.

const INK = '#18345f'
const CHEEK = '#9fd1ff'

const sun = `
<g stroke="#155eef" stroke-width="9" stroke-linecap="round">
  ${Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2
    const r1 = 74
    const r2 = i % 2 ? 90 : 96
    return `<line x1="${100 + Math.cos(a) * r1}" y1="${100 + Math.sin(a) * r1}" x2="${100 + Math.cos(a) * r2}" y2="${100 + Math.sin(a) * r2}"/>`
  }).join('')}
</g>
<circle cx="100" cy="100" r="60" fill="#9bd4ff" stroke="#155eef" stroke-width="7"/>
<circle cx="84" cy="84" r="20" fill="#eaf6ff" opacity=".8"/>
<path d="M74 98 q8 -10 16 0 M110 98 q8 -10 16 0" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
<path d="M84 114 q16 18 32 0" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
<ellipse cx="68" cy="114" rx="9" ry="6" fill="${CHEEK}"/><ellipse cx="132" cy="114" rx="9" ry="6" fill="${CHEEK}"/>`

const cloud = `
<g fill="#4c8de0" stroke="#215fc0" stroke-width="3">
  <path d="M70 150 q-7 13 0 20 q7 -7 0 -20z"/><path d="M100 158 q-7 13 0 20 q7 -7 0 -20z"/><path d="M130 150 q-7 13 0 20 q7 -7 0 -20z"/>
</g>
<path d="M52 132 q-30 0 -30 -26 q0 -26 30 -26 q6 -34 44 -34 q32 0 42 26 q36 -4 40 30 q2 30 -32 30z" fill="#fff" stroke="#215fc0" stroke-width="7" stroke-linejoin="round"/>
<path d="M78 98 q8 6 16 0 M110 98 q8 6 16 0" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>
<path d="M90 120 q12 -10 24 0" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>
<path d="M128 104 q-6 10 0 14 q6 -4 0 -14z" fill="#6fb0ff"/>
<ellipse cx="70" cy="112" rx="8" ry="5" fill="${CHEEK}"/><ellipse cx="136" cy="112" rx="8" ry="5" fill="${CHEEK}"/>`

const cat = `
<path d="M40 150 q-6 -54 18 -86 l-6 -38 q22 6 38 26 q10 -2 20 0 q16 -20 38 -26 l-6 38 q24 32 18 86z" fill="#fff" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
<path d="M56 64 l-3 -26 q14 6 22 16z M144 64 l3 -26 q-14 6 -22 16z" fill="#b9dcff"/>
<path d="M118 52 q18 -4 26 12 q6 14 -6 22 q-14 -10 -20 -34z" fill="#d9ecff"/>
<path d="M66 106 q10 8 20 0 M114 106 q10 8 20 0" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>
<path d="M92 122 q8 8 8 0 q0 8 8 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
<path d="M28 112 h22 M28 126 l22 -6 M172 112 h-22 M172 126 l-22 -6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
<ellipse cx="62" cy="122" rx="9" ry="6" fill="${CHEEK}"/><ellipse cx="138" cy="122" rx="9" ry="6" fill="${CHEEK}"/>
<path d="M32 150 h136" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
<text x="160" y="40" font-family="Fredoka, sans-serif" font-weight="700" font-size="34" fill="#246bce">z</text>
<text x="176" y="20" font-family="Fredoka, sans-serif" font-weight="700" font-size="24" fill="#246bce">z</text>`

const scribble = `
<g fill="none" stroke="#231c1e" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">
  <ellipse cx="100" cy="96" rx="62" ry="54" transform="rotate(-12 100 96)"/>
  <ellipse cx="96" cy="100" rx="50" ry="40" transform="rotate(20 96 100)"/>
  <ellipse cx="106" cy="92" rx="40" ry="46" transform="rotate(-35 106 92)"/>
  <ellipse cx="98" cy="102" rx="30" ry="22" transform="rotate(8 98 102)"/>
  <ellipse cx="102" cy="96" rx="18" ry="26" transform="rotate(50 102 96)"/>
  <path d="M100 150 q-4 18 8 30"/>
</g>`

const crown = `
<path d="M34 146 l-10 -88 l42 36 l34 -56 l34 56 l42 -36 l-10 88z" fill="#9bd4ff" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
<path d="M40 128 h120" stroke="#246bce" stroke-width="8"/>
<rect x="34" y="146" width="132" height="22" rx="8" fill="#74b9ff" stroke="${INK}" stroke-width="7"/>
<circle cx="24" cy="54" r="10" fill="#b9dcff" stroke="${INK}" stroke-width="5"/><circle cx="100" cy="32" r="10" fill="#b9dcff" stroke="${INK}" stroke-width="5"/><circle cx="176" cy="54" r="10" fill="#b9dcff" stroke="${INK}" stroke-width="5"/>
<circle cx="100" cy="112" r="12" fill="#155eef" stroke="${INK}" stroke-width="4"/>
<circle cx="62" cy="118" r="8" fill="#eaf6ff" stroke="${INK}" stroke-width="4"/><circle cx="138" cy="118" r="8" fill="#eaf6ff" stroke="${INK}" stroke-width="4"/>
<path d="M70 80 l6 -14" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>`

export const MOOD_ICONS: Record<string, string> = { happy: sun, sad: cloud, tired: cat, anxious: scribble, confident: crown }

/** Four-point sparkle. */
export const sparkle = (color: string) =>
  `<path d="M100 10 q10 80 90 90 q-80 10 -90 90 q-10 -80 -90 -90 q80 -10 90 -90z" fill="${color}" stroke="#fff" stroke-width="10" stroke-linejoin="round" paint-order="stroke"/>`

export const heart = (color: string) =>
  `<path d="M100 176 q-86 -54 -86 -104 q0 -40 40 -46 q32 -2 46 30 q14 -32 46 -30 q40 6 40 46 q0 50 -86 104z" fill="${color}" stroke="#fff" stroke-width="12" stroke-linejoin="round" paint-order="stroke"/>`

/** Wraps icon markup in a standalone SVG document (white sticker outline via a blurred-free stroke copy). */
export function svgDoc(inner: string, sticker = true) {
  const outline = sticker
    ? `<g stroke="#fff" stroke-width="22" stroke-linejoin="round" stroke-linecap="round" fill="#fff">${inner
        .replace(/fill="(?!none)[^"]*"/g, 'fill="#fff"')
        .replace(/stroke="[^"]*"/g, 'stroke="#fff"')
        .replace(/stroke-width="[^"]*"/g, 'stroke-width="22"')
        .replace(/opacity="[^"]*"/g, '')}</g>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 240 240" width="480" height="480">${outline}${inner}</svg>`
}

export function svgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('SVG_ICON'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}
