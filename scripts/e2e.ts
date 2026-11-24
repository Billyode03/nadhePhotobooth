// End-to-end check in real Chrome with a FAKE camera and phone emulation (no extra deps).
//   npm run build && npm run preview   (in another terminal; serves http://localhost:4173)
//   npm run test:e2e
// Env: CHROME_PATH, BASE_URL (default http://localhost:4173), OUT_DIR (screenshots/downloads).
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { FRAMES } from '../src/config/frames.ts'

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const OUT = resolve(process.env.OUT_DIR ?? join(tmpdir(), 'nadhe-photobooth-e2e'))
const UPLOAD = process.env.UPLOAD_IMAGE // optional JPG for the gallery test
const PORT = 9333
rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'downloads'), { recursive: true })

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(OUT, 'profile')}`,
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Msg = { id?: number; method?: string; params?: any; result?: any; error?: any }
class Cdp {
  ws: WebSocket
  n = 0
  pending = new Map<number, (m: Msg) => void>()
  listeners: ((m: Msg) => void)[] = []
  constructor(url: string) {
    this.ws = new WebSocket(url)
    this.ws.onmessage = (e) => {
      const m: Msg = JSON.parse(String(e.data))
      if (m.id && this.pending.has(m.id)) {
        this.pending.get(m.id)!(m)
        this.pending.delete(m.id)
      } else this.listeners.forEach((l) => l(m))
    }
  }
  open() {
    return new Promise((r) => (this.ws.onopen = r))
  }
  send(method: string, params: object = {}): Promise<any> {
    const id = ++this.n
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))))
  }
}

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const v = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()) as { webSocketDebuggerUrl: string }
      return v.webSocketDebuggerUrl as string
    } catch {
      await sleep(200)
    }
  }
  throw new Error('Chrome did not start')
}

const browser = new Cdp(await connect())
await browser.open()
await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: join(OUT, 'downloads') })

async function newPage(init?: string) {
  const t = (await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()) as { id: string; webSocketDebuggerUrl: string }
  const p = new Cdp(t.webSocketDebuggerUrl)
  await p.open()
  await p.send('Page.enable')
  await p.send('Runtime.enable')
  // iPhone-ish viewport.
  await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true })
  await p.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  // input.click() must not open a real file dialog; files are set with DOM.setFileInputFiles.
  await p.send('Page.setInterceptFileChooserDialog', { enabled: true })
  // Track every camera stream so we can prove they are stopped.
  await p.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__streams = [];
      const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (c) => { ${init ?? ''} const s = await gum(c); window.__streams.push(s); return s; };`,
  })
  const errors: string[] = []
  p.listeners.push((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? 'exception')
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a: any) => a.value ?? a.description).join(' '))
  })
  const page = {
    cdp: p,
    errors,
    async go(path: string) {
      await p.send('Page.navigate', { url: BASE + path })
      await page.wait('document.readyState === "complete" && !!document.querySelector("#root > *")')
    },
    async eval<T = any>(expr: string): Promise<T> {
      const r = await p.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? expr)
      return r.result.value
    },
    async wait(expr: string, ms = 8000) {
      const end = Date.now() + ms
      while (Date.now() < end) {
        if (await page.eval(`!!(${expr})`).catch(() => false)) return
        await sleep(100)
      }
      throw new Error(`timeout waiting for: ${expr}`)
    },
    text: () => page.eval<string>("document.body.textContent"),
    click: (label: string) =>
      page.eval(`(() => { const b = [...document.querySelectorAll('button')].find(b => (b.textContent.trim() === ${JSON.stringify(label)} || b.getAttribute('aria-label') === ${JSON.stringify(label)})); if (!b) throw new Error('no button ${label}'); if (b.disabled) throw new Error('disabled ${label}'); b.click(); return true })()`),
    async shot(name: string) {
      const { data } = await p.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
    },
    async setFile(path: string) {
      const { root } = await p.send('DOM.getDocument')
      const { nodeId } = await p.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })
      await p.send('DOM.setFileInputFiles', { nodeId, files: [path] })
    },
    close: () => fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`),
  }
  return page
}

let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`)
  }
}

