import type { Gl } from './gl/index'

/*
  Scroll model borrowed from the Shuttle site and rebuilt:
  - wheel input moves a target, the page eases toward it (first smoothing stage);
  - the 3D scene eases toward the page (second stage), which gives the soft, floaty feel;
  - after a short idle the page settles on the nearest keyframe in the direction you were going;
  - keyboard, nav links and deep links all go through the same keyframes.
*/

const html = document.documentElement
const FX = html.classList.contains('fx')

console.log(
  '%c %c Miroslaw Shpak · built from scratch with three.js · github.com/bytesbay ',
  'padding:8px 4px;background:#ff2a75;border-radius:99px',
  'padding:8px 12px;color:#fff;background:radial-gradient(100% 185% at 100% 50%,#22033e 0%,#ff2a75 100%);border-radius:6px 18px 18px 6px',
)

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const now = () => performance.now()

type Ch = { el: HTMLElement; panel: HTMLElement; id: string; label: string; len: number; top: number; height: number; anchors: number[]; key0: number }

const sections = Array.from(document.querySelectorAll<HTMLElement>('main .ch'))
const roles = Array.from(document.querySelectorAll<HTMLElement>('.ch-career .role'))
const roleDots = Array.from(document.querySelectorAll<HTMLElement>('.orbit-dots li'))
const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav a[data-go]'))
const hudLabel = document.querySelector<HTMLElement>('[data-hud-label]')
const hudStrip = document.querySelector<HTMLElement>('[data-hud-strip]')
const warpOut = document.querySelector<HTMLElement>('[data-warp]')

const chapters: Ch[] = sections.map((el) => ({
  el, panel: el.querySelector<HTMLElement>('.panel')!, id: el.id, label: el.dataset.label || el.id, len: parseFloat(el.dataset.len || '1'), top: 0, height: 0, anchors: [], key0: 0,
}))

let vh = innerHeight
let sticky = false
let anchors: number[] = []
let maxScroll = 0
const coarse = matchMedia('(pointer: coarse)').matches

function measure() {
  vh = innerHeight
  maxScroll = Math.max(0, document.documentElement.scrollHeight - vh)
  const stage = document.querySelector<HTMLElement>('.stage')
  sticky = !!stage && getComputedStyle(stage).position === 'sticky'
  if (!sticky) roles.forEach(clearLook)
  anchors = []
  for (const c of chapters) {
    const r = c.el.getBoundingClientRect()
    c.top = r.top + scrollY
    c.height = r.height
    c.key0 = anchors.length
    c.anchors = []
    if (c.id === 'career') {
      if (sticky) {
        const unit = (c.len * vh) / roles.length
        roles.forEach((_, j) => c.anchors.push(c.top + (j + 0.5) * unit))
      } else {
        roles.forEach((li) => {
          const rr = li.getBoundingClientRect()
          c.anchors.push(rr.top + scrollY + rr.height / 2 - vh / 2)
        })
      }
    } else if (c.id === 'hello') {
      c.anchors.push(0)
    } else {
      c.anchors.push(c.top + (c.height - vh) / 2)
    }
    c.anchors = c.anchors.map((a) => clamp(a, 0, maxScroll))
    anchors.push(...c.anchors)
  }
  for (let i = 1; i < anchors.length; i++) if (anchors[i] <= anchors[i - 1]) anchors[i] = anchors[i - 1] + 1
  ;(window as any).__anchors = anchors
}
;(window as any).__goto = (y: number) => goTo(y, true)

// continuous keyframe index for a scroll position
function keyT(y: number) {
  if (y <= anchors[0]) return 0
  for (let i = 0; i < anchors.length - 1; i++) {
    if (y < anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i])
  }
  return anchors.length - 1
}

/* ---------------------------------------------------------------- smooth wheel scrolling */
const smoothWheel = FX && !coarse
let cur = scrollY
let target = scrollY
let expected = scrollY
let lastInput = 0
let snapping = false
let originKey = 0
let touching = false
let lastScrollEvt = 0

function onWheel(e: WheelEvent) {
  if (e.ctrlKey || !sticky) return
  e.preventDefault()
  const mult = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1
  if (snapping) { snapping = false; originKey = nearestKey(target) }
  target = clamp(target + e.deltaY * mult, 0, maxScroll)
  lastInput = now()
}

function nearestKey(y: number) {
  let best = 0
  for (let i = 1; i < anchors.length; i++) if (Math.abs(anchors[i] - y) < Math.abs(anchors[best] - y)) best = i
  return best
}

