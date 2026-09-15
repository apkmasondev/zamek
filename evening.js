import * as THREE from 'three';
import {lanterns} from './lanterns.js';

// A second lighting preset, using the same sun, reflection and three local lights.
// No additional shadow maps or per-lantern lights are allocated.
export function createEveningLighting({scene,sun,hemisphere,sky,lake,renderer,localLights,castle,haloMap}) {
 const skyKeys=['turbidity','rayleigh','mieCoefficient','mieDirectionalG'];
 const day={sunPosition:sun.position.clone(),sunColor:sun.color.clone(),skyPosition:sky.material.uniforms.sunPosition.value.clone(),
  sky:Object.fromEntries(skyKeys.map(k=>[k,sky.material.uniforms[k].value])),fog:scene.fog.color.clone(),background:scene.background.clone(),
  skyColor:hemisphere.color.clone(),groundColor:hemisphere.groundColor.clone(),waterColor:lake.material.uniforms.waterColor.value.clone(),
  waterSun:lake.material.uniforms.sunColor.value.clone(),waterDirection:lake.material.uniforms.sunDirection.value.clone(),shadows:localLights.map(l=>l.castShadow)};
 const lamps=new Map(),windows=new Map();
 castle.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(m.name.includes('Light · warm alabaster')&&!lamps.has(m))lamps.set(m,{color:m.emissive.clone(),intensity:m.emissiveIntensity});
  // Deep window reveals share this cloth material; a warm emission reads as lit interiors from outside.
  if(m.name.includes('Midnight blue · woven banners')&&!windows.has(m))windows.set(m,{color:m.emissive.clone(),intensity:m.emissiveIntensity});
 }});
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(lanterns.flatMap(p=>p.slice(0,3)),3));
 const halos=new THREE.Points(geometry,new THREE.PointsMaterial({map:haloMap,color:'#ffbd72',size:1.25,transparent:true,opacity:.58,
  blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
 halos.name='Evening · lantern glow';halos.visible=false;scene.add(halos);
 // Low sun ahead-right of the bridge view, so the horizon glow sits behind the castle and east faces catch warm light.
 const duskDirection=new THREE.Vector3(.62,.028,-.78).normalize();
 let enabled=false,outdoors=false,lastSelection=-Infinity;
 function apply(evening,outside){
  enabled=evening;outdoors=outside;lastSelection=-Infinity;
  sun.position.copy(evening?duskDirection.clone().multiplyScalar(215):day.sunPosition);
  sun.color.copy(evening?new THREE.Color('#ffa45c'):day.sunColor);
  hemisphere.color.copy(evening?new THREE.Color('#a898b8'):day.skyColor);
  hemisphere.groundColor.copy(evening?new THREE.Color('#6a4a38'):day.groundColor);
  scene.fog.color.copy(evening?new THREE.Color('#b08c84'):day.fog);
  scene.background.copy(evening?scene.fog.color:day.background);
  const u=sky.material.uniforms;
  u.sunPosition.value.copy(evening?duskDirection:day.skyPosition);
  for(const k of skyKeys)u[k].value=evening?({turbidity:3.2,rayleigh:5.2,mieCoefficient:.0045,mieDirectionalG:.94}[k]):day.sky[k];
  lake.material.uniforms.sunDirection.value.copy(evening?duskDirection:day.waterDirection);
  lake.material.uniforms.sunColor.value.copy(evening?new THREE.Color('#ffb06a'):day.waterSun);
  lake.material.uniforms.waterColor.value.copy(evening?new THREE.Color('#1e3240'):day.waterColor);
  if(evening&&outside){sun.intensity=3;hemisphere.intensity=.68;scene.environmentIntensity=.26;scene.fog.density=.0012;renderer.toneMappingExposure=1;}
  localLights.forEach((l,i)=>{l.castShadow=evening&&outside?false:day.shadows[i];});
  lamps.forEach((original,m)=>{m.emissive.copy(evening&&outside?new THREE.Color('#ffc387'):original.color);m.emissiveIntensity=evening&&outside?Math.max(original.intensity,2.8):original.intensity;});
  windows.forEach((original,m)=>{m.emissive.copy(evening&&outside?new THREE.Color('#ff9f50'):original.color);m.emissiveIntensity=evening&&outside?1.25:original.intensity;});
  halos.visible=evening&&outside;
  renderer.shadowMap.needsUpdate=true;
 }
 function update(seconds,camera){
  if(!enabled||!outdoors||seconds-lastSelection<.5)return;
  lastSelection=seconds;
  const closest=lanterns.map(p=>({p,d:(p[0]-camera.position.x)**2+(p[1]-camera.position.y)**2+(p[2]-camera.position.z)**2})).sort((a,b)=>a.d-b.d);
  localLights.forEach((l,i)=>{const candidate=closest[i];l.distance=35;
   if(!candidate){l.intensity=0;return;}
   l.position.set(...candidate.p.slice(0,3));l.color.set('#ffbd78');
   // Fade illumination before distant lights are reassigned along the route.
   l.intensity=115*THREE.MathUtils.smoothstep(32-Math.sqrt(candidate.d),0,14);
  });
 }
 return {apply,update};
}

export function createLanternHalo(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
 const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
 gradient.addColorStop(0,'rgba(255,255,255,.9)');gradient.addColorStop(.16,'rgba(255,255,255,.35)');gradient.addColorStop(.45,'rgba(255,255,255,.08)');gradient.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(canvas);
}
