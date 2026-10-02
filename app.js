import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = (id) => document.getElementById(id);
const ui = {
  viewer: $('viewer'), modelState: $('model-state'), modelName: $('model-name'), modelSize: $('model-size'),
  triangles: $('triangles'), meshes: $('meshes'), dimX: $('dim-x'), dimZ: $('dim-z'),
  segmentBtn: $('segment-btn'), gridPreset: $('grid-preset'), progressWrap: $('progress-wrap'),
  progressBar: $('progress-bar'), progressLabel: $('progress-label'), showGrid: $('show-grid'),
  colorRegions: $('color-regions'), selectedId: $('selected-id'), selectionEmpty: $('selection-empty'),
  selectionData: $('selection-data'), selTriangles: $('sel-triangles'), selPercent: $('sel-percent'),
  selX: $('sel-x'), selZ: $('sel-z'), focusSelected: $('focus-selected'), exportJson: $('export-json'),
  clearSelected: $('clear-selected'), viewOriginal: $('view-original'), viewSegments: $('view-segments'),
  toggleWireframe: $('toggle-wireframe'), status: $('status'), resetView: $('reset-view'),
  modelFile: $('model-file')
};

const state = {
  modelRoot: null,
  segmentGroup: new THREE.Group(),
  gridHelper: new THREE.Group(),
  highlightGroup: new THREE.Group(),
  modelBox: new THREE.Box3(),
  modelSphere: new THREE.Sphere(),
  totalTriangles: 0,
  totalMeshes: 0,
  cells: new Map(),
  selectedCellId: null,
  segmented: false,
  mode: 'original',
  wireframe: false,
  sourceName: 'Gaza Strip 2014',
  sourceSize: 0
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07131f);
// Fog disabled: on portrait/mobile screens the camera must move farther back to fit the wide Gaza model, which previously fogged the model completely into the background.
scene.fog = null;

const camera = new THREE.PerspectiveCamera(52, 1, 0.01, 250);
camera.position.set(22, 19, 28);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
ui.viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .065;
controls.screenSpacePanning = true;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xe8f7ff, 0x10212b, 2.2));
const dir = new THREE.DirectionalLight(0xffffff, 2.4);
dir.position.set(12, 24, 10);
scene.add(dir);

scene.add(state.segmentGroup, state.gridHelper, state.highlightGroup);
state.segmentGroup.visible = false;
state.gridHelper.visible = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const loader = new GLTFLoader();
const tempA = new THREE.Vector3();
const tempB = new THREE.Vector3();
const tempC = new THREE.Vector3();
const tempCentroid = new THREE.Vector3();
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(ui.viewer);

function resize() {
  const w = Math.max(ui.viewer.clientWidth, 1);
  const h = Math.max(ui.viewer.clientHeight, 1);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function formatNumber(n) { return new Intl.NumberFormat('ar-EG').format(Math.round(n)); }
function formatDim(n) { return `${n.toFixed(2)} وحدة`; }
function setStatus(text) { ui.status.textContent = text; }
function sleepFrame() { return new Promise(resolve => requestAnimationFrame(resolve)); }

async function loadDefaultModel() {
  try {
    const response = await fetch('./models/gaza_strip_2014.glb');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.sourceSize = Number(response.headers.get('content-length') || 0);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    await loadGLB(url, 'Gaza Strip 2014', blob.size);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    ui.modelState.className = 'badge';
    ui.modelState.textContent = 'ارفع النموذج';
    ui.modelName.textContent = 'Gaza Strip 2014';
    ui.modelSize.textContent = 'GLB مطلوب';
    setStatus('ملف GLB غير موجود في هذه النسخة من المستودع. استخدم زر «تحميل GLB آخر» واختر gaza_strip_2014.glb.');
  }
}

async function loadGLB(url, name, size) {
  clearCurrentModel();
  ui.modelState.className = 'badge loading';
  ui.modelState.textContent = 'جارٍ التحميل';
  setStatus('جاري قراءة النموذج ثلاثي الأبعاد…');

  const gltf = await loader.loadAsync(url);
  state.modelRoot = gltf.scene;
  state.sourceName = name;
  state.sourceSize = size || 0;
  scene.add(state.modelRoot);

  state.modelRoot.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(state.modelRoot);
  const center = rawBox.getCenter(new THREE.Vector3());
  state.modelRoot.position.sub(center);
  state.modelRoot.updateMatrixWorld(true);

  state.modelBox.setFromObject(state.modelRoot);
  state.modelBox.getBoundingSphere(state.modelSphere);
  calculateModelStats();
  fitCameraToBox(state.modelBox);

  ui.modelState.className = 'badge ready';
  ui.modelState.textContent = 'جاهز';
  ui.segmentBtn.disabled = false;
  ui.modelName.textContent = name.replace(/\.(glb|gltf)$/i, '');
  ui.modelSize.textContent = state.sourceSize ? `${(state.sourceSize / 1024 / 1024).toFixed(1)} MB` : 'ملف محلي';
  setStatus('النموذج جاهز. أنشئ التقسيم المكاني ثم اضغط على أي منطقة.');
}

function calculateModelStats() {
  let triangles = 0;
  let meshes = 0;
  state.modelRoot.traverse(obj => {
    if (!obj.isMesh || !obj.geometry) return;
    meshes++;
    const g = obj.geometry;
    triangles += g.index ? g.index.count / 3 : (g.getAttribute('position')?.count || 0) / 3;
  });
  state.totalTriangles = Math.round(triangles);
  state.totalMeshes = meshes;
  const size = state.modelBox.getSize(new THREE.Vector3());
  ui.triangles.textContent = formatNumber(state.totalTriangles);
  ui.meshes.textContent = formatNumber(meshes);
  ui.dimX.textContent = formatDim(size.x);
  ui.dimZ.textContent = formatDim(size.z);
}

function clearCurrentModel() {
  clearSegments();
  clearSelection();
  if (state.modelRoot) {
    scene.remove(state.modelRoot);
    state.modelRoot.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry?.dispose?.();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m?.dispose?.();
      }
    });
  }
  state.modelRoot = null;
}

