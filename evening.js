import * as THREE from 'three';
import {lanterns} from './lanterns.js';

// Evening details on top of the dusk sky mode (look.js): lit lanterns with halos, warm windows and the three local
// lights following the nearest lanterns. No additional shadow maps or per-lantern lights are allocated.
export function createEveningLighting({scene,renderer,localLights,castle,haloMap,surfaces}) {
 const shadows=localLights.map(l=>l.castShadow);
 const lamps=new Map();
 castle.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(m.name.includes('Light · warm alabaster')&&!lamps.has(m))lamps.set(m,{color:m.emissive.clone(),intensity:m.emissiveIntensity});
 }});
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(lanterns.flatMap(p=>p.slice(0,3)),3));
 const halos=new THREE.Points(geometry,new THREE.PointsMaterial({map:haloMap,color:'#ffbd72',size:1.25,transparent:true,opacity:.58,
  blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
 halos.name='Evening · lantern glow';halos.visible=false;scene.add(halos);
 let enabled=false,outdoors=false,lastSelection=-Infinity;
 function apply(evening,outside){
  enabled=evening;outdoors=outside;lastSelection=-Infinity;
  localLights.forEach((l,i)=>{l.castShadow=evening&&outside?false:shadows[i];});
  lamps.forEach((original,m)=>{m.emissive.copy(evening&&outside?new THREE.Color('#ffc387'):original.color);m.emissiveIntensity=evening&&outside?Math.max(original.intensity,2.8):original.intensity;});
  // Leaded windows glow warmly from lit rooms when seen from outside in the evening.
  surfaces.set({windowGlow:evening&&outside?new THREE.Color(1.5,.82,.38):new THREE.Color(0,0,0)});
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
