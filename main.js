import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Studio-style radial gradient backdrop.
{
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(512, 400, 60, 512, 540, 760);
  grad.addColorStop(0, '#3b4252');
  grad.addColorStop(0.55, '#222834');
  grad.addColorStop(1, '#0f1218');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 1024);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}

// Image-based lighting from a procedural room environment (no downloaded assets).
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(
  38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4.1, 1.5, 4.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -0.05, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.6;
controls.maxDistance = 14;

// ---------------------------------------------------------------------------
// Lighting + shadow-catcher floor
// ---------------------------------------------------------------------------

const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(5, 7, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -4;
keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 4;
keyLight.shadow.camera.bottom = -4;
keyLight.shadow.bias = -0.0002;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xbfd0e8, 0.55);
fillLight.position.set(-4, 2, -3);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.ShadowMaterial({ opacity: 0.32 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.35;
floor.receiveShadow = true;
scene.add(floor);

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const paint = new THREE.MeshPhysicalMaterial({
  color: 0xd9dce1,
  metalness: 0.18,
  roughness: 0.42,
  clearcoat: 0.35,
  clearcoatRoughness: 0.5,
  envMapIntensity: 0.9,
});

const panelMat = new THREE.MeshStandardMaterial({
  color: 0x878c93,
  metalness: 0.55,
  roughness: 0.55,
});

const darkMetal = new THREE.MeshStandardMaterial({
  color: 0x2c2f34,
  metalness: 0.92,
  roughness: 0.42,
});

const intakeDark = new THREE.MeshStandardMaterial({
  color: 0x121417,
  metalness: 0.7,
  roughness: 0.6,
});

// ---------------------------------------------------------------------------
// Fuselage: smooth lathe profile (tail at -X, nose at +X)
// ---------------------------------------------------------------------------

// [axial, radius] control points, resampled smoothly with a spline.
const profile = [
  [-2.32, 0.000], [-2.305, 0.120], [-2.24, 0.185], [-2.10, 0.240],
  [-1.90, 0.285], [-1.60, 0.310], [-1.10, 0.328], [-0.60, 0.335],
  [0.00, 0.335], [0.50, 0.331], [0.85, 0.316], [1.20, 0.282],
  [1.55, 0.232], [1.85, 0.172], [2.10, 0.112], [2.28, 0.052],
  [2.36, 0.000],
];

function radiusAt(axial) {
  for (let i = 0; i < profile.length - 1; i++) {
    const [a0, r0] = profile[i];
    const [a1, r1] = profile[i + 1];
    if (axial >= a0 && axial <= a1) {
      const t = (axial - a0) / (a1 - a0);
      return r0 + (r1 - r0) * t;
    }
  }
  return 0;
}

const missile = new THREE.Group();

{
  const spline = new THREE.SplineCurve(
    profile.map(([a, r]) => new THREE.Vector2(a, r)));
  const pts = spline
    .getPoints(200)
    .map((v) => new THREE.Vector2(Math.max(v.y, 0.0001), v.x));
  const geo = new THREE.LatheGeometry(pts, 128);
  geo.rotateZ(-Math.PI / 2); // lathe axis +Y -> +X (nose toward +X)
  const mesh = new THREE.Mesh(geo, paint);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  missile.add(mesh);
}

// Panel lines: thin rings at fuselage stations.
for (const p of [-2.05, -1.5, -0.95, -0.4, 0.15, 0.7, 1.05, 1.45]) {
  const r = radiusAt(p);
  if (r < 0.02) continue;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r + 0.0012, 0.0045, 8, 96),
    panelMat);
  ring.geometry.rotateY(Math.PI / 2);
  ring.position.x = p;
  ring.castShadow = true;
  missile.add(ring);
}

// Dorsal seam: a fine raised line along the top of the body.
{
  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.012, 0.014), panelMat);
  seam.position.set(-0.45, 0.332, 0);
  missile.add(seam);
}

