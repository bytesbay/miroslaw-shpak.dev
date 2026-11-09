import {
  BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, Color, Vector3, Matrix3, Sphere, WebGLRenderer, WebGLRenderTarget,
  HalfFloatType, RedFormat, LinearFilter, RepeatWrapping, ClampToEdgeWrapping, Scene, OrthographicCamera, PlaneGeometry, Texture,
  DataTexture, RGBAFormat, LinearMipmapLinearFilter,
} from 'three'

/*
  Procedural planets, generated on the GPU.
  Geometry: an indexed spherified cube (up to ~2M triangles). The vertex shader displaces it with
  domain-warped fBm, ridged multifractal mountains and (for the second planet) cellular craters.
  The fragment shader keeps the faceted look by taking the normal from screen-space derivatives,
  so the old low-poly style survives at ~100x the detail.
*/

// Builds the sphere one cube face per task so a 2M-triangle planet never blocks input.
export async function sphereCubeAsync(n: number) {
  return sphereCube(n, true) as Promise<BufferGeometry>
}

export function sphereCube(n: number): BufferGeometry
export function sphereCube(n: number, chunked: true): Promise<BufferGeometry>
export function sphereCube(n: number, chunked = false): BufferGeometry | Promise<BufferGeometry> {
  const verts = 6 * (n + 1) * (n + 1)
  const pos = new Float32Array(verts * 3)
  const idx = new Uint32Array(6 * n * n * 6)
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ]
  let v = 0, k = 0
  const q = Math.PI / 4
  const face = (f: number) => {
    const [c, a, b] = faces[f]
    const base = v
    for (let j = 0; j <= n; j++) {
      // tan warp spreads vertices evenly over the sphere
      const tb = Math.tan((j / n * 2 - 1) * q)
      for (let i = 0; i <= n; i++) {
        const ta = Math.tan((i / n * 2 - 1) * q)
        let x = c[0] + a[0] * ta + b[0] * tb
        let y = c[1] + a[1] * ta + b[1] * tb
        let z = c[2] + a[2] * ta + b[2] * tb
        const l = 1 / Math.hypot(x, y, z)
        pos[v * 3] = x * l; pos[v * 3 + 1] = y * l; pos[v * 3 + 2] = z * l
        v++
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const p0 = base + j * (n + 1) + i, p1 = p0 + 1, p2 = p0 + n + 1, p3 = p2 + 1
        idx[k++] = p0; idx[k++] = p1; idx[k++] = p2
        idx[k++] = p1; idx[k++] = p3; idx[k++] = p2
      }
    }
  }
  const finish = () => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setIndex(new BufferAttribute(idx, 1))
    g.boundingSphere = new Sphere(new Vector3(), 1)
    return g
  }
  if (!chunked) {
    for (let f = 0; f < 6; f++) face(f)
    return finish()
  }
  return (async () => {
    for (let f = 0; f < 6; f++) {
      face(f)
      await new Promise((r) => setTimeout(r, 0))
    }
    return finish()
  })()
}

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p, int oct){ float a=0.5, s=0.0; for(int i=0;i<8;i++){ if(i>=oct) break; s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
float ridged(vec3 p, int oct){ float a=0.5, s=0.0, w=1.0; for(int i=0;i<8;i++){ if(i>=oct) break; float n=1.0-abs(snoise(p)); n*=n; n*=w; w=clamp(n*1.7,0.0,1.0); s+=n*a; p=p*2.11+vec3(3.1,1.4,7.7); a*=0.5; } return s; }
vec3 hash3(vec3 p){ p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453123); }
// cellular craters: bowl, raised rim, a little ejecta
float craters(vec3 x){
  vec3 i=floor(x), f=fract(x); float h=0.0;
  for(int a=-1;a<=1;a++) for(int b=-1;b<=1;b++) for(int c=-1;c<=1;c++){
    vec3 n=vec3(float(a),float(b),float(c)); vec3 r=hash3(i+n);
    if(r.z>0.62) continue;
    float rad=0.18+0.3*r.x; float d=length(n+r-f)/rad;
    if(d<1.0) h+=(d*d-1.0)*0.9;
    h+=exp(-pow((d-1.0)*3.5,2.0))*0.45;
  }
  return h;
}
`

/*
  Small tileable value-noise texture (4 independent channels). Per-pixel detail (grain, waves,
  city lights, cloud wisps) samples it instead of evaluating simplex noise, which was the main
  fragment cost.
*/
let noiseTex: DataTexture | null = null
export function noiseTexture() {
  if (noiseTex) return noiseTex
  const N = 128
  const data = new Uint8Array(N * N * 4)
  const lattice = (g: number, seed: number) => {
    const a = new Float32Array(g * g)
    let x = seed * 9301 + 49297
    for (let i = 0; i < a.length; i++) { x = (x * 9301 + 49297) % 233280; a[i] = x / 233280 }
    return a
  }
  const sample = (a: Float32Array, g: number, u: number, v: number) => {
    const x = u * g, y = v * g
    const xi = Math.floor(x), yi = Math.floor(y)
    const fx = x - xi, fy = y - yi
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const at = (i: number, j: number) => a[((j % g + g) % g) * g + ((i % g + g) % g)]
    const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx
    const bot = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx
    return top + (bot - top) * sy
  }
  for (let c = 0; c < 4; c++) {
    const l1 = lattice(16, c * 3 + 1), l2 = lattice(32, c * 3 + 2)
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = i / N, v = j / N
      const n = sample(l1, 16, u, v) * 0.65 + sample(l2, 32, u, v) * 0.35
      data[(j * N + i) * 4 + c] = Math.round(n * 255)
    }
  }
  const t = new DataTexture(data, N, N, RGBAFormat)
  t.wrapS = t.wrapT = RepeatWrapping
  t.magFilter = LinearFilter
  t.minFilter = LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  noiseTex = t
  return t
}

const TRI = /* glsl */ `
uniform sampler2D uNoise;
vec4 tri(vec3 p, float s){
  vec3 w=abs(p); w*=w; w*=w; w/=(w.x+w.y+w.z);
  return texture(uNoise,p.yz*s)*w.x+texture(uNoise,p.zx*s)*w.y+texture(uNoise,p.xy*s)*w.z;
}
`

// equirectangular lookup shared by the bake pass and the planet shaders
const UV = /* glsl */ `
vec2 sphereUv(vec3 p){ return vec2(atan(p.z,p.x)*0.15915494+0.5, asin(clamp(p.y,-1.0,1.0))*0.31830989+0.5); }
`

/*
  Terrain and clouds are expensive noise. They used to run per vertex on every frame (~2M vertices),
  which dropped Chrome to ~26 fps. Now they are evaluated once into an equirectangular half-float
  texture, and the per-frame shaders only sample it.
*/
function bake(renderer: WebGLRenderer, w: number, h: number, body: string, uniforms: Record<string, { value: unknown }>, main?: string): Texture {
  const rt = new WebGLRenderTarget(w, h, {
    type: HalfFloatType, format: RedFormat, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter,
    wrapS: RepeatWrapping, wrapT: ClampToEdgeWrapping, depthBuffer: false, generateMipmaps: true,
  })
  const mat = new ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      ${body}
      varying vec2 vUv;
      void main(){
        ${main ?? `float lon=(vUv.x-0.5)*6.2831853, lat=(vUv.y-0.5)*3.1415927;
        vec3 p=vec3(cos(lat)*cos(lon), sin(lat), cos(lat)*sin(lon));
        gl_FragColor=vec4(value(p),0.0,0.0,1.0);`}
      }`,
  })
  const scene = new Scene()
  const quad = new Mesh(new PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  scene.add(quad)
  const prev = renderer.getRenderTarget()
  renderer.setRenderTarget(rt)
  renderer.render(scene, new OrthographicCamera())
  renderer.setRenderTarget(prev)
  mat.dispose(); quad.geometry.dispose()
  return rt.texture
}

