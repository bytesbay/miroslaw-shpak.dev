import {
  BufferGeometry, Float32BufferAttribute, Mesh, ShaderMaterial, Color, Vector3,
  AdditiveBlending, Points, LineSegments, Line, Group, RingGeometry, DoubleSide, CanvasTexture,
  Sprite, SpriteMaterial, SRGBColorSpace, Object3D,
} from 'three'
import { sphereCube } from './planet'

/*
  Atmosphere, evaluated per pixel. For every view ray the shader finds the segment inside the
  atmosphere shell, its lowest point and an approximate optical depth (exponential density with
  scale height H). Nothing depends on mesh normals, so the glow has no facets, and a small H keeps
  the layer thin: a bright line at the limb, soft haze at grazing angles, warm band at the terminator.
*/
export function makeAtmosphere(radius: number, color: string, sun: Vector3, strength: number, center: Vector3, scaleHeight: number, terrain: number, lowest = radius) {
  const top = radius * (1 + terrain) + scaleHeight * 7
  const mat = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) }, uSun: { value: sun }, uK: { value: strength }, uC: { value: center },
      uR: { value: radius }, uH: { value: scaleHeight }, uTop: { value: top }, uRHit: { value: lowest },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uSun, uC; uniform float uR, uH, uTop, uK, uRHit;
      varying vec3 vW;
      void main() {
        vec3 rd = normalize(vW - cameraPosition);
        vec3 oc = cameraPosition - uC;
        float b = dot(oc, rd);
        float c0 = dot(oc, oc);
        bool outside = c0 > uTop * uTop;
        if (outside && !gl_FrontFacing) discard;
        float dA = b * b - (c0 - uTop * uTop);
        if (dA <= 0.0) discard;
        float sA = sqrt(dA);
        float t0 = outside ? -b - sA : 0.0;
        float t1 = -b + sA;
        float dP = b * b - (c0 - uRHit * uRHit);   // lowest terrain (crater floors), not the base sphere
        bool hit = dP > 0.0 && (-b - sqrt(dP)) > 0.0;
        float tau; vec3 P;
        float Lg = sqrt(6.2832 * uR * uH);           // optical length of a grazing ray
        if (hit) discard;                             // the surface haze is drawn by the planet shader
        float tc = clamp(-b, t0, t1);
        P = oc + rd * tc;
        float h = max(length(P) - uR, 0.0);
        tau = exp(-h / uH) * min(t1 - t0, Lg);
        tau *= 0.15 + 0.85 * smoothstep(uRHit, uR, length(P));   // rays grazing below the base sphere are over terrain
        float glow = 1.0 - exp(-tau / (Lg * 0.38));
        vec3 n = normalize(P);
        float sd = dot(n, uSun);
        float lit = smoothstep(-0.28, 0.45, sd);
        float sunset = exp(-pow((sd + 0.03) * 5.0, 2.0));
        float fwd = pow(max(dot(rd, uSun), 0.0), 8.0);
        vec3 col = mix(uColor * vec3(0.5, 0.6, 1.0), uColor, glow);
        col = mix(col, vec3(1.0, 0.5, 0.36), sunset * 0.7);
        col = mix(col, vec3(1.0), glow * glow * glow * lit * 0.35);
        float k = glow * (lit + sunset * 0.55 + fwd * 1.3 + 0.02);
        gl_FragColor = vec4(col * k * uK, 1.0);
      }`,
    side: DoubleSide, blending: AdditiveBlending, transparent: true, depthWrite: false,
  })
  const m = new Mesh(sphereCube(72), mat)
  m.scale.setScalar(top)
  m.geometry.boundingSphere!.radius = 1.01
  m.renderOrder = 3
  return m
}

export function makePlanetRing(inner: number, outer: number, sun: Vector3) {
  const geo = new RingGeometry(inner, outer, 160, 1)
  const mat = new ShaderMaterial({
    uniforms: { uIn: { value: inner }, uOut: { value: outer }, uSun: { value: sun } },
    vertexShader: /* glsl */ `
      varying vec3 vL; varying vec3 vW;
      void main() { vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uIn; uniform float uOut; uniform vec3 uSun;
      varying vec3 vL; varying vec3 vW;
      float h(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float r = (length(vL.xy) - uIn) / (uOut - uIn);
        float band = 0.0;
        for (int i = 0; i < 5; i++) {
          float f = float(i + 1) * 9.0;
          band += (0.5 + 0.5 * sin(r * f * 3.1 + h(float(i)) * 6.28)) / float(i + 2);
        }
        float a = smoothstep(0.0, 0.08, r) * smoothstep(1.0, 0.82, r) * (0.25 + band * 0.55);
        a *= 1.0 - smoothstep(0.42, 0.47, r) * smoothstep(0.53, 0.48, r) * 0.85;
        vec3 V = normalize(vW - cameraPosition);
        float fwd = pow(max(dot(V, uSun), 0.0), 4.0);
        vec3 col = mix(vec3(0.75, 0.55, 0.62), vec3(1.0, 0.82, 0.7), r) * (0.55 + fwd * 1.4);
        gl_FragColor = vec4(col * 0.7, a * 0.5);
      }`,
    transparent: true, depthWrite: false, side: DoubleSide,
  })
  return new Mesh(geo, mat)
}

/* ---------------------------------------------------------------- sprites */
export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.25)') {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, inner)
  g.addColorStop(0.18, mid)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export function glowSprite(tex: CanvasTexture, color: string, scale: number) {
  const s = new Sprite(new SpriteMaterial({ map: tex, color, blending: AdditiveBlending, transparent: true, depthWrite: false }))
  s.scale.setScalar(scale)
  return s
}

/* ---------------------------------------------------------------- stars + warp */
export function makeStars(count: number, radius: number) {
  const dirs: number[] = [], size: number[] = [], col: number[] = [], phase: number[] = []
  const palette = [new Color('#ffffff'), new Color('#ffd1e1'), new Color('#ffe6b8'), new Color('#c9d6ff')]
  const v = new Vector3()
  for (let i = 0; i < count; i++) {
    v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
    if (v.lengthSq() > 1 || v.lengthSq() < 0.01) { i--; continue }
    v.normalize()
    dirs.push(v.x, v.y, v.z)
    const r = Math.random()
    size.push(r < 0.06 ? 3.2 : r < 0.25 ? 2.1 : 1.3)
    const c = palette[Math.random() < 0.72 ? 0 : 1 + Math.floor(Math.random() * 3)]
    col.push(c.r, c.g, c.b)
    phase.push(Math.random() * 6.28)
  }
  const uniforms = { uR: { value: radius }, uTime: { value: 0 }, uDpr: { value: 1 }, uWarp: { value: 0 }, uVel: { value: new Vector3(0, 0, -1) } }

  const pg = new BufferGeometry()
  pg.setAttribute('position', new Float32BufferAttribute(dirs, 3))
  pg.setAttribute('aSize', new Float32BufferAttribute(size, 1))
  pg.setAttribute('aColor', new Float32BufferAttribute(col, 3))
  pg.setAttribute('aPhase', new Float32BufferAttribute(phase, 1))
  const points = new Points(
    pg,
    new ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        uniform float uR, uTime, uDpr, uWarp;
        attribute float aSize, aPhase; attribute vec3 aColor;
        varying vec3 vC; varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position * uR, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.75 + 0.25 * sin(uTime * (0.6 + aPhase * 0.3) + aPhase * 7.0);
          gl_PointSize = aSize * uDpr * tw;
          vC = aColor; vA = tw * (1.0 - uWarp * 0.65);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vC * a * vA, 1.0);
        }`,
      blending: AdditiveBlending, depthWrite: false, transparent: true,
    }),
  )

  // warp streaks: each star becomes a segment stretched against the travel direction
  const ls: number[] = [], end: number[] = [], len: number[] = [], lc: number[] = []
  const n = Math.min(count, 1600)
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 2; k++) {
      ls.push(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2])
      end.push(k)
      len.push(0.35 + Math.random() * 0.9)
      lc.push(col[i * 3], col[i * 3 + 1], col[i * 3 + 2])
    }
  }
  const lg = new BufferGeometry()
  lg.setAttribute('position', new Float32BufferAttribute(ls, 3))
  lg.setAttribute('aEnd', new Float32BufferAttribute(end, 1))
  lg.setAttribute('aLen', new Float32BufferAttribute(len, 1))
  lg.setAttribute('aColor', new Float32BufferAttribute(lc, 3))
  const streaks = new LineSegments(
    lg,
    new ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        uniform float uR, uWarp; uniform vec3 uVel;
        attribute float aEnd, aLen; attribute vec3 aColor;
        varying vec3 vC; varying float vA;
        void main() {
          vec3 p = position * uR - uVel * uR * 0.32 * uWarp * aLen * aEnd;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          float ahead = max(dot(position, uVel), 0.0);
          vC = mix(aColor, vec3(1.0, 0.55, 0.78), 0.35) * (1.0 + ahead);
          vA = uWarp * (1.0 - aEnd * 0.9) * 0.45;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vA;
        void main() { gl_FragColor = vec4(vC * vA, 1.0); }`,
      blending: AdditiveBlending, depthWrite: false, transparent: true,
    }),
  )
  streaks.frustumCulled = false
  points.frustumCulled = false
  const group = new Group()
  group.add(points, streaks)
  group.renderOrder = -10
  return { group, uniforms }
}

/* ---------------------------------------------------------------- warp dust */
export function makeDust(count: number) {
  const pos = new Float32Array(count * 6)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  const mat = new ShaderMaterial({
    uniforms: { uA: { value: 0 } },
    vertexShader: `varying float vE; attribute float aE; void main(){ vE = aE; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uA; varying float vE; void main(){ gl_FragColor = vec4(vec3(1.0,0.7,0.85) * uA * (1.0 - vE), 1.0); }`,
    blending: AdditiveBlending, depthWrite: false, transparent: true,
  })
  const e = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) e[i * 2 + 1] = 1
  geo.setAttribute('aE', new Float32BufferAttribute(e, 1))
  const lines = new LineSegments(geo, mat)
  lines.frustumCulled = false
  const local = new Float32Array(count * 3)
  const spawn = (i: number, zFar: boolean) => {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 70
    local[i * 3] = Math.cos(a) * r
    local[i * 3 + 1] = Math.sin(a) * r
    local[i * 3 + 2] = zFar ? 260 + Math.random() * 200 : Math.random() * 460 - 60
  }
  for (let i = 0; i < count; i++) spawn(i, false)
  const right = new Vector3(), up = new Vector3(), p = new Vector3()
  function update(dt: number, warp: number, cam: Vector3, fwd: Vector3, upHint: Vector3) {
    mat.uniforms.uA.value = warp * 0.4
    lines.visible = warp > 0.01
    if (!lines.visible) return
    right.crossVectors(fwd, upHint).normalize()
    up.crossVectors(right, fwd).normalize()
    const speed = 900 * warp
    const L = 4 + 60 * warp
    const arr = geo.getAttribute('position').array as Float32Array
    for (let i = 0; i < count; i++) {
      local[i * 3 + 2] -= speed * dt
      if (local[i * 3 + 2] < -60) spawn(i, true)
      const x = local[i * 3], y = local[i * 3 + 1], z = local[i * 3 + 2]
      p.copy(cam).addScaledVector(right, x).addScaledVector(up, y).addScaledVector(fwd, z)
      arr[i * 6] = p.x; arr[i * 6 + 1] = p.y; arr[i * 6 + 2] = p.z
      p.addScaledVector(fwd, -L)
      arr[i * 6 + 3] = p.x; arr[i * 6 + 4] = p.y; arr[i * 6 + 5] = p.z
    }
    geo.getAttribute('position').needsUpdate = true
  }
  return { lines, update }
}

/* ---------------------------------------------------------------- orbit + trail */
export function makeOrbit(pointAt: (th: number, out: Vector3) => Vector3, segs = 720) {
  const pos: number[] = [], th: number[] = []
  const v = new Vector3()
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2
    pointAt(a, v)
    pos.push(v.x, v.y, v.z)
    th.push(a)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('aTh', new Float32BufferAttribute(th, 1))
  const uniforms = { uTh: { value: 0 }, uA: { value: 0 }, uFrom: { value: 0 }, uTo: { value: 1 } }
  const line = new Line(
    geo,
    new ShaderMaterial({
      uniforms,
      vertexShader: `attribute float aTh; varying float vTh; void main(){ vTh = aTh; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTh, uA, uFrom, uTo; varying float vTh;
        void main() {
          float d = vTh - uTh;
          d = mod(d + 3.14159265, 6.2831853) - 3.14159265;
          float dash = step(0.45, fract(vTh * 46.0));
          float past = step(d, 0.0) * step(uFrom, vTh);
          float a = mix(0.12 * dash, 0.5, past) + 0.7 * exp(-abs(d) * 3.0);
          vec3 c = mix(vec3(0.75, 0.7, 0.9), vec3(1.0, 0.16, 0.46), past * 0.8 + exp(-abs(d) * 3.0) * 0.2);
          gl_FragColor = vec4(c * a * uA, 1.0);
        }`,
      blending: AdditiveBlending, depthWrite: false, transparent: true,
    }),
  )
  line.frustumCulled = false
  return { line, uniforms }
}

export function makeTrail(pointAt: (s: number, out: Vector3) => Vector3, segs = 260) {
  const pos: number[] = [], us: number[] = []
  const v = new Vector3()
  for (let i = 0; i <= segs; i++) {
    const s = i / segs
    pointAt(s, v)
    pos.push(v.x, v.y, v.z)
    us.push(s)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('aU', new Float32BufferAttribute(us, 1))
  const uniforms = { uHead: { value: 0 }, uA: { value: 0 } }
  const line = new Line(
    geo,
    new ShaderMaterial({
      uniforms,
      vertexShader: `attribute float aU; varying float vU; void main(){ vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uHead, uA; varying float vU;
        void main() {
          if (vU > uHead) discard;
          float a = 0.25 + 0.75 * smoothstep(uHead - 0.35, uHead, vU);
          gl_FragColor = vec4(vec3(1.0, 0.22, 0.52) * a * uA, 1.0);
        }`,
      blending: AdditiveBlending, depthWrite: false, transparent: true,
    }),
  )
  line.frustumCulled = false
  return { line, uniforms }
}

export function placeAll(parent: Object3D, ...children: Object3D[]) {
  children.forEach((c) => parent.add(c))
}
