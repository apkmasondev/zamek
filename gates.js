import * as THREE from 'three';

// The gate leaves share their exported materials with benches and fittings elsewhere, which read as flat orange
// boards with pale green straps up close. The leaves get their own copies: aged oak with grain and per-plank tone,
// forged iron straps and darkened brass rings. Grain is computed from the (world-space) geometry, so no texture is needed.
const WOOD_CHUNK = `
  float gateHash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
  float gateNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = gateHash(i.x + i.y * 57.0), b = gateHash(i.x + 1.0 + i.y * 57.0), c = gateHash(i.x + (i.y + 1.0) * 57.0), d = gateHash(i.x + 1.0 + (i.y + 1.0) * 57.0);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }`;
function oakMaterial(source) {
  const m = source.clone();
  m.name = 'Gate · aged oak';
  m.color.setRGB(.105, .064, .036);
  m.roughness = .8; m.metalness = 0;
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGateWood;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGateWood = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGateWood;' + WOOD_CHUNK)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float plank = floor((vGateWood.x + 50.0) / 0.33);
        float tone = gateHash(plank * 7.13);
        float wobble = gateNoise(vec2(vGateWood.x * 7.0, vGateWood.y * 0.55 + plank * 3.7));
        float rings = 0.5 + 0.5 * sin(vGateWood.x * 75.0 + wobble * 7.0 + tone * 20.0);
        float fibre = gateNoise(vec2(vGateWood.x * 160.0, vGateWood.y * 2.2));
        float knot = smoothstep(0.93, 1.0, gateNoise(vec2(vGateWood.x * 3.0 + plank, vGateWood.y * 1.3)));
        diffuseColor.rgb *= (0.72 + 0.42 * tone) * (0.78 + 0.26 * rings) * (0.88 + 0.16 * fibre) * (1.0 - 0.45 * knot);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (0.9 + 0.2 * fibre), 0.0, 1.0);');
  };
  m.customProgramCacheKey = () => 'gate-aged-oak';
  return m;
}
function dressGateMaterials(meshes) {
  const cache = new Map();
  const replacement = source => {
    if (cache.has(source)) return cache.get(source);
    let m = source;
    if (source.name.includes('Oak')) m = oakMaterial(source);
    else if (source.name.includes('bronze')) { m = source.clone(); m.name = 'Gate · forged iron'; m.color.setRGB(.03, .028, .026); m.metalness = .6; m.roughness = .58; }
    else if (source.name.includes('Brass')) { m = source.clone(); m.name = 'Gate · aged brass'; m.color.setRGB(.3, .19, .075); m.metalness = .85; m.roughness = .48; }
    cache.set(source, m);
    return m;
  };
  for (const mesh of meshes) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(replacement) : replacement(mesh.material);
}

// Each leaf is exported as its own collection so Draco/material batching cannot
// merge it with the facade or the opposite leaf. Geometry stays in world space.
export function createEntranceGates(castle, scene, changed = () => {}) {
  const leaves = ['23_GATE_LEFT', '24_GATE_RIGHT'].map(prefix => {
    const meshes = [];
    castle.traverse(o => { if (o.isMesh && o.name.startsWith(prefix)) meshes.push(o); });
    return meshes;
  });
  if (leaves.some(parts => !parts.length)) return null;
  dressGateMaterials(leaves.flat());
  scene.updateMatrixWorld(true);
  const pivots = leaves.map((parts, i) => {
    const pivot = new THREE.Group();
    pivot.name = i ? 'Entrance right hinge' : 'Entrance left hinge';
    pivot.position.set(i ? 3.96 : -3.96, 0, 49.04);
    scene.add(pivot);
    pivot.updateMatrixWorld(true);
    for (const mesh of parts) pivot.attach(mesh);
    return pivot;
  });
  let fraction = 0, startFraction = 0, target = 0, started = 0, duration = 0;
  function pose(value) {
    if (value === fraction) return;
    fraction = value;
    pivots[0].rotation.y = value * Math.PI / 2;
    pivots[1].rotation.y = -value * Math.PI / 2;
    changed();
  }
  const controller = {
    get fraction() { return fraction; },
    open(now, immediate = false) {
      if (immediate) { target = 1; duration = 0; pose(1); return; }
      if (target === 1) return;
      startFraction = fraction; target = 1; started = now;
      duration = 7200 * (1 - startFraction);
    },
    reset() { target = 0; duration = 0; pose(0); },
    update(now, reduced = false) {
      if (!duration) return;
      const t = reduced ? 1 : Math.min(1, Math.max(0, (now - started) / duration));
      pose(startFraction + (target - startFraction) * t * t * (3 - 2 * t));
      if (t === 1) duration = 0;
    }
  };
  return controller;
}