// height on the unit sphere; kind 0 = home, 1 = destination
const HEIGHT = /* glsl */ `
uniform float uKind; uniform vec3 uSeed;
float height(vec3 p){
  vec3 q=p*1.25+uSeed;
  vec3 w=vec3(fbm(q,4),fbm(q+vec3(5.2,1.3,2.8),4),fbm(q+vec3(9.1,4.7,7.3),4));
  if(uKind<0.5){
    float land=fbm(q+w*0.85,6)+0.03;
    float inland=smoothstep(0.0,0.22,land);
    float m=ridged(p*3.2+w*0.6+uSeed,6);
    float h=land+m*inland*0.75;
    h+=fbm(p*22.0+uSeed,3)*0.035*inland;
    return h;
  }
  float base=fbm(q+w*0.6,5)*0.55;
  float c=craters(p*2.6+uSeed)*0.55+craters(p*6.3+uSeed*1.7)*0.28+craters(p*14.0+uSeed*2.3)*0.12;
  float canyon=-pow(1.0-abs(snoise(p*1.7+w*1.2)),10.0)*0.6;
  float m=ridged(p*4.0+w,5)*0.35;
  return base+c+canyon+m;
}
`

// planet rotation for the fragment shader (shared material, so set per mesh before drawing)
export function bindRotation(this: Mesh) {
  ;((this.material as ShaderMaterial).uniforms.uNormalM.value as Matrix3).setFromMatrix4(this.matrixWorld)
}