const streamsLive = `window.__streams.flatMap(s => s.getTracks()).filter(t => t.readyState === 'live').length`
const JSQR = readFileSync(resolve('node_modules/jsqr/dist/jsQR.js'), 'utf8')
const PUBLIC = 'https://photobooth.example.com'

/** Mean RGB of the centre of each slot on the visible composite canvas (to prove which photo changed). */
const slotSignature = (moodId: string) => {
  const f = FRAMES.find((m) => m.id === moodId)!
  const boxes = f.photoSlots.map((s) => [(s.x + s.width * 0.3) / f.frameWidth, (s.y + s.height * 0.3) / f.frameHeight, (s.width * 0.4) / f.frameWidth, (s.height * 0.4) / f.frameHeight])
  return `(() => { const c = [...document.querySelectorAll('canvas')].find(c => c.getAttribute('aria-label')?.startsWith('Pratinjau')); const x = c.getContext('2d');
    return ${JSON.stringify(boxes)}.map(([bx, by, bw, bh]) => { const out = [];
      for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { const d = x.getImageData(Math.round((bx + bw * i / 11) * c.width), Math.round((by + bh * j / 11) * c.height), 1, 1).data; out.push(d[0], d[1], d[2]) }
      return out }) })()`
}
/** Two grid samples are "the same photo" when (almost) every sampled pixel matches. */
const same = (a: number[], b: number[]) => a.filter((v, i) => Math.abs(v - b[i]) > 6).length < a.length * 0.02

// Chrome's fake camera restarts its animation each time it opens, so equal timings give
// pixel-identical shots; a distinct delay per shot makes "was it replaced?" checkable.
let shotDelay = 300
async function shoot(page: Awaited<ReturnType<typeof newPage>>, slot: number) {
  await page.wait(`document.body.textContent.includes('Foto ${slot + 1}') && document.querySelector('video')?.readyState >= 2 && !document.querySelector("button[aria-label='Ambil foto']").disabled`)
  shotDelay += 450
  await sleep(shotDelay)
  await page.click('Ambil foto')
  await page.wait('document.body.textContent.includes("Sudah pas?")', 6000)
}

