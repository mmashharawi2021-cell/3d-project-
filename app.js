import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const APP_VERSION = 'V5.4.0';

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
  modelFile: $('model-file'), viewSemantic: $('view-semantic'),
  semanticBtn: $('semantic-btn'), semanticState: $('semantic-state'),
  semanticProgressWrap: $('semantic-progress-wrap'), semanticProgressBar: $('semantic-progress-bar'),
  semanticProgressLabel: $('semantic-progress-label'), semanticLegend: $('semantic-legend'),
  exportTraining: $('export-training'), manualClass: $('manual-class'),
  applyManualLabel: $('apply-manual-label'), autoClassRow: $('auto-class-row'),
  autoClass: $('auto-class'), autoConfidence: $('auto-confidence'),
  semanticDiagnostics: $('semantic-diagnostics'), diagBins: $('diag-bins'),
  diagComponents: $('diag-components'), diagCleaned: $('diag-cleaned'),
  diagRoughness: $('diag-roughness'), appVersion: $('app-version'),
  semanticFilterActions: $('semantic-filter-actions'),
  showAllSemantic: $('show-all-semantic'), hideAllSemantic: $('hide-all-semantic'),
  semanticClassPanel: $('semantic-class-panel'), selectedClassBadge: $('selected-class-badge'),
  classTriangles: $('class-triangles'), classPercent: $('class-percent'),
  classRegions: $('class-regions'), classVisibleState: $('class-visible-state'),
  soloSelectedClass: $('solo-selected-class'), restoreSemanticView: $('restore-semantic-view'),
  exportClassJson: $('export-class-json'), exportClassObj: $('export-class-obj'),
  clearClassSelection: $('clear-class-selection'),
  viewAi: $('view-ai'), aiState: $('ai-state'), aiModel: $('ai-model'),
  aiPoints: $('ai-points'), aiAgreement: $('ai-agreement'), aiConfidence: $('ai-confidence'),
  gtMode: $('gt-mode'), gtClass: $('gt-class'), gtRadius: $('gt-radius'),
  gtCountBadge: $('gt-count-badge'), gtCount: $('gt-count'),
  gtTrainedCount: $('gt-trained-count'), gtValidation: $('gt-validation'),
  gtLast: $('gt-last'), gtUndo: $('gt-undo'), gtExport: $('gt-export'),
  gtImport: $('gt-import'), gtClear: $('gt-clear'),
  analysisState: $('analysis-state'), dimY: $('dim-y'), planEnvelope: $('plan-envelope'),
  modelDiagonal: $('model-diagonal'), measurementCount: $('measurement-count'),
  measureMode: $('measure-mode'), measureTool: $('measure-tool'),
  clearMeasurements: $('clear-measurements'), exportAnalysisReport: $('export-analysis-report'),
  measurementCurrent: $('measurement-current'), measurementStep: $('measurement-step'),
  measurementValue: $('measurement-value'), measurementDetails: $('measurement-details'),
  measurementHistory: $('measurement-history'), activePlanLabel: $('active-plan-label'), authEntry: $('auth-entry')
};

if (ui.appVersion) ui.appVersion.textContent = APP_VERSION;
const savedPlan = (() => {
  try { return localStorage.getItem('gaza3d_plan') || 'free'; }
  catch { return 'free'; }
})();
const PLAN_LABELS = { free: 'Free', pro: 'Pro', pro_plus: 'Pro+', business: 'Business' };
if (ui.activePlanLabel) ui.activePlanLabel.textContent = PLAN_LABELS[savedPlan] || 'Free';
const savedSession = (() => {
  try { return JSON.parse(localStorage.getItem('gaza3d_session') || 'null'); }
  catch { return null; }
})();
if (ui.authEntry && savedSession?.email) {
  const display = savedSession.name || savedSession.email.split('@')[0] || 'الحساب';
  ui.authEntry.textContent = display.length > 14 ? display.slice(0, 14) + '…' : display;
  ui.authEntry.href = './login.html?mode=account';
  ui.authEntry.classList.add('signed-in');
}

const state = {
  modelRoot: null,
  segmentGroup: new THREE.Group(),
  semanticGroup: new THREE.Group(),
  aiGroup: new THREE.Group(),
  gridHelper: new THREE.Group(),
  highlightGroup: new THREE.Group(),
  measurementGroup: new THREE.Group(),
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
  sourceSize: 0,
  semanticReady: false,
  semanticSummary: null,
  semanticDiagnostics: null,
  semanticMethod: 'enhanced-geometry-v4-local-ground-roughness-components',
  aiReady: false,
  aiMeta: null,
  aiPointsObject: null,
  aiDisplayPositions: null,
  aiDisplayLabels: null,
  aiFaceIndices: null,
  aiClassKeys: [],
  aiCorrections: new Map(),
  aiCorrectionHistory: [],
  aiCorrectionMode: false,
  selectedSemanticClass: null,
  semanticVisibility: {
    roof: true,
    wall: true,
    ground: true,
    debris: true,
    other: true
  },
  measurements: [],
  measureMode: false,
  measurePointA: null,
  measureDraftMarker: null
};

const SEMANTIC_CLASSES = {
  roof:   { label: 'سطح',  color: 0x42c7f5 },
  wall:   { label: 'جدار', color: 0xffb454 },
  ground: { label: 'أرض',  color: 0x69d59a },
  debris: { label: 'ركام', color: 0xf06a6a },
  other:  { label: 'أخرى', color: 0xaab9c5 }
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

scene.add(state.segmentGroup, state.semanticGroup, state.aiGroup, state.gridHelper, state.highlightGroup, state.measurementGroup);
state.segmentGroup.visible = false;
state.semanticGroup.visible = false;
state.aiGroup.visible = false;
state.gridHelper.visible = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const loader = new GLTFLoader();
const tempA = new THREE.Vector3();
const tempB = new THREE.Vector3();
const tempC = new THREE.Vector3();
const tempCentroid = new THREE.Vector3();
const tempEdge1 = new THREE.Vector3();
const tempEdge2 = new THREE.Vector3();
const tempNormal = new THREE.Vector3();
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
    await loadNeuralAIResult();
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

  state.modelRoot.traverse(obj => {
    if (!obj.isMesh) return;
    obj.frustumCulled = false;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.side = THREE.DoubleSide;
      if (mat.color) mat.color.set(0xffffff);
      mat.needsUpdate = true;
    }
  });

  state.modelRoot.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(state.modelRoot);
  const center = rawBox.getCenter(new THREE.Vector3());
  state.modelRoot.position.sub(center);
  state.modelRoot.updateMatrixWorld(true);

  state.modelBox.setFromObject(state.modelRoot);
  state.modelBox.getBoundingSphere(state.modelSphere);
  calculateModelStats();
  fitCameraToBox(state.modelBox);
  requestAnimationFrame(() => fitCameraToBox(state.modelBox));
  setTimeout(() => fitCameraToBox(state.modelBox), 350);

  ui.modelState.className = 'badge ready';
  ui.modelState.textContent = 'جاهز';
  ui.segmentBtn.disabled = false;
  ui.semanticBtn.disabled = true;
  if (ui.measureMode) ui.measureMode.disabled = false;
  if (ui.measureTool) ui.measureTool.disabled = false;
  if (ui.exportAnalysisReport) ui.exportAnalysisReport.disabled = false;
  if (ui.analysisState) { ui.analysisState.className = 'badge ready'; ui.analysisState.textContent = 'جاهز'; }
  ui.modelName.textContent = name.replace(/\.(glb|gltf)$/i, '');
  ui.modelSize.textContent = state.sourceSize ? `${(state.sourceSize / 1024 / 1024).toFixed(1)} MB` : 'ملف محلي';
  setStatus('النموذج جاهز. أنشئ التقسيم المكاني ثم اضغط على أي منطقة.');
}

function clearAIResult() {
  disposeGroup(state.aiGroup, true);
  state.aiGroup.visible = false;
  state.aiReady = false;
  state.aiMeta = null;
  state.aiPointsObject = null;
  state.aiDisplayPositions = null;
  state.aiDisplayLabels = null;
  state.aiFaceIndices = null;
  state.aiClassKeys = [];
  state.aiCorrectionMode = false;
  state.aiCorrectionHistory = [];
  controls.enabled = true;
  if (ui.gtMode) ui.gtMode.checked = false;
  if (ui.viewAi) ui.viewAi.disabled = true;
  if (ui.aiState) {
    ui.aiState.className = 'badge';
    ui.aiState.textContent = 'غير متاح';
  }
  if (ui.aiModel) ui.aiModel.textContent = '—';
  if (ui.aiPoints) ui.aiPoints.textContent = '—';
  if (ui.aiAgreement) ui.aiAgreement.textContent = '—';
  if (ui.aiConfidence) ui.aiConfidence.textContent = '—';
  updateGroundTruthUI();
}

const GT_STORAGE_KEY = 'gaza3d_ground_truth_v1';

function classColorForName(name, corrected = false) {
  const color = new THREE.Color(SEMANTIC_CLASSES[name]?.color ?? SEMANTIC_CLASSES.other.color);
  if (corrected) color.lerp(new THREE.Color(0xffffff), 0.28);
  return color;
}

