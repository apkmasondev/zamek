import * as THREE from 'three';

// Only the new roof standards move. UV.x is zero at the fixed hoist seam.
export function createFlagWind(castle) {
 const time={value:0};
 castle.traverse(o=>{
  if(!o.isMesh||!o.material?.name.includes('Silhouette · navy flag cloth'))return;
  o.material=o.material.clone();o.material.side=THREE.DoubleSide;
  o.castShadow=false; // Avoid stale silhouettes in the castle's cached shadow map.
  o.material.onBeforeCompile=shader=>{
   shader.uniforms.flagTime=time;
   shader.vertexShader='uniform float flagTime;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float flutter=uv.x*uv.x;
    transformed.z += flutter * (0.12*sin(uv.x*7.0-flagTime*1.5+position.x*.07)+0.035*sin(uv.x*13.0-flagTime*2.1));
   `);
  };
  o.material.customProgramCacheKey=()=> 'castle-flag-wind-v1';
 });
 return {update(seconds,reduced){time.value=reduced?0:seconds;}};
}
