// Subtle weathering on exterior masonry only. Reuses the existing material pass:
// no texture, light, transparent overlay, geometry or animation is added.
export function applyStonePatina(castle){
 const materials=new Map();
 castle.traverse(o=>{
  if(!o.isMesh)return;
  const apply=m=>{
   if(!['Limestone · warm honed blocks','Limestone · carved edges'].includes(m.name))return m;
   if(materials.has(m))return materials.get(m);
   const copy=m.clone();materials.set(m,copy);
   copy.onBeforeCompile=shader=>{
    const varying='varying vec3 patinaPosition;\nvarying vec3 patinaNormal;\n';
    shader.vertexShader=varying+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     patinaPosition=(modelMatrix*vec4(transformed,1.0)).xyz;
     patinaNormal=normalize(mat3(modelMatrix)*normal);`);
    shader.fragmentShader=varying+`float patinaRange(float x,float a,float b){return step(a,x)*step(x,b);}
     float patinaUnder(float height,float ledge){return smoothstep(ledge-.65,ledge-.09,height)*(1.0-smoothstep(ledge-.08,ledge,height));}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
     vec3 p=patinaPosition;
     float ax=abs(p.x);
     float sides=patinaRange(ax,35.12,37.8)*patinaRange(p.z,-45.3,53.8);
     float front=patinaRange(ax,14.0,35.9)*patinaRange(p.z,53.25,54.2);
     float gate=patinaRange(ax,4.0,12.0)*patinaRange(p.z,49.35,51.6);
     float pavilion=patinaRange(ax,13.85,14.8)*patinaRange(p.z,-77.0,-54.8);
     float exterior=min(1.0,sides+front+gate+pavilion)*(1.0-smoothstep(.25,.6,abs(patinaNormal.y)));
     float grain=clamp(.65+.18*sin(p.x*1.73+p.z*.37)+.14*sin(p.z*2.31-p.x*.29),.25,1.0);
     float base=(1.0-smoothstep(.10,1.25,p.y))*patinaRange(p.y,-.15,1.25);
     float ledges=sides*patinaUnder(p.y,9.85)+front*(patinaUnder(p.y,8.58)+patinaUnder(p.y,10.18))+gate*patinaUnder(p.y,13.8)+pavilion*patinaUnder(p.y,25.8);
     float weather=exterior*grain*clamp(base*.40+ledges*.28,0.0,.48);
     diffuseColor.rgb*=mix(vec3(1.0),vec3(.57,.56,.48),weather);
     roughnessFactor=min(1.0,roughnessFactor+weather*.12);`);
   };
   copy.customProgramCacheKey=()=> 'castle-exterior-patina-v1';
   return copy;
  };
  o.material=Array.isArray(o.material)?o.material.map(apply):apply(o.material);
 });
 return materials.size;
}
