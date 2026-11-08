import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, DirectionalLight, AmbientLight, Vector3, Quaternion, Group, Mesh,
  ConeGeometry, ShaderMaterial, AdditiveBlending, AnimationMixer, ACESFilmicToneMapping, SRGBColorSpace,
  PMREMGenerator, MathUtils, Sprite, Material,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  evaluate, newPose, orient, configure, R_H, C_D, R_D, SUN, N_O, ringPoint, thetaOf, capturePoint, CAREER_FIRST, CAREER_COUNT, smooth, THETA0,
} from './timeline'
import { makePlanet, makeAtmosphere, makePlanetRing, makeStars, makeDust, makeOrbit, makeTrail, glowTexture, glowSprite } from './world'

export type Gl = { frame(dt: number, t: number, mx: number, my: number): void; resize(): void; warp: number }

const SHUTTLE_SCALE = 12

export async function start(canvas: HTMLCanvasElement, onReady: () => void): Promise<Gl> {
  const dprCap = Math.min(window.devicePixelRatio || 1, 1.75)
  const renderer = new WebGLRenderer({ canvas, antialias: dprCap < 1.5, powerPreference: 'high-performance', alpha: false, stencil: false })
  renderer.setPixelRatio(dprCap)
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setClearColor(new Color('#05040a'))

  const scene = new Scene()
  const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.4, 60000)
  configure(innerWidth / innerHeight)

  // light
  const sun = new DirectionalLight('#fff0e0', 3.1)
  sun.position.copy(SUN)
  const fill = new DirectionalLight('#5b6cff', 0.35)
  fill.position.copy(SUN).negate()
  scene.add(sun, sun.target, fill, new AmbientLight('#2b2442', 0.9))

  const pmrem = new PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = env
  scene.environmentIntensity = 0.35

  // sky
  const stars = makeStars(2600, 20000)
  stars.uniforms.uDpr.value = dprCap
  scene.add(stars.group)
  const glowTex = glowTexture()
  const sunGlow = glowSprite(glowTex, '#ffd6a6', 3400)
  const sunCore = glowSprite(glowTex, '#ffffff', 900)
  scene.add(sunGlow, sunCore)
  const dust = makeDust(260)
  scene.add(dust.lines)

  // home planet
  const home = new Group()
  const homeMesh = makePlanet({ radius: R_H, detail: 5, seed: 3, amp: 0.03, freq: 3.4, a: '#2e3344', b: '#4f566e', c: '#7d6f9c' })
  home.add(homeMesh, makeAtmosphere(R_H, '#6f8dff', SUN, 1.1, new Vector3(0, 0, 0)))
  scene.add(home)

  // destination planet with rings
  const dest = new Group()
  dest.position.copy(C_D)
  const destMesh = makePlanet({ radius: R_D, detail: 4, seed: 11, amp: 0.06, freq: 2.6, a: '#241628', b: '#52304a', c: '#b07a70' })
  const ring = makePlanetRing(R_D * 1.38, R_D * 2.1, SUN)
  ring.lookAt(new Vector3(-0.12, 1, 0.3))
  dest.add(destMesh, makeAtmosphere(R_D, '#ff6a9a', SUN, 0.55, C_D), ring)
  scene.add(dest)

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
  loader.load('/models/shuttle.glb', (gltf) => {
    const m = gltf.scene
    m.scale.setScalar(SHUTTLE_SCALE)
    m.traverse((o) => {
      const mesh = o as Mesh
      if (mesh.isMesh) {
        const mat = mesh.material as Material & { envMapIntensity?: number }
        if ('envMapIntensity' in mat) mat.envMapIntensity = 0.6
      }
    })
    body.add(m)
    if (gltf.animations.length) {
      mixer = new AnimationMixer(m)
      gltf.animations.forEach((c) => mixer!.clipAction(c).play())
      mixer.setTime(0)
    }
  })

  // state
  const pose = newPose()
  const q = new Quaternion()
  let tD = -1
  let time = 0
  let lastFov = 0
  let pmx = 0, pmy = 0
  const camTarget = new Vector3()
  const tmp = new Vector3(), right = new Vector3(), camUp = new Vector3()
  const api: Gl = { warp: 0, frame, resize }
  let first = true
  let slowFrames = 0, frames = 0

  function frame(dt: number, t: number, mx: number, my: number) {
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
    const bob = Math.sin(time * 0.9) * 0.12 * (1 - pose.warp)
    shuttle.position.addScaledVector(pose.up, bob)
    body.rotation.z = Math.sin(time * 0.6) * 0.03 + pmx * 0.08 * (1 - pose.warp)
    body.rotation.x = -pmy * 0.04
    if (pose.warp > 0) {
      body.position.set((Math.random() - 0.5) * 0.04 * pose.warp, (Math.random() - 0.5) * 0.04 * pose.warp, 0)
    } else body.position.set(0, 0, 0)

    const fl = pose.flame
    const len = 0.6 + fl * 5 + pose.warp * 2.5
    flame.scale.set(0.55 + fl * 0.6, len, 0.55 + fl * 0.6)
    flame.rotation.x = -Math.PI / 2
    flame.position.copy(ENGINE).add(new Vector3(0, 0, -len / 2))
    flameMat.uniforms.uI.value = Math.min(1.2, 0.25 + fl)
    flameMat.uniforms.uTime.value = time
    flameGlow.position.copy(ENGINE)
    flameGlow.scale.setScalar(1.2 + fl * 3.5 + pose.warp * 3)
    flameGlow.material.opacity = 0.15 + fl * 0.6
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
      camera.position.add(tmp.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s))
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
      const target = (on ? 7 + Math.sin(time * 3) * 1.5 : 9) * (0.4 + careerVis * 0.6)
      b.scale.setScalar(MathUtils.lerp(b.scale.x, target, 0.12))
      b.material.opacity = careerVis * (on ? 0.5 : 0.75)
      b.material.color.set(on ? '#ff7fb0' : '#ff2a75')
      b.visible = careerVis > 0.01
    })

    // planets drift
    homeMesh.rotation.y += dt * 0.004
    destMesh.rotation.y += dt * 0.006
    ring.rotation.z += dt * 0.002

    renderer.render(scene, camera)

    if (first) {
      first = false
      onReady()
    }
    // adaptive resolution for weak GPUs
    frames++
    if (frames > 30 && frames < 240) {
      if (dt > 0.028) slowFrames++
      if (slowFrames > 40 && renderer.getPixelRatio() > 1) {
        renderer.setPixelRatio(1)
        renderer.setSize(innerWidth, innerHeight, false)
      }
    }
  }

  function resize() {
    configure(innerWidth / innerHeight)
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight, false)
  }

  return api
}
