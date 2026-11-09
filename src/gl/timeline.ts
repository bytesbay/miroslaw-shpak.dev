import { Vector3, Quaternion, Matrix4, MathUtils } from 'three'
const _q = new Quaternion()

/*
  Scroll keyframes (t is continuous, one unit per keyframe):
  0 hello · 1 about · 2 stack · 3 transit (mid-warp) · 4..10 career stops · 11 open source · 12 contact

  The Shuttle site flew a straight line to the moon and then swapped the camera.
  Here the jump is one continuous, scrubbable move:
    2→3  ignition: the shuttle turns to the target, the camera slides into a chase position,
         FOV opens up and the stars stretch into warp streaks.
    3    rest point inside hyperspace.
    3→4  drop out: warp collapses, a dolly zoom swells the planet while the shuttle keeps its size,
         then the shuttle slingshots around the limb on a Bezier arc into the career orbit,
         leaving a trail. The camera blends from chase to orbit framing without a cut.
*/

export const KEYS = 13
export const CAREER_FIRST = 4
export const CAREER_COUNT = 7

export const R_H = 1000
export const C_D = new Vector3(0, 1400, -16000)
export const R_D = 400
export const R_O = 900
export const SUN = new Vector3(-0.55, 0.32, -0.77).normalize()
export const N_O = new Vector3(0.22, 1, 0.12).normalize()
export const U_O = new Vector3(1, 0, 0).projectOnPlane(N_O).normalize()
export const V_O = new Vector3().crossVectors(N_O, U_O).normalize()
const WORLD_UP = new Vector3(0, 1, 0)

export const THETA0 = 0.75
export const THETA_STEP = 0.5
export const thetaOf = (j: number) => THETA0 + j * THETA_STEP
const THETA_OS = thetaOf(CAREER_COUNT - 1) + 0.45
const THETA_CONTACT = THETA_OS + 0.42

export const ringPoint = (th: number, out = new Vector3()) =>
  out.copy(C_D).addScaledVector(U_O, Math.cos(th) * R_O).addScaledVector(V_O, Math.sin(th) * R_O)
export const ringTangent = (th: number, out = new Vector3()) =>
  out.set(0, 0, 0).addScaledVector(U_O, -Math.sin(th)).addScaledVector(V_O, Math.cos(th)).normalize()

export type Pose = {
  sp: Vector3 // shuttle position
  f: Vector3 // shuttle forward
  up: Vector3 // shuttle up
  co: Vector3 // camera offset from shuttle
  to: Vector3 // look-at offset from shuttle
  fov: number
  warp: number
  flame: number
  doors: number
  trail: number // capture trail head 0..1
  camUp: Vector3
}

const newPose = (): Pose => ({
  sp: new Vector3(), f: new Vector3(0, 0, -1), up: new Vector3(0, 1, 0), co: new Vector3(), to: new Vector3(),
  fov: 45, warp: 0, flame: 0, doors: 0, trail: 0, camUp: new Vector3(0, 1, 0),
})

/* ---------------------------------------------------------------- math helpers */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const easeSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2

// Direction slerp with length lerp, so camera offsets swing around instead of cutting through.
const _sa = new Vector3(), _sb = new Vector3(), _na = new Vector3(), _nb = new Vector3()
function swing(a: Vector3, b: Vector3, w: number, out: Vector3) {
  const la = a.length(), lb = b.length()
  if (la < 1e-6 || lb < 1e-6) return out.lerpVectors(a, b, w)
  const da = _sa.copy(a).divideScalar(la), db = _sb.copy(b).divideScalar(lb)
  const d = MathUtils.clamp(da.dot(db), -1, 1)
  const om = Math.acos(d)
  if (om < 1e-3) out.lerpVectors(da, db, w)
  else {
    const s = Math.sin(om)
    out.copy(da).multiplyScalar(Math.sin((1 - w) * om) / s).addScaledVector(db, Math.sin(w * om) / s)
  }
  return out.normalize().multiplyScalar(MathUtils.lerp(la, lb, w))
}

function slerpDir(a: Vector3, b: Vector3, w: number, out: Vector3) {
  return swing(_na.copy(a).normalize(), _nb.copy(b).normalize(), w, out).normalize()
}

function blend(a: Pose, b: Pose, w: number, out: Pose) {
  out.sp.lerpVectors(a.sp, b.sp, w)
  slerpDir(a.f, b.f, w, out.f)
  slerpDir(a.up, b.up, w, out.up)
  swing(a.co, b.co, w, out.co)
  out.to.lerpVectors(a.to, b.to, w)
  out.fov = MathUtils.lerp(a.fov, b.fov, w)
  out.warp = MathUtils.lerp(a.warp, b.warp, w)
  out.flame = MathUtils.lerp(a.flame, b.flame, w)
  out.doors = MathUtils.lerp(a.doors, b.doors, w)
  out.trail = MathUtils.lerp(a.trail, b.trail, w)
  slerpDir(a.camUp, b.camUp, w, out.camUp)
  return out
}

