// Checks the mood catalogue and QR mapping:  npm test
// - ids unique and URL-safe; every QR slug opens its own mood
// - frame PNG exists, is RGBA, and its size matches the config (slot coordinates rely on it)
// - two slots per frame, inside the frame, top above bottom, not overlapping, covering
//   the transparent hole measured by scripts/extract-frames.py
// - QR base URL validation rejects localhost/private/http addresses
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { boothUrl, findFrame, FRAMES, isPublicUrl, outputSize, type FrameConfig } from '../src/config/frames.ts'

const file = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const extraction = JSON.parse(readFileSync(file('docs/frame-extraction.json'), 'utf8')) as Record<
  string,
  { width: number; height: number; slots: { holePx: { x: number; y: number; w: number; h: number } }[] }
>

let passed = 0
const test = (name: string, fn: () => void) => {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`)
    process.exitCode = 1
  }
}

/** Width, height and colour type from a PNG's IHDR chunk. */
function pngInfo(path: string) {
  const b = readFileSync(path)
  assert.equal(b.toString('latin1', 1, 4), 'PNG', `${path} is not a PNG`)
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] }
}

console.log('Mood catalogue')
test('exactly the five moods, in card order', () => {
  assert.deepEqual(FRAMES.map((f) => f.id), ['happy', 'sad', 'tired', 'anxious', 'confident'])
})
test('ids are unique, lowercase and URL-safe', () => {
  const slugs = FRAMES.flatMap((f) => [f.id, ...(f.aliases ?? [])])
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate id/alias')
  for (const s of slugs) assert.match(s, /^[a-z0-9][a-z0-9-]*$/, `bad slug "${s}"`)
})

for (const f of FRAMES) {
  test(`${f.id}: RGBA PNG ${f.frameWidth}×${f.frameHeight} as configured`, () => {
    const png = pngInfo(file(`public${f.frame}`))
    assert.equal(png.colorType, 6, `PNG colour type ${png.colorType}, expected 6 (RGBA)`)
    assert.deepEqual([png.width, png.height], [f.frameWidth, f.frameHeight])
    const out = outputSize(f)
    assert.ok(Math.abs(out.w / out.h - png.width / png.height) < 0.001, 'output ratio ≠ frame ratio')
  })
  test(`${f.id}: two slots, top then bottom, inside the frame, not overlapping`, () => {
    assert.equal(f.photoSlots.length, 2)
    const [a, b] = f.photoSlots
    assert.deepEqual([a.id, b.id], ['photo-1', 'photo-2'])
    for (const s of f.photoSlots) {
      assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.width <= f.frameWidth && s.y + s.height <= f.frameHeight, `${s.id} outside frame`)
      assert.ok(s.radius >= 0 && s.radius <= Math.min(s.width, s.height) / 2, `${s.id} radius`)
    }
    assert.ok(a.y + a.height <= b.y, 'photo-1 must end above photo-2')
  })
  test(`${f.id}: each slot box covers its measured transparent hole`, () => {
    const m = extraction[f.id]
    assert.ok(m, 'missing in docs/frame-extraction.json')
    f.photoSlots.forEach((s, i) => {
      const h = m.slots[i].holePx
      assert.ok(s.x <= h.x && s.y <= h.y && s.x + s.width >= h.x + h.w && s.y + s.height >= h.y + h.h, `${s.id} does not cover hole ${JSON.stringify(h)}`)
      assert.ok(s.x >= h.x - 24 && s.y >= h.y - 24 && s.x + s.width <= h.x + h.w + 24 && s.y + s.height <= h.y + h.h + 24, `${s.id} bleed > 24 px`)
    })
  })
}
test('slot coordinates are measured per frame (not all identical)', () => {
  const keys = new Set(FRAMES.map((f) => JSON.stringify(f.photoSlots)))
  assert.ok(keys.size > 1)
})

console.log('QR mapping')
for (const id of ['happy', 'sad', 'tired', 'anxious', 'confident']) {
  test(`/booth/${id} opens "${id}" with /frames/${id}.png`, () => {
    const r = findFrame(id)
    assert.equal(r.status, 'ok')
    assert.equal(r.status === 'ok' && r.frame.id, id)
    assert.equal(r.status === 'ok' && r.frame.frame, `/frames/${id}.png`)
  })
}
test('slug is case-insensitive and ignores trailing slash', () => {
  const r = findFrame('Happy/')
  assert.equal(r.status === 'ok' && r.frame.id, 'happy')
})
test('unknown and empty slugs are rejected', () => {
  assert.equal(findFrame('romantic').status, 'unknown')
  assert.equal(findFrame('').status, 'unknown')
})
test('aliases and disabled moods', () => {
  const base = FRAMES[0]
  const list: FrameConfig[] = [
    { ...base, id: 'a', aliases: ['old-a'] },
    { ...base, id: 'b', enabled: false },
  ]
  assert.equal(findFrame('old-a', list).status, 'ok')
  assert.equal(findFrame('b', list).status, 'disabled')
})
test('QR url format', () => {
  assert.equal(boothUrl('https://foto.example.com/', { id: 'sad' }), 'https://foto.example.com/booth/sad')
})
test('QR base URL must be public https (no localhost / LAN / http)', () => {
  for (const ok of ['https://photobooth.example.com', 'https://nadhe-photobooth.vercel.app']) assert.ok(isPublicUrl(ok), ok)
  for (const bad of ['http://photobooth.example.com', 'https://localhost:5173', 'http://localhost:4173', 'https://127.0.0.1', 'https://192.168.1.5', 'https://10.0.0.2', 'https://172.20.1.1', 'https://laptop.local', 'not a url', ''])
    assert.ok(!isPublicUrl(bad), bad)
})

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`)