try {
  console.log(`E2E against ${BASE} (fake camera)\n`)

  await test('each QR slug opens its own mood frame (no mix-ups)', async () => {
    const page = await newPage()
    for (const f of FRAMES) {
      await page.go(`/booth/${f.id}`)
      await page.wait(`document.querySelector('img[alt="Frame ${f.name}"]')?.src.endsWith('/frames/${f.id}.png') && document.querySelector('h1')?.textContent === '${f.name}'`)
    }
    await page.shot('01-intro-confident')
    await page.close()
  })

  await test('invalid QR / old placeholder slug shows an informative error', async () => {
    const page = await newPage()
    await page.go('/booth/romantic')
    assert.match(await page.text(), /QR tidak dikenali/)
    await page.close()
  })

  await test('2-photo flow: shot 1 → preview → shot 2 → preview → combined → retake each independently → save 1288×2320', async () => {
    const page = await newPage()
    await page.go('/booth/happy')
    await page.wait('![...document.querySelectorAll("button")].find(b => b.textContent.includes("Mulai Foto")).disabled')
    await page.click('Mulai Foto')

    // Photo 1 with countdown.
    await page.wait(`document.querySelector('video')?.readyState >= 2 && !document.querySelector("button[aria-label='Ambil foto']").disabled`)
    await page.shot('02-camera-slot1')
    await page.click('Ambil foto')
    const seen = new Set<string>()
    const end = Date.now() + 5000
    while (Date.now() < end && !(await page.text()).includes('Sudah pas?')) {
      const n = await page.eval<string>('document.querySelector(".count-pop")?.textContent ?? ""')
      if (n) seen.add(n)
      await sleep(80)
    }
    assert.ok(['3', '2', '1'].every((n) => seen.has(n)), `countdown seen: ${[...seen]}`)
    await page.wait('document.body.textContent.includes("Sudah pas?")')
    assert.match(await page.text(), /Foto 1 dari 2/)
    assert.equal(await page.eval(streamsLive), 0, 'camera still running after shot 1')
    await sleep(200)
    await page.shot('03-review-slot1')
    const [p1, empty2] = await page.eval<number[][]>(slotSignature('happy'))

    // Photo 2: the camera opens for slot 2 and shows photo 1 underneath.
    await page.click('Foto 2')
    await page.wait(`document.querySelector('video')?.readyState >= 2`)
    await sleep(300)
    await page.shot('04-camera-slot2')
    await shoot(page, 1)
    assert.match(await page.text(), /Foto 2 dari 2/)
    const [p1b, p2] = await page.eval<number[][]>(slotSignature('happy'))
    assert.ok(same(p1, p1b), 'photo 1 changed when taking photo 2')
    assert.ok(!same(empty2, p2), 'photo 2 did not land in slot 2')
    await page.click('Lihat Hasil')
    await page.wait('document.body.textContent.includes("Hasil gabungan")')
    await sleep(200)
    await page.shot('05-overview')

    // Retake only photo 2.
    await page.click('Ulangi foto 2 dengan kamera')
    await shoot(page, 1)
    await page.click('Lihat Hasil')
    await page.wait('document.body.textContent.includes("Hasil gabungan")')
    const [q1, q2] = await page.eval<number[][]>(slotSignature('happy'))
    assert.ok(same(p1, q1), 'retaking photo 2 changed photo 1')
    assert.ok(!same(p2, q2), 'photo 2 was not replaced')

    // Retake only photo 1.
    await page.click('Ulangi foto 1 dengan kamera')
    await shoot(page, 0)
    await page.click('Lihat Hasil')
    await page.wait('document.body.textContent.includes("Hasil gabungan")')
    const [r1, r2] = await page.eval<number[][]>(slotSignature('happy'))
    assert.ok(!same(q1, r1), 'photo 1 was not replaced')
    assert.ok(same(q2, r2), 'retaking photo 1 changed photo 2')
    assert.equal(await page.eval(streamsLive), 0, 'camera still running on the overview')

    // Preview pixels (for parity with the export).
    const preview = await page.eval<string>(`(() => { const c = [...document.querySelectorAll('canvas')].find(c => c.getAttribute('aria-label')?.startsWith('Pratinjau')); const s = document.createElement('canvas'); s.width = 64; s.height = 116; s.getContext('2d').drawImage(c, 0, 0, 64, 116); return s.toDataURL() })()`)

    await page.click('Simpan Hasil')
    await page.wait('document.querySelector("img[alt^=\'Hasil foto\']")?.complete')
    const size = await page.eval('(() => { const i = document.querySelector("img[alt^=\'Hasil foto\']"); return [i.naturalWidth, i.naturalHeight] })()')
    assert.deepEqual(size, [1288, 2320])
    const check = await page.eval<{ diff: number; frameDiff: number; slots: number[] }>(`(async () => {
      const load = (src) => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src });
      const out = await load(document.querySelector("img[alt^='Hasil foto']").src);
      const fr = await load('/frames/happy.png');
      const px = (img, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h); return x.getImageData(0, 0, w, h).data };
      const a = px(await load(${JSON.stringify(preview)}), 64, 116), b = px(out, 64, 116);
      let d = 0; for (let k = 0; k < a.length; k += 4) d += Math.abs(a[k]-b[k]) + Math.abs(a[k+1]-b[k+1]) + Math.abs(a[k+2]-b[k+2]);
      // Frame on top & sharp: wherever the PNG is opaque, the output equals the PNG.
      const O = px(out, 1288, 2320), F = px(fr, 1288, 2320); let fd = 0, fn = 0;
      for (let k = 0; k < F.length; k += 4 * 97) if (F[k+3] === 255) { fd += Math.abs(O[k]-F[k]) + Math.abs(O[k+1]-F[k+1]) + Math.abs(O[k+2]-F[k+2]); fn++ }
      // Both slots contain a photo (not the white background).
      const slots = ${JSON.stringify(FRAMES[0].photoSlots)}.map(s => { const i = ((s.y + s.height / 2) * 1288 + (s.x + s.width / 2)) * 4; return O[i] + O[i+1] + O[i+2] });
      return { diff: d / (a.length / 4) / 3, frameDiff: fd / fn / 3, slots } })()`)
    assert.ok(check.diff < 20, `preview vs output mean diff ${check.diff.toFixed(1)}`)
    assert.ok(check.frameDiff < 6, `frame pixels altered in output (mean diff ${check.frameDiff.toFixed(1)})`)
    assert.ok(check.slots.every((v) => v < 740), `a slot is empty/white in the output: ${check.slots}`)
    await page.shot('06-result')

    await page.click('Simpan Foto')
    let file = ''
    for (let i = 0; i < 50 && !file; i++) {
      await sleep(100)
      file = readdirSync(join(OUT, 'downloads')).find((f) => /^NadhePhotobooth-happy-\d{8}-\d{6}\.jpg$/.test(f)) ?? ''
    }
    assert.ok(file, 'download not found')
    assert.ok(statSync(join(OUT, 'downloads', file)).size > 100_000, 'file suspiciously small')

    await page.eval('window.print = () => { window.__printed = true }')
    await page.click('Cetak')
    const pdf = await page.cdp.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true })
    const raw = Buffer.from(pdf.data, 'base64')
    writeFileSync(join(OUT, 'print-4r.pdf'), raw)
    assert.equal(raw.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0, 1, 'print is not one page')

    await page.click('Selesai')
    await page.wait('document.body.textContent.includes("Terima kasih")')
    assert.deepEqual(page.errors, [])
    await page.close()
  })

  await test('gallery upload fills both slots (tired, narrower slot 1)', async () => {
    const page = await newPage()
    await page.go('/booth/tired')
    await page.wait('![...document.querySelectorAll("button")].find(b => b.textContent.includes("Pilih dari Galeri")).disabled')
    assert.ok(UPLOAD && existsSync(UPLOAD), 'set UPLOAD_IMAGE to a JPG')
    await page.click('Pilih dari Galeri')
    await page.setFile(resolve(UPLOAD!))
    await page.wait('document.body.textContent.includes("Sudah pas?") && document.body.textContent.includes("Foto 1 dari 2")')
    assert.match(await page.text(), /Ganti/)
    await page.click('Foto 2')
    await page.wait(`document.querySelector('video')?.readyState >= 2`)
    await page.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Galeri').click()`)
    await page.setFile(resolve(UPLOAD!))
    await page.wait('document.body.textContent.includes("Sudah pas?") && document.body.textContent.includes("Foto 2 dari 2")')
    await page.click('Lihat Hasil')
    await page.wait('document.body.textContent.includes("Hasil gabungan")')
    await sleep(200)
    await page.shot('07-upload-overview')
    await page.click('Simpan Hasil')
    await page.wait('document.querySelector("img[alt^=\'Hasil foto\']")?.complete')
    await page.close()
  })

  await test('upload rejects non-image files', async () => {
    const page = await newPage()
    await page.go('/booth/sad')
    await page.wait('document.querySelector("img[alt=\'Frame Sad\']")?.complete')
    const bad = join(OUT, 'not-a-photo.txt')
    writeFileSync(bad, 'hello')
    await page.setFile(bad)
    await page.wait('document.querySelector("[role=alert]")?.textContent.includes("tidak didukung")')
    await page.close()
  })

  await test('camera permission denied → clear message + gallery fallback', async () => {
    const page = await newPage(`throw new DOMException('denied', 'NotAllowedError');`)
    await page.go('/booth/anxious')
    await page.wait('![...document.querySelectorAll("button")].find(b => b.textContent.includes("Mulai Foto")).disabled')
    await page.click('Mulai Foto')
    await page.wait('document.body.textContent.includes("Izin kamera ditolak")')
    assert.match(await page.text(), /Pilih dari Galeri/)
    await page.shot('08-denied')
    await page.close()
  })

  await test('panitia: blocks localhost QR, shows transparency OK for all 5 frames', async () => {
    const page = await newPage()
    await page.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
    await page.go('/panitia')
    assert.match(await page.text(), /Isi alamat https:\/\/ publik/)
    assert.ok(await page.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Unduh Semua Kartu')).disabled`), 'zip enabled for localhost')
    for (const f of FRAMES) await page.wait(`document.querySelector('[data-testid="transparency-${f.id}"]')?.textContent.includes('Status: OK')`, 10000)
    await page.close()
  })

  await test('panitia: 5 QR cards decode (full size and at 3 cm print size) to the right mood URL; downloads work', async () => {
    const page = await newPage()
    await page.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
    await page.go('/panitia')
    await page.eval(`(() => { const i = document.querySelector('input[inputmode=url]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(PUBLIC)}); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    for (const f of FRAMES) await page.wait(`document.querySelector('[data-testid="card-${f.id}"]')?.complete`, 15000)
    await page.eval(JSQR)
    for (const f of FRAMES) {
      const res = await page.eval<{ full: string | null; small: string | null; w: number; h: number }>(`(async () => {
        const img = document.querySelector('[data-testid="card-${f.id}"]');
        const read = (w) => { const h = Math.round(w * img.naturalHeight / img.naturalWidth); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h); const d = x.getImageData(0, 0, w, h); return jsQR(d.data, w, h)?.data ?? null };
        // 360 px wide ≈ the card printed and photographed small; the QR is then ~200 px.
        return { full: read(img.naturalWidth), small: read(360), w: img.naturalWidth, h: img.naturalHeight } })()`)
      assert.equal(res.full, `${PUBLIC}/booth/${f.id}`, `${f.id} full-size decode`)
      assert.equal(res.small, `${PUBLIC}/booth/${f.id}`, `${f.id} small decode`)
      assert.deepEqual([res.w, res.h], [1004, 1299], `${f.id} card size`)
    }
    await page.shot('09-panitia')
    await page.eval(`window.scrollTo(0, 0)`)
    await page.click('Unduh Semua Kartu (.zip)')
    let zip = ''
    for (let i = 0; i < 80 && !zip; i++) {
      await sleep(100)
      zip = readdirSync(join(OUT, 'downloads')).find((f) => f === 'nadhe-photobooth-kartu-qr.zip') ?? ''
    }
    assert.ok(zip, 'zip not downloaded')
    await page.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Unduh Kartu QR')).click()`)
    let png = ''
    for (let i = 0; i < 50 && !png; i++) {
      await sleep(100)
      png = readdirSync(join(OUT, 'downloads')).find((f) => /^kartu-qr-.*happy\.png$/.test(f)) ?? ''
    }
    assert.ok(png, 'single card PNG not downloaded')
    // Print: one card per page at 85 × 110 mm.
    await page.eval('window.print = () => {}')
    await page.click('Cetak Semua Kartu')
    const pdf = await page.cdp.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true })
    const raw = Buffer.from(pdf.data, 'base64')
    writeFileSync(join(OUT, 'cards.pdf'), raw)
    const pages = raw.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0
    const box = raw.toString('latin1').match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/)
    assert.equal(pages, 5, `cards print has ${pages} pages`)
    assert.ok(box && Math.abs(+box[1] - 240.9) < 2 && Math.abs(+box[2] - 311.8) < 2, `card page size ${box?.slice(1)}`)
    await page.close()
  })
} finally {
  chrome.kill()
  console.log(`\n${passed} passed, ${failed} failed · screenshots in ${OUT}`)
  process.exitCode = failed ? 1 : 0
}