const bez = (a: Vector3, b: Vector3, c: Vector3, d: Vector3, s: number, out: Vector3) => {
  const m = 1 - s
  return out
    .copy(a).multiplyScalar(m * m * m)
    .addScaledVector(b, 3 * m * m * s)
    .addScaledVector(c, 3 * m * s * s)
    .addScaledVector(d, s * s * s)
}
const _bt1 = new Vector3(), _bt2 = new Vector3()
const bezTan = (a: Vector3, b: Vector3, c: Vector3, d: Vector3, s: number, out: Vector3) => {
  const m = 1 - s
  return out
    .subVectors(b, a).multiplyScalar(3 * m * m)
    .addScaledVector(_bt1.subVectors(c, b), 6 * m * s)
    .addScaledVector(_bt2.subVectors(d, c), 3 * s * s)
    .normalize()
}

const _m = new Matrix4()
const _x = new Vector3(), _y = new Vector3(), _z = new Vector3()
export function orient(f: Vector3, up: Vector3, out: Quaternion) {
  _z.copy(f).normalize()
  _x.crossVectors(up, _z)
  if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0)
  _x.normalize()
  _y.crossVectors(_z, _x)
  _m.makeBasis(_x, _y, _z)
  return out.setFromRotationMatrix(_m)
}

/* ---------------------------------------------------------------- framing */
// Camera direction is solved from where the shuttle should sit on screen (NDC), so the
// composition holds on any aspect ratio and the shuttle never hides under the text panels.
let aspect = 1.6
export const setAspect = (a: number) => { aspect = a }
const portrait = () => aspect < 0.95

function aim(co: Vector3, sx: number, sy: number, fov: number, up: Vector3, out: Vector3) {
  const d0 = _a.copy(co).negate().normalize()
  const tv = Math.tan(MathUtils.degToRad(fov / 2)), th = tv * aspect
  const r = _b.crossVectors(d0, up).normalize()
  const u = _c.crossVectors(r, d0)
  const D = d0.addScaledVector(r, -sx * th).addScaledVector(u, -sy * tv).normalize()
  return out.copy(co).addScaledVector(D, co.length() * 2)
}
const _a = new Vector3(), _b = new Vector3(), _c = new Vector3()

// screen slot per keyframe: [desktop x, desktop y, portrait x, portrait y]
const SLOT: Record<string, [number, number, number, number]> = {
  hello: [0.1, -0.52, 0.05, -0.78],
  about: [0.45, 0.02, 0, 0.42],
  stack: [-0.45, 0.06, 0, 0.42],
  career: [0.34, -0.06, 0, 0.4],
  contact: [0.02, -0.66, 0, 0.35],
}
const slot = (k: string) => {
  const s = SLOT[k]
  return portrait() ? [s[2], s[3]] : [s[0], s[1]]
}

/* ---------------------------------------------------------------- rest poses */
function chaseCo(f: Vector3, up: Vector3, dist: number, out: Vector3) {
  return out.copy(f).multiplyScalar(-dist).addScaledVector(up, dist * 0.26)
}

const K: Pose[] = []
function base(i: number, sp: Vector3, f: Vector3, co: Vector3, fov: number, flame: number, name: string) {
  const p = K[i] || (K[i] = newPose())
  // offsets are authored as if standing at the pole, then rotated into the local frame
  const localUp = sp.clone().normalize()
  _q.setFromUnitVectors(WORLD_UP, localUp)
  p.sp.copy(sp); p.f.copy(f).applyQuaternion(_q).normalize(); p.co.copy(co).applyQuaternion(_q); p.fov = fov; p.flame = flame
  p.up.copy(localUp); p.camUp.copy(localUp)
  const [sx, sy] = slot(name)
  aim(p.co, sx, sy, fov, localUp, p.to)
  return p
}

const SP0 = new Vector3(0, R_H + 42, 0)
const SP1 = new Vector3(0, R_H + 150, -150)
const SP2 = new Vector3(0, R_H + 300, -520)
const F2 = new Vector3(0, 0.06, -1).normalize().applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), SP2.clone().normalize()))
const P_TURN = SP2.clone().addScaledVector(F2, 25)
export const DIR_D = new Vector3().subVectors(C_D, P_TURN).normalize()
const UP_D = WORLD_UP.clone().projectOnPlane(DIR_D).normalize()