// Snap in the direction of travel once the user moved 5% of the gap, otherwise fall back.
function snapTarget(y: number) {
  const last = anchors.length - 1
  if (y > anchors[last] + 4) return null
  let k = 0
  while (k < last && y >= anchors[k + 1]) k++
  if (k >= last) return anchors[last]
  const frac = (y - anchors[k]) / (anchors[k + 1] - anchors[k])
  const dir = Math.sign(y - anchors[originKey])
  if (dir > 0) return frac > 0.05 ? anchors[k + 1] : anchors[k]
  if (dir < 0) return frac < 0.95 ? anchors[k] : anchors[k + 1]
  return frac < 0.5 ? anchors[k] : anchors[k + 1]
}

function goTo(y: number, instant = false) {
  y = clamp(y, 0, maxScroll)
  if (instant) {
    cur = target = expected = y
    window.scrollTo(0, y)
    return
  }
  if (smoothWheel && sticky) {
    target = y
    snapping = true
    originKey = nearestKey(y)
  } else {
    snapping = true
    window.scrollTo({ top: y, behavior: 'smooth' })
  }
}

function goChapter(id: string) {
  const c = chapters.find((x) => x.id === id)
  if (c) goTo(c.anchors[0])
}

function stepKey(dir: number) {
  const base = smoothWheel ? target : scrollY
  const k = nearestKey(base)
  let next = k + dir
  if (dir > 0 && anchors[k] > base + 2) next = k
  if (dir < 0 && anchors[k] < base - 2) next = k
  if (next > anchors.length - 1) { goTo(maxScroll); return }
  goTo(anchors[clamp(next, 0, anchors.length - 1)])
}

function scrollTick(dt: number) {
  const t = now()
  if (smoothWheel && sticky) {
    const k = 1 - Math.pow(1 - (snapping ? 0.07 : 0.11), dt * 60)
    cur += (target - cur) * k
    if (Math.abs(target - cur) < 0.25) cur = target
    const dpr = window.devicePixelRatio || 1
    const yw = Math.round(cur * dpr) / dpr
    if (Math.abs(yw - scrollY) > 0.25) {
      window.scrollTo(0, yw)
      expected = yw
    }
    if (!snapping && t - lastInput > 170 && Math.abs(target - cur) < vh * 0.6) {
      const s = snapTarget(target)
      if (s !== null && Math.abs(s - target) > 1) goTo(s)
      else if (s !== null) { snapping = true; originKey = nearestKey(s) }
    }
  } else if (FX && sticky && !touching && !snapping && t - lastScrollEvt > 220 && lastScrollEvt > 0) {
    const s = snapTarget(scrollY)
    snapping = true
    if (s !== null && Math.abs(s - scrollY) > 2) window.scrollTo({ top: s, behavior: 'smooth' })
    originKey = nearestKey(s ?? scrollY)
  }
}

addEventListener('scroll', () => {
  lastScrollEvt = now()
  if (smoothWheel && Math.abs(scrollY - expected) > 4 && Math.abs(scrollY - cur) > 4) {
    // scrollbar drag, find-in-page, focus scrolling: follow the browser
    cur = target = expected = scrollY
    lastInput = now()
    snapping = false
  }
  if (!smoothWheel && !touching && snapping && Math.abs(scrollY - anchors[nearestKey(scrollY)]) < 2) originKey = nearestKey(scrollY)
}, { passive: true })

if (FX) {
  addEventListener('wheel', onWheel, { passive: false })
  addEventListener('touchstart', () => { touching = true; snapping = false; originKey = nearestKey(scrollY) }, { passive: true })
  addEventListener('touchend', () => { touching = false; lastScrollEvt = now() }, { passive: true })
  addEventListener('keydown', (e) => {
    if (!sticky || e.altKey || e.metaKey || e.ctrlKey) return
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    const map: Record<string, number> = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }
    if (e.key === ' ') map[' '] = e.shiftKey ? -1 : 1
    if (e.key in map) { e.preventDefault(); stepKey(map[e.key]) }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0) }
    else if (e.key === 'End') { e.preventDefault(); goTo(maxScroll) }
  })
  // keyboard users: tabbing into a hidden panel brings it into view
  document.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement
    const role = el.closest<HTMLElement>('.role')
    if (role && sticky) { goTo(anchors[chapters.find((c) => c.id === 'career')!.key0 + Number(role.dataset.i)]); return }
    const ch = el.closest<HTMLElement>('.ch')
    if (ch && sticky) goChapter(ch.id)
  })
}