// Exhaust: dark inset disk + nozzle shroud lip at the tail.
{
  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 48), darkMetal);
  disk.geometry.rotateY(-Math.PI / 2);
  disk.position.x = -2.285;
  missile.add(disk);

  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(radiusAt(-2.24) + 0.001, 0.009, 10, 96),
    darkMetal);
  lip.geometry.rotateY(Math.PI / 2);
  lip.position.x = -2.24;
  missile.add(lip);
}

// ---------------------------------------------------------------------------
// Wings: thin extruded trapezoidal planforms, swept, mid-body, +/- Z
// ---------------------------------------------------------------------------

function wingGeometry(mirror) {
  const s = mirror ? -1 : 1;
  const sh = new THREE.Shape();
  sh.moveTo(0.28, 0);           // leading-edge root
  sh.lineTo(-0.32, 0);          // trailing-edge root
  sh.lineTo(-0.36, s * 0.80);   // trailing-edge tip
  sh.lineTo(-0.02, s * 0.83);   // leading-edge tip (swept back)
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.009,
    bevelSize: 0.009,
    bevelSegments: 3,
    steps: 1,
  });
  g.translate(0, 0, -0.016);
  g.rotateX(Math.PI / 2); // planform into XZ plane, thickness in Y
  return g;
}

for (const mirror of [false, true]) {
  const wing = new THREE.Mesh(wingGeometry(mirror), paint);
  wing.position.set(0.15, -0.02, 0);
  wing.castShadow = true;
  wing.receiveShadow = true;
  missile.add(wing);
}

// ---------------------------------------------------------------------------
// Tail fins: 4 in X arrangement at the aft body
// ---------------------------------------------------------------------------

function finGeometry() {
  const sh = new THREE.Shape();
  sh.moveTo(0.18, 0);           // leading-edge root
  sh.lineTo(-0.20, 0);          // trailing-edge root
  sh.lineTo(-0.26, 0.50);       // trailing-edge tip
  sh.lineTo(-0.04, 0.52);       // leading-edge tip
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 3,
    steps: 1,
  });
  g.translate(0, 0.14, -0.014); // root embedded into the fuselage
  return g;
}

{
  const geo = finGeometry();
  for (const deg of [45, 135, 225, 315]) {
    const fin = new THREE.Mesh(geo, paint);
    fin.position.x = -1.92;
    fin.rotation.x = THREE.MathUtils.degToRad(deg);
    fin.castShadow = true;
    fin.receiveShadow = true;
    missile.add(fin);
  }
}

// ---------------------------------------------------------------------------
// Ventral intake scoop (flush belly inlet, aft of mid-body)
// ---------------------------------------------------------------------------

{
  // Flattened cylinder, axis along X, opening facing forward.
  const scoopGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.68, 48, 1, true);
  scoopGeo.scale(0.7, 1, 1);
  scoopGeo.rotateZ(Math.PI / 2);
  const scoop = new THREE.Mesh(scoopGeo, paint);
  scoop.position.set(-0.55, -0.315, 0);
  scoop.castShadow = true;
  missile.add(scoop);

  // Dark inlet face, slightly inset.
  const faceGeo = new THREE.CircleGeometry(0.128, 48);
  faceGeo.scale(1, 0.7, 1);
  faceGeo.rotateY(Math.PI / 2);
  const face = new THREE.Mesh(faceGeo, intakeDark);
  face.position.set(-0.213, -0.315, 0);
  missile.add(face);

  // Lip ring around the intake opening.
  const lipGeo = new THREE.TorusGeometry(0.135, 0.008, 10, 64);
  lipGeo.scale(1, 0.7, 1);
  lipGeo.rotateY(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeo, panelMat);
  lip.position.set(-0.216, -0.315, 0);
  missile.add(lip);
}

// Slight presentation angle.
missile.rotation.y = -0.38;
missile.rotation.z = 0.06;
scene.add(missile);

// ---------------------------------------------------------------------------
// Resize + render loop
// ---------------------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