// Career orbit framing for any angle on the ring.
function careerPose(th: number, out: Pose) {
  ringPoint(th, out.sp)
  ringTangent(th, out.f)
  out.up.copy(N_O)
  const rd = _d.subVectors(out.sp, C_D).normalize()
  out.co.copy(rd).multiplyScalar(17).addScaledVector(N_O, 6).addScaledVector(out.f, -11)
  out.fov = 48
  const [sx, sy] = slot('career')
  aim(out.co, sx, sy, out.fov, N_O, out.to)
  out.warp = 0
  out.flame = 0.16
  out.doors = 1
  out.trail = 1
  out.camUp.copy(N_O)
  return out
}
const _d = new Vector3()

// Wide shot from the sunny side: planet, rings and the whole career orbit.
const WIDE_CAM = C_D.clone().add(new Vector3().copy(SUN).multiplyScalar(0.55).addScaledVector(N_O, 0.75).addScaledVector(U_O, -0.35).normalize().multiplyScalar(3300))
function openSourcePose(th: number, out: Pose) {
  careerPose(th, out)
  out.co.subVectors(WIDE_CAM, out.sp)
  const right = _d.subVectors(C_D, WIDE_CAM).normalize().cross(N_O).normalize()
  out.to.subVectors(C_D, out.sp).addScaledVector(right, portrait() ? 0 : 900)
  out.fov = portrait() ? 62 : 44
  out.flame = 0.22
  return out
}

function contactPose(th: number, out: Pose) {
  careerPose(th, out)
  const rd = _d.subVectors(out.sp, C_D).normalize()
  out.co.copy(rd).multiplyScalar(15).addScaledVector(out.f, 8).addScaledVector(N_O, 3.5)
  out.fov = 40
  const [sx, sy] = slot('contact')
  aim(out.co, sx, sy, out.fov, N_O, out.to)
  out.flame = 0.35
  out.doors = 0
  return out
}

function buildKeys() {
  // 0 hello: skimming the home planet, sunrise ahead
  base(0, SP0, new Vector3(0, 0, -1), new Vector3(8, 14, 20), 42, 0.18, 'hello')
  // 1 about: climbing, the curvature shows up
  base(1, SP1, new Vector3(0, 0.42, -1), new Vector3(-22, 20, 26), 42, 0.65, 'about')
  // 2 stack: in orbit, the planet below
  base(2, SP2, new Vector3(0, 0.06, -1), new Vector3(24, 26, 22), 44, 0.4, 'stack')
  // 3 transit: rest point in hyperspace
  const p = K[3] || (K[3] = newPose())
  p.sp.copy(P_TURN).addScaledVector(DIR_D, P_TURN.distanceTo(C_D) * 0.42)
  p.f.copy(DIR_D)
  p.up.copy(UP_D)
  chaseCo(DIR_D, UP_D, 15, p.co).addScaledVector(_d.crossVectors(UP_D, DIR_D).normalize(), -1.6)
  p.to.copy(DIR_D).multiplyScalar(80).addScaledVector(UP_D, 1.5)
  p.fov = portrait() ? 84 : 74
  p.warp = 1
  p.flame = 1
  p.camUp.copy(UP_D)
  for (let j = 0; j < CAREER_COUNT; j++) careerPose(thetaOf(j), K[CAREER_FIRST + j] || (K[CAREER_FIRST + j] = newPose()))
  openSourcePose(THETA_OS, K[11] || (K[11] = newPose()))
  contactPose(THETA_CONTACT, K[12] || (K[12] = newPose()))
}
buildKeys()
export function configure(a: number) {
  setAspect(a)
  buildKeys()
}

/* ---------------------------------------------------------------- capture curve */
export const CAP_A = K[3].sp.clone()
export const CAP_E = ringPoint(THETA0)
const T0 = ringTangent(THETA0)
const capLen = CAP_A.distanceTo(CAP_E)
export const CAP_B = CAP_A.clone().addScaledVector(DIR_D, capLen * 0.5)
export const CAP_C = CAP_E.clone().addScaledVector(T0, -capLen * 0.3)
export const capturePoint = (s: number, out = new Vector3()) => bez(CAP_A, CAP_B, CAP_C, CAP_E, s, out)

/* ---------------------------------------------------------------- evaluation */
const tmpA = newPose(), tmpB = newPose()
const _t1 = new Vector3(), _t2 = new Vector3(), _t3 = new Vector3()
const _v = new Vector3(), _w = new Vector3()