addEventListener('hashchange', () => {
  const id = location.hash.slice(1)
  if (FX && chapters.some((c) => c.id === id)) goChapter(id)
})

document.addEventListener('click', (e) => {
  const r = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-role]')
  if (r && FX && sticky) {
    e.preventDefault()
    goTo(anchors[chapters.find((c) => c.id === 'career')!.key0 + Number(r.dataset.role)])
    return
  }
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-go]')
  if (!a) return
  const id = a.dataset.go!
  if (!FX) return
  e.preventDefault()
  goChapter(id)
  history.replaceState(null, '', id === 'hello' ? location.pathname : '#' + id)
})

/* ---------------------------------------------------------------- panels, HUD, nav */
let activeCh = -1
let hudOffset = 0
let hudTf = ''
// Opacity, offset and blur are written as plain inline styles. WebKit does not always repaint
// properties that go through calc(var(--v)), which left Safari showing stale, blurred panels.
function setLook(el: HTMLElement, v: number, dir: number, dist: number, blur: boolean, scale = false) {
  const key = v.toFixed(3) + dir
  if ((el as any)._look === key) return
  ;(el as any)._look = key
  const y = ((1 - v) * dir * dist).toFixed(2)
  el.style.opacity = v.toFixed(3)
  el.style.transform = v > 0.995 ? 'none' : `translate3d(0,${y}px,0)` + (scale ? ` scale(${(0.97 + v * 0.03).toFixed(4)})` : '')
  if (blur) el.style.filter = v > 0.995 ? 'none' : `blur(${((1 - v) * 6).toFixed(2)}px)`
}

function clearLook(el: HTMLElement) {
  ;(el as any)._look = ''
  el.style.opacity = el.style.transform = el.style.filter = ''
}

const STEP = 200
// each checkpoint is 1K, intermediate labels every 200
const fmt = (v: number) => (v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(v))

function buildHud() {
  if (!hudStrip) return
  let h = ''
  for (let i = 0; i < anchors.length; i++) {
    for (let n = 0; n < 10; n++) {
      const x = i * STEP + n * (STEP / 10)
      if (n === 0) h += `<i class="cp" data-k="${i}" style="left:${x}px" title="${chapterOfKey(i).label}"><b>${fmt(i * 1000)}</b></i>`
      else if (n % 2 === 0) {
        const l = fmt(i * 1000 + n * 100)
        h += `<i class="mid" style="left:${x}px">${l.length <= 4 ? `<b>${l}</b>` : ''}</i>`
      } else h += `<i style="left:${x}px"></i>`
    }
  }
  hudStrip.innerHTML = h
  cps = Array.from(hudStrip.querySelectorAll<HTMLElement>('.cp'))
}

// Checkpoints on the ruler: one per snap point, the active one lights up, click to fly there.
let cps: HTMLElement[] = []
let cpOn = -2
function chapterOfKey(k: number) {
  let c = chapters[0]
  for (const x of chapters) if (k >= x.key0) c = x
  return c
}
hudStrip?.addEventListener('click', (e) => {
  const cp = (e.target as HTMLElement).closest<HTMLElement>('.cp')
  if (cp) goTo(anchors[Number(cp.dataset.k)])
})

function setLabel(label: string, dir: number) {
  if (!hudLabel || hudLabel.textContent === label) return
  hudLabel.classList.add(dir > 0 ? 'out-l' : 'out-r')
  setTimeout(() => {
    hudLabel.textContent = label
    hudLabel.classList.remove('out-l', 'out-r')
    hudLabel.classList.add(dir > 0 ? 'out-r' : 'out-l')
    requestAnimationFrame(() => requestAnimationFrame(() => hudLabel.classList.remove('out-l', 'out-r')))
  }, 180)
}

