import { BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, Color, Vector3, Matrix3, Sphere } from 'three'

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
  radius: number
  kind: 0 | 1
  segs: number
  amp: number
  seed: [number, number, number]
  sun: Vector3
  colors: Record<string, string>
}

export function makeDetailedPlanet(o: PlanetOpts) {
  const col = (k: string) => ({ value: new Color(o.colors[k]) })
  const mat = new ShaderMaterial({
    uniforms: {
      uR: { value: o.radius }, uAmp: { value: o.amp }, uKind: { value: o.kind }, uSeed: { value: new Vector3(...o.seed) },
      uSun: { value: o.sun }, uTime: { value: 0 }, uNormalM: { value: new Matrix3() },
      cDeep: col('deep'), cShallow: col('shallow'), cLow: col('low'), cMid: col('mid'), cHigh: col('high'), cPeak: col('peak'),
      cAmb: col('amb'), cFill: col('fill'), cSun: col('sun'), cLights: col('lights'),
    },
    vertexShader: /* glsl */ `
      ${NOISE}
      ${HEIGHT}
      uniform float uR, uAmp;
      varying vec3 vP; varying vec3 vL; varying float vH; varying vec3 vW;
      void main(){
        vec3 p=normalize(position);
        float h=height(p);
        vH=h; vP=p;
        float d = uKind < 0.5 ? max(h,0.0) : h;
        vec3 L=p*uR*(1.0+d*uAmp);
        vL=L;
        vec4 w=modelMatrix*vec4(L,1.0); vW=w.xyz;
        gl_Position=projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uKind, uR; uniform vec3 uSun; uniform vec3 uSeed; uniform mat3 uNormalM;
      uniform vec3 cDeep, cShallow, cLow, cMid, cHigh, cPeak, cAmb, cFill, cSun, cLights;
      varying vec3 vP; varying vec3 vL; varying float vH; varying vec3 vW;
      void main(){
        // faceted normal from derivatives (model space, good precision), then to world
        vec3 nl=normalize(cross(dFdx(vL),dFdy(vL)));
        if(dot(nl,vL)<0.0) nl=-nl;
        vec3 N=normalize(uNormalM*nl);
        vec3 S=normalize(uNormalM*normalize(vP));
        vec3 V=normalize(cameraPosition-vW);
        float h=vH;
        float grain=snoise(vP*90.0+uSeed)*0.5+0.5;
        vec3 albedo; float water=0.0;
        if(uKind<0.5){
          if(h<0.0){
            water=1.0;
            albedo=mix(cDeep,cShallow,smoothstep(-0.3,0.0,h));
            // small waves break the sun glint into sparkles
            vec3 wp=vP*700.0+uSeed;
            N=normalize(S+0.05*vec3(snoise(wp),snoise(wp+17.3),snoise(wp+41.7)));
          } else {
            albedo=mix(cLow,cMid,smoothstep(0.0,0.25,h));
            albedo=mix(albedo,cHigh,smoothstep(0.25,0.6,h));
            float slope=1.0-max(dot(nl,normalize(vL)),0.0);
            albedo=mix(albedo,cPeak,smoothstep(1.05,1.3,h+grain*0.1)*(1.0-smoothstep(0.2,0.45,slope)));
          }
        } else {
          albedo=mix(cLow,cMid,smoothstep(-0.45,0.0,h));
          albedo=mix(albedo,cHigh,smoothstep(0.0,0.35,h));
          albedo=mix(albedo,cPeak,smoothstep(0.32,0.6,h)*0.8);
          float bands=snoise(vec3(vP.y*7.0,vP.x*0.6,vP.z*0.6)+uSeed)*0.5+0.5;
          albedo*=0.85+bands*0.3;
        }
        albedo*=0.88+grain*0.24;
        float ndl=dot(N,uSun);
        float lit=max(ndl,0.0);
        float terminator=smoothstep(-0.12,0.25,dot(S,uSun));
        vec3 col=albedo*(cSun*lit*terminator*1.25+cFill*max(-ndl,0.0)*0.35+cAmb);
        if(water>0.5){
          vec3 H=normalize(uSun+V);
          float nh=max(dot(N,H),0.0);
          float spec=(pow(nh,600.0)*0.9+pow(nh,40.0)*0.05)*terminator;
          float fres=pow(1.0-max(dot(N,V),0.0),5.0);
          col+=cSun*spec+cShallow*fres*0.5*terminator;
        }
        if(uKind<0.5 && water<0.5){
          float night=smoothstep(0.02,-0.25,dot(S,uSun));
          float cluster=smoothstep(0.15,0.6,snoise(vP*9.0+uSeed*3.0));
          float dots=pow(max(snoise(vP*260.0),0.0),5.0)*8.0;
          col+=cLights*dots*cluster*night*smoothstep(0.35,0.0,h);
        }
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const mesh = new Mesh(sphereCube(Math.min(o.segs, 32)), mat)
  mesh.onBeforeRender = bindRotation
  const fix = () => { mesh.geometry.boundingSphere!.radius = o.radius * (1 + o.amp * 1.5) }
  fix()
  sphereCubeAsync(o.segs).then((g) => { mesh.geometry.dispose(); mesh.geometry = g; fix() })
  return mesh
}

/*
  Cloud / haze shell. Home planet: domain-warped cloud fronts that drift slowly,
  lit by the sun with a warm tint along the terminator. Destination: thin banded dust haze.
*/
export function makeClouds(o: { radius: number; segs: number; kind: 0 | 1; sun: Vector3; seed: [number, number, number]; tint: string; opacity: number }) {
  const mat = new ShaderMaterial({
    uniforms: {
      uSun: { value: o.sun }, uTime: { value: 0 }, uSeed: { value: new Vector3(...o.seed) }, uKind: { value: o.kind },
      uTint: { value: new Color(o.tint) }, uOpacity: { value: o.opacity }, uNormalM: { value: new Matrix3() },
    },
    // large-scale density per vertex (cheap), fine wisps per pixel
    vertexShader: /* glsl */ `
      ${NOISE}
      uniform vec3 uSeed; uniform float uTime, uKind;
      varying vec3 vP; varying vec3 vW; varying float vD; varying vec3 vWarp;
      void main(){
        vec3 p=normalize(position); vP=p;
        if(uKind<0.5){
          vec3 q=p*2.2+uSeed+vec3(uTime*0.006,0.0,uTime*0.003);
          vec3 w=vec3(fbm(q,3),fbm(q+vec3(4.1,7.3,2.2),3),fbm(q+vec3(8.7,1.9,5.5),3));
          float d=fbm(q*1.6+w*1.4,5);
          d+=0.18*sin(abs(p.y)*14.0+w.x*3.0);
          vD=d; vWarp=w;
        } else {
          vec3 q=vec3(p.y*7.0,p.x*1.1,p.z*1.1)+uSeed+vec3(0.0,uTime*0.004,0.0);
          vD=fbm(q+vec3(fbm(p*2.0+uSeed,3)*2.0),4); vWarp=vec3(0.0);
        }
        vec4 w4=modelMatrix*vec4(position,1.0); vW=w4.xyz;
        gl_Position=projectionMatrix*viewMatrix*w4;
      }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform vec3 uSun, uSeed, uTint; uniform float uTime, uKind, uOpacity; uniform mat3 uNormalM;
      varying vec3 vP; varying vec3 vW; varying float vD; varying vec3 vWarp;
      void main(){
        vec3 p=vP;
        float c;
        if(uKind<0.5){
          float fine=snoise(p*36.0+vWarp*2.0+uSeed)*0.09+snoise(p*110.0+uSeed)*0.04;
          c=smoothstep(0.08,0.42,vD+fine);
        } else {
          c=smoothstep(0.0,0.5,vD+snoise(vec3(p.y*40.0,p.x*6.0,p.z*6.0))*0.05)*0.8;
        }
        vec3 S=normalize(uNormalM*p);
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
  const mesh = new Mesh(sphereCube(Math.min(o.segs, 32)), mat)
  mesh.scale.setScalar(o.radius)
  mesh.geometry.boundingSphere!.radius = 1.01
  sphereCubeAsync(o.segs).then((g) => { mesh.geometry.dispose(); g.boundingSphere!.radius = 1.01; mesh.geometry = g })
  mesh.onBeforeRender = bindRotation
  mesh.renderOrder = 2
  return mesh
}