function updateGroundTruthUI() {
  const count = state.aiCorrections?.size || 0;
  if (ui.gtCountBadge) ui.gtCountBadge.textContent = `${formatNumber(count)} مثلث`;
  if (ui.gtCount) ui.gtCount.textContent = formatNumber(count);
  if (ui.gtUndo) ui.gtUndo.disabled = !state.aiCorrectionHistory.length;
  if (ui.gtExport) ui.gtExport.disabled = !count;
  if (ui.gtClear) ui.gtClear.disabled = !count;

  const trained = state.aiMeta?.manual_ground_truth_total || 0;
  if (ui.gtTrainedCount) ui.gtTrainedCount.textContent = formatNumber(trained);

  const validation = state.aiMeta?.manual_ground_truth_validation;
  if (ui.gtValidation) {
    ui.gtValidation.textContent = validation?.accuracy != null
      ? `${(validation.accuracy * 100).toFixed(1)}% / ${formatNumber(validation.count)}`
      : '—';
  }
}

function saveGroundTruthLocal() {
  try {
    const payload = [...state.aiCorrections.entries()].map(([face_index, label]) => ({ face_index, label }));
    localStorage.setItem(GT_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Unable to persist ground truth locally:', err);
  }
}

function loadGroundTruthLocal() {
  state.aiCorrections.clear();
  try {
    const raw = localStorage.getItem(GT_STORAGE_KEY);
    if (!raw) {
      updateGroundTruthUI();
      return;
    }
    const items = JSON.parse(raw);
    for (const item of Array.isArray(items) ? items : []) {
      const faceIndex = Number(item.face_index);
      const label = String(item.label || '');
      if (Number.isInteger(faceIndex) && faceIndex >= 0 && SEMANTIC_CLASSES[label]) {
        state.aiCorrections.set(faceIndex, label);
      }
    }
  } catch (err) {
    console.warn('Unable to load local ground truth:', err);
  }
  refreshAICorrectionColors();
  updateGroundTruthUI();
}

function refreshAICorrectionColors() {
  const points = state.aiPointsObject;
  if (!points || !state.aiFaceIndices || !state.aiDisplayLabels) return;
  const colorAttr = points.geometry.getAttribute('color');
  if (!colorAttr) return;

  for (let i = 0; i < state.aiFaceIndices.length; i++) {
    const faceIndex = state.aiFaceIndices[i];
    const corrected = state.aiCorrections.get(faceIndex);
    const className = corrected || state.aiClassKeys[state.aiDisplayLabels[i]] || 'other';
    const color = classColorForName(className, Boolean(corrected));
    colorAttr.setXYZ(i, color.r, color.g, color.b);
  }
  colorAttr.needsUpdate = true;
}

function setAIPointColor(pointIndex, label, corrected = true) {
  const points = state.aiPointsObject;
  if (!points) return;
  const colorAttr = points.geometry.getAttribute('color');
  if (!colorAttr) return;
  const color = classColorForName(label, corrected);
  colorAttr.setXYZ(pointIndex, color.r, color.g, color.b);
  colorAttr.needsUpdate = true;
}

function applyGroundTruthFromPointer() {
  if (!state.aiPointsObject || !state.aiFaceIndices) return;

  const radius = Math.max(0, Number(ui.gtRadius?.value || 0));
  raycaster.params.Points.threshold = Math.max(radius || 0.10, 0.08);
  const hits = raycaster.intersectObject(state.aiPointsObject, false);
  if (!hits.length || hits[0].index == null) {
    setStatus('لم يتم التقاط نقطة AI. قرّب أكثر ثم اضغط على النقطة المراد تصحيحها.');
    return;
  }

  const centerIndex = hits[0].index;
  const label = ui.gtClass?.value || 'other';
  const position = state.aiPointsObject.geometry.getAttribute('position');
  const affected = [];

  if (radius <= 0) {
    affected.push(centerIndex);
  } else {
    const cx = position.getX(centerIndex);
    const cy = position.getY(centerIndex);
    const cz = position.getZ(centerIndex);
    const r2 = radius * radius;

    for (let i = 0; i < position.count; i++) {
      const dx = position.getX(i) - cx;
      const dy = position.getY(i) - cy;
      const dz = position.getZ(i) - cz;
      if (dx * dx + dy * dy + dz * dz <= r2) affected.push(i);
    }
  }

  const history = [];
  let changed = 0;
  for (const pointIndex of affected) {
    const faceIndex = Number(state.aiFaceIndices[pointIndex]);
    const previous = state.aiCorrections.has(faceIndex) ? state.aiCorrections.get(faceIndex) : null;
    if (previous === label) continue;
    history.push({ faceIndex, previous });
    state.aiCorrections.set(faceIndex, label);
    setAIPointColor(pointIndex, label, true);
    changed++;
  }

  if (!changed) {
    setStatus('هذه النقاط تحمل بالفعل نفس Ground Truth.');
    return;
  }

  state.aiCorrectionHistory.push(history);
  if (ui.gtLast) ui.gtLast.textContent = `${SEMANTIC_CLASSES[label]?.label || label} · ${formatNumber(changed)}`;
  saveGroundTruthLocal();
  updateGroundTruthUI();
  setStatus(`تم تصحيح ${formatNumber(changed)} مثلث إلى «${SEMANTIC_CLASSES[label]?.label || label}».`);
}

function undoGroundTruth() {
  const history = state.aiCorrectionHistory.pop();
  if (!history) return;

  for (const item of history) {
    if (item.previous == null) state.aiCorrections.delete(item.faceIndex);
    else state.aiCorrections.set(item.faceIndex, item.previous);
  }

  refreshAICorrectionColors();
  saveGroundTruthLocal();
  updateGroundTruthUI();
  if (ui.gtLast) ui.gtLast.textContent = 'تراجع';
  setStatus('تم التراجع عن آخر تصحيح Ground Truth.');
}

function exportGroundTruth() {
  if (!state.aiCorrections.size) return;

  const corrections = [...state.aiCorrections.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([face_index, label]) => ({ face_index, label, source: 'human' }));

  const payload = {
    schema: 'gaza-3d-ground-truth/v1',
    created_at: new Date().toISOString(),
    app_version: APP_VERSION,
    model: state.sourceName,
    classes: state.aiClassKeys,
    correction_count: corrections.length,
    corrections
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'manual_corrections.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  setStatus('تم تصدير Ground Truth. ارفعه إلى ai/ground_truth/manual_corrections.json لإعادة تدريب PointNet تلقائيًا.');
}

async function importGroundTruthFile(file) {
  const payload = JSON.parse(await file.text());
  if (payload?.schema !== 'gaza-3d-ground-truth/v1' || !Array.isArray(payload.corrections)) {
    throw new Error('Unsupported Ground Truth schema');
  }

  state.aiCorrections.clear();
  for (const item of payload.corrections) {
    const faceIndex = Number(item.face_index);
    const label = String(item.label || '');
    if (Number.isInteger(faceIndex) && faceIndex >= 0 && SEMANTIC_CLASSES[label]) {
      state.aiCorrections.set(faceIndex, label);
    }
  }

  state.aiCorrectionHistory = [];
  refreshAICorrectionColors();
  saveGroundTruthLocal();
  updateGroundTruthUI();
  if (ui.gtLast) ui.gtLast.textContent = 'استيراد';
  setStatus(`تم استيراد ${formatNumber(state.aiCorrections.size)} تصحيح Ground Truth.`);
}

async function loadNeuralAIResult() {
  clearAIResult();
  if (ui.aiState) {
    ui.aiState.className = 'badge loading';
    ui.aiState.textContent = 'جارٍ التحميل';
  }

  try {
    const metaResponse = await fetch('./ai/output/gaza_ai_meta.json', { cache: 'no-store' });
    if (!metaResponse.ok) throw new Error(`AI metadata HTTP ${metaResponse.status}`);
    const meta = await metaResponse.json();

    const [posResponse, labelResponse, faceIndexResponse] = await Promise.all([
      fetch('./ai/output/gaza_ai_points.f32', { cache: 'no-store' }),
      fetch('./ai/output/gaza_ai_points_labels.u8', { cache: 'no-store' }),
      fetch('./ai/output/gaza_ai_points_face_index.u32', { cache: 'no-store' })
    ]);
    if (!posResponse.ok || !labelResponse.ok || !faceIndexResponse.ok) throw new Error('AI binary result is incomplete');

    const positions = new Float32Array(await posResponse.arrayBuffer());
    const labels = new Uint8Array(await labelResponse.arrayBuffer());
    const faceIndices = new Uint32Array(await faceIndexResponse.arrayBuffer());
    const pointCount = Math.floor(positions.length / 3);
    if (pointCount !== labels.length || pointCount !== faceIndices.length) {
      throw new Error(`AI point/label/index mismatch: ${pointCount} / ${labels.length} / ${faceIndices.length}`);
    }

    const colors = new Float32Array(pointCount * 3);
    const classKeys = meta.classes || Object.keys(SEMANTIC_CLASSES);
    const color = new THREE.Color();

    for (let i = 0; i < pointCount; i++) {
      const key = classKeys[labels[i]] || 'other';
      color.setHex(SEMANTIC_CLASSES[key]?.color ?? SEMANTIC_CLASSES.other.color);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    const material = new THREE.PointsMaterial({
      size: Math.max((state.modelSphere.radius || 20) * 0.006, 0.035),
      vertexColors: true,
      sizeAttenuation: true,
      transparent: false
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.userData.aiResult = true;
    state.aiGroup.add(points);

    state.aiMeta = meta;
    state.aiReady = true;
    state.aiPointsObject = points;
    state.aiDisplayPositions = positions;
    state.aiDisplayLabels = labels;
    state.aiFaceIndices = faceIndices;
    state.aiClassKeys = classKeys;
    state.aiGroup.visible = false;
    ui.viewAi.disabled = false;

    ui.aiState.className = 'badge ready';
    ui.aiState.textContent = 'PointNet جاهز';
    ui.aiModel.textContent = meta.model || 'PointNet';
    ui.aiPoints.textContent = formatNumber(meta.display_point_count || pointCount);
    ui.aiAgreement.textContent = meta.agreement_with_bootstrap_labels != null
      ? `${(meta.agreement_with_bootstrap_labels * 100).toFixed(1)}%`
      : '—';
    ui.aiConfidence.textContent = meta.mean_confidence != null
      ? `${(meta.mean_confidence * 100).toFixed(1)}%`
      : '—';

    loadGroundTruthLocal();
    updateGroundTruthUI();
    setStatus('تم تحميل نتيجة PointNet العصبية. استخدم تبويب AI، ويمكنك الآن إنشاء Ground Truth على مستوى المثلثات.');
  } catch (err) {
    console.warn('Neural AI result is not available yet:', err);
    if (ui.aiState) {
      ui.aiState.className = 'badge';
      ui.aiState.textContent = 'قيد التدريب';
    }
    if (ui.viewAi) ui.viewAi.disabled = true;
  }
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
  if (ui.dimY) ui.dimY.textContent = formatDim(size.y);
  if (ui.planEnvelope) ui.planEnvelope.textContent = `${(size.x * size.z).toFixed(2)} وحدة²`;
  if (ui.modelDiagonal) ui.modelDiagonal.textContent = formatDim(size.length());
}

function clearCurrentModel() {
  clearMeasurements();
  clearAIResult();
  clearSemanticResults();
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
      if (obj.isMesh || obj.isLineSegments || obj.isPoints) {
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
  ui.semanticBtn.disabled = true;
  clearSemanticResults();
  setViewMode('original');
}

async function buildSegments() {
  if (!state.modelRoot) return;
  clearSemanticResults();
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
          meshes: [],
          semanticCounts: {},
          dominantClass: null,
          confidence: 0,
          manualLabel: ''
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
  ui.semanticBtn.disabled = false;
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
  const sem = mode === 'semantic' && state.semanticReady;
  const ai = mode === 'ai' && state.aiReady;
  const original = !seg && !sem && !ai;
  if (state.modelRoot) state.modelRoot.visible = original;
  state.segmentGroup.visible = seg;
  state.semanticGroup.visible = sem;
  state.aiGroup.visible = ai;
  state.gridHelper.visible = (seg || sem) && ui.showGrid.checked;
  state.highlightGroup.visible = seg || sem;
  controls.enabled = !state.measureMode && !(ai && state.aiCorrectionMode);
  ui.viewOriginal.classList.toggle('active', original);
  ui.viewSegments.classList.toggle('active', seg);
  ui.viewSemantic.classList.toggle('active', sem);
  ui.viewAi?.classList.toggle('active', ai);
}

function clearSelection() {
  state.selectedCellId = null;
  disposeGroup(state.highlightGroup, false);
  ui.selectedId.textContent = 'لا يوجد';
  ui.selectionEmpty.classList.remove('hidden');
  ui.selectionData.classList.add('hidden');
  ui.autoClassRow.classList.add('hidden');
  ui.manualClass.value = '';
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
  ui.manualClass.value = cell.manualLabel || '';
  if (cell.dominantClass) {
    ui.autoClassRow.classList.remove('hidden');
    ui.autoClass.textContent = SEMANTIC_CLASSES[cell.dominantClass]?.label || cell.dominantClass;
    ui.autoConfidence.textContent = `ثقة V4.2 تقريبية: ${(cell.confidence * 100).toFixed(1)}%`;
  } else {
    ui.autoClassRow.classList.add('hidden');
  }
  ui.selectionEmpty.classList.add('hidden');
  ui.selectionData.classList.remove('hidden');
  $('selection-panel').classList.remove('muted');
  setStatus(`تم تحديد المنطقة ${id} — ${formatNumber(cell.triangles)} مثلث.`);
}

function cellIdFromPoint(point) {
  const [cols, rows] = ui.gridPreset.value.split('x').map(Number);
  const min = state.modelBox.min, max = state.modelBox.max;
  const dx = Math.max(max.x - min.x, 1e-8);
  const dz = Math.max(max.z - min.z, 1e-8);
  let col = Math.floor(((point.x - min.x) / dx) * cols);
  let row = Math.floor(((point.z - min.z) / dz) * rows);
  col = THREE.MathUtils.clamp(col, 0, cols - 1);
  row = THREE.MathUtils.clamp(row, 0, rows - 1);
  return `R${String(row + 1).padStart(2, '0')}-C${String(col + 1).padStart(2, '0')}`;
}

function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  if (state.measureMode) {
    event.preventDefault();
    applyMeasurementFromPointer();
    return;
  }

  if (state.mode === 'ai' && state.aiReady && state.aiCorrectionMode) {
    event.preventDefault();
    applyGroundTruthFromPointer();
    return;
  }

  if (!state.segmented || (state.mode !== 'segments' && state.mode !== 'semantic')) return;

  if (state.mode === 'segments') {
    const hits = raycaster.intersectObjects(state.segmentGroup.children, false);
    if (hits.length) selectCell(hits[0].object.userData.cellId);
    return;
  }

  const hits = raycaster.intersectObjects(state.semanticGroup.children, false)
    .filter(hit => hit.object.visible);
  if (hits.length) {
    const id = cellIdFromPoint(hits[0].point);
    if (state.cells.has(id)) selectCell(id);
  }
}

function updateCameraClipping() {
  if (!state.modelRoot) return;
  const radius = Math.max(state.modelSphere.radius || 1, 0.001);
  const distance = Math.max(camera.position.distanceTo(controls.target), 0.001);

  // Keep the near plane tiny while zooming so façades and roofs do not disappear.
  const desiredNear = Math.max(0.002, Math.min(radius * 0.0015, distance * 0.004));
  const desiredFar = Math.max(distance + radius * 24, radius * 40, 500);

  if (
    Math.abs(camera.near - desiredNear) / Math.max(camera.near, 0.001) > 0.08 ||
    Math.abs(camera.far - desiredFar) / Math.max(camera.far, 1) > 0.08
  ) {
    camera.near = desiredNear;
    camera.far = desiredFar;
    camera.updateProjectionMatrix();
  }
}

function fitCameraToBox(box, padding = 1.18) {
  if (!box || box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.001);

  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const safeAspect = Math.max(camera.aspect, 0.05);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * safeAspect);
  const limitingFov = Math.max(Math.min(vFov, hFov), THREE.MathUtils.degToRad(8));
  const distance = (radius / Math.sin(limitingFov / 2)) * padding;

  const direction = new THREE.Vector3(0.78, 0.92, 1).normalize();
  camera.up.set(0, 1, 0);
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.lookAt(center);

  controls.target.copy(center);
  controls.minDistance = radius * 0.025;
  controls.maxDistance = distance * 5;
  controls.update();

  updateCameraClipping();
}


function formatMeasure(n) {
  return `${Number(n || 0).toFixed(3)} وحدة`;
}

function makeMeasurementMarker(point, draft = false) {
  const radius = Math.max((state.modelSphere.radius || 1) * 0.007, 0.012);
  const geometry = new THREE.SphereGeometry(radius, 12, 8);
  const material = new THREE.MeshBasicMaterial({
    color: draft ? 0xffc86b : 0x5cd7ff,
    depthTest: false,
    transparent: true,
    opacity: 0.95
  });
  const marker = new THREE.Mesh(geometry, material);
  marker.position.copy(point);
  marker.renderOrder = 30;
  state.measurementGroup.add(marker);
  return marker;
}

function removeDraftMeasurementMarker() {
  const marker = state.measureDraftMarker;
  if (!marker) return;
  state.measurementGroup.remove(marker);
  marker.geometry?.dispose?.();
  marker.material?.dispose?.();
  state.measureDraftMarker = null;
}

function renderMeasurementHistory() {
  if (!ui.measurementHistory) return;
  if (ui.measurementCount) ui.measurementCount.textContent = formatNumber(state.measurements.length);
  if (ui.clearMeasurements) ui.clearMeasurements.disabled = state.measurements.length === 0;

  if (!state.measurements.length) {
    ui.measurementHistory.innerHTML = '<div class="measurement-empty">لا توجد قياسات محفوظة بعد.</div>';
    return;
  }

  ui.measurementHistory.innerHTML = state.measurements.slice().reverse().map(item => `
    <div class="measurement-row">
      <b>${item.id}</b>
      <span>${formatMeasure(item.distance3d)}</span>
      <small>H ${item.horizontal.toFixed(3)} · ΔY ${item.deltaY.toFixed(3)}</small>
    </div>
  `).join('');
}

function setMeasurementMode(enabled) {
  if (!state.modelRoot && enabled) return;
  state.measureMode = Boolean(enabled);
  state.measurePointA = null;
  removeDraftMeasurementMarker();

  ui.measureMode?.classList.toggle('measure-active', state.measureMode);
  ui.measureTool?.classList.toggle('measure-active', state.measureMode);
  if (ui.measureMode) ui.measureMode.textContent = state.measureMode ? 'إنهاء وضع القياس' : 'بدء قياس نقطتين';

  if (ui.measurementCurrent) {
    ui.measurementCurrent.classList.toggle('hidden', !state.measureMode);
  }
  if (ui.measurementStep) ui.measurementStep.textContent = 'اختر النقطة الأولى من سطح النموذج';
  if (ui.measurementValue) ui.measurementValue.textContent = '—';
  if (ui.measurementDetails) ui.measurementDetails.textContent = 'المسافة 3D · المسافة الأفقية · فرق الارتفاع';

  controls.enabled = !state.measureMode && !(state.mode === 'ai' && state.aiCorrectionMode);
  renderer.domElement.style.cursor = state.measureMode ? 'crosshair' : '';

  if (state.measureMode) {
    if (state.aiCorrectionMode && ui.gtMode) {
      state.aiCorrectionMode = false;
      ui.gtMode.checked = false;
    }
    setStatus('وضع القياس V5.2 مفعّل: اختر نقطتين على سطح الـMesh.');
  } else {
    setStatus('تم إنهاء وضع القياس.');
  }
}

function completeMeasurement(pointB) {
  const pointA = state.measurePointA;
  if (!pointA) return;

  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const dz = pointB.z - pointA.z;
  const horizontal = Math.hypot(dx, dz);
  const distance3d = pointA.distanceTo(pointB);
  const id = `M${String(state.measurements.length + 1).padStart(2, '0')}`;

  if (state.measureDraftMarker) {
    state.measureDraftMarker.material.color.setHex(0x5cd7ff);
    state.measureDraftMarker = null;
  }
  makeMeasurementMarker(pointB, false);

  const geometry = new THREE.BufferGeometry().setFromPoints([pointA, pointB]);
  const material = new THREE.LineBasicMaterial({
    color: 0x5cd7ff,
    depthTest: false,
    transparent: true,
    opacity: 0.95
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 29;
  line.userData.measurementId = id;
  state.measurementGroup.add(line);

  state.measurements.push({
    id,
    distance3d,
    horizontal,
    deltaY: dy,
    a: { x: pointA.x, y: pointA.y, z: pointA.z },
    b: { x: pointB.x, y: pointB.y, z: pointB.z }
  });

  if (ui.measurementStep) ui.measurementStep.textContent = `${id} محفوظ — اختر النقطة الأولى للقياس التالي`;
  if (ui.measurementValue) ui.measurementValue.textContent = formatMeasure(distance3d);
  if (ui.measurementDetails) ui.measurementDetails.textContent =
    `أفقي ${horizontal.toFixed(3)} وحدة · ΔY ${dy.toFixed(3)} وحدة`;

  state.measurePointA = null;
  renderMeasurementHistory();
  setStatus(`${id}: المسافة ثلاثية الأبعاد ${formatMeasure(distance3d)}، أفقية ${horizontal.toFixed(3)}، فرق الارتفاع ${dy.toFixed(3)}.`);
}

function applyMeasurementFromPointer() {
  if (!state.modelRoot) return;
  state.modelRoot.updateMatrixWorld(true);
  const hits = raycaster.intersectObject(state.modelRoot, true)
    .filter(hit => hit.object?.isMesh);

  if (!hits.length) {
    setStatus('لم يتم التقاط سطح. اضغط مباشرة على الـMesh.');
    return;
  }

  const point = hits[0].point.clone();
  if (!state.measurePointA) {
    state.measurePointA = point;
    removeDraftMeasurementMarker();
    state.measureDraftMarker = makeMeasurementMarker(point, true);
    if (ui.measurementStep) ui.measurementStep.textContent = 'النقطة الأولى محفوظة — اختر النقطة الثانية';
    if (ui.measurementValue) ui.measurementValue.textContent = 'P1';
    if (ui.measurementDetails) ui.measurementDetails.textContent =
      `X ${point.x.toFixed(3)} · Y ${point.y.toFixed(3)} · Z ${point.z.toFixed(3)}`;
    setStatus('تم تثبيت النقطة الأولى. اختر النقطة الثانية.');
    return;
  }

  completeMeasurement(point);
}

function clearMeasurements() {
  state.measurements = [];
  state.measurePointA = null;
  state.measureMode = false;
  state.measureDraftMarker = null;
  disposeGroup(state.measurementGroup, true);
  if (ui.measureMode) {
    ui.measureMode.classList.remove('measure-active');
    ui.measureMode.textContent = 'بدء قياس نقطتين';
  }
  ui.measureTool?.classList.remove('measure-active');
  if (ui.measurementCurrent) ui.measurementCurrent.classList.add('hidden');
  if (ui.measurementValue) ui.measurementValue.textContent = '—';
  if (ui.measurementDetails) ui.measurementDetails.textContent = '—';
  renderer.domElement.style.cursor = '';
  controls.enabled = !(state.mode === 'ai' && state.aiCorrectionMode);
  renderMeasurementHistory();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function exportAnalysisReport() {
  if (!state.modelRoot) return;
  const size = state.modelBox.getSize(new THREE.Vector3());
  const diagonal = size.length();
  const rows = state.measurements.length
    ? state.measurements.map(m => `
      <tr>
        <td>${m.id}</td>
        <td>${m.distance3d.toFixed(3)}</td>
        <td>${m.horizontal.toFixed(3)}</td>
        <td>${m.deltaY.toFixed(3)}</td>
        <td>${m.a.x.toFixed(3)}, ${m.a.y.toFixed(3)}, ${m.a.z.toFixed(3)}</td>
        <td>${m.b.x.toFixed(3)}, ${m.b.y.toFixed(3)}, ${m.b.z.toFixed(3)}</td>
      </tr>`).join('')
    : '<tr><td colspan="6">لا توجد قياسات محفوظة.</td></tr>';

  const semanticRows = state.semanticReady && state.semanticSummary
    ? Object.entries(state.semanticSummary).map(([key, count]) =>
        `<li>${escapeHtml(SEMANTIC_CLASSES[key]?.label || key)}: ${formatNumber(count)} مثلث</li>`
      ).join('')
    : '<li>لم يتم تشغيل التحليل الدلالي في هذه الجلسة.</li>';

  const aiSummary = state.aiReady && state.aiMeta
    ? `<p>النموذج العصبي: <strong>${escapeHtml(state.aiMeta.model || state.aiMeta.model_name || 'PointNet')}</strong></p>
       <p>متوسط الثقة: <strong>${state.aiMeta.mean_confidence != null ? (state.aiMeta.mean_confidence * 100).toFixed(1) + '%' : '—'}</strong></p>`
    : '<p>لا توجد نتيجة AI محملة في هذه الجلسة.</p>';

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>Gaza 3D GIS Lab — تقرير التحليل</title>
<style>
body{font-family:Arial,Tahoma,sans-serif;max-width:1100px;margin:32px auto;padding:0 24px;color:#14202a;line-height:1.7}
h1,h2{color:#0b5f7d} .meta{color:#516673;font-size:13px}.warn{padding:12px 14px;background:#fff4d8;border:1px solid #efd28c;border-radius:10px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.card{padding:12px;border:1px solid #d8e4ea;border-radius:10px}.card span{display:block;color:#6b7d86;font-size:12px}.card strong{font-size:16px}
table{width:100%;border-collapse:collapse;font-size:12px;direction:ltr}th,td{border:1px solid #d8e4ea;padding:7px;text-align:center}th{background:#eef7fa}
@media(max-width:700px){.grid{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>
<h1>Gaza 3D GIS Lab — تقرير التحليل الهندسي</h1>
<p class="meta">الإصدار: ${APP_VERSION} · التاريخ: ${new Date().toLocaleString('ar-EG')} · النموذج: ${escapeHtml(state.sourceName)}</p>
<p class="warn">تنبيه: هذه القياسات بوحدات النموذج المحلية وليست أمتارًا أو إحداثيات GIS حتى تتم معايرة المقياس وإضافة المرجعية المكانية.</p>
<h2>ملخص النموذج</h2>
<div class="grid">
  <div class="card"><span>المثلثات</span><strong>${formatNumber(state.totalTriangles)}</strong></div>
  <div class="card"><span>Meshes</span><strong>${formatNumber(state.totalMeshes)}</strong></div>
  <div class="card"><span>الأبعاد X × Y × Z</span><strong>${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}</strong></div>
  <div class="card"><span>قطر 3D</span><strong>${diagonal.toFixed(3)}</strong></div>
  <div class="card"><span>الغلاف الأفقي X×Z</span><strong>${(size.x * size.z).toFixed(3)} وحدة²</strong></div>
  <div class="card"><span>عدد القياسات</span><strong>${formatNumber(state.measurements.length)}</strong></div>
</div>
<h2>القياسات</h2>
<table>
<thead><tr><th>ID</th><th>3D</th><th>Horizontal</th><th>ΔY</th><th>Point A</th><th>Point B</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<h2>التحليل الدلالي</h2>
<ul>${semanticRows}</ul>
<h2>الذكاء الاصطناعي</h2>
${aiSummary}
</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gaza_3d_analysis_${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  setStatus('تم تصدير تقرير التحليل الهندسي بصيغة HTML.');
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
    semantic_prediction: cell.dominantClass ? {
      class: cell.dominantClass,
      label_ar: SEMANTIC_CLASSES[cell.dominantClass]?.label || cell.dominantClass,
      confidence: Number(cell.confidence.toFixed(4)),
      counts: cell.semanticCounts
    } : null,
    manual_training_label: cell.manualLabel || null,
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

function clearSemanticResults() {
  disposeGroup(state.semanticGroup, true);
  state.semanticGroup.visible = false;
  state.semanticReady = false;
  state.semanticSummary = null;
  state.semanticDiagnostics = null;
  ui.viewSemantic.disabled = true;
  ui.exportTraining.disabled = true;
  ui.semanticLegend.innerHTML = '';
  ui.semanticLegend.classList.add('hidden');
  state.selectedSemanticClass = null;
  ui.semanticClassPanel?.classList.add('hidden');
  ui.semanticFilterActions?.classList.add('hidden');
  ui.semanticDiagnostics.classList.add('hidden');
  ui.semanticState.className = 'badge';
  ui.semanticState.textContent = 'لم يبدأ';
  for (const cell of state.cells.values()) {
    cell.semanticCounts = {};
    cell.dominantClass = null;
    cell.confidence = 0;
  }
}

function fineGridIndexFromPoint(point, cols, rows) {
  const min = state.modelBox.min, max = state.modelBox.max;
  const dx = Math.max(max.x - min.x, 1e-8);
  const dz = Math.max(max.z - min.z, 1e-8);
  let col = Math.floor(((point.x - min.x) / dx) * cols);
  let row = Math.floor(((point.z - min.z) / dz) * rows);
  col = THREE.MathUtils.clamp(col, 0, cols - 1);
  row = THREE.MathUtils.clamp(row, 0, rows - 1);
  return row * cols + col;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = THREE.MathUtils.clamp(Math.floor((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[idx];
}

function solve3x3(A, b) {
  const m = [
    [A[0], A[1], A[2], b[0]],
    [A[3], A[4], A[5], b[1]],
    [A[6], A[7], A[8], b[2]]
  ];
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-10) return [0, 0, b[2] / Math.max(A[8], 1)];
    if (pivot !== col) [m[pivot], m[col]] = [m[col], m[pivot]];

    const div = m[col][col];
    for (let j = col; j < 4; j++) m[col][j] /= div;

    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const factor = m[r][col];
      for (let j = col; j < 4; j++) m[r][j] -= factor * m[col][j];
    }
  }
  return [m[0][3], m[1][3], m[2][3]];
}

function fitGroundPlane(seedIndices, lowY, cols, rows) {
  const min = state.modelBox.min, max = state.modelBox.max;
  const dx = (max.x - min.x) / cols;
  const dz = (max.z - min.z) / rows;

  let sxx = 0, sxz = 0, sx = 0;
  let szz = 0, sz = 0, n = 0;
  let sxy = 0, szy = 0, sy = 0;

  for (const idx of seedIndices) {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const x = min.x + (col + 0.5) * dx;
    const z = min.z + (row + 0.5) * dz;
    const y = lowY[idx];
    if (!Number.isFinite(y)) continue;

    sxx += x * x;
    sxz += x * z;
    sx += x;
    szz += z * z;
    sz += z;
    sxy += x * y;
    szy += z * y;
    sy += y;
    n++;
  }

  if (n < 3) {
    const fallback = n ? sy / n : state.modelBox.min.y;
    return [0, 0, fallback];
  }

  return solve3x3(
    [sxx, sxz, sx, sxz, szz, sz, sx, sz, n],
    [sxy, szy, sy]
  );
}

function findGroundComponents(candidate, lowY, cols, rows) {
  const n = cols * rows;
  const visited = new Uint8Array(n);
  const components = [];
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let start = 0; start < n; start++) {
    if (!candidate[start] || visited[start]) continue;

    const queue = [start];
    visited[start] = 1;
    const cells = [];
    let touchesBorder = false;

    for (let qi = 0; qi < queue.length; qi++) {
      const idx = queue[qi];
      cells.push(idx);
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      if (row === 0 || col === 0 || row === rows - 1 || col === cols - 1) touchesBorder = true;

      for (const [dc, dr] of neighbors) {
        const nc = col + dc, nr = row + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = nr * cols + nc;
        if (!candidate[ni] || visited[ni]) continue;

        const a = lowY[idx], b = lowY[ni];
        const h = Math.max(state.modelBox.max.y - state.modelBox.min.y, 1e-8);
        if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > h * 0.065) continue;

        visited[ni] = 1;
        queue.push(ni);
      }
    }

    components.push({ cells, touchesBorder });
  }

  components.sort((a, b) => b.cells.length - a.cells.length);
  return components;
}

async function buildLocalSurfaceContext(sourceMeshes) {
  const fineCols = 30;
  const fineRows = 30;
  const fineCount = fineCols * fineRows;
  const sampleK = 5;

  const counts = new Uint32Array(fineCount);
  const sumY = new Float64Array(fineCount);
  const sumY2 = new Float64Array(fineCount);
  const horizontalCounts = new Uint32Array(fineCount);
  const lowSamples = new Float32Array(fineCount * sampleK);
  lowSamples.fill(Infinity);

  let processed = 0;

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

      tempEdge1.subVectors(tempB, tempA);
      tempEdge2.subVectors(tempC, tempA);
      tempNormal.crossVectors(tempEdge1, tempEdge2);
      const horizontal = tempNormal.lengthSq() > 1e-12 ? Math.abs(tempNormal.normalize().y) : 0;

      const gi = fineGridIndexFromPoint(tempCentroid, fineCols, fineRows);
      const y = tempCentroid.y;
      counts[gi]++;
      sumY[gi] += y;
      sumY2[gi] += y * y;
      if (horizontal >= 0.62) horizontalCounts[gi]++;

      const base = gi * sampleK;
      if (y < lowSamples[base + sampleK - 1]) {
        let insert = sampleK - 1;
        while (insert > 0 && y < lowSamples[base + insert - 1]) {
          lowSamples[base + insert] = lowSamples[base + insert - 1];
          insert--;
        }
        lowSamples[base + insert] = y;
      }

      processed++;
      if (processed % 22000 === 0) {
        const pct = Math.min(28, Math.round((processed / state.totalTriangles) * 28));
        ui.semanticProgressBar.style.width = `${pct}%`;
        ui.semanticProgressLabel.textContent = `${pct}%`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  const lowY = new Float64Array(fineCount);
  const roughness = new Float32Array(fineCount);
  const horizontalRatio = new Float32Array(fineCount);
  lowY.fill(NaN);

  const finiteLows = [];
  const modelHeight = Math.max(state.modelBox.max.y - state.modelBox.min.y, 1e-8);

  for (let i = 0; i < fineCount; i++) {
    if (!counts[i]) continue;

    let lowSum = 0, lowN = 0;
    const base = i * sampleK;
    for (let k = 0; k < sampleK; k++) {
      const v = lowSamples[base + k];
      if (!Number.isFinite(v)) continue;
      lowSum += v;
      lowN++;
    }
    if (lowN) {
      lowY[i] = lowSum / lowN;
      finiteLows.push(lowY[i]);
    }

    const mean = sumY[i] / counts[i];
    const variance = Math.max(0, sumY2[i] / counts[i] - mean * mean);
    roughness[i] = Math.sqrt(variance) / modelHeight;
    horizontalRatio[i] = horizontalCounts[i] / counts[i];
  }

  const p35 = percentile(finiteLows, 0.35);
  const p50 = percentile(finiteLows, 0.50);
  const candidate = new Uint8Array(fineCount);

  for (let i = 0; i < fineCount; i++) {
    if (!Number.isFinite(lowY[i])) continue;
    const lowEnough = lowY[i] <= p35 + modelHeight * 0.055;
    const surfaceLike = horizontalRatio[i] >= 0.24 || roughness[i] <= 0.11;
    if (lowEnough && surfaceLike) candidate[i] = 1;
  }

  const components = findGroundComponents(candidate, lowY, fineCols, fineRows);
  const groundMask = new Uint8Array(fineCount);
  const seedIndices = [];

  for (let ci = 0; ci < components.length; ci++) {
    const comp = components[ci];
    const keep = comp.touchesBorder || ci === 0 || comp.cells.length >= 8;
    if (!keep) continue;
    for (const idx of comp.cells) {
      groundMask[idx] = 1;
      seedIndices.push(idx);
    }
  }

  if (seedIndices.length < 6) {
    const fallback = [];
    for (let i = 0; i < fineCount; i++) {
      if (Number.isFinite(lowY[i]) && lowY[i] <= p50) fallback.push(i);
    }
    seedIndices.splice(0, seedIndices.length, ...fallback);
    for (const idx of fallback) groundMask[idx] = 1;
  }

  const plane = fitGroundPlane(seedIndices, lowY, fineCols, fineRows);
  const groundY = new Float64Array(fineCount);
  const min = state.modelBox.min, max = state.modelBox.max;
  const stepX = (max.x - min.x) / fineCols;
  const stepZ = (max.z - min.z) / fineRows;

  for (let idx = 0; idx < fineCount; idx++) {
    const row = Math.floor(idx / fineCols);
    const col = idx % fineCols;
    const x = min.x + (col + 0.5) * stepX;
    const z = min.z + (row + 0.5) * stepZ;
    const planeY = plane[0] * x + plane[1] * z + plane[2];
    groundY[idx] = groundMask[idx] && Number.isFinite(lowY[idx])
      ? lowY[idx] * 0.68 + planeY * 0.32
      : planeY;
  }

  let roughnessSum = 0;
  let roughnessCount = 0;
  for (let i = 0; i < fineCount; i++) {
    if (!counts[i]) continue;
    roughnessSum += roughness[i];
    roughnessCount++;
  }

  return {
    cols: fineCols,
    rows: fineRows,
    counts,
    lowY,
    roughness,
    horizontalRatio,
    groundMask,
    groundY,
    plane,
    diagnostics: {
      grid: `${fineCols}x${fineRows}`,
      finite_cells: finiteLows.length,
      ground_seed_cells: seedIndices.length,
      ground_components: components.length,
      average_roughness: roughnessCount ? roughnessSum / roughnessCount : 0,
      ground_reference_p35: p35,
      ground_reference_p50: p50,
      plane: { a: plane[0], b: plane[1], c: plane[2] }
    }
  };
}

function classifyTriangleV4(horizontal, relativeHeight, roughness, isConnectedGround, modelHeight) {
  const groundTol = Math.max(modelHeight * 0.032, 0.18);
  const roofMin = Math.max(modelHeight * 0.085, 0.75);
  const wallMin = Math.max(modelHeight * 0.035, 0.28);
  const debrisMax = Math.max(modelHeight * 0.20, 1.6);

  if (relativeHeight <= groundTol * 1.45 && horizontal >= 0.54 && isConnectedGround) return 'ground';
  if (relativeHeight <= groundTol && horizontal >= 0.68) return 'ground';

  if (relativeHeight >= roofMin && horizontal >= 0.73 && roughness <= 0.20) return 'roof';

  if (relativeHeight >= wallMin && horizontal <= 0.36) return 'wall';

  if (
    relativeHeight <= debrisMax &&
    relativeHeight > -groundTol &&
    (
      roughness >= 0.045 ||
      (horizontal > 0.25 && horizontal < 0.76)
    )
  ) return 'debris';

  if (relativeHeight >= roofMin * 0.72 && horizontal >= 0.62) return 'roof';
  if (relativeHeight >= wallMin && horizontal < 0.56) return 'wall';

  if (relativeHeight <= groundTol * 1.6 && horizontal >= 0.50) return 'ground';
  return 'other';
}

function cleanupFineComponents(dominant, confidence, groundMask, cols, rows, groundClassIndex) {
  const n = cols * rows;
  const visited = new Uint8Array(n);
  const cleaned = Int8Array.from(dominant);
  const changed = new Uint8Array(n);
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let removedComponents = 0;

  for (let start = 0; start < n; start++) {
    const cls = dominant[start];
    if (cls < 0 || visited[start]) continue;

    const queue = [start];
    const cells = [];
    visited[start] = 1;
    let confidenceSum = 0;

    for (let qi = 0; qi < queue.length; qi++) {
      const idx = queue[qi];
      cells.push(idx);
      confidenceSum += confidence[idx];
      const row = Math.floor(idx / cols);
      const col = idx % cols;

      for (const [dc, dr] of neighbors) {
        const nc = col + dc, nr = row + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = nr * cols + nc;
        if (visited[ni] || dominant[ni] !== cls) continue;
        visited[ni] = 1;
        queue.push(ni);
      }
    }

    const meanConfidence = confidenceSum / Math.max(cells.length, 1);
    const protectedGround = cls === groundClassIndex && cells.some(idx => groundMask[idx]);
    if (protectedGround || cells.length > 2 || meanConfidence >= 0.72) continue;

    const neighborVotes = new Map();
    for (const idx of cells) {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      for (const [dc, dr] of neighbors) {
        const nc = col + dc, nr = row + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = nr * cols + nc;
        const ncls = dominant[ni];
        if (ncls < 0 || ncls === cls) continue;
        neighborVotes.set(ncls, (neighborVotes.get(ncls) || 0) + 1);
      }
    }

    if (!neighborVotes.size) continue;
    const replacement = [...neighborVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (const idx of cells) {
      cleaned[idx] = replacement;
      changed[idx] = 1;
    }
    removedComponents++;
  }

  return { cleaned, changed, removedComponents };
}

function finalizeCellSemanticStats() {
  for (const cell of state.cells.values()) {
    const entries = Object.entries(cell.semanticCounts || {});
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (!total) {
      cell.dominantClass = null;
      cell.confidence = 0;
      continue;
    }
    entries.sort((a, b) => b[1] - a[1]);
    cell.dominantClass = entries[0][0];
    cell.confidence = entries[0][1] / total;
  }
}

function applySemanticVisibility() {
  const selected = state.selectedSemanticClass;

  state.semanticGroup.traverse(obj => {
    if (!obj.isMesh) return;
    const cls = obj.userData.semanticClass;
    if (!cls) return;

    obj.visible = state.semanticVisibility[cls] !== false;

    if (obj.material) {
      const dimmed = Boolean(selected && cls !== selected);
      obj.material.transparent = dimmed;
      obj.material.opacity = dimmed ? 0.14 : 1;
      obj.material.depthWrite = !dimmed;
      obj.material.needsUpdate = true;
    }
  });

  ui.semanticLegend.querySelectorAll('input[data-semantic-class]').forEach(input => {
    input.checked = state.semanticVisibility[input.dataset.semanticClass] !== false;
  });

  ui.semanticLegend.querySelectorAll('.semantic-toggle-item').forEach(row => {
    row.classList.toggle('selected-class-row', row.dataset.semanticClass === selected);
  });

  updateSemanticClassPanel();
}

function setAllSemanticVisibility(visible) {
  for (const key of Object.keys(SEMANTIC_CLASSES)) state.semanticVisibility[key] = visible;
  applySemanticVisibility();
  setStatus(visible ? 'تم إظهار جميع الفئات الدلالية.' : 'تم إخفاء جميع الفئات الدلالية.');
}

function selectSemanticClass(key) {
  if (!SEMANTIC_CLASSES[key] || !state.semanticReady) return;
  state.selectedSemanticClass = key;
  applySemanticVisibility();
  setStatus(`تم تحديد جميع مثلثات فئة ${SEMANTIC_CLASSES[key].label}.`);
}

function soloSemanticClass(key) {
  if (!SEMANTIC_CLASSES[key] || !state.semanticReady) return;
  for (const cls of Object.keys(SEMANTIC_CLASSES)) state.semanticVisibility[cls] = cls === key;
  state.selectedSemanticClass = key;
  applySemanticVisibility();
  setStatus(`وضع Solo: ${SEMANTIC_CLASSES[key].label} فقط.`);
}

function clearSemanticClassSelection() {
  state.selectedSemanticClass = null;
  applySemanticVisibility();
  setStatus('تم إلغاء تحديد الفئة مع الإبقاء على حالة الإظهار الحالية.');
}

function classRegionStats(key) {
  const regions = [];
  for (const cell of state.cells.values()) {
    const count = cell.semanticCounts?.[key] || 0;
    if (!count) continue;
    regions.push({
      region_id: cell.id,
      triangles: count,
      share_of_region_percent: Number(((count / Math.max(cell.triangles, 1)) * 100).toFixed(3))
    });
  }
  regions.sort((a, b) => b.triangles - a.triangles);
  return regions;
}

function updateSemanticClassPanel() {
  const key = state.selectedSemanticClass;
  if (!key || !state.semanticReady) {
    ui.semanticClassPanel?.classList.add('hidden');
    return;
  }

  const meta = SEMANTIC_CLASSES[key];
  const triangles = state.semanticSummary?.[key] || 0;
  const regions = classRegionStats(key);

  ui.semanticClassPanel?.classList.remove('hidden');
  ui.selectedClassBadge.textContent = meta.label;
  ui.classTriangles.textContent = formatNumber(triangles);
  ui.classPercent.textContent = `${((triangles / Math.max(state.totalTriangles, 1)) * 100).toFixed(2)}%`;
  ui.classRegions.textContent = formatNumber(regions.length);
  ui.classVisibleState.textContent = state.semanticVisibility[key] !== false ? 'ظاهر' : 'مخفي';
}

function exportSelectedClassJSON() {
  const key = state.selectedSemanticClass;
  if (!key || !state.semanticReady) {
    setStatus('حدد فئة دلالية أولًا.');
    return;
  }

  const triangles = state.semanticSummary?.[key] || 0;
  const payload = {
    schema: 'gaza-3d-semantic-class/v1',
    created_at: new Date().toISOString(),
    app_version: APP_VERSION,
    model: state.sourceName,
    coordinate_system: 'local / ungeoreferenced',
    semantic_method: state.semanticMethod,
    class: key,
    label_ar: SEMANTIC_CLASSES[key].label,
    triangles,
    share_of_model_percent: Number(((triangles / Math.max(state.totalTriangles, 1)) * 100).toFixed(5)),
    regions: classRegionStats(key)
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `semantic_${key}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  setStatus(`تم تصدير بيانات فئة ${SEMANTIC_CLASSES[key].label} بصيغة JSON.`);
}

async function exportSelectedClassOBJ() {
  const key = state.selectedSemanticClass;
  if (!key || !state.semanticReady) {
    setStatus('حدد فئة دلالية أولًا.');
    return;
  }

  const meshes = state.semanticGroup.children.filter(obj => obj.isMesh && obj.userData.semanticClass === key);
  if (!meshes.length) {
    setStatus('لا توجد هندسة متاحة لهذه الفئة.');
    return;
  }

  setStatus(`جاري تجهيز هندسة فئة ${SEMANTIC_CLASSES[key].label} بصيغة OBJ…`);
  const lines = [
    '# Gaza 3D GIS Lab semantic class export',
    `# Version: ${APP_VERSION}`,
    `# Class: ${key} / ${SEMANTIC_CLASSES[key].label}`,
    '# Coordinate system: local / ungeoreferenced',
    ''
  ];

  let vertexOffset = 1;
  const v = new THREE.Vector3();

  for (let meshIndex = 0; meshIndex < meshes.length; meshIndex++) {
    const mesh = meshes[meshIndex];
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const index = geometry.index;
    if (!position || !index) continue;

    const used = new Map();
    const ordered = [];

    for (let i = 0; i < index.count; i++) {
      const oldIndex = index.getX(i);
      if (!used.has(oldIndex)) {
        used.set(oldIndex, vertexOffset + ordered.length);
        ordered.push(oldIndex);
      }
    }

    lines.push(`o ${key}_part_${meshIndex + 1}`);
    for (const oldIndex of ordered) {
      v.fromBufferAttribute(position, oldIndex).applyMatrix4(mesh.matrix);
      lines.push(`v ${v.x.toFixed(6)} ${v.y.toFixed(6)} ${v.z.toFixed(6)}`);
    }

    for (let i = 0; i < index.count; i += 3) {
      const a = used.get(index.getX(i));
      const b = used.get(index.getX(i + 1));
      const c = used.get(index.getX(i + 2));
      lines.push(`f ${a} ${b} ${c}`);
    }

    vertexOffset += ordered.length;
    lines.push('');
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `semantic_${key}.obj`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setStatus(`تم تصدير هندسة فئة ${SEMANTIC_CLASSES[key].label} بصيغة OBJ.`);
}

function renderSemanticLegend(summary) {
  ui.semanticLegend.innerHTML = '';
  const total = Object.values(summary).reduce((a, b) => a + b, 0) || 1;

  for (const [key, meta] of Object.entries(SEMANTIC_CLASSES)) {
    const count = summary[key] || 0;
    const row = document.createElement('div');
    row.className = 'semantic-item semantic-toggle-item';
    row.dataset.semanticClass = key;
    row.innerHTML = `
      <input type="checkbox" data-semantic-class="${key}" ${state.semanticVisibility[key] !== false ? 'checked' : ''} aria-label="إظهار ${meta.label}">
      <i class="semantic-swatch" style="background:#${meta.color.toString(16).padStart(6, '0')}"></i>
      <span>${meta.label}</span>
      <strong>${((count / total) * 100).toFixed(1)}% · ${formatNumber(count)}</strong>
      <div class="semantic-row-actions">
        <button type="button" class="legend-action select-action">تحديد</button>
        <button type="button" class="legend-action solo-action">Solo</button>
      </div>
    `;

    const checkbox = row.querySelector('input');
    checkbox.addEventListener('change', () => {
      state.semanticVisibility[key] = checkbox.checked;
      applySemanticVisibility();
      setStatus(`${meta.label}: ${checkbox.checked ? 'ظاهر' : 'مخفي'}.`);
    });

    row.querySelector('.select-action').addEventListener('click', () => selectSemanticClass(key));
    row.querySelector('.solo-action').addEventListener('click', () => soloSemanticClass(key));

    ui.semanticLegend.appendChild(row);
  }

  ui.semanticLegend.classList.remove('hidden');
  ui.semanticFilterActions?.classList.remove('hidden');
  applySemanticVisibility();
}

async function runSemanticBaseline() {
  if (!state.modelRoot || !state.segmented) {
    setStatus('أنشئ التقسيم المكاني أولًا، ثم شغّل التحليل الدلالي.');
    return;
  }

  disposeGroup(state.semanticGroup, true);
  state.semanticReady = false;
  ui.viewSemantic.disabled = true;
  ui.exportTraining.disabled = true;
  ui.semanticBtn.disabled = true;
  ui.semanticState.className = 'badge running';
  ui.semanticState.textContent = 'V4.2 يحلل';
  ui.semanticProgressWrap.classList.remove('hidden');
  ui.semanticProgressBar.style.width = '0%';
  ui.semanticProgressLabel.textContent = '0%';
  setStatus('V4.2: تقدير الأرض المحلية والخشونة والاتصال المكاني…');

  for (const cell of state.cells.values()) {
    cell.semanticCounts = {};
    cell.dominantClass = null;
    cell.confidence = 0;
  }

  state.modelRoot.updateMatrixWorld(true);
  state.modelBox.setFromObject(state.modelRoot);

  const sourceMeshes = [];
  state.modelRoot.traverse(obj => {
    if (obj.isMesh && obj.geometry?.getAttribute('position')) sourceMeshes.push(obj);
  });

  const surface = await buildLocalSurfaceContext(sourceMeshes);
  ui.semanticProgressBar.style.width = '30%';
  ui.semanticProgressLabel.textContent = '30%';

  const classKeys = Object.keys(SEMANTIC_CLASSES);
  const classIndex = new Map(classKeys.map((k, i) => [k, i]));
  const groundClassIndex = classIndex.get('ground');
  const modelHeight = Math.max(state.modelBox.max.y - state.modelBox.min.y, 1e-8);

  const regionIds = [...state.cells.keys()].sort();
  const regionIndexById = new Map(regionIds.map((id, i) => [id, i]));
  const fineClassCounts = new Uint32Array(surface.cols * surface.rows * classKeys.length);
  const perMesh = [];
  let processed = 0;

  for (let sourceIndex = 0; sourceIndex < sourceMeshes.length; sourceIndex++) {
    const mesh = sourceMeshes[sourceIndex];
    const geometry = mesh.geometry;
    const pos = geometry.getAttribute('position');
    const index = geometry.index;
    const faceCount = index ? index.count / 3 : pos.count / 3;
    const matrixWorld = mesh.matrixWorld.clone();

    const faceClasses = new Uint8Array(faceCount);
    const fineIndices = new Uint16Array(faceCount);
    const regionIndices = new Uint16Array(faceCount);
    regionIndices.fill(65535);

    for (let f = 0; f < faceCount; f++) {
      const ia = index ? index.getX(f * 3) : f * 3;
      const ib = index ? index.getX(f * 3 + 1) : f * 3 + 1;
      const ic = index ? index.getX(f * 3 + 2) : f * 3 + 2;

      tempA.fromBufferAttribute(pos, ia).applyMatrix4(matrixWorld);
      tempB.fromBufferAttribute(pos, ib).applyMatrix4(matrixWorld);
      tempC.fromBufferAttribute(pos, ic).applyMatrix4(matrixWorld);
      tempCentroid.copy(tempA).add(tempB).add(tempC).multiplyScalar(1 / 3);

      tempEdge1.subVectors(tempB, tempA);
      tempEdge2.subVectors(tempC, tempA);
      tempNormal.crossVectors(tempEdge1, tempEdge2);
      const horizontal = tempNormal.lengthSq() > 1e-12 ? Math.abs(tempNormal.normalize().y) : 0;

      const fi = fineGridIndexFromPoint(tempCentroid, surface.cols, surface.rows);
      const relativeHeight = tempCentroid.y - surface.groundY[fi];
      const cls = classifyTriangleV4(
        horizontal,
        relativeHeight,
        surface.roughness[fi],
        surface.groundMask[fi] === 1,
        modelHeight
      );
      const ci = classIndex.get(cls);

      faceClasses[f] = ci;
      fineIndices[f] = fi;
      fineClassCounts[fi * classKeys.length + ci]++;

      const regionId = cellIdFromPoint(tempCentroid);
      const ri = regionIndexById.get(regionId);
      if (ri !== undefined) regionIndices[f] = ri;

      processed++;
      if (processed % 18000 === 0) {
        const pct = 30 + Math.min(40, Math.round((processed / state.totalTriangles) * 40));
        ui.semanticProgressBar.style.width = `${pct}%`;
        ui.semanticProgressLabel.textContent = `${pct}%`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    perMesh.push({ mesh, faceClasses, fineIndices, regionIndices });
  }

  const fineCount = surface.cols * surface.rows;
  const dominant = new Int8Array(fineCount);
  dominant.fill(-1);
  const fineConfidence = new Float32Array(fineCount);

  for (let fi = 0; fi < fineCount; fi++) {
    let bestClass = -1, best = 0, total = 0;
    for (let ci = 0; ci < classKeys.length; ci++) {
      const count = fineClassCounts[fi * classKeys.length + ci];
      total += count;
      if (count > best) {
        best = count;
        bestClass = ci;
      }
    }
    if (total) {
      dominant[fi] = bestClass;
      fineConfidence[fi] = best / total;
    }
  }

  const cleanup = cleanupFineComponents(
    dominant,
    fineConfidence,
    surface.groundMask,
    surface.cols,
    surface.rows,
    groundClassIndex
  );

  ui.semanticProgressBar.style.width = '74%';
  ui.semanticProgressLabel.textContent = '74%';
  setStatus('V4.2: تنظيف البقع المعزولة وربط المكونات المكانية…');
  await new Promise(resolve => setTimeout(resolve, 0));

  const buckets = sourceMeshes.map(() => Object.fromEntries(classKeys.map(k => [k, []])));
  const summary = Object.fromEntries(classKeys.map(k => [k, 0]));

  for (const cell of state.cells.values()) cell.semanticCounts = {};

  processed = 0;
  for (let sourceIndex = 0; sourceIndex < perMesh.length; sourceIndex++) {
    const { mesh, faceClasses, fineIndices, regionIndices } = perMesh[sourceIndex];
    const geometry = mesh.geometry;
    const index = geometry.index;
    const faceCount = faceClasses.length;

    for (let f = 0; f < faceCount; f++) {
      let ci = faceClasses[f];
      const fi = fineIndices[f];

      if (cleanup.changed[fi] && ci === dominant[fi]) {
        ci = cleanup.cleaned[fi];
      }

      const cls = classKeys[ci];
      const ia = index ? index.getX(f * 3) : f * 3;
      const ib = index ? index.getX(f * 3 + 1) : f * 3 + 1;
      const ic = index ? index.getX(f * 3 + 2) : f * 3 + 2;
      buckets[sourceIndex][cls].push(ia, ib, ic);
      summary[cls]++;

      const ri = regionIndices[f];
      if (ri !== 65535) {
        const cell = state.cells.get(regionIds[ri]);
        if (cell) cell.semanticCounts[cls] = (cell.semanticCounts[cls] || 0) + 1;
      }

      processed++;
      if (processed % 28000 === 0) {
        const pct = 74 + Math.min(16, Math.round((processed / state.totalTriangles) * 16));
        ui.semanticProgressBar.style.width = `${pct}%`;
        ui.semanticProgressLabel.textContent = `${pct}%`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  for (let sourceIndex = 0; sourceIndex < sourceMeshes.length; sourceIndex++) {
    const source = sourceMeshes[sourceIndex];
    for (const key of classKeys) {
      const arr = buckets[sourceIndex][key];
      if (!arr.length) continue;

      const sub = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(source.geometry.attributes)) sub.setAttribute(name, attr);
      sub.setIndex(new THREE.BufferAttribute(new Uint32Array(arr), 1));

      const material = new THREE.MeshBasicMaterial({
        color: SEMANTIC_CLASSES[key].color,
        side: THREE.DoubleSide,
        transparent: false,
        wireframe: state.wireframe
      });
      const part = new THREE.Mesh(sub, material);
      part.matrixAutoUpdate = false;
      part.matrix.copy(source.matrixWorld);
      part.frustumCulled = false;
      part.userData.semanticClass = key;
      state.semanticGroup.add(part);
    }
  }

  finalizeCellSemanticStats();
  state.semanticSummary = summary;
  state.semanticDiagnostics = {
    ...surface.diagnostics,
    removed_small_components: cleanup.removedComponents
  };
  state.semanticReady = true;

  ui.diagBins.textContent = `${surface.diagnostics.finite_cells} / ${surface.cols * surface.rows}`;
  ui.diagComponents.textContent = String(surface.diagnostics.ground_components);
  ui.diagCleaned.textContent = String(cleanup.removedComponents);
  ui.diagRoughness.textContent = Number(surface.diagnostics.average_roughness || 0).toFixed(3);
  ui.semanticDiagnostics.classList.remove('hidden');

  ui.semanticProgressBar.style.width = '100%';
  ui.semanticProgressLabel.textContent = '100%';
  ui.semanticState.className = 'badge ready';
  ui.semanticState.textContent = 'V4.2 جاهز';
  ui.semanticBtn.disabled = false;
  ui.viewSemantic.disabled = false;
  ui.exportTraining.disabled = false;
  renderSemanticLegend(summary);
  applySemanticVisibility();
  setViewMode('semantic');

  if (state.selectedCellId && state.cells.has(state.selectedCellId)) selectCell(state.selectedCellId);

  const manualCount = [...state.cells.values()].filter(c => c.manualLabel).length;
  const groundPct = ((summary.ground || 0) / Math.max(state.totalTriangles, 1) * 100).toFixed(1);
  setStatus(`V4.2 اكتمل: أرض محلية + خشونة + Connected Components. الأرض المكتشفة ${groundPct}%، والتصحيحات اليدوية ${manualCount}.`);
  setTimeout(() => ui.semanticProgressWrap.classList.add('hidden'), 1000);
}

function applyManualTrainingLabel() {
  if (!state.selectedCellId) {
    setStatus('حدد منطقة أولًا ثم اختر Label.');
    return;
  }
  const cell = state.cells.get(state.selectedCellId);
  if (!cell) return;
  cell.manualLabel = ui.manualClass.value || '';
  const label = cell.manualLabel
    ? (SEMANTIC_CLASSES[cell.manualLabel]?.label || ui.manualClass.options[ui.manualClass.selectedIndex]?.text || cell.manualLabel)
    : 'بدون تصحيح';
  setStatus(`تم حفظ ${cell.id} كـ Training Label: ${label}.`);
}

function exportTrainingLabels() {
  if (!state.segmented) return;
  const regions = [...state.cells.values()]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map(cell => {
      const size = cell.box.getSize(new THREE.Vector3());
      const center = cell.box.getCenter(new THREE.Vector3());
      return {
        region_id: cell.id,
        row: cell.row,
        col: cell.col,
        triangles: cell.triangles,
        prediction: cell.dominantClass ? {
          class: cell.dominantClass,
          confidence: Number(cell.confidence.toFixed(5)),
          counts: cell.semanticCounts
        } : null,
        manual_label: cell.manualLabel || null,
        bounds_local: {
          min: { x: cell.box.min.x, y: cell.box.min.y, z: cell.box.min.z },
          max: { x: cell.box.max.x, y: cell.box.max.y, z: cell.box.max.z },
          size: { x: size.x, y: size.y, z: size.z },
          center: { x: center.x, y: center.y, z: center.z }
        }
      };
    });

  const payload = {
    schema: 'gaza-3d-training-labels/v2',
    created_at: new Date().toISOString(),
    model: state.sourceName,
    coordinate_system: 'local / ungeoreferenced',
    baseline_method: state.semanticMethod,
    warning: 'Automatic predictions are geometry-based baseline labels, not a trained neural network.',
    grid: ui.gridPreset.value,
    total_triangles: state.totalTriangles,
    semantic_summary: state.semanticSummary,
    semantic_diagnostics: state.semanticDiagnostics,
    manual_label_count: regions.filter(r => r.manual_label).length,
    regions
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gaza_3d_training_labels.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  setStatus('تم تصدير Training Labels بصيغة JSON.');
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
  state.semanticGroup.traverse(obj => { if (obj.isMesh) { obj.material.wireframe = state.wireframe; obj.material.needsUpdate = true; } });
}

ui.segmentBtn.addEventListener('click', buildSegments);
ui.viewOriginal.addEventListener('click', () => setViewMode('original'));
ui.viewSegments.addEventListener('click', () => setViewMode('segments'));
ui.viewSemantic.addEventListener('click', () => setViewMode('semantic'));
ui.viewAi?.addEventListener('click', () => setViewMode('ai'));
ui.gtMode?.addEventListener('change', () => {
  state.aiCorrectionMode = Boolean(ui.gtMode.checked);
  if (state.aiCorrectionMode) {
    if (state.measureMode) setMeasurementMode(false);
    setViewMode('ai');
    controls.enabled = false;
    setStatus('وضع Ground Truth مفعّل: اضغط على نقاط AI لتصحيحها. أوقف الوضع للعودة للدوران والتحريك.');
  } else {
    controls.enabled = !state.measureMode;
    setStatus('تم إيقاف وضع التصحيح. يمكنك تحريك الكاميرا مجددًا.');
  }
});
ui.gtUndo?.addEventListener('click', undoGroundTruth);
ui.gtExport?.addEventListener('click', exportGroundTruth);
ui.gtClear?.addEventListener('click', () => {
  state.aiCorrections.clear();
  state.aiCorrectionHistory = [];
  refreshAICorrectionColors();
  saveGroundTruthLocal();
  updateGroundTruthUI();
  if (ui.gtLast) ui.gtLast.textContent = '—';
  setStatus('تم مسح التصحيحات المحلية فقط.');
});
ui.gtImport?.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try { await importGroundTruthFile(file); }
  catch (err) {
    console.error(err);
    setStatus('تعذر قراءة ملف Ground Truth.');
  } finally {
    e.target.value = '';
  }
});
ui.semanticBtn.addEventListener('click', runSemanticBaseline);
ui.applyManualLabel.addEventListener('click', applyManualTrainingLabel);
ui.exportTraining.addEventListener('click', exportTrainingLabels);
ui.showAllSemantic?.addEventListener('click', () => setAllSemanticVisibility(true));
ui.hideAllSemantic?.addEventListener('click', () => setAllSemanticVisibility(false));
ui.soloSelectedClass?.addEventListener('click', () => {
  if (state.selectedSemanticClass) soloSemanticClass(state.selectedSemanticClass);
});
ui.restoreSemanticView?.addEventListener('click', () => {
  state.selectedSemanticClass = null;
  setAllSemanticVisibility(true);
  ui.semanticClassPanel?.classList.add('hidden');
  setStatus('تمت استعادة العرض الدلالي الكامل.');
});
ui.exportClassJson?.addEventListener('click', exportSelectedClassJSON);
ui.exportClassObj?.addEventListener('click', exportSelectedClassOBJ);
ui.clearClassSelection?.addEventListener('click', clearSemanticClassSelection);
ui.showGrid.addEventListener('change', () => { state.gridHelper.visible = (state.mode === 'segments' || state.mode === 'semantic') && ui.showGrid.checked; });
ui.colorRegions.addEventListener('change', applyRegionColors);
ui.clearSelected.addEventListener('click', clearSelection);
ui.focusSelected.addEventListener('click', () => {
  if (state.selectedCellId) fitCameraToBox(state.cells.get(state.selectedCellId).box, 1.7);
});
ui.exportJson.addEventListener('click', exportSelectedJSON);
ui.toggleWireframe.addEventListener('click', toggleWireframe);
ui.measureMode?.addEventListener('click', () => setMeasurementMode(!state.measureMode));
ui.measureTool?.addEventListener('click', () => setMeasurementMode(!state.measureMode));
ui.clearMeasurements?.addEventListener('click', () => { clearMeasurements(); setStatus('تم مسح جميع القياسات.'); });
ui.exportAnalysisReport?.addEventListener('click', exportAnalysisReport);
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
  updateCameraClipping();
  renderer.render(scene, camera);
}

resize();
animate();
loadDefaultModel();