function updatePanels(y: number, t: number, dt: number) {
  html.classList.toggle('scrolled', y > 40)
  html.classList.toggle('at-end', y > anchors[anchors.length - 1] + vh * 0.12)
  if (sticky) {
    for (const c of chapters) {
      const a0 = c.anchors[0], a1 = c.anchors[c.anchors.length - 1]
      const last = c === chapters[chapters.length - 1]
      const d = y < a0 ? a0 - y : y > a1 && !last ? y - a1 : 0
      const h = c.id === 'career' ? (c.len * vh) / roles.length / 2 : (c.len * vh) / 2
      const v = c.id === 'hello' ? 1 - smooth(0.06 * vh, 0.55 * vh, d) : 1 - smooth(h * 0.5 + 0.08 * vh, h * 0.5 + 0.72 * vh, d)
      setLook(c.panel, v, y < a0 ? 1 : -1, 36, false)
      c.el.classList.toggle('is-hidden', v < 0.002)
    }
    const career = chapters.find((c) => c.id === 'career')!
    const unitH = (career.len * vh) / roles.length / 2
    let best = 0, bestV = -1
    roles.forEach((li, j) => {
      const a = career.anchors[j]
      const d = Math.abs(y - a)
      const v = 1 - smooth(unitH * 0.22, unitH * 1.08, d)
      setLook(li, v, y < a ? 1 : -1, 46, false, true)
      li.classList.toggle('is-off', v < 0.002)
      if (v > bestV) { bestV = v; best = j }
    })
    roleDots.forEach((d, j) => d.classList.toggle('on', j === best))
  } else if (FX) {
    for (const c of chapters) {
      const r = c.panel.getBoundingClientRect()
      const v = clamp(Math.min(r.bottom - vh * 0.08, vh * 0.92 - r.top) / (vh * 0.22), 0, 1)
      setLook(c.panel, c.id === 'hello' ? Math.max(v, y < 10 ? 1 : 0) : v, r.top > vh / 2 ? 1 : -1, 36, false)
    }
  }

  // active chapter
  const key = Math.round(t)
  let idx = 0
  chapters.forEach((c, i) => { if (key >= c.key0) idx = i })
  if (idx !== activeCh) {
    const dir = idx > activeCh ? 1 : -1
    activeCh = idx
    const c = chapters[idx]
    setLabel(c.label, dir)
    navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.go === c.id))
    if (FX && scrollY > 10) history.replaceState(null, '', c.id === 'hello' ? location.pathname : '#' + c.id)
  }

  const k = Math.round(t)
  const on = Math.abs(t - k) < 0.12 ? k : -1
  if (on !== cpOn) {
    cps.forEach((el, i) => el.classList.toggle('on', i === on))
    cpOn = on
  }
  if (hudStrip) {
    hudOffset += (t * STEP - hudOffset) * (1 - Math.pow(1 - 0.08, dt * 60))
    // snap to device pixels so the tick and the rotated diamond stay on the same pixel column
    const dpr = window.devicePixelRatio || 1
    const tf = `translate3d(${Math.round((260 - hudOffset) * dpr) / dpr}px,0,0)`
    if (tf !== hudTf) { hudStrip.style.transform = tf; hudTf = tf }   // no style writes while nothing moves
  }
}

/* ---------------------------------------------------------------- boot */
let gl: Gl | null = null
let mx = 0, my = 0
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return
  mx = (e.clientX / innerWidth) * 2 - 1
  my = (e.clientY / innerHeight) * 2 - 1
}, { passive: true })

let lastW = innerWidth, lastH = innerHeight
let resizeTimer = 0
addEventListener('resize', () => {
  if (coarse && innerWidth === lastW && Math.abs(innerHeight - lastH) < 140) return
  lastW = innerWidth; lastH = innerHeight
  clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    const t = keyT(scrollY)
    measure()
    buildHud()
    const k = Math.floor(t), u = t - k
    const y = k >= anchors.length - 1 ? anchors[anchors.length - 1] : anchors[k] + (anchors[k + 1] - anchors[k]) * u
    goTo(y, true)
    gl?.resize()
  }, 120)
})