export type PlanetOpts = {
  atmo?: { color: string; h: number; k: number }
  mapW: number
  radius: number
  kind: 0 | 1
  segs: number
  amp: number
  seed: [number, number, number]
  sun: Vector3
  colors: Record<string, string>
}

const PLANET_FRAG = /* glsl */ `
  ${TRI}
  ${UV}
  uniform sampler2D uHMap;
  #ifdef PATCH
  uniform sampler2D uPMap; uniform float uCapSin;
  #endif
  // height per pixel for colour and coastlines (vertex heights would follow the mesh grid)
  // Mip level from the pixel footprint on the sphere: distant planets read prefiltered heights
  // instead of aliasing into sparkly noise. Manual LOD keeps the longitude seam clean.
  uniform float uHW, uPW;
  float lodG, lodP;
  float hAt(vec3 p){
    float hg=textureLod(uHMap,sphereUv(p),lodG).r;
    #ifdef PATCH
    vec2 q=vec2(p.x,p.z)/uCapSin;
    float hp=textureLod(uPMap,q*0.5+0.5,lodP).r;
    return mix(hp,hg,smoothstep(0.78,0.96,length(q)));
    #else
    return hg;
    #endif
  }
  uniform float uKind, uR, uAmp; uniform vec3 uSun; uniform vec3 uSeed; uniform mat3 uNormalM;
  uniform vec3 uAtmo; uniform float uAtmoH, uAtmoK;
  uniform vec3 cDeep, cShallow, cLow, cMid, cHigh, cPeak, cAmb, cFill, cSun, cLights;
  varying vec3 vP; varying vec3 vL; varying float vH; varying vec3 vW;
  void main(){
    // Normal from the height texture gradient, per pixel: lighting shows the relief at texture
    // resolution instead of mesh facets (those read as square "pixels" at mid distance).
    vec3 p0=normalize(vP);
    vec3 t1=normalize(cross(abs(p0.y)<0.99?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0),p0));
    vec3 t2=cross(p0,t1);
    float fp=length(fwidth(p0));                      // radians covered by one pixel
    lodG=log2(max(fp*uHW/6.2832,1.0));
    #ifdef PATCH
    lodP=log2(max(fp*uPW/(2.0*uCapSin),1.0));
    float e=mix(0.0007,0.003,smoothstep(0.78,0.96,length(vec2(p0.x,p0.z)/uCapSin)));
    #else
    lodP=0.0;
    float e=0.003;
    #endif
    e=max(e,fp*1.5);
    float far=smoothstep(0.003,0.03,fp);             // 0 close up, 1 when the planet is small
    float h=hAt(p0);
    float land=uKind<0.5?1.0:0.0;
    float h0=uKind<0.5?max(h,0.0):h;
    float h1=hAt(normalize(p0+t1*e)), h2=hAt(normalize(p0+t2*e));
    if(uKind<0.5){ h1=max(h1,0.0); h2=max(h2,0.0); }
    float k=uAmp/e;
    vec3 nl=normalize(p0-k*((h1-h0)*t1+(h2-h0)*t2));
    vec3 N=normalize(uNormalM*nl);
    vec3 S=normalize(uNormalM*p0);
    vec3 V=normalize(cameraPosition-vW);
    vec4 nz=tri(vP+uSeed*0.01,5.6);
    float grain=nz.r;
    vec3 albedo; float water=0.0;
    if(uKind<0.5){
      if(h<0.0){
        water=1.0;
        albedo=mix(cDeep,cShallow,smoothstep(-0.3,0.0,h));
        // small waves break the sun glint into sparkles
        vec3 wv=tri(vP,48.0).gba-0.5;
        N=normalize(S+0.11*wv*(1.0-far));
      } else {
        float region=tri(vP,0.9).b;                    // large-scale regions: darker basins vs pale uplands
        vec3 low=mix(cLow,cLow*vec3(0.75,0.95,0.9),smoothstep(0.35,0.65,region));
        albedo=mix(low,cMid,smoothstep(0.02,0.3,h));
        albedo=mix(albedo,cHigh,smoothstep(0.3,0.7,h));
        float slope=1.0-max(dot(nl,p0),0.0);
        albedo=mix(albedo,cPeak,smoothstep(1.05,1.3,h+grain*0.1)*(1.0-smoothstep(0.2,0.45,slope)));
      }
    } else {
      albedo=mix(cLow,cMid,smoothstep(-0.45,0.0,h));
      albedo=mix(albedo,cHigh,smoothstep(0.0,0.35,h));
      albedo=mix(albedo,cPeak,smoothstep(0.32,0.6,h)*0.8);
      float bands=texture(uNoise,vec2(vP.y*0.35+uSeed.x*0.01,0.37)).b;
      albedo*=0.8+bands*0.4;
    }
    albedo*=0.88+mix(grain,0.5,far)*0.24;
    float ndl=dot(N,uSun);
    float lit=max(ndl,0.0);
    float sdot=dot(S,uSun);
    float terminator=smoothstep(-0.12,0.25,sdot);
    vec3 col=albedo*(cSun*lit*terminator*1.25+cFill*max(-ndl,0.0)*0.35+cAmb);
    if(water>0.5){
      vec3 H=normalize(uSun+V);
      float nh=max(dot(N,H),0.0);
      float spec=(pow(nh,600.0)*0.9+pow(nh,40.0)*0.05)*terminator;
      float fres=pow(1.0-max(dot(N,V),0.0),5.0);
      col+=cSun*spec+cShallow*fres*0.5*terminator;
    } else if(uKind<0.5 && sdot<0.02){
      float night=smoothstep(0.02,-0.25,sdot);
      float cluster=smoothstep(0.45,0.7,tri(vP,0.7).a);
      float dots=pow(max(tri(vP,18.0).r*2.0-1.0,0.0),5.0)*14.0;
      col+=cLights*mix(dots,0.12,far)*cluster*night*smoothstep(0.35,0.0,h);
    }
    // Aerial haze over the surface, same model as the atmosphere shell. Computed here so it is
    // identical whether the camera is inside or outside the atmosphere (no pop when climbing out).
    if(uAtmoK>0.0){
      float Lg=sqrt(6.2832*uR*uAtmoH);
      float mu=max(dot(V,S),0.03);
      float tau=min(uAtmoH/mu,Lg*1.4)*0.55;
      float g=1.0-exp(-tau/(Lg*0.38));
      float la=smoothstep(-0.28,0.45,sdot);
      float ss=exp(-pow((sdot+0.03)*5.0,2.0));
      vec3 ac=mix(uAtmo*vec3(0.5,0.6,1.0),uAtmo,g);
      ac=mix(ac,vec3(1.0,0.5,0.36),ss*0.7);
      col+=ac*g*(la+ss*0.55+0.02)*uAtmoK;
    }
    gl_FragColor=vec4(col,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

export function makeDetailedPlanet(renderer: WebGLRenderer, o: PlanetOpts) {
  const col = (k: string) => ({ value: new Color(o.colors[k]) })
  const hmap = bake(renderer, o.mapW, o.mapW / 2, `${HEIGHT}\nfloat value(vec3 p){ return height(p); }`, {
    uKind: { value: o.kind }, uSeed: { value: new Vector3(...o.seed) },
  })
  const mat = new ShaderMaterial({
    uniforms: {
      uHMap: { value: hmap },
      uR: { value: o.radius }, uAmp: { value: o.amp }, uKind: { value: o.kind }, uSeed: { value: new Vector3(...o.seed) },
      uSun: { value: o.sun }, uTime: { value: 0 }, uNormalM: { value: new Matrix3() },
      uNoise: { value: noiseTexture() }, uCapCos: { value: -2 }, uHW: { value: o.mapW }, uPW: { value: 1 },
      uAtmo: { value: new Color(o.atmo?.color ?? '#000000') }, uAtmoH: { value: o.atmo?.h ?? 1 }, uAtmoK: { value: o.atmo?.k ?? 0 },
      cDeep: col('deep'), cShallow: col('shallow'), cLow: col('low'), cMid: col('mid'), cHigh: col('high'), cPeak: col('peak'),
      cAmb: col('amb'), cFill: col('fill'), cSun: col('sun'), cLights: col('lights'),
    },
    vertexShader: /* glsl */ `
      ${UV}
      uniform sampler2D uHMap; uniform float uR, uAmp, uKind, uCapCos;
      varying vec3 vP; varying vec3 vL; varying float vH; varying vec3 vW;
      void main(){
        vec3 p=normalize(position);
        float h=textureLod(uHMap, sphereUv(p), 0.0).r;
        vH=h; vP=p;
        float d = uKind < 0.5 ? max(h,0.0) : h;
        vec3 L=p*uR*(1.0+d*uAmp);
        if(p.y>uCapCos) L*=0.97;   // sink under the high-detail patch
        vL=L;
        vec4 w=modelMatrix*vec4(L,1.0); vW=w.xyz;
        gl_Position=projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: PLANET_FRAG,
  })
  const mesh = new Mesh(sphereCube(Math.min(o.segs, 32)), mat)
  mesh.onBeforeRender = bindRotation
  const fix = () => { mesh.geometry.boundingSphere!.radius = o.radius * (1 + o.amp * 1.5) }
  fix()
  mesh.userData.ready = sphereCubeAsync(o.segs).then((g) => { mesh.geometry.dispose(); mesh.geometry = g; fix() })
  return mesh
}

