import * as THREE from 'three';

// The finale in the observatory: a brass armillary around a small sun. Ten medallions ride on its equator, one per
// room, and each lights up in its room's colour once the visitor has been there — the journey gathered in one object.
// It replaces the static rings of the Blender model (hidden there) and costs a few dozen draw calls, only when visible.
const CENTRE = new THREE.Vector3(0, 5.3, -28);   // three.js coordinates: Blender (0, 28, 5.3)

function numeralTexture(n) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#000'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#000'; g.font = '600 50px "Palatino Linotype", Palatino, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n).padStart(2, '0'), 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createObservatory(scene, stations, brassSource) {
  const brass = brassSource ? brassSource.clone() : new THREE.MeshStandardMaterial({color: '#c89a4e', metalness: .9, roughness: .32});
  const dark = new THREE.MeshStandardMaterial({color: '#3a2a16', metalness: .8, roughness: .45});
  const root = new THREE.Group(); root.name = 'Observatory · armillary of ten rooms'; root.position.copy(CENTRE); scene.add(root);

  // Stand: a fluted column and a half meridian cradle holding the sphere.
  const column = new THREE.Mesh(new THREE.CylinderGeometry(.16, .26, 2.35, 16), dark); column.position.y = -3.6; root.add(column);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(.24, .05, 8, 24), brass); collar.rotation.x = Math.PI / 2; collar.position.y = -2.45; root.add(collar);
  const cradle = new THREE.Mesh(new THREE.TorusGeometry(3.25, .06, 10, 96, Math.PI), brass); cradle.rotation.z = Math.PI; cradle.position.y = .0; root.add(cradle);

  const sphere = new THREE.Group(); sphere.rotation.z = THREE.MathUtils.degToRad(23.4); root.add(sphere);
  const ring = (r, tube, rx, ry = 0) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 160), brass); m.rotation.set(rx, ry, 0); sphere.add(m); return m; };
  ring(3, .045, 0);                          // colure
  ring(3, .045, 0, Math.PI / 2);             // second colure
  const tropics = [ring(2.75, .025, Math.PI / 2), ring(2.75, .025, Math.PI / 2)];
  tropics[0].position.y = 1.2; tropics[1].position.y = -1.2;
  tropics[0].scale.setScalar(Math.sqrt(9 - 1.44) / 2.75); tropics[1].scale.setScalar(Math.sqrt(9 - 1.44) / 2.75);
  const ecliptic = ring(3.02, .07, Math.PI / 2 + THREE.MathUtils.degToRad(23.4));
  // Degree ticks on the equator ring.
  const equator = new THREE.Group(); equator.rotation.x = 0; sphere.add(equator);
  const eqRing = new THREE.Mesh(new THREE.TorusGeometry(3.08, .085, 12, 180), brass); eqRing.rotation.x = Math.PI / 2; equator.add(eqRing);
  const tick = new THREE.BoxGeometry(.02, .1, .2), ticks = new THREE.InstancedMesh(tick, dark, 72), mtx = new THREE.Matrix4();
  for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; mtx.makeRotationY(-a).setPosition(Math.cos(a) * 3.08, .09, Math.sin(a) * 3.08); ticks.setMatrixAt(i, mtx); }
  equator.add(ticks);

  // Ten medallions on the equator.
  const medallions = stations.map((s, i) => {
    const a = i / stations.length * Math.PI * 2;
    // Room colours are pale pastels; the medallions carry them a little deeper so they read from the doorway.
    const color = new THREE.Color(s.color).offsetHSL(0, .28, -.08);
    const face = new THREE.MeshStandardMaterial({color: '#2a2016', metalness: .55, roughness: .45, emissive: color.clone(), emissiveIntensity: 0, emissiveMap: numeralTexture(s.id)});
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .07, 40), [brass, face, face]);
    m.position.set(Math.cos(a) * 3.08, 0, Math.sin(a) * 3.08);
    m.lookAt(0, 0, 0); m.rotateX(Math.PI / 2);
    equator.add(m);
    return {id: s.id, face, color, level: 0, target: 0};
  });

  // The sun: an emissive core with a soft halo sprite; the room's lights do the actual lighting.
  const sun = new THREE.Mesh(new THREE.SphereGeometry(.42, 32, 16), new THREE.MeshBasicMaterial({color: new THREE.Color('#ffd79a').multiplyScalar(3.2), toneMapped: true}));
  root.add(sun);
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,220,160,.9)'); gr.addColorStop(.25, 'rgba(255,200,130,.35)'); gr.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true}));
  halo.scale.setScalar(2.6); root.add(halo);

  let reveal = 0;
  return {
    root,
    // Visited rooms light up; on arrival in the observatory they do so one after another.
    setVisited(visited, sequence = false) {
      medallions.forEach((m, i) => { m.target = visited.has(m.id) ? 1 : 0; m.delay = sequence ? .35 + i * .22 : 0; });
      reveal = 0;
    },
    update(dt, reduced, visible) {
      root.visible = visible;
      if (!visible) return;
      reveal += dt;
      if (!reduced) { sphere.rotation.y += dt * .05; equator.rotation.y -= dt * .03; }
      for (const m of medallions) {
        const goal = reveal >= (m.delay || 0) ? m.target : 0;
        m.level += (goal - m.level) * Math.min(1, dt * (reduced ? 30 : 2.2));
        m.face.emissiveIntensity = m.level * 2.4;
      }
    }
  };
}