function init() {
  measure()
  buildHud()
  if (FX) {
    const hash = location.hash.slice(1)
    const role = hash.startsWith('career-') ? roles.findIndex((r) => r.id === hash) : -1
    if (role >= 0 && sticky) goTo(anchors[chapters.find((c) => c.id === 'career')!.key0 + role], true)
    else if (hash && chapters.some((c) => c.id === hash)) goTo(chapters.find((c) => c.id === hash)!.anchors[0], true)
    else goTo(0, true)
  }
  let last = now()
  let lastT = -1, lastMx = 0, lastMy = 0, idleSince = now(), lastGl = 0, glDt = 0, warpText = ''
  const loop = () => {
    const t0 = now()
    const dt = Math.min((t0 - last) / 1000, 1 / 20)
    last = t0
    if (FX) scrollTick(dt)
    const y = FX && smoothWheel && sticky ? cur : scrollY
    const t = keyT(y)
    if (FX) updatePanels(y, t, dt)
    if (warpOut && gl) {
      const w = gl.warp.toFixed(2)
      if (w !== warpText) { warpOut.textContent = w; warpText = w }   // a DOM write per frame forced layout even at rest
    }
    // full frame rate while anything moves, 30 fps when the scene is just idling
    const moving = Math.abs(t - lastT) > 1e-4 || mx !== lastMx || my !== lastMy
    if (moving) idleSince = t0
    lastT = t; lastMx = mx; lastMy = my
    glDt += dt
    // ~30 fps at rest on any display (was half the refresh rate, so 60 fps on 120 Hz screens)
    const idle = t0 - idleSince > 1500
    if (gl && (!idle || t0 - lastGl >= 30)) { gl.frame(glDt, t, mx, my); glDt = 0; lastGl = t0 }
    if (FX) requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  if (FX) {
    const bar = document.querySelector<HTMLElement>('.loader-bar')
    const progress = (p: number) => bar?.style.setProperty('--p', String(Math.max(0.04, p)))
    const done = () => {
      if (html.classList.contains('loaded')) return
      html.classList.add('loaded')
      setTimeout(() => document.querySelector('.loader')?.remove(), 1500)   // stops its animations for good
    }
    setTimeout(done, 9000) // never keep the page behind the loader
    progress(0.04)
    const boot = () => {
      // model and 3D code download in parallel
      const model = fetch('/models/shuttle.glb').then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)
      return import('./gl/index')
        .then((m) => { progress(0.08); return m.start(document.getElementById('gl') as HTMLCanvasElement, () => { html.classList.add('gl-ready'); done() }, progress, model) })
        .then((g) => { gl = g })
        .catch((err) => { console.warn('3D disabled:', err); done(); html.classList.replace('fx', 'nofx'); measure() })
    }
    // start after the page itself has loaded, so 3D setup never competes with the first render
    const go = () => ('requestIdleCallback' in window ? (window as any).requestIdleCallback(boot, { timeout: 600 }) : setTimeout(boot, 30))
    if (document.readyState === 'complete') go()
    else addEventListener('load', go, { once: true })
  }
}

// Live GitHub numbers: the values baked into the HTML are refreshed on load, cached for 10 minutes
// (keeps well under the unauthenticated API limit without showing stale counts for long).
const TTL = 10 * 60 * 1000
function cached(key: string) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null') as { n: number; t: number } | null
    return v && Date.now() - v.t < TTL ? v.n : 0
  } catch { return 0 }
}
function store(key: string, n: number) {
  try { localStorage.setItem(key, JSON.stringify({ n, t: Date.now() })) } catch {}
}

// Live GitHub star counts.
function refreshStars() {
  const els = Array.from(document.querySelectorAll<HTMLElement>('.os-stars[data-repo]'))
  els.forEach(async (el) => {
    const repo = el.dataset.repo!
    const key = 'stars:' + repo
    let n = cached(key)
    if (!n) {
      try {
        const r = await fetch(`https://api.github.com/repos/${repo}`, { cache: 'no-store', headers: { accept: 'application/vnd.github+json' } })
        if (r.ok) n = ((await r.json()) as { stargazers_count?: number }).stargazers_count || 0
        if (n) store(key, n)
      } catch {}
    }
    const shown = Number((el.textContent || '').replace(/\D/g, ''))
    if (n > shown) {
      el.textContent = `★ ${n}`
      el.setAttribute('aria-label', `${n} GitHub stars`)
    }
  })
}
// Live GitHub follower count on the contact button, same idea as the stars.
async function refreshFollowers() {
  const el = document.querySelector<HTMLElement>('[data-gh-followers]')
  if (!el) return
  const user = el.dataset.ghFollowers!
  const key = 'followers:' + user
  let n = cached(key)
  if (!n) {
    try {
      const r = await fetch(`https://api.github.com/users/${user}`, { cache: 'no-store', headers: { accept: 'application/vnd.github+json' } })
      if (r.ok) n = ((await r.json()) as { followers?: number }).followers || 0
      if (n) store(key, n)
    } catch {}
  }
  if (n) {
    el.textContent = `${n} followers`
    el.setAttribute('aria-label', `${n} followers`)
  }
}

const idle = (fn: () => void) => ('requestIdleCallback' in window ? (window as any).requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500))
addEventListener('load', () => idle(() => { refreshStars(); refreshFollowers() }), { once: true })

document.fonts?.ready.then(init, init) ?? init()