function disposeGroup(group, disposeSharedGeometry = false) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse?.(obj => {
      if (obj.isMesh || obj.isLineSegments) {
        if (disposeSharedGeometry) obj.geometry?.dispose?.();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m?.dispose?.();
      }
    });
  }
}

function clearSegments() {
  disposeGroup(state.segmentGroup, false);
  disposeGroup(state.gridHelper, true);
  disposeGroup(state.highlightGroup, false);
  state.cells.clear();
  state.segmented = false;
  state.segmentGroup.visible = false;
  state.gridHelper.visible = false;
  ui.viewSegments.disabled = true;
  setViewMode('original');
}

async function buildSegments() {
  if (!state.modelRoot) return;
  const [cols, rows] = ui.gridPreset.value.split('x').map(Number);
  clearSelection();
  disposeGroup(state.segmentGroup, false);
  disposeGroup(state.gridHelper, true);
  state.cells.clear();

  ui.segmentBtn.disabled = true;
  ui.gridPreset.disabled = true;
  ui.progressWrap.classList.remove('hidden');
  ui.progressBar.style.width = '0%';
  ui.progressLabel.textContent = '0%';
  setStatus(`جاري تقسيم ${formatNumber(state.totalTriangles)} مثلث إلى شبكة ${cols}×${rows}…`);
  await sleepFrame();

  state.modelRoot.updateMatrixWorld(true);
  state.modelBox.setFromObject(state.modelRoot);
  const min = state.modelBox.min;
  const max = state.modelBox.max;
  const dx = Math.max(max.x - min.x, 1e-8);
  const dz = Math.max(max.z - min.z, 1e-8);
  const sourceMeshes = [];
  state.modelRoot.traverse(obj => { if (obj.isMesh && obj.geometry?.getAttribute('position')) sourceMeshes.push(obj); });

  let processed = 0;
  let sourceIndex = 0;
  for (const mesh of sourceMeshes) {
    const geometry = mesh.geometry;
    const pos = geometry.getAttribute('position');
    const index = geometry.index;
    const faceCount = index ? index.count / 3 : pos.count / 3;
    const matrixWorld = mesh.matrixWorld.clone();

    for (let f = 0; f < faceCount; f++) {
      const ia = index ? index.getX(f * 3) : f * 3;
      const ib = index ? index.getX(f * 3 + 1) : f * 3 + 1;
      const ic = index ? index.getX(f * 3 + 2) : f * 3 + 2;

      tempA.fromBufferAttribute(pos, ia).applyMatrix4(matrixWorld);
      tempB.fromBufferAttribute(pos, ib).applyMatrix4(matrixWorld);
      tempC.fromBufferAttribute(pos, ic).applyMatrix4(matrixWorld);
      tempCentroid.copy(tempA).add(tempB).add(tempC).multiplyScalar(1 / 3);

      let col = Math.floor(((tempCentroid.x - min.x) / dx) * cols);
      let row = Math.floor(((tempCentroid.z - min.z) / dz) * rows);
      col = THREE.MathUtils.clamp(col, 0, cols - 1);
      row = THREE.MathUtils.clamp(row, 0, rows - 1);
      const id = `R${String(row + 1).padStart(2, '0')}-C${String(col + 1).padStart(2, '0')}`;

      let cell = state.cells.get(id);
      if (!cell) {
        cell = {
          id, row, col, triangles: 0,
          box: new THREE.Box3().makeEmpty(),
          bySource: new Map(),
          meshes: []
        };
        state.cells.set(id, cell);
      }
      let faceIndices = cell.bySource.get(sourceIndex);
      if (!faceIndices) { faceIndices = []; cell.bySource.set(sourceIndex, faceIndices); }
      faceIndices.push(ia, ib, ic);
      cell.triangles++;
      cell.box.expandByPoint(tempA); cell.box.expandByPoint(tempB); cell.box.expandByPoint(tempC);

      processed++;
      if (processed % 18000 === 0) {
        const pct = Math.min(96, Math.round((processed / state.totalTriangles) * 96));
        ui.progressBar.style.width = `${pct}%`;
        ui.progressLabel.textContent = `${pct}%`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    sourceIndex++;
  }

  const sortedCells = [...state.cells.values()].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const cell of sortedCells) {
    for (const [srcIdx, arr] of cell.bySource.entries()) {
      const source = sourceMeshes[srcIdx];
      const sub = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(source.geometry.attributes)) sub.setAttribute(name, attr);
      sub.setIndex(new THREE.BufferAttribute(new Uint32Array(arr), 1));
      sub.boundingBox = source.geometry.boundingBox;
      sub.boundingSphere = source.geometry.boundingSphere;

      const mats = Array.isArray(source.material) ? source.material : [source.material];
      const sourceMat = mats[0];
      const mat = sourceMat.clone();
      mat.wireframe = state.wireframe;
      mat.userData.baseColor = mat.color?.clone?.() || null;
      const hue = ((cell.row * cols + cell.col) * 0.127) % 1;
      mat.userData.regionColor = new THREE.Color().setHSL(hue, .46, .74);

      const part = new THREE.Mesh(sub, mat);
      part.matrixAutoUpdate = false;
      part.matrix.copy(source.matrixWorld);
      part.userData.cellId = cell.id;
      part.userData.sourceIndex = srcIdx;
      state.segmentGroup.add(part);
      cell.meshes.push(part);
    }
  }

  createGridOverlay(cols, rows, state.modelBox);
  applyRegionColors();
  state.segmented = true;
  ui.viewSegments.disabled = false;
  ui.segmentBtn.disabled = false;
  ui.gridPreset.disabled = false;
  ui.progressBar.style.width = '100%';
  ui.progressLabel.textContent = '100%';
  setViewMode('segments');
  setStatus(`تم إنشاء ${state.cells.size} منطقة فعلية. اضغط على أي منطقة داخل المجسم لتحديدها.`);
  setTimeout(() => ui.progressWrap.classList.add('hidden'), 900);
}

