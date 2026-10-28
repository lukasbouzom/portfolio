import { defineComponent, ref, onMounted, onUnmounted } from 'vue'

export default defineComponent({
  name: 'AsciiGrass',
  setup() {
    const canvasRef = ref<HTMLCanvasElement | null>(null)
    let animationFrameId: number | null = null

    const FONT_SIZE = 12
    const FONT = `${FONT_SIZE}px "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", "Courier New", monospace`
    const LOOP = 2.4
    const P2 = 2 * LOOP
    const TAU = Math.PI * 2
    const GLOW = 0.5
    const GRASS_WIND = 2.0
    const GRASS_HEIGHT = 1.7
    const HORIZON = 0.56

    const GRASS_FAR = [0.20, 0.27, 0.26]
    const GRASS_NEAR = [0.32, 0.50, 0.28]
    const GRASS_TIP = [0.82, 0.72, 0.40]
    const BG = [0x14, 0x15, 0x18]

    const BUCKETS = [' ', '.', ':-', '=+', '*%', '#', '@']
    const LEVELS = [0.06, 0.18, 0.32, 0.48, 0.64, 0.80]
    const G_PIPE = 0, G_SLASH = 1, G_BACK = 2, G_TICK = 3, G_COMMA = 4, G_DOT = 5
    const GRASS_CHARS = "|/\\',."

    const clamp = (x: number, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x)

    function hash3(a: number, b: number, c: number): number {
      let h = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0
      h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
      return (h ^ (h >>> 16)) >>> 0
    }

    const rnd = (k: number, n: number) => hash3(k, n, 5150) / 4294967296
    const lerp3 = (a: number[], b: number[], k: number) => {
      k = clamp(k)
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
    }

    let CW = 7
    let CH = FONT_SIZE
    let ROWS = 120
    let COLS = 160
    let N = ROWS * COLS

    let lum = new Float32Array(0)
    let rgb = new Float32Array(0)
    let glyph = new Int8Array(0)

    interface Blade {
      x: number
      y: number
      depth: number
      h: number
      lean0: number
      ph: number
      tint: number
    }

    let BLADES: Blade[] = []

    let MASKS: Uint8Array[] = []
    let START: number[] = []
    let COUNT: number[] = []
    let GRASS0 = 0

    let asciiCanvas: HTMLCanvasElement | null = null
    let asciiCtx: CanvasRenderingContext2D | null = null
    let imgData: ImageData | null = null
    let px32: Uint32Array | null = null

    let glowA: HTMLCanvasElement | null = null
    let glowB: HTMLCanvasElement | null = null
    let glowC: HTMLCanvasElement | null = null

    function setPixel(i: number, l: number, col: number[]) {
      lum[i] = l
      glyph[i] = -1
      const j = i * 3
      rgb[j] = col[0]
      rgb[j + 1] = col[1]
      rgb[j + 2] = col[2]
    }

    function initMasks() {
      START = []
      COUNT = BUCKETS.map((b) => b.length)
      BUCKETS.reduce((s, b, k) => {
        START[k] = s
        return s + b.length
      }, 0)
      GRASS0 = BUCKETS.join('').length

      const allGlyphs = [...BUCKETS.join('') + GRASS_CHARS]
      MASKS = allGlyphs.map((ch) => {
        const g = document.createElement('canvas')
        g.width = CW
        g.height = CH
        const gx = g.getContext('2d')
        if (!gx) return new Uint8Array(CW * CH)
        gx.font = FONT
        gx.textBaseline = 'middle'
        gx.fillStyle = '#fff'
        gx.fillText(ch, 0, CH / 2)
        const d = gx.getImageData(0, 0, CW, CH).data
        const m = new Uint8Array(CW * CH)
        for (let k = 0; k < m.length; k++) m[k] = d[k * 4 + 3]
        return m
      })
    }

    function initMetrics() {
      const probe = document.createElement('canvas').getContext('2d')
      if (probe) {
        probe.font = FONT
        CW = Math.max(1, Math.round(probe.measureText('M').width))
      }
      CH = FONT_SIZE

      const fitCols = (rows: number) =>
        Math.round((rows * CH) / CW * window.innerWidth / Math.max(1, window.innerHeight))
      ROWS = Math.max(119, Math.min(260, Math.round((119 * CW) / CH * window.innerHeight / Math.max(1, window.innerWidth))))
      COLS = Math.max(152, Math.min(560, fitCols(ROWS)))
      N = COLS * ROWS

      lum = new Float32Array(N)
      rgb = new Float32Array(N * 3)
      glyph = new Int8Array(N)

      initMasks()

      const H0 = ROWS * HORIZON
      BLADES = []
      const n = Math.round(COLS * 5.5)
      for (let k = 0; k < n; k++) {
        const depth = Math.pow(rnd(k, 1), 0.75)
        BLADES.push({
          x: rnd(k, 2) * COLS * 0.5,
          y: H0 + depth * (ROWS + 3 - H0),
          depth,
          h: (0.8 + 10 * GRASS_HEIGHT * depth * depth) * (0.45 + 1.0 * Math.pow(rnd(k, 3), 1.4)) * (0.8 + 0.2 * GRASS_HEIGHT),
          lean0: 0.15 + (rnd(k, 4) - 0.5) * 0.35,
          ph: rnd(k, 5) * TAU,
          tint: rnd(k, 6)
        })
      }
      BLADES.sort((a, b) => a.y - b.y)

      const W = COLS * CW
      const H = ROWS * CH

      asciiCanvas = document.createElement('canvas')
      asciiCanvas.width = W
      asciiCanvas.height = H
      asciiCtx = asciiCanvas.getContext('2d')
      if (asciiCtx) {
        imgData = asciiCtx.createImageData(W, H)
        px32 = new Uint32Array(imgData.data.buffer)
      }

      glowA = document.createElement('canvas')
      glowB = document.createElement('canvas')
      glowC = document.createElement('canvas')
      ;[[glowA, 2], [glowB, 4], [glowC, 8]].forEach(([g, s]) => {
        const canvas = g as HTMLCanvasElement
        canvas.width = Math.ceil(W / (s as number))
        canvas.height = Math.ceil(H / (s as number))
      })

      const canvas = canvasRef.value
      if (canvas) {
        canvas.width = W
        canvas.height = H
      }
    }

    function wind(x: number, t: number) {
      const gust = Math.pow(0.5 + 0.5 * Math.sin(TAU * (x / 60 - t / P2)), 3)
      return GRASS_WIND * (0.18 + 0.55 * gust + 0.12 * Math.sin(TAU * (x / 17 - 2 * t / P2) + 1.3))
    }

    function renderBlades(t: number) {
      for (let k = 0; k < BLADES.length; k++) {
        const B = BLADES[k]
        const w = wind(B.x, t)
        const lean = B.lean0 + w * (0.6 * B.depth) * (0.7 + 0.3 * Math.sin(TAU * t / P2 + B.ph))
        const g = lean > 0.5 ? G_SLASH : lean < -0.6 ? G_BACK : Math.abs(lean) < 0.25 ? G_PIPE : lean > 0 ? G_TICK : G_COMMA
        const nSteps = Math.max(2, Math.round(B.h))

        for (let s = 0; s < nSteps; s++) {
          const u = s / (nSteps - 1)
          const x = B.x + lean * B.h * u * u
          const y = B.y - s
          const c = Math.floor(x * 2)
          const r = Math.floor(y)
          if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue

          const i = r * COLS + c
          const l = (0.12 + 0.75 * u * (0.6 + 0.4 * B.depth)) * (0.8 + 0.2 * Math.sin(B.ph))
          const sheen = Math.pow(0.5 + 0.5 * Math.sin(TAU * (x / 30 - t / P2) + B.ph), 4)
          let col = lerp3(GRASS_FAR, GRASS_NEAR, B.depth)
          col = lerp3(col, GRASS_TIP, u * u * (0.25 + 0.35 * B.tint) + 0.45 * sheen * u)
          if (l >= lum[i]) {
            setPixel(i, l, col)
            glyph[i] = g
          }
        }
      }
    }

    function draw() {
      if (!px32 || !imgData || !asciiCtx || !asciiCanvas) return
      const canvas = canvasRef.value
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const W = COLS * CW
      const H = ROWS * CH

      px32.fill(0)
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c
          const L = lum[i]
          let m: Uint8Array | undefined

          if (glyph[i] >= 0) {
            m = MASKS[GRASS0 + glyph[i]]
          } else {
            let level = 0
            while (level < LEVELS.length && L >= LEVELS[level]) level++
            if (level === 0) continue
            m = MASKS[START[level] + hash3(r, c, 1) % COUNT[level]]
          }

          if (!m) continue
          const k = (0.6 + 0.45 * L) * 255
          const j = i * 3
          const pr = Math.min(255, rgb[j] * k) | 0
          const pg = Math.min(255, rgb[j + 1] * k) | 0
          const pb = Math.min(255, rgb[j + 2] * k) | 0
          const col = (pb << 16) | (pg << 8) | pr

          let o0 = (r * CH) * W + c * CW
          let mi = 0
          for (let y = 0; y < CH; y++, o0 += W) {
            for (let x = 0; x < CW; x++, mi++) {
              const v = m[mi]
              if (v) px32[o0 + x] = (v << 24) | col
            }
          }
        }
      }

      asciiCtx.putImageData(imgData, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.fillStyle = `rgb(${BG.join(',')})`
      ctx.fillRect(0, 0, W, H)
      ctx.drawImage(asciiCanvas, 0, 0)

      if (GLOW > 0 && glowA && glowB && glowC) {
        let src: CanvasImageSource = asciiCanvas
        for (const g of [glowA, glowB, glowC]) {
          const gx = g.getContext('2d')
          if (gx) {
            gx.clearRect(0, 0, g.width, g.height)
            gx.drawImage(src, 0, 0, g.width, g.height)
            src = g
          }
        }
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = GLOW
        ctx.drawImage(glowC, 0, 0, W, H)
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
      }
    }

    let t0 = performance.now()
    let lastDraw = -1e9
    const FPS = 30

    function tick(now: number) {
      if (now - lastDraw >= 1000 / FPS - 2) {
        lastDraw = now
        lum.fill(0)
        glyph.fill(-1)
        const t = (now - t0) / 1000
        renderBlades(t)
        draw()
      }
      animationFrameId = requestAnimationFrame(tick)
    }

    onMounted(() => {
      initMetrics()
      window.addEventListener('resize', initMetrics)
      t0 = performance.now()
      animationFrameId = requestAnimationFrame(tick)
    })

    onUnmounted(() => {
      window.removeEventListener('resize', initMetrics)
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
    })

    return {
      canvasRef
    }
  }
})