/*
  Cloud / haze shell. Home planet: domain-warped cloud fronts that drift slowly,
  lit by the sun with a warm tint along the terminator. Destination: thin banded dust haze.
*/
export function makeClouds(renderer: WebGLRenderer, o: { radius: number; segs: number; mapW: number; sun: Vector3; seed: [number, number, number]; tint: string; opacity: number }) {
  const seed = new Vector3(...o.seed)
  const cmap = bake(renderer, o.mapW, o.mapW / 2, /* glsl */ `
    uniform vec3 uSeed;
    float value(vec3 p){
      // large swirled weather systems, stretched along latitude; small scales stay weak so the
      // threshold does not break the field into spots
      vec3 q=p*1.6+uSeed;
      vec3 w=vec3(fbm(q*0.7,3),fbm(q*0.7+vec3(4.1,7.3,2.2),3),fbm(q*0.7+vec3(8.7,1.9,5.5),3));
      vec3 qs=vec3(q.x,q.y*2.0,q.z);
      float d=fbm(qs*0.55+w*1.9,4)*1.2;
      d+=fbm(qs*2.2+w*2.5,3)*0.1;
      d+=snoise(p*30.0+w*3.0+uSeed)*0.03;
      return d;
    }`, { uSeed: { value: seed } })
  const mat = new ShaderMaterial({
    uniforms: {
      uMap: { value: cmap }, uSun: { value: o.sun }, uSeed: { value: seed }, uNoise: { value: noiseTexture() }, uCW: { value: o.mapW },
      uTint: { value: new Color(o.tint) }, uOpacity: { value: o.opacity }, uNormalM: { value: new Matrix3() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vP; varying vec3 vW;
      void main(){ vP=normalize(position); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `
      ${TRI}
      ${UV}
      uniform sampler2D uMap; uniform vec3 uSun, uSeed, uTint; uniform float uOpacity, uCW; uniform mat3 uNormalM;
      varying vec3 vP; varying vec3 vW;
      void main(){
        // Prefiltered by distance: soft cloud masses from afar, wisps only close up.
        float fp=length(fwidth(vP));
        float d=textureLod(uMap, sphereUv(vP), log2(max(fp*uCW/6.2832,1.0))).r;
        // pixel-art rendering makes one pixel ~3x larger on the sphere, so the near/far range is wide
        // and only opacity fades with distance (the cloud shapes themselves never change)
        float near=1.0-smoothstep(0.004,0.04,fp);
        d+=((tri(vP,9.0).r-0.5)*0.08+(tri(vP,28.0).g-0.5)*0.04)*near*smoothstep(0.0,0.2,d);
        float far=1.0-near;
        float c=smoothstep(0.06,0.46,d);
        c*=c*(3.0-2.0*c);
        c*=1.0-0.4*far;                                // translucent from afar so oceans and land read
        vec3 S=normalize(uNormalM*vP);
        vec3 V=normalize(cameraPosition-vW);
        float sd=dot(S,uSun);
        float day=smoothstep(-0.18,0.35,sd);
        float sunset=exp(-pow((sd-0.02)*5.0,2.0));
        vec3 col=mix(uTint,vec3(1.0,0.62,0.48),sunset*0.7)*(0.04+day*1.05);
        float edge=smoothstep(0.0,0.3,dot(S,V));
        gl_FragColor=vec4(col,c*uOpacity*edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  })
  const mesh = new Mesh(sphereCube(o.segs), mat)
  mesh.scale.setScalar(o.radius)
  mesh.geometry.boundingSphere!.radius = 1.01
  mesh.onBeforeRender = bindRotation
  mesh.renderOrder = 2
  return mesh
}

/*
  High-detail patch around the north pole, where the story starts. The global sphere is light;
  this cap carries ~4x denser geometry and an extra bake with fine relief, densest under the
  shuttle and fading into the global heights at its edge. The global mesh sinks under it.
*/
export function makeHomePatch(renderer: WebGLRenderer, planet: Mesh, o: { capDeg: number; rings: number; sectors: number; mapSize: number; seed: [number, number, number] }) {
  const cap = (o.capDeg * Math.PI) / 180
  const capSin = Math.sin(cap)
  const base = planet.material as ShaderMaterial
  const pmap = bake(renderer, o.mapSize, o.mapSize, /* glsl */ `
    ${HEIGHT}
    uniform float uCapSin;
    float value(vec3 pp){
      vec2 q=(vec2(pp.x,pp.z)); // unused, the bake uses the polar projection below
      return 0.0;
    }`, { uKind: { value: 0 }, uSeed: { value: new Vector3(...o.seed) }, uCapSin: { value: capSin } }, /* glsl */ `
      vec2 q=(vUv*2.0-1.0)*uCapSin;
      vec3 p=vec3(q.x, sqrt(max(1.0-dot(q,q),0.0)), q.y);
      float h=height(p);
      float land=smoothstep(0.0,0.08,h);
      // fine relief only where the patch mesh is dense enough to carry it (near the start point)
      float near=1.0-smoothstep(0.12,0.42,length(q)/uCapSin);
      h+=(fbm(p*110.0+uSeed,2)*0.04+(ridged(p*55.0+uSeed,3)-0.35)*0.05)*land*near;
      gl_FragColor=vec4(h,0.0,0.0,1.0);`)

  // polar grid: rings get denser towards the pole, where the camera starts
  const R = o.rings, M = o.sectors
  const count = 1 + (R + 1) * M
  const pos = new Float32Array(count * 3)
  const skirt = new Float32Array(count)
  pos[1] = 1
  for (let i = 1; i <= R + 1; i++) {
    const last = i === R + 1
    const th = cap * Math.pow(Math.min(i, R) / R, 1.7)
    for (let j = 0; j < M; j++) {
      const ph = (j / M) * Math.PI * 2
      const k = 1 + (i - 1) * M + j
      pos[k * 3] = Math.sin(th) * Math.cos(ph)
      pos[k * 3 + 1] = Math.cos(th)
      pos[k * 3 + 2] = Math.sin(th) * Math.sin(ph)
      if (last) skirt[k] = 1
    }
  }
  const idx = new Uint32Array(M * 3 + R * M * 6)
  let n = 0
  for (let j = 0; j < M; j++) { idx[n++] = 0; idx[n++] = 1 + ((j + 1) % M); idx[n++] = 1 + j }
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < M; j++) {
      const a = 1 + i * M + j, b = 1 + i * M + ((j + 1) % M)
      const c = a + M, d = b + M
      idx[n++] = a; idx[n++] = b; idx[n++] = c; idx[n++] = b; idx[n++] = d; idx[n++] = c
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('aSkirt', new BufferAttribute(skirt, 1))
  g.setIndex(new BufferAttribute(idx, 1))
  const r0 = base.uniforms.uR.value as number
  g.boundingSphere = new Sphere(new Vector3(0, r0 * Math.cos(cap), 0), r0 * capSin * 1.1)

  const mat = new ShaderMaterial({
    uniforms: { ...base.uniforms, uPMap: { value: pmap }, uCapSin: { value: capSin }, uPW: { value: o.mapSize } },
    defines: { PATCH: 1 },
    vertexShader: /* glsl */ `
      ${UV}
      uniform sampler2D uHMap, uPMap; uniform float uR, uAmp, uCapSin;
      attribute float aSkirt;
      varying vec3 vP; varying vec3 vL; varying float vH; varying vec3 vW;
      void main(){
        vec3 p=normalize(position);
        vec2 q=vec2(p.x,p.z)/uCapSin;
        float hp=textureLod(uPMap,q*0.5+0.5,0.0).r;
        float hg=textureLod(uHMap,sphereUv(p),0.0).r;
        float h=mix(hp,hg,smoothstep(0.78,0.96,length(q)));
        vH=h; vP=p;
        float lift=1.0+0.0004*smoothstep(0.85,1.0,length(q));   // win the overlap with the global mesh
        vec3 L=p*uR*(1.0+max(h,0.0)*uAmp)*lift*(1.0-aSkirt*0.02);
        vL=L;
        vec4 w=modelMatrix*vec4(L,1.0); vW=w.xyz;
        gl_Position=projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: PLANET_FRAG,
  })
  const mesh = new Mesh(g, mat)
  mesh.onBeforeRender = bindRotation
  // the global mesh sinks only well inside the patch, so its sloped boundary triangles stay hidden
  return { mesh, capCos: Math.cos(cap - (1.6 * Math.PI) / 180) }
}