export function evaluate(t: number, out: Pose): Pose {
  t = MathUtils.clamp(t, 0, KEYS - 1)
  let k = Math.floor(t)
  if (k >= KEYS - 1) k = KEYS - 2
  const u = t - k

  if (k === 2) {
    // ignition and jump to warp
    const a = smooth(0, 0.34, u)
    const b = clamp01((u - 0.24) / 0.76)
    const fwd = slerpDir(K[2].f, DIR_D, easeInOut(a), _v)
    out.f.copy(fwd)
    out.up.copy(slerpDir(K[2].up, UP_D, a, _w))
    out.sp.copy(K[2].sp).addScaledVector(K[2].f, 25 * easeSine(a))
    // accelerate, but arrive at the rest point with zero speed (no lurch at the keyframe)
    const gb = b * b * (3 - 2 * b)
    out.sp.addScaledVector(DIR_D, K[3].sp.distanceTo(P_TURN) * Math.pow(gb, 1.6))
    const chase = chaseCo(fwd, out.up, 15, _t1)
    swing(K[2].co, chase, easeInOut(a), out.co)
    out.co.lerp(K[3].co, smooth(0.6, 1, u))
    out.to.lerpVectors(K[2].to, K[3].to, easeInOut(a))
    out.fov = MathUtils.lerp(K[2].fov, K[3].fov, smooth(0.32, 1, u))
    out.warp = smooth(0.42, 0.97, u)
    out.flame = MathUtils.lerp(K[2].flame, 1, smooth(0.06, 0.45, u))
    out.doors = 0
    out.trail = 0
    slerpDir(K[2].camUp, UP_D, a, out.camUp)
    return out
  }

  if (k === 3) {
    // drop out of warp, dolly zoom, slingshot into orbit
    // leave the rest point from zero speed, cover most of the distance early, settle softly
    const gu = u * u * (3 - 2 * u)
    const s = 1 - Math.pow(1 - gu, 1.8)
    capturePoint(s, out.sp)
    bezTan(CAP_A, CAP_B, CAP_C, CAP_E, Math.min(s, 0.999), out.f)
    out.up.copy(slerpDir(UP_D, N_O, smooth(0.2, 0.9, u), _w))
    out.warp = 1 - smooth(0, 0.36, u)
    const fov = u < 0.46 ? MathUtils.lerp(K[3].fov, 33, smooth(0, 0.46, u)) : MathUtils.lerp(33, K[4].fov, smooth(0.46, 1, u))
    const dist = 15 * Math.tan(MathUtils.degToRad(K[3].fov / 2)) / Math.tan(MathUtils.degToRad(fov / 2))
    const chase = chaseCo(out.f, out.up, dist, _t1)
    const toPlanet = _t2.subVectors(C_D, out.sp).normalize()
    const look = 0.62 * smooth(0.08, 0.42, u)
    const chaseTo = _t3.copy(out.f).multiplyScalar(1 - look).addScaledVector(toPlanet, look).normalize().multiplyScalar(80)
    // the rest pose at 3K has a small side offset and a lifted aim; fade them out here
    // instead of dropping them at the keyframe (that was the jolt at 3K)
    const keep = 1 - smooth(0, 0.5, u)
    chase.addScaledVector(_t2.crossVectors(UP_D, DIR_D).normalize(), -1.6 * keep)
    chaseTo.addScaledVector(UP_D, 1.5 * keep)
    const w = smooth(0.5, 1, u)
    swing(chase, K[4].co, easeInOut(w), out.co)
    out.to.lerpVectors(chaseTo, K[4].to, easeInOut(w))
    out.fov = fov
    out.flame = MathUtils.lerp(1, K[4].flame, smooth(0.15, 0.9, u))
    out.doors = smooth(0.72, 1, u)
    out.trail = s
    slerpDir(UP_D, N_O, smooth(0.3, 1, u), out.camUp)
    return out
  }

  if (k >= CAREER_FIRST && k < CAREER_FIRST + CAREER_COUNT - 1) {
    const j = k - CAREER_FIRST
    const e = easeInOut(u)
    careerPose(MathUtils.lerp(thetaOf(j), thetaOf(j + 1), e), out)
    out.flame = 0.16 + 0.5 * Math.sin(Math.PI * u)
    return out
  }

  if (k === 10) {
    const e = easeInOut(u)
    const th = MathUtils.lerp(thetaOf(CAREER_COUNT - 1), THETA_OS, e)
    careerPose(th, tmpA)
    openSourcePose(th, tmpB)
    return blend(tmpA, tmpB, e, out)
  }

  if (k === 11) {
    const e = easeInOut(u)
    const th = MathUtils.lerp(THETA_OS, THETA_CONTACT, e)
    openSourcePose(th, tmpA)
    contactPose(th, tmpB)
    return blend(tmpA, tmpB, e, out)
  }

  return blend(K[k], K[k + 1], easeInOut(u), out)
}

export { newPose }
