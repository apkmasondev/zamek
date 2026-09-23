import * as THREE from 'three';

// Small additions to the exhibits that belong to the page rather than the Blender master.
// Room 01: the white ray started in mid-air. A brass projection lantern with a slit now hangs from the vault
// on a rod and sends the ray towards the prism (the ray geometry itself is unchanged).
const w = (x, y, z) => new THREE.Vector3(x, z, -y);   // Blender (x, y, z) → three.js

export function dressExhibits(scene, brassSource) {
  const brass = brassSource ? brassSource.clone() : new THREE.MeshStandardMaterial({color: '#b88a45', metalness: .9, roughness: .38});
  brass.onBeforeCompile = () => {};
  const iron = new THREE.MeshStandardMaterial({color: '#18130e', metalness: .6, roughness: .5});
  const glow = new THREE.MeshBasicMaterial({color: new THREE.Color('#fff4e0').multiplyScalar(3), toneMapped: true});
  const group = new THREE.Group(); group.name = 'Exhibit 01 · projection lantern';

  const start = w(20.0, -5.0, 4.4), end = w(24.5, -4.0, 2.5);
  const dir = end.clone().sub(start).normalize();
  const housing = new THREE.Group();
  housing.position.copy(start).addScaledVector(dir, -.34);
  housing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const add = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; housing.add(m); return m; };
  add(new THREE.CylinderGeometry(.17, .19, .52, 28), iron);                      // lamp body
  add(new THREE.TorusGeometry(.19, .025, 8, 28).rotateX(Math.PI / 2), brass, -.2);  // rear band
  add(new THREE.TorusGeometry(.175, .025, 8, 28).rotateX(Math.PI / 2), brass, .2);  // front band
  add(new THREE.CylinderGeometry(.11, .14, .22, 24), brass, .36);                 // lens tube
  add(new THREE.BoxGeometry(.22, .02, .06), iron, .48);                           // slit plate
  add(new THREE.CylinderGeometry(.075, .075, .01, 20), glow, .475);               // lit lens
  add(new THREE.CylinderGeometry(.05, .05, .16, 12), brass, -.34);                 // rear cap
  group.add(housing);

  // Yoke and rod up to the vault.
  const top = w(20.0 - 4.5 * .075, -5.0 - .075, 10.1), yoke = housing.position.clone();
  const rodLen = top.y - yoke.y - .2;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, rodLen, 10), iron);
  rod.position.set(yoke.x, yoke.y + .2 + rodLen / 2, yoke.z);
  const fork = new THREE.Mesh(new THREE.TorusGeometry(.24, .02, 8, 24, Math.PI).rotateZ(Math.PI), brass);
  fork.position.copy(yoke).add(new THREE.Vector3(0, .02, 0)); fork.lookAt(yoke.clone().add(new THREE.Vector3(dir.x, 0, dir.z)));
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .05, 20), brass);
  rose.position.set(yoke.x, top.y - .02, yoke.z);
  group.add(rod, fork, rose);
  scene.add(group);
  return group;
}