function createGridOverlay(cols, rows, box) {
  const min = box.min, max = box.max;
  const y = min.y + 0.035;
  const vertices = [];
  for (let c = 0; c <= cols; c++) {
    const x = THREE.MathUtils.lerp(min.x, max.x, c / cols);
    vertices.push(x, y, min.z, x, y, max.z);
  }
  for (let r = 0; r <= rows; r++) {
    const z = THREE.MathUtils.lerp(min.z, max.z, r / rows);
    vertices.push(min.x, y, z, max.x, y, z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const m = new THREE.LineBasicMaterial({ color: 0x74dfff, transparent: true, opacity: .52, depthTest: false });
  const lines = new THREE.LineSegments(g, m);
  lines.renderOrder = 9;
  state.gridHelper.add(lines);
}

function applyRegionColors() {
  for (const cell of state.cells.values()) {
    for (const mesh of cell.meshes) {
      const mat = mesh.material;
      if (!mat?.color) continue;
      if (ui.colorRegions.checked) mat.color.copy(mat.userData.regionColor);
      else if (mat.userData.baseColor) mat.color.copy(mat.userData.baseColor);
      mat.needsUpdate = true;
    }
  }
}

function setViewMode(mode) {
  state.mode = mode;
  const seg = mode === 'segments' && state.segmented;
  if (state.modelRoot) state.modelRoot.visible = !seg;
  state.segmentGroup.visible = seg;
  state.gridHelper.visible = seg && ui.showGrid.checked;
  state.highlightGroup.visible = seg;
  ui.viewOriginal.classList.toggle('active', !seg);
  ui.viewSegments.classList.toggle('active', seg);
}

function clearSelection() {
  state.selectedCellId = null;
  disposeGroup(state.highlightGroup, false);
  ui.selectedId.textContent = 'لا يوجد';
  ui.selectionEmpty.classList.remove('hidden');
  ui.selectionData.classList.add('hidden');
  $('selection-panel').classList.add('muted');
}

function selectCell(id) {
  if (!state.segmented || !state.cells.has(id)) return;
  clearSelection();
  state.selectedCellId = id;
  const cell = state.cells.get(id);

  const material = new THREE.MeshBasicMaterial({ color: 0x63dcff, transparent: true, opacity: .34, depthWrite: false, side: THREE.DoubleSide });
  for (const part of cell.meshes) {
    const overlay = new THREE.Mesh(part.geometry, material);
    overlay.matrixAutoUpdate = false;
    overlay.matrix.copy(part.matrix);
    overlay.renderOrder = 10;
    state.highlightGroup.add(overlay);
  }

  const size = cell.box.getSize(new THREE.Vector3());
  ui.selectedId.textContent = id;
  ui.selTriangles.textContent = formatNumber(cell.triangles);
  ui.selPercent.textContent = `${((cell.triangles / state.totalTriangles) * 100).toFixed(2)}%`;
  ui.selX.textContent = formatDim(size.x);
  ui.selZ.textContent = formatDim(size.z);
  ui.selectionEmpty.classList.add('hidden');
  ui.selectionData.classList.remove('hidden');
  $('selection-panel').classList.remove('muted');
  setStatus(`تم تحديد المنطقة ${id} — ${formatNumber(cell.triangles)} مثلث.`);
}

function onPointerDown(event) {
  if (state.mode !== 'segments' || !state.segmented) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(state.segmentGroup.children, false);
  if (hits.length) selectCell(hits[0].object.userData.cellId);
}

function fitCameraToBox(box, padding = 1.35) {
  if (!box || box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * camera.fov / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = padding * Math.max(fitHeightDistance, fitWidthDistance);
  const direction = new THREE.Vector3(1, .82, 1).normalize();
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  controls.target.copy(center);
  camera.near = Math.max(distance / 1000, .005);
  camera.far = distance * 20;
  camera.updateProjectionMatrix();
  controls.update();
}

function exportSelectedJSON() {
  if (!state.selectedCellId) return;
  const cell = state.cells.get(state.selectedCellId);
  const size = cell.box.getSize(new THREE.Vector3());
  const center = cell.box.getCenter(new THREE.Vector3());
  const payload = {
    schema: 'gaza-3d-gis-region/v1',
    model: state.sourceName,
    coordinate_system: 'local / ungeoreferenced',
    region_id: cell.id,
    triangles: cell.triangles,
    share_of_model_percent: Number(((cell.triangles / state.totalTriangles) * 100).toFixed(4)),
    bounds: {
      min: { x: cell.box.min.x, y: cell.box.min.y, z: cell.box.min.z },
      max: { x: cell.box.max.x, y: cell.box.max.y, z: cell.box.max.z },
      size: { x: size.x, y: size.y, z: size.z },
      center: { x: center.x, y: center.y, z: center.z }
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${cell.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

function toggleWireframe() {
  state.wireframe = !state.wireframe;
  ui.toggleWireframe.classList.toggle('active', state.wireframe);
  if (state.modelRoot) state.modelRoot.traverse(obj => {
    if (obj.isMesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => { m.wireframe = state.wireframe; m.needsUpdate = true; });
    }
  });
  state.segmentGroup.traverse(obj => { if (obj.isMesh) { obj.material.wireframe = state.wireframe; obj.material.needsUpdate = true; } });
}

ui.segmentBtn.addEventListener('click', buildSegments);
ui.viewOriginal.addEventListener('click', () => setViewMode('original'));
ui.viewSegments.addEventListener('click', () => setViewMode('segments'));
ui.showGrid.addEventListener('change', () => { state.gridHelper.visible = state.mode === 'segments' && ui.showGrid.checked; });
ui.colorRegions.addEventListener('change', applyRegionColors);
ui.clearSelected.addEventListener('click', clearSelection);
ui.focusSelected.addEventListener('click', () => {
  if (state.selectedCellId) fitCameraToBox(state.cells.get(state.selectedCellId).box, 1.7);
});
ui.exportJson.addEventListener('click', exportSelectedJSON);
ui.toggleWireframe.addEventListener('click', toggleWireframe);
ui.resetView.addEventListener('click', () => fitCameraToBox(state.modelBox));
renderer.domElement.addEventListener('pointerdown', onPointerDown);
ui.gridPreset.addEventListener('change', () => { if (state.segmented) setStatus('غيّرت دقة الشبكة. اضغط «إنشاء المناطق» لإعادة التقسيم.'); });
ui.modelFile.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!/\.(glb|gltf)$/i.test(file.name)) {
    setStatus('هذه النسخة تدعم GLB/GLTF في التحميل المباشر.');
    return;
  }
  const url = URL.createObjectURL(file);
  try { await loadGLB(url, file.name, file.size); }
  catch (err) { console.error(err); setStatus('تعذر قراءة الملف المحدد.'); }
  finally { URL.revokeObjectURL(url); }
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

resize();
animate();
loadDefaultModel();
