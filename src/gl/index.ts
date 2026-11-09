import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, DirectionalLight, AmbientLight, Vector3, Quaternion, Group, Mesh,
  ConeGeometry, ShaderMaterial, AdditiveBlending, AnimationMixer, ACESFilmicToneMapping, SRGBColorSpace,
  PMREMGenerator, MathUtils, Sprite, Material, MeshStandardMaterial, SphereGeometry, BackSide, PCFSoftShadowMap, Vector2, WebGLRenderTarget, HalfFloatType, NearestFilter, OrthographicCamera, PlaneGeometry,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import {
  evaluate, newPose, orient, configure, R_H, C_D, R_D, SUN, N_O, ringPoint, thetaOf, capturePoint, CAREER_FIRST, CAREER_COUNT, smooth, THETA0,
} from './timeline'
import { makeAtmosphere, makePlanetRing, makeStars, makeDust, makeOrbit, makeTrail, glowTexture, glowSprite } from './world'
import { makeDetailedPlanet, sphereCube, bindRotation, makeClouds, makeHomePatch } from './planet'

export type Gl = { frame(dt: number, t: number, mx: number, my: number, measure?: boolean): void; resize(): void; warp: number; quality: () => number }

const SHUTTLE_SCALE = 12

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

export async function start(canvas: HTMLCanvasElement, onReady: () => void, onProgress: (p: number) => void = () => {}): Promise<Gl> {
  const weak = matchMedia('(pointer: coarse)').matches || (navigator as any).deviceMemory < 4
  // Pixel-art rendering: the scene is drawn at ~300 lines and scaled up with nearest-neighbour
  // filtering (image-rendering: pixelated). Same look on every device, and a fraction of the GPU cost.
  const pixelSize = () => Math.min(5, Math.max(2, Math.round(innerHeight / 300)))
  const pixelRatio = () => 1 / pixelSize()
  const dprCap = 1
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false })
  renderer.setPixelRatio(pixelRatio())
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setClearColor(new Color('#05040a'))

  const scene = new Scene()
  const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.4, 60000)

  // HDR target at the low resolution, then one full-screen pass: tone mapping, sRGB,
  // a limited palette and 4x4 Bayer dithering.
  const bufSize = new Vector2()
  renderer.getDrawingBufferSize(bufSize)
  const target = new WebGLRenderTarget(bufSize.x, bufSize.y, { type: HalfFloatType, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true })
  const post = new Scene()
  const postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const postQuad = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
    uniforms: { tScene: { value: target.texture }, uLevels: { value: 9 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tScene; uniform float uLevels; varying vec2 vUv;
      float bayer(vec2 p){
        int x=int(mod(p.x,4.0)), y=int(mod(p.y,4.0));
        int i=x+y*4;
        float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
        return m[i]/16.0-0.5;
      }
      void main(){
        gl_FragColor=vec4(texture(tScene,vUv).rgb,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec3 c=gl_FragColor.rgb;
        c=floor(c*uLevels+0.5+bayer(gl_FragCoord.xy)*0.9)/uLevels;
        gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
      }`,
    depthTest: false, depthWrite: false,
  }))
  postQuad.frustumCulled = false
  post.add(postQuad)
  const draw = () => {
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    renderer.render(post, postCam)
  }
  configure(innerWidth / innerHeight)

  // light
  const sun = new DirectionalLight('#fff0e0', 3.1)
  sun.position.copy(SUN)
  const fill = new DirectionalLight('#5b6cff', 0.35)
  fill.position.copy(SUN).negate()
  scene.add(sun, sun.target, fill, new AmbientLight('#2b2442', 0.25))

  // Space environment for the metal hull: black sky, bluish bounce from the planet below,
  // a hot sun. A studio environment made the shuttle look like a plastic toy.
  const envScene = new Scene()
  envScene.add(new Mesh(new SphereGeometry(10, 48, 24), new ShaderMaterial({
    side: BackSide,
    uniforms: { uSun: { value: SUN } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; varying vec3 vD;
      void main(){
        float below = smoothstep(0.1, -0.6, vD.y);
        float above = smoothstep(-0.2, 0.9, vD.y);
        vec3 c = vec3(0.06, 0.06, 0.08) * above + vec3(0.18, 0.22, 0.42) * below + vec3(0.03);
        float s = max(dot(vD, uSun), 0.0);
        c += vec3(1.0, 0.92, 0.8) * (pow(s, 600.0) * 60.0 + pow(s, 12.0) * 0.35);
        gl_FragColor = vec4(c, 1.0);
      }`,
  })))
  const pmrem = new PMREMGenerator(renderer)
  const env = pmrem.fromScene(envScene, 0).texture
  scene.environment = env
  scene.environmentIntensity = 1

  // real self-shadowing on the shuttle: a small shadow map that follows it
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = sun.shadow.camera.bottom = -3
  sun.shadow.camera.right = sun.shadow.camera.top = 3
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 80
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02

  await nextFrame()
  // sky
  const stars = makeStars(2600, 20000)
  stars.uniforms.uDpr.value = 1
  scene.add(stars.group)
  const glowTex = glowTexture()
  const sunGlow = glowSprite(glowTex, '#ffd6a6', 3400)
  const sunCore = glowSprite(glowTex, '#ffffff', 900)
  scene.add(sunGlow, sunCore)
  const dust = makeDust(260)
  scene.add(dust.lines)

  onProgress(0.1)
  await nextFrame()

  // home planet: light global sphere plus a dense patch where the camera starts
  const home = new Group()
  const SEG_H = weak ? 128 : 192, SEG_D = weak ? 96 : 144
  const homeMesh = makeDetailedPlanet(renderer, {
    atmo: { color: '#6f8dff', h: R_H * 0.009, k: 1.15 }, mapW: weak ? 1024 : 2048, radius: R_H, kind: 0, segs: SEG_H, amp: 0.016, seed: [3.1, 7.4, 1.9], sun: SUN,
    colors: { deep: '#040a1c', shallow: '#123060', low: '#232a2b', mid: '#353240', high: '#4f4655', peak: '#cfcadc', amb: '#221d36', fill: '#4b55c8', sun: '#fff1e4', lights: '#ffb35c' },
  })
  const homeLo = new Mesh(sphereCube(48), homeMesh.material)
  homeLo.geometry.boundingSphere!.radius = R_H * 1.05
  homeLo.onBeforeRender = bindRotation
  await nextFrame()
  const patch = makeHomePatch(renderer, homeMesh, { capDeg: 26, rings: weak ? 110 : 180, sectors: weak ? 240 : 400, mapSize: weak ? 1024 : 2048, seed: [3.1, 7.4, 1.9] })
  homeMesh.add(patch.mesh)
  const homeU = (homeMesh.material as ShaderMaterial).uniforms
  onProgress(0.3)
  await nextFrame()
  await nextFrame()
  const homeClouds = makeClouds(renderer, { radius: R_H * 1.027, segs: weak ? 48 : 96, mapW: weak ? 1024 : 2048, sun: SUN, seed: [2.3, 5.1, 8.8], tint: '#f2efff', opacity: 0.62 })
  home.add(homeClouds)
  home.add(homeMesh, homeLo, makeAtmosphere(R_H, '#6f8dff', SUN, 1.15, new Vector3(0, 0, 0), R_H * 0.009, 0.022))
  scene.add(home)

  // destination planet with rings
  const dest = new Group()
  dest.position.copy(C_D)
  await nextFrame()
  const destMesh = makeDetailedPlanet(renderer, {
    atmo: { color: '#ff6a9a', h: R_D * 0.012, k: 0.7 }, mapW: weak ? 1024 : 2048, radius: R_D, kind: 1, segs: SEG_D, amp: 0.045, seed: [11.3, 2.2, 5.6], sun: SUN,
    colors: { deep: '#000000', shallow: '#000000', low: '#1e0f1d', mid: '#4a2440', high: '#87485c', peak: '#d79a86', amb: '#2a1426', fill: '#7a3bb0', sun: '#fff1e4', lights: '#000000' },
  })
  const destLo = new Mesh(sphereCube(40), destMesh.material)
  destLo.geometry.boundingSphere!.radius = R_D * 1.1
  destLo.onBeforeRender = bindRotation
  const ring = makePlanetRing(R_D * 1.38, R_D * 2.1, SUN)
  ring.lookAt(new Vector3(-0.12, 1, 0.3))
  dest.add(destMesh, destLo, makeAtmosphere(R_D, '#ff6a9a', SUN, 0.7, C_D, R_D * 0.012, 0.05, R_D * 0.95), ring)
  scene.add(dest)
  onProgress(0.45)
  await nextFrame()

  // career orbit, beacons, capture trail
  const orbit = makeOrbit((th, out) => ringPoint(th, out))
  orbit.uniforms.uFrom.value = THETA0
  scene.add(orbit.line)
  const trail = makeTrail((s, out) => capturePoint(s, out))
  scene.add(trail.line)
  const beacons: Sprite[] = []
  for (let j = 0; j < CAREER_COUNT; j++) {
    const b = glowSprite(glowTex, '#ff2a75', 14)
    ringPoint(thetaOf(j), b.position)
    beacons.push(b)
    scene.add(b)
  }

  // shuttle
  const shuttle = new Group()
  const body = new Group()
  shuttle.add(body)
  scene.add(shuttle)
  let mixer: AnimationMixer | null = null

  const flameMat = new ShaderMaterial({
    uniforms: { uI: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uI, uTime; varying vec2 vUv;
      void main() {
        float along = vUv.y;
        float flick = 0.85 + 0.15 * sin(uTime * 40.0 + along * 12.0);
        float a = pow(along, 1.6) * flick * uI;
        vec3 hot = vec3(1.0, 0.95, 1.0), mid = vec3(1.0, 0.25, 0.55), cool = vec3(0.35, 0.3, 1.0);
        vec3 c = mix(cool, mix(mid, hot, smoothstep(0.75, 1.0, along)), smoothstep(0.2, 0.8, along));
        gl_FragColor = vec4(c * a * 1.6, 1.0);
      }`,
    blending: AdditiveBlending, transparent: true, depthWrite: false,
  })
  const flame = new Mesh(new ConeGeometry(0.42, 1, 20, 1, true), flameMat)
  const flameGlow = glowSprite(glowTex, '#ff3d86', 3)
  const navL = glowSprite(glowTex, '#ff3048', 0.5)
  const navR = glowSprite(glowTex, '#33ff99', 0.5)
  shuttle.add(flame, flameGlow, navL, navR)

  // Engine position in shuttle space. The model's nose points along +Z.
  const ENGINE = new Vector3(0, 0.36, -1.85)
  navL.position.set(1.08, 0.12, -0.9)
  navR.position.set(-1.08, 0.12, -0.9)

  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const model = new Promise<void>((resolve) => {
    setTimeout(resolve, 8000)
    loader.load('/models/shuttle.glb', (gltf) => {
    const m = gltf.scene
    m.scale.setScalar(SHUTTLE_SCALE)
    // three meshes (hull + two cargo doors), one brushed-metal material with baked vertex colours
    const hull = new MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.34, envMapIntensity: 1.4 })
    m.traverse((o) => {
      const mesh = o as Mesh
      if (mesh.isMesh) {
        ;(mesh.material as Material).dispose()
        mesh.material = hull
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    body.add(m)
    if (gltf.animations.length) {
      mixer = new AnimationMixer(m)
      gltf.animations.forEach((c) => mixer!.clipAction(c).play())
      mixer.setTime(0)
    }
    resolve()
    }, undefined, () => resolve())
  })

  await Promise.all([model, homeMesh.userData.ready, destMesh.userData.ready])
  onProgress(0.7)
  await nextFrame()

  // Warm-up: compile every program and upload every buffer now, behind the preloader,
  // so nothing gets compiled or uploaded mid-scroll (that was the stutter at the warp and at the second planet).
  const hidden: { o: { visible: boolean; frustumCulled: boolean }; v: boolean; f: boolean }[] = []
  scene.traverse((o) => { hidden.push({ o, v: o.visible, f: o.frustumCulled }); o.visible = true; o.frustumCulled = false })
  renderer.setRenderTarget(target)
  try { await renderer.compileAsync(scene, camera) } catch {}
  renderer.setRenderTarget(null)
  onProgress(0.85)
  const groups = [home, dest]
  for (const g of groups) {
    const others = scene.children.filter((c) => c !== g)
    others.forEach((c) => (c.visible = false))
    draw()
    others.forEach((c) => (c.visible = true))
    await nextFrame()
  }
  draw()
  hidden.forEach((h) => { h.o.visible = h.v; h.o.frustumCulled = h.f })
  await nextFrame()
  onProgress(1)

  // state
  const pose = newPose()
  const q = new Quaternion()
  let tD = -1
  let time = 0
  let lastFov = 0
  let pmx = 0, pmy = 0
  const camTarget = new Vector3()
  const tmp = new Vector3(), right = new Vector3(), camUp = new Vector3()
  const api: Gl = { warp: 0, frame, resize, quality: () => renderer.getPixelRatio() }
  let first = true

  function frame(dt: number, t: number, mx: number, my: number, measure = true) {
    dt = Math.min(dt, 0.05)
    time += dt
    // Second smoothing stage on top of the smoothed scroll. Same idea as the Shuttle site (0.05 per frame).
    if (tD < 0) tD = t
    tD += (t - tD) * (1 - Math.pow(1 - 0.075, dt * 60))
    pmx += (mx - pmx) * (1 - Math.pow(1 - 0.06, dt * 60))
    pmy += (my - pmy) * (1 - Math.pow(1 - 0.06, dt * 60))

    evaluate(tD, pose)
    api.warp = pose.warp

    // shuttle
    orient(pose.f, pose.up, q)
    shuttle.quaternion.copy(q)
    shuttle.position.copy(pose.sp)
    sun.target.position.copy(pose.sp)
    sun.position.copy(pose.sp).addScaledVector(SUN, 40)
    const bob = Math.sin(time * 0.9) * 0.12 * (1 - pose.warp)
    shuttle.position.addScaledVector(pose.up, bob)
    body.rotation.z = Math.sin(time * 0.6) * 0.03 + pmx * 0.08 * (1 - pose.warp)
    body.rotation.x = -pmy * 0.04
    if (pose.warp > 0) {
      // smooth vibration (sum of sines), not per-frame random jitter
      const a = 0.025 * pose.warp
      body.position.set(a * (Math.sin(time * 37.0) + 0.5 * Math.sin(time * 61.0)) * 0.6, a * (Math.sin(time * 43.0 + 1.3) + 0.5 * Math.sin(time * 71.0)) * 0.6, 0)
    } else body.position.set(0, 0, 0)

    const fl = pose.flame
    const len = 0.6 + fl * 5 + pose.warp * 2.5
    flame.scale.set(0.55 + fl * 0.6, len, 0.55 + fl * 0.6)
    flame.rotation.x = -Math.PI / 2
    flame.position.copy(ENGINE); flame.position.z -= len / 2
    flameMat.uniforms.uI.value = Math.min(1.2, 0.25 + fl)
    flameMat.uniforms.uTime.value = time
    flameGlow.position.copy(ENGINE)
    flameGlow.scale.setScalar(1.0 + fl * 2.5 + pose.warp * 1.5)
    flameGlow.material.opacity = 0.1 + fl * 0.4
    const blink = (time % 1.6) < 0.12 ? 1 : 0.15
    navL.material.opacity = navR.material.opacity = blink
    if (mixer) mixer.setTime(pose.doors * 2.5)

    // camera
    camera.position.copy(pose.sp).add(pose.co)
    camTarget.copy(pose.sp).add(pose.to)
    const dist = camera.position.distanceTo(camTarget)
    camUp.copy(pose.camUp)
    right.subVectors(camTarget, camera.position).normalize().cross(camUp).normalize()
    camTarget.addScaledVector(right, pmx * dist * 0.035).addScaledVector(camUp, -pmy * dist * 0.025)
    if (pose.warp > 0.02) {
      const s = pose.warp * 0.05
      camera.position.add(tmp.set(Math.sin(time * 23.0) + 0.4 * Math.sin(time * 41.0), Math.sin(time * 29.0 + 2.0) + 0.4 * Math.sin(time * 53.0), 0).multiplyScalar(s * 0.35))
    }
    camera.up.copy(camUp)
    camera.lookAt(camTarget)
    if (Math.abs(pose.fov - lastFov) > 0.01) {
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
      lastFov = pose.fov
    }

    // sky follows the camera
    stars.group.position.copy(camera.position)
    stars.uniforms.uTime.value = time
    stars.uniforms.uWarp.value = pose.warp
    stars.uniforms.uVel.value.copy(pose.f)
    sunGlow.position.copy(camera.position).addScaledVector(SUN, 19000)
    sunCore.position.copy(sunGlow.position)
    dust.update(dt, pose.warp, camera.position, pose.f, pose.up)

    // orbit, beacons, trail
    const careerVis = smooth(3.45, 3.95, tD) * (1 - smooth(11.2, 12, tD) * 0.6)
    orbit.uniforms.uA.value = careerVis
    const thNow = tD < CAREER_FIRST ? thetaOf(0) - 0.01 : MathUtils.clamp(thetaOf(tD - CAREER_FIRST), 0, 10)
    orbit.uniforms.uTh.value = tD > 10 ? thetaOf(CAREER_COUNT - 1) + (tD - 10) * 0.45 : thNow
    trail.uniforms.uHead.value = pose.trail
    trail.uniforms.uA.value = smooth(3.02, 3.15, tD) * (1 - smooth(4.4, 6.2, tD))
    const active = Math.round(tD - CAREER_FIRST)
    beacons.forEach((b, j) => {
      const on = j === active && tD > 3.6 && tD < 10.6
      const target = (on ? 5 + Math.sin(time * 3) * 1 : 6) * (0.4 + careerVis * 0.6)
      b.scale.setScalar(MathUtils.lerp(b.scale.x, target, 0.12))
      b.material.opacity = careerVis * (on ? 0.3 : 0.5)
      b.material.color.set(on ? '#ff7fb0' : '#ff2a75')
      b.visible = careerVis > 0.01
    })

    // planets drift; far planets use the light mesh
    homeMesh.rotation.y += dt * 0.004
    destMesh.rotation.y += dt * 0.006
    homeLo.rotation.copy(homeMesh.rotation)
    homeClouds.rotation.y = homeMesh.rotation.y * 1.6
    destLo.rotation.copy(destMesh.rotation)
    const nearH = R_H / Math.max(1, camera.position.length()) > 0.12
    homeMesh.visible = nearH; homeLo.visible = !nearH
    homeU.uCapCos.value = nearH ? patch.capCos : -2
    const nearD = R_D / Math.max(1, camera.position.distanceTo(C_D)) > 0.06
    destMesh.visible = nearD; destLo.visible = !nearD
    ring.rotation.z += dt * 0.002

    draw()

    if (first) {
      first = false
      onReady()
    }
    void measure
  }

  function resize() {
    renderer.setPixelRatio(pixelRatio())
    configure(innerWidth / innerHeight)
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight, false)
    renderer.getDrawingBufferSize(bufSize)
    target.setSize(bufSize.x, bufSize.y)
  }

  return api
}
