import * as THREE from 'three';

// The courtyard fountain (Blender origin; bowl rim 0.7 m at 1.1 m, basin water at 0.5 m) had a dry nozzle.
// A jet rises from the bowl and falls back into it, twelve threads spill over the rim into the basin and rings
// spread on both water surfaces. Every droplet is placed by the GPU from time and a seed (ballistic flight), so the
// CPU only advances a clock. Reduced motion freezes the water; dusk dims it with the courtyard.
const BOWL_Y = 1.1, BASIN_Y = .5, RIM = .7, G = 9.81;
const JET = 320, THREADS = 12, PER_THREAD = 56;

const DROP_VERT = `
uniform float uTime;uniform float uScale;attribute vec4 aSeed;varying float vAlpha;
void main(){
 vec3 p;
 if(aSeed.w<.5){ // jet: straight up with a slight spread, back into the bowl
  float v=3.7+.25*aSeed.z,T=2.*v/${G.toFixed(2)},t=mod(uTime+aSeed.x*T,T);
  vec2 h=vec2(cos(aSeed.y),sin(aSeed.y))*(.05+.1*aSeed.z);
  p=vec3(h.x*t,${BOWL_Y.toFixed(2)}+.02+v*t-${(G / 2).toFixed(3)}*t*t,h.y*t);
  vAlpha=.55*smoothstep(0.,.08,t)*smoothstep(0.,.1,T-t);
 }else{ // thread over the rim: leaves the lip with a little outward speed and falls to the basin
  float T=sqrt(2.*${(BOWL_Y - BASIN_Y).toFixed(2)}/${G.toFixed(2)}),t=mod(uTime+aSeed.x*T,T);
  vec2 d=vec2(cos(aSeed.y),sin(aSeed.y));
  vec2 w=vec2(-d.y,d.x)*(aSeed.z-.5)*.03; // a thread is a few centimetres wide
  p=vec3(d.x*(${RIM.toFixed(2)}+.22*t)+w.x,${BOWL_Y.toFixed(2)}-.03-${(G / 2).toFixed(3)}*t*t,d.y*(${RIM.toFixed(2)}+.22*t)+w.y);
  vAlpha=.34*smoothstep(0.,.03,t);
 }
 vec4 mv=modelViewMatrix*vec4(p,1.);
 gl_PointSize=(aSeed.w<.5?.034:.03)*uScale/max(-mv.z,.1);
 gl_Position=projectionMatrix*mv;
}`;
const DROP_FRAG = `
uniform float uLight;varying float vAlpha;
void main(){vec2 c=gl_PointCoord-.5;float r=dot(c,c);if(r>.25)discard;
 gl_FragColor=vec4(vec3(.82,.9,.98)*uLight,vAlpha*(1.-r*4.));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
// Rings on still water: a train of crests moving out from the radius where the water lands.
const RING_VERT = `varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const RING_FRAG = `
uniform float uTime;uniform float uLight;uniform float uFrom;uniform float uSpread;varying vec2 vP;
void main(){float r=length(vP),d=r-uFrom;
 float crest=pow(.5+.5*sin(d*38.-uTime*5.),6.)*exp(-abs(d)*uSpread);
 float a=crest*.22*smoothstep(0.,.05,abs(d)+.02);
 gl_FragColor=vec4(vec3(.85,.93,1.)*uLight,a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export function createFountain(scene, renderer) {
  const time = {value: 0}, light = {value: 1}, scale = {value: 800};
  const root = new THREE.Group(); root.name = 'Courtyard fountain water';
  const seeds = [];
  for (let i = 0; i < JET; i++) seeds.push(i / JET, Math.random() * Math.PI * 2, Math.random(), 0);
  for (let k = 0; k < THREADS; k++) for (let i = 0; i < PER_THREAD; i++) seeds.push(i / PER_THREAD, (k + .5) / THREADS * Math.PI * 2 + (Math.random() - .5) * .04, Math.random(), 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(seeds.length / 4 * 3), 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
  const drops = new THREE.Points(geo, new THREE.ShaderMaterial({uniforms: {uTime: time, uScale: scale, uLight: light},
    vertexShader: DROP_VERT, fragmentShader: DROP_FRAG, transparent: true, depthWrite: false}));
  drops.frustumCulled = false; drops.name = 'Fountain · droplets';
  const ring = (radius, y, from, spread) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.ShaderMaterial({
      uniforms: {uTime: time, uLight: light, uFrom: {value: from}, uSpread: {value: spread}},
      vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false}));
    m.rotation.x = -Math.PI / 2; m.position.y = y + .004; m.name = 'Fountain · ripples'; return m;
  };
  root.add(drops, ring(2.75, BASIN_Y, RIM + .1, 1.4), ring(RIM - .08, BOWL_Y, 0, 4));
  scene.add(root);
  const size = new THREE.Vector2();
  return {
    root,
    update(seconds, reduced, camera, dusk) {
      root.visible = camera.position.lengthSq() < 75 * 75;
      if (!root.visible) return;
      if (!reduced) time.value = seconds;
      light.value = dusk ? .5 : 1;
      renderer.getDrawingBufferSize(size);
      scale.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    }
  };
}
