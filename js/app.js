// app.js — RigStudio 3D: mobile touch UI, viewport, modes, animation timeline.
import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { Rig } from './rigcore.js';
import {
  buildHumanMesh, buildAnimalMesh,
  HUMAN_JOINTS, ANIMAL_JOINTS, faceJointSpec, EXPRESSIONS,
} from './characters.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- state
const rig = new Rig();
let mode = 'build';                 // build | pose | animate
let tool = 'move';                  // build: move/add/delete — pose: rotate/translate
let sel = null;                     // selected joint
let autoSnap = true;
let charKind = 'none';              // human | animal | custom | none
let meshes = [];                    // bindable static meshes
let sceneScale = 1.7;
let dirtySave = false;

// animation
const anim = { duration: 4, tracks: new Map(), time: 0, playing: false, loop: true };

// ---------------------------------------------------------------- scene
const viewport = $('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1420);
scene.fog = new THREE.Fog(0x0e1420, 14, 30);

const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
camera.position.set(1.8, 1.5, 2.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.85, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.2;
controls.maxDistance = 15;

scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x2a2e3a, 1.1));
const dl = new THREE.DirectionalLight(0xffffff, 1.4);
dl.position.set(2, 4, 3);
scene.add(dl);

const grid = new THREE.GridHelper(12, 24, 0x2f4468, 0x1c2940);
scene.add(grid);
const groundDisc = new THREE.Mesh(
  new THREE.CircleGeometry(6, 48).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x131b2c, roughness: 1 })
);
groundDisc.position.y = -0.002;
scene.add(groundDisc);

const charGroup = new THREE.Group();
scene.add(charGroup);

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  sizeTimelineCanvas();
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- overlay (joints + links)
const overlayGroup = new THREE.Group();
scene.add(overlayGroup);
const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
const linkGeo = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0);
const MAT = {
  normal: new THREE.MeshBasicMaterial({ color: 0x4da3ff, depthTest: false, transparent: true, opacity: 0.95 }),
  face: new THREE.MeshBasicMaterial({ color: 0xff8fc0, depthTest: false, transparent: true, opacity: 0.95 }),
  dynamic: new THREE.MeshBasicMaterial({ color: 0x53e08d, depthTest: false, transparent: true, opacity: 0.95 }),
  selected: new THREE.MeshBasicMaterial({ color: 0xffd54a, depthTest: false, transparent: true, opacity: 1 }),
  snap: new THREE.MeshBasicMaterial({ color: 0x7cfc00, depthTest: false, transparent: true, opacity: 1 }),
  link: new THREE.MeshBasicMaterial({ color: 0x8fb7e8, depthTest: false, transparent: true, opacity: 0.5 }),
};
let jointMeshes = [];   // sphere Mesh per joint (same index as rig.joints)
let linkMeshes = [];

function syncOverlay() {
  for (const m of [...jointMeshes, ...linkMeshes]) overlayGroup.remove(m);
  jointMeshes = rig.joints.map((j) => {
    const m = new THREE.Mesh(sphereGeo, MAT.normal);
    m.renderOrder = 10;
    m.userData.joint = j;
    overlayGroup.add(m);
    return m;
  });
  linkMeshes = rig.joints.filter(j => j.parent).map((j) => {
    const m = new THREE.Mesh(linkGeo, MAT.link);
    m.renderOrder = 9;
    m.userData.joint = j;
    overlayGroup.add(m);
    return m;
  });
  refreshBoneList();
}

const _wp = new THREE.Vector3(), _wp2 = new THREE.Vector3();
let snapCandidate = null;

function updateOverlay() {
  overlayGroup.visible = rig.joints.length > 0;
  for (const m of jointMeshes) {
    const j = m.userData.joint;
    rig.worldPos(j, _wp);
    m.position.copy(_wp);
    const dist = camera.position.distanceTo(_wp);
    let r = THREE.MathUtils.clamp(dist * 0.019, 0.008, 0.2);
    if (j.face) r *= 0.62;
    m.scale.setScalar(r);
    m.material =
      j === snapCandidate ? MAT.snap :
      j === sel ? MAT.selected :
      j.dynamic ? MAT.dynamic :
      j.face ? MAT.face : MAT.normal;
  }
  const lr = Math.max(0.004, 0.010 * sceneScale);
  for (const m of linkMeshes) {
    const j = m.userData.joint;
    rig.worldPos(j, _wp);
    rig.worldPos(j.parent, _wp2);
    const len = _wp.distanceTo(_wp2);
    m.position.copy(_wp2);
    m.scale.set(lr, Math.max(len, 1e-5), lr);
    m.quaternion.setFromUnitVectors(_Y, _wp.sub(_wp2).normalize());
  }
}
const _Y = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- toast / helpers
let toastTimer = 0;
function toast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

function computeSceneScale() {
  if (meshes.length === 0) { sceneScale = 1.7; return; }
  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  const s = box.getSize(new THREE.Vector3());
  sceneScale = Math.max(0.4, Math.max(s.x, s.y, s.z));
}

// ---------------------------------------------------------------- characters
function disposeCharacter() {
  for (const m of [...charGroup.children]) {
    charGroup.remove(m);
    m.traverse?.((o) => { if (o.isMesh) o.geometry.dispose(); });
  }
  meshes = [];
}

function clearAll() {
  anim.tracks.clear(); anim.time = 0; anim.playing = false;
  sel = null; snapCandidate = null;
  rig.clear(scene);
  disposeCharacter();
  syncOverlay();
  markDirtySave();
}

function loadTemplate(spec, scale = 1, offset = new THREE.Vector3(), anchor = null) {
  const byName = new Map();
  for (const [name, parentName, pos, opts] of spec) {
    const p = new THREE.Vector3().fromArray(pos).multiplyScalar(scale).add(offset);
    let parent = null;
    if (parentName === 'HEAD') parent = anchor;
    else if (parentName) parent = byName.get(parentName) || null;
    const j = rig.addJoint(p, parent, { name, ...(opts || {}) });
    byName.set(name, j);
  }
  syncOverlay();
}

function newHuman() {
  clearAll();
  charKind = 'human';
  const mesh = buildHumanMesh();
  charGroup.add(mesh);
  meshes = [mesh];
  computeSceneScale();
  loadTemplate(HUMAN_JOINTS);
  addFaceRig(true);
  setMode('build');
  toast('🧍 Human ready — tweak bones, then Bind Skin');
}

function newAnimal() {
  clearAll();
  charKind = 'animal';
  const mesh = buildAnimalMesh();
  charGroup.add(mesh);
  meshes = [mesh];
  computeSceneScale();
  loadTemplate(ANIMAL_JOINTS);
  setMode('build');
  toast('🐕 Animal ready — tail & ears have physics ⚡');
}

function newEmpty() {
  clearAll();
  charKind = 'none';
  computeSceneScale();
  setMode('build');
  setTool('add');
  toast('Tap ➕ then tap the scene to place bones');
}

function importGLB(file) {
  const reader = new FileReader();
  reader.onload = () => {
    new GLTFLoader().parse(reader.result, '', (gltf) => {
      clearAll();
      charKind = 'custom';
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const found = [];
      root.traverse((o) => { if (o.isMesh) found.push(o); });
      if (found.length === 0) { toast('No meshes found in that file'); return; }
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const s = 1.7 / Math.max(0.0001, size.y);
      const norm = new THREE.Matrix4().makeScale(s, s, s)
        .multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
      for (const src of found) {
        const m = new THREE.Mesh(src.geometry, src.material);
        m.applyMatrix4(new THREE.Matrix4().multiplyMatrices(norm, src.matrixWorld));
        charGroup.add(m);
        meshes.push(m);
      }
      computeSceneScale();
      setMode('build');
      toast('📦 Model imported — add a skeleton from the ☰ menu, or build bones');
      markDirtySave();
    }, (err) => { console.error(err); toast('Could not read that model 😕'); });
  };
  reader.readAsArrayBuffer(file);
}

function addSkeletonTemplate(kind) {
  if (rig.joints.length > 0 && !confirm('Replace the current skeleton?')) return;
  anim.tracks.clear();
  rig.clear(scene);
  let scale = 1, offset = new THREE.Vector3();
  if (meshes.length) {
    const box = new THREE.Box3();
    for (const m of meshes) box.expandByObject(m);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const tplH = kind === 'human' ? 1.75 : 1.01;
    scale = size.y / tplH;
    offset.set(center.x, box.min.y, center.z);
  }
  loadTemplate(kind === 'human' ? HUMAN_JOINTS : ANIMAL_JOINTS, scale, offset);
  if (kind === 'human') addFaceRig(true);
  setMode('build');
  toast('Skeleton added — drag joints to fit your model');
  markDirtySave();
}

function addFaceRig(silent = false) {
  const anchor = (sel && !sel.face && sel) || rig.byRole('head') || null;
  if (!anchor) { toast('Select the head joint first, then add the face rig'); return; }
  if (rig.joints.some(j => j.face && rig.isDescendant(j, anchor))) {
    if (!silent) toast('This head already has a face rig 🙂');
    return;
  }
  const s = THREE.MathUtils.clamp(anchor.pos.y * 0.64, 0.3, 2.5);
  loadTemplate(faceJointSpec(s), 1, anchor.pos.clone(), anchor);
  if (!silent) toast('🙂 Face rig added — jaw, eyes, brows, mouth, cheeks');
  markDirtySave();
}

// ---------------------------------------------------------------- binding
function ensureBound() {
  if (rig.joints.length === 0) { toast('Add bones first (Build mode ➕)'); return false; }
  if (rig.bound && !rig.dirty) return true;
  toast('🧲 Binding skin…', 1200);
  rig.bind(meshes, scene);
  rig.physics.enabled = physicsOn;
  return true;
}

function setBoundView(showSkinned) {
  charGroup.visible = !(showSkinned && rig.skinnedMeshes.length > 0);
  for (const sm of rig.skinnedMeshes) sm.visible = showSkinned;
}

// ---------------------------------------------------------------- modes & tools
function setMode(next) {
  if (next !== 'build' && !ensureBound()) next = 'build';
  mode = next;
  anim.playing = false;
  updatePlayBtn();
  document.querySelectorAll('#modeTabs .tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode));
  document.querySelectorAll('#toolbar .toolgroup').forEach(g =>
    g.classList.toggle('hidden', g.dataset.for !== mode));
  $('timeline').classList.toggle('hidden', mode !== 'animate');
  $('app').classList.toggle('has-timeline', mode === 'animate');
  setBoundView(mode !== 'build');
  tool = mode === 'build' ? 'move' : 'rotate';
  syncToolButtons();
  updateBonePanel();
  if (mode === 'animate') { sizeTimelineCanvas(); drawTimeline(); }
}

function setTool(next) {
  tool = next;
  syncToolButtons();
}

function syncToolButtons() {
  document.querySelectorAll(`#toolbar .toolgroup[data-for="${mode}"] .tool[data-tool]`)
    .forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
}

document.querySelectorAll('#modeTabs .tab').forEach(t =>
  t.addEventListener('click', () => setMode(t.dataset.mode)));
document.querySelectorAll('#toolbar .tool[data-tool]').forEach(b =>
  b.addEventListener('click', () => setTool(b.dataset.tool)));

// ---------------------------------------------------------------- pointer input
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const dragPlane = new THREE.Plane();
let drag = null; // {kind:'joint'|'rotate'|'translate', joint, lastX, lastY}
let tap = null;  // {x, y, t, id}

function setNdc(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

function pickJoint(e) {
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(jointMeshes, false);
  return hits.length ? hits[0].object.userData.joint : null;
}

function planePoint(e, through) {
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  dragPlane.setFromNormalAndCoplanarPoint(
    camera.getWorldDirection(new THREE.Vector3()).negate(), through);
  const out = new THREE.Vector3();
  return raycaster.ray.intersectPlane(dragPlane, out) ? out : null;
}

function surfacePoint(e) {
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length) return hits[0].point.clone();
  return planePoint(e, controls.target.clone());
}

viewport.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) { tap = null; return; }
  if (drag) return;
  const joint = pickJoint(e);
  tap = { x: e.clientX, y: e.clientY, t: performance.now(), joint };

  if (mode === 'build' && tool === 'move' && joint) {
    beginDrag(e, { kind: 'joint', joint });
  } else if (mode !== 'build' && joint) {
    selectJoint(joint);
    beginDrag(e, { kind: tool === 'translate' ? 'translate' : 'rotate', joint });
  }
}, { capture: true });

function beginDrag(e, d) {
  drag = { ...d, lastX: e.clientX, lastY: e.clientY, moved: false };
  controls.enabled = false;
  e.stopPropagation();
  addEventListener('pointermove', onDragMove);
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);
}

function onDragMove(e) {
  if (!drag || !e.isPrimary) return;
  const dx = e.clientX - drag.lastX, dy = e.clientY - drag.lastY;
  drag.lastX = e.clientX; drag.lastY = e.clientY;
  if (Math.abs(dx) + Math.abs(dy) > 0) drag.moved = true;

  if (drag.kind === 'joint') {
    const p = planePoint(e, drag.joint.pos);
    if (p) {
      drag.joint.pos.copy(p);
      rig.dirty = true;
      const snapR = 0.05 * sceneScale;
      snapCandidate = autoSnap ? rig.nearestJoint(p, drag.joint, snapR) : null;
    }
  } else if (drag.kind === 'rotate') {
    rotateSelectedBone(dx, dy);
  } else if (drag.kind === 'translate') {
    translateSelectedBone(e);
  }
}

function endDrag(e) {
  if (drag && drag.kind === 'joint') {
    if (snapCandidate) {
      const j = drag.joint;
      if (!j.parent) {
        rig.setParent(j, snapCandidate);
        syncOverlay();
        toast(`🧲 Connected ${j.name} → ${snapCandidate.name}`);
      } else if (j.pos.distanceTo(snapCandidate.pos) < 0.03 * sceneScale) {
        j.pos.copy(snapCandidate.pos);
      }
      snapCandidate = null;
    }
    selectJoint(drag.joint);
    markDirtySave();
  }
  if (drag && (drag.kind === 'rotate' || drag.kind === 'translate')) {
    updateSliders();
    markDirtySave();
  }
  drag = null;
  controls.enabled = true;
  removeEventListener('pointermove', onDragMove);
  removeEventListener('pointerup', endDrag);
  removeEventListener('pointercancel', endDrag);
}

// taps (add / delete / select) — evaluated on pointerup so orbiting still works
viewport.addEventListener('pointerup', (e) => {
  if (!tap || !e.isPrimary) return;
  const dt = performance.now() - tap.t;
  const dist = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
  const isTap = dt < 500 && dist < 10;
  const joint = tap.joint;
  tap = null;
  if (!isTap || drag) return;

  if (mode === 'build') {
    if (tool === 'add') {
      if (joint) { selectJoint(joint); toast(`Chain from “${joint.name}” — tap to add`, 1400); return; }
      const p = surfacePoint(e);
      if (!p) return;
      let parent = sel;
      if (!parent && autoSnap) parent = rig.nearestJoint(p, null, 0.6 * sceneScale);
      const j = rig.addJoint(p, parent, { name: 'bone_' + (rig.joints.length + 1) });
      syncOverlay();
      selectJoint(j);
      toast(parent ? `🧲 Snapped to ${parent.name}` : 'Root bone placed', 1300);
      markDirtySave();
    } else if (tool === 'delete' && joint) {
      if (sel === joint) sel = null;
      rig.removeJoint(joint);
      syncOverlay();
      updateBonePanel();
      toast('Bone deleted');
      markDirtySave();
    } else if (tool === 'move' && joint) {
      selectJoint(joint);
    }
  }
}, { capture: true });

// bone manipulation (pose/animate)
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();
const _mq1 = new THREE.Quaternion(), _mq2 = new THREE.Quaternion(),
      _mq3 = new THREE.Quaternion(), _mq4 = new THREE.Quaternion();

function rotateSelectedBone(dx, dy) {
  if (!sel || !rig.bound) return;
  const bone = rig.bones.get(sel.id);
  if (!bone) return;
  const s = 0.008;
  _e1.set(0, 1, 0).applyQuaternion(camera.quaternion);       // camera up
  _e2.set(1, 0, 0).applyQuaternion(camera.quaternion);       // camera right
  _mq1.setFromAxisAngle(_e1, dx * s).multiply(_mq2.setFromAxisAngle(_e2, dy * s));
  const parentQ = bone.parent ? bone.parent.getWorldQuaternion(_mq2) : _mq2.identity();
  _mq3.copy(parentQ).invert();
  _mq4.copy(bone.quaternion);
  bone.quaternion.copy(_mq3).multiply(_mq1).multiply(parentQ).multiply(_mq4);
}

function translateSelectedBone(e) {
  if (!sel || !rig.bound) return;
  const bone = rig.bones.get(sel.id);
  if (!bone) return;
  const world = bone.getWorldPosition(new THREE.Vector3());
  const p = planePoint(e, world);
  if (!p) return;
  const deltaW = p.sub(world);
  const parentQ = bone.parent ? bone.parent.getWorldQuaternion(_mq1) : _mq1.identity();
  bone.position.add(deltaW.applyQuaternion(parentQ.invert()));
}

// ---------------------------------------------------------------- selection & bone panel
function selectJoint(j) {
  sel = j;
  updateBonePanel();
  refreshBoneList();
}

function updateBonePanel() {
  const panel = $('bonePanel');
  if (!sel) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  $('boneName').textContent = '🦴 ' + sel.name;
  $('boneDynamic').checked = !!sel.dynamic;
  $('boneSliders').classList.toggle('hidden', mode === 'build' || !rig.bound);
  updateSliders();
}

const _eu = new THREE.Euler();
let slidersBusy = false;
function updateSliders() {
  if (!sel || mode === 'build' || !rig.bound) return;
  const bone = rig.bones.get(sel.id);
  if (!bone) return;
  slidersBusy = true;
  _eu.setFromQuaternion(bone.quaternion, 'XYZ');
  for (const [ax, v] of [['X', _eu.x], ['Y', _eu.y], ['Z', _eu.z]]) {
    const deg = Math.round(THREE.MathUtils.radToDeg(v));
    $('rot' + ax).value = deg;
    $('rot' + ax + 'v').textContent = deg + '°';
  }
  slidersBusy = false;
}

for (const ax of ['X', 'Y', 'Z']) {
  $('rot' + ax).addEventListener('input', () => {
    if (slidersBusy || !sel || !rig.bound) return;
    const bone = rig.bones.get(sel.id);
    if (!bone) return;
    _eu.set(
      THREE.MathUtils.degToRad(+$('rotX').value),
      THREE.MathUtils.degToRad(+$('rotY').value),
      THREE.MathUtils.degToRad(+$('rotZ').value), 'XYZ');
    bone.quaternion.setFromEuler(_eu);
    for (const a of ['X', 'Y', 'Z']) $('rot' + a + 'v').textContent = $('rot' + a).value + '°';
    markDirtySave();
  });
}

$('bonePanelClose').addEventListener('click', () => { sel = null; updateBonePanel(); refreshBoneList(); });
$('boneDelete').addEventListener('click', () => {
  if (!sel) return;
  if (mode !== 'build') { toast('Delete bones in Build mode'); return; }
  rig.removeJoint(sel);
  sel = null;
  syncOverlay(); updateBonePanel(); markDirtySave();
});
$('boneName').addEventListener('click', () => {
  if (!sel) return;
  const n = prompt('Bone name', sel.name);
  if (n) { sel.name = n.trim() || sel.name; updateBonePanel(); refreshBoneList(); markDirtySave(); }
});
$('boneDynamic').addEventListener('change', (e) => {
  if (!sel) return;
  sel.dynamic = e.target.checked;
  if (rig.bound) rig.initPhysics();
  toast(sel.dynamic ? '⚡ Physics ON for ' + sel.name : 'Physics off for ' + sel.name, 1400);
  markDirtySave();
});

// ---------------------------------------------------------------- bone list drawer
function refreshBoneList() {
  const wrap = $('boneListItems');
  if ($('boneDrawer').classList.contains('hidden')) return;
  wrap.innerHTML = '';
  for (const j of rig.joints) {
    let depth = 0;
    for (let p = j.parent; p; p = p.parent) depth++;
    const b = document.createElement('button');
    b.className = 'bone-item' + (j === sel ? ' sel' : '');
    b.style.paddingLeft = 6 + depth * 14 + 'px';
    b.innerHTML = `🦴 ${j.name} <span class="badge">${j.dynamic ? '⚡' : ''}${j.face ? '🙂' : ''}</span>`;
    b.addEventListener('click', () => { selectJoint(j); });
    wrap.appendChild(b);
  }
}
$('btnBones').addEventListener('click', () => {
  $('boneDrawer').classList.toggle('hidden');
  refreshBoneList();
});
$('boneDrawerClose').addEventListener('click', () => $('boneDrawer').classList.add('hidden'));

// ---------------------------------------------------------------- animation
function trackFor(id) {
  let tr = anim.tracks.get(id);
  if (!tr) { tr = { times: [], qs: [], ps: [] }; anim.tracks.set(id, tr); }
  return tr;
}

function keyAll(time) {
  if (!rig.bound) return;
  for (const [id, bone] of rig.bones) {
    const tr = trackFor(id);
    const q = bone.quaternion.clone(), p = bone.position.clone();
    let i = tr.times.findIndex(t => Math.abs(t - time) < 1 / 120);
    if (i >= 0) { tr.qs[i] = q; tr.ps[i] = p; continue; }
    i = tr.times.findIndex(t => t > time);
    if (i < 0) i = tr.times.length;
    tr.times.splice(i, 0, time);
    tr.qs.splice(i, 0, q);
    tr.ps.splice(i, 0, p);
  }
  markDirtySave();
}

function deleteKeysAt(time) {
  let removed = 0;
  for (const tr of anim.tracks.values()) {
    for (let i = tr.times.length - 1; i >= 0; i--) {
      if (Math.abs(tr.times[i] - time) < 1 / 30) {
        tr.times.splice(i, 1); tr.qs.splice(i, 1); tr.ps.splice(i, 1);
        removed++;
      }
    }
  }
  if (removed) markDirtySave();
  return removed;
}

function sampleAnim(time) {
  if (!rig.bound) return;
  for (const [id, tr] of anim.tracks) {
    const bone = rig.bones.get(id);
    if (!bone || tr.times.length === 0) continue;
    const n = tr.times.length;
    if (time <= tr.times[0]) { bone.quaternion.copy(tr.qs[0]); bone.position.copy(tr.ps[0]); continue; }
    if (time >= tr.times[n - 1]) { bone.quaternion.copy(tr.qs[n - 1]); bone.position.copy(tr.ps[n - 1]); continue; }
    let i = 1;
    while (i < n && tr.times[i] < time) i++;
    const u = (time - tr.times[i - 1]) / (tr.times[i] - tr.times[i - 1]);
    bone.quaternion.slerpQuaternions(tr.qs[i - 1], tr.qs[i], u);
    bone.position.lerpVectors(tr.ps[i - 1], tr.ps[i], u);
  }
}

function allKeyTimes() {
  const set = new Set();
  for (const tr of anim.tracks.values()) for (const t of tr.times) set.add(Math.round(t * 120) / 120);
  return [...set].sort((a, b) => a - b);
}

// timeline canvas
const tlCanvas = $('tlCanvas');
const tlCtx = tlCanvas.getContext('2d');
function sizeTimelineCanvas() {
  const dpr = Math.min(devicePixelRatio, 2);
  const w = tlCanvas.clientWidth, h = tlCanvas.clientHeight;
  if (w === 0) return;
  tlCanvas.width = w * dpr; tlCanvas.height = h * dpr;
  tlCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawTimeline();
}

function drawTimeline() {
  const w = tlCanvas.clientWidth, h = tlCanvas.clientHeight;
  if (!w) return;
  tlCtx.clearRect(0, 0, w, h);
  // ruler
  tlCtx.strokeStyle = '#28395a'; tlCtx.fillStyle = '#6f85ad';
  tlCtx.font = '10px sans-serif'; tlCtx.textAlign = 'center';
  const step = anim.duration > 8 ? 1 : 0.5;
  for (let t = 0; t <= anim.duration + 1e-6; t += step) {
    const x = (t / anim.duration) * w;
    tlCtx.beginPath(); tlCtx.moveTo(x, 0); tlCtx.lineTo(x, t % 1 === 0 ? 14 : 8); tlCtx.stroke();
    if (t % 1 === 0) tlCtx.fillText(t + 's', Math.min(Math.max(x, 8), w - 10), 24);
  }
  // keys
  const selTr = sel ? anim.tracks.get(sel.id) : null;
  for (const t of allKeyTimes()) {
    const x = (t / anim.duration) * w;
    const isSel = selTr && selTr.times.some(tt => Math.abs(tt - t) < 1 / 100);
    tlCtx.fillStyle = isSel ? '#ffd54a' : '#7db2ff';
    tlCtx.beginPath();
    tlCtx.moveTo(x, h - 22); tlCtx.lineTo(x + 6, h - 15); tlCtx.lineTo(x, h - 8); tlCtx.lineTo(x - 6, h - 15);
    tlCtx.closePath(); tlCtx.fill();
  }
  // playhead
  const px = (anim.time / anim.duration) * w;
  tlCtx.strokeStyle = '#ff5d5d'; tlCtx.lineWidth = 2;
  tlCtx.beginPath(); tlCtx.moveTo(px, 0); tlCtx.lineTo(px, h); tlCtx.stroke();
  tlCtx.lineWidth = 1;
  $('timeLabel').textContent = anim.time.toFixed(2) + 's';
}

let scrubbing = false;
tlCanvas.addEventListener('pointerdown', (e) => {
  scrubbing = true;
  tlCanvas.setPointerCapture(e.pointerId);
  scrubTo(e);
});
tlCanvas.addEventListener('pointermove', (e) => { if (scrubbing) scrubTo(e); });
tlCanvas.addEventListener('pointerup', () => { scrubbing = false; });
function scrubTo(e) {
  const r = tlCanvas.getBoundingClientRect();
  const u = THREE.MathUtils.clamp((e.clientX - r.left) / r.width, 0, 1);
  anim.time = Math.round(u * anim.duration * 60) / 60;
  sampleAnim(anim.time);
  updateSliders();
  drawTimeline();
}

$('btnPlay').addEventListener('click', () => {
  if (anim.tracks.size === 0) { toast('Pose the character, then press ◆ to add a keyframe'); return; }
  anim.playing = !anim.playing;
  updatePlayBtn();
});
function updatePlayBtn() { $('btnPlay').textContent = anim.playing ? '⏸' : '▶'; }

$('btnKey').addEventListener('click', () => {
  if (!ensureBound()) return;
  keyAll(anim.time);
  drawTimeline();
  toast(`◆ Keyframe at ${anim.time.toFixed(2)}s`, 1300);
});
$('btnDelKey').addEventListener('click', () => {
  const n = deleteKeysAt(anim.time);
  toast(n ? 'Keys deleted' : 'No keys at playhead', 1200);
  drawTimeline();
});
$('btnLoop').addEventListener('click', (e) => {
  anim.loop = !anim.loop;
  e.currentTarget.classList.toggle('on', anim.loop);
});
$('durInput').addEventListener('change', (e) => {
  anim.duration = THREE.MathUtils.clamp(parseFloat(e.target.value) || 4, 0.5, 60);
  e.target.value = anim.duration;
  anim.time = Math.min(anim.time, anim.duration);
  drawTimeline();
  markDirtySave();
});

// ---------------------------------------------------------------- physics UI
let physicsOn = true;
function syncPhysicsBtns() {
  for (const id of ['btnPhysics', 'btnPhysics2']) $(id).classList.toggle('on', physicsOn);
}
for (const id of ['btnPhysics', 'btnPhysics2']) {
  $(id).addEventListener('click', () => {
    physicsOn = !physicsOn;
    rig.physics.enabled = physicsOn;
    if (physicsOn && rig.bound) rig.initPhysics();
    syncPhysicsBtns();
    toast(physicsOn ? '⚡ Physics on — ⚡ bones jiggle' : 'Physics off', 1400);
  });
}
$('phGravity').addEventListener('input', (e) => { rig.physics.gravity = +e.target.value; });
$('phStiff').addEventListener('input', (e) => { rig.physics.stiffness = +e.target.value; });
$('phDamp').addEventListener('input', (e) => { rig.physics.damping = +e.target.value; });

// ---------------------------------------------------------------- expressions
function buildExprButtons() {
  const wrap = $('exprButtons');
  wrap.innerHTML = '';
  for (const name of Object.keys(EXPRESSIONS)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => applyExpression(name));
    wrap.appendChild(b);
  }
}

function faceScale() {
  const head = rig.byRole('head');
  const faces = rig.joints.filter(j => j.face);
  if (!head || faces.length === 0) return 1;
  let sum = 0;
  for (const f of faces) sum += f.pos.distanceTo(head.pos);
  return (sum / faces.length) / 0.11;
}

function applyExpression(name) {
  if (!ensureBound()) return;
  const preset = EXPRESSIONS[name];
  const faces = rig.joints.filter(j => j.face);
  if (faces.length === 0) { toast('No face rig — add one from the ☰ menu'); return; }
  const s = faceScale();
  // reset face bones, then apply offsets
  for (const j of faces) {
    const bone = rig.bones.get(j.id);
    if (!bone) continue;
    bone.quaternion.identity();
    bone.position.copy(bone.userData.restPos);
    const off = preset[j.role];
    if (!off) continue;
    if (off.p) bone.position.add(new THREE.Vector3().fromArray(off.p).multiplyScalar(s));
    if (off.e) bone.quaternion.setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(off.e[0]),
      THREE.MathUtils.degToRad(off.e[1]),
      THREE.MathUtils.degToRad(off.e[2]), 'XYZ'));
  }
  toast(`🙂 ${name} — press ◆ in Animate to keyframe it`, 1600);
  markDirtySave();
}

for (const id of ['btnExpr', 'btnExpr2']) {
  $(id).addEventListener('click', () => $('exprSheet').classList.toggle('hidden'));
}
$('exprClose').addEventListener('click', () => $('exprSheet').classList.add('hidden'));

// ---------------------------------------------------------------- menu & project io
$('btnMenu').addEventListener('click', () => $('menu').classList.remove('hidden'));
$('menuClose').addEventListener('click', () => $('menu').classList.add('hidden'));
function closeMenu() { $('menu').classList.add('hidden'); }

$('miHuman').addEventListener('click', () => { newHuman(); closeMenu(); });
$('miAnimal').addEventListener('click', () => { newAnimal(); closeMenu(); });
$('miEmpty').addEventListener('click', () => { newEmpty(); closeMenu(); });
$('miImport').addEventListener('click', () => { $('fileModel').click(); });
$('fileModel').addEventListener('change', (e) => {
  if (e.target.files[0]) { importGLB(e.target.files[0]); closeMenu(); }
  e.target.value = '';
});
$('miHumanRig').addEventListener('click', () => { addSkeletonTemplate('human'); closeMenu(); });
$('miAnimalRig').addEventListener('click', () => { addSkeletonTemplate('animal'); closeMenu(); });
$('miFaceRig').addEventListener('click', () => { addFaceRig(); closeMenu(); });
$('miSnap').addEventListener('click', () => {
  autoSnap = !autoSnap;
  $('snapState').textContent = `🧲 Auto-snap: ${autoSnap ? 'ON' : 'OFF'}`;
});
$('miReset').addEventListener('click', () => {
  if (!confirm('Delete everything and start fresh?')) return;
  try { localStorage.removeItem('rigstudio.project'); } catch {}
  newHuman();
  closeMenu();
});

function projectJSON() {
  const tracks = {};
  for (const [id, tr] of anim.tracks) {
    tracks[id] = {
      t: [...tr.times],
      q: tr.qs.map(q => [q.x, q.y, q.z, q.w]),
      p: tr.ps.map(p => [p.x, p.y, p.z]),
    };
  }
  return { v: 1, app: 'RigStudio3D', char: charKind, rig: rig.toJSON(), anim: { duration: anim.duration, tracks }, physicsOn };
}

function loadProject(data) {
  clearAll();
  charKind = data.char || 'none';
  if (charKind === 'human') { const m = buildHumanMesh(); charGroup.add(m); meshes = [m]; }
  else if (charKind === 'animal') { const m = buildAnimalMesh(); charGroup.add(m); meshes = [m]; }
  else if (charKind === 'custom') toast('Project uses an imported model — re-import it from ☰ menu', 3500);
  computeSceneScale();
  rig.fromJSON(data.rig || { joints: [] }, scene);
  anim.duration = data.anim?.duration || 4;
  $('durInput').value = anim.duration;
  anim.tracks.clear();
  for (const [id, tr] of Object.entries(data.anim?.tracks || {})) {
    anim.tracks.set(+id, {
      times: [...tr.t],
      qs: tr.q.map(a => new THREE.Quaternion().fromArray(a)),
      ps: tr.p.map(a => new THREE.Vector3().fromArray(a)),
    });
  }
  physicsOn = data.physicsOn !== false;
  rig.physics.enabled = physicsOn;
  syncPhysicsBtns();
  $('phGravity').value = rig.physics.gravity;
  $('phStiff').value = rig.physics.stiffness;
  $('phDamp').value = rig.physics.damping;
  syncOverlay();
  setMode('build');
}

$('miSave').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(projectJSON())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rigstudio-project.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('💾 Project saved');
  closeMenu();
});
$('miLoad').addEventListener('click', () => $('fileProject').click());
$('fileProject').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  f.text().then(txt => {
    try { loadProject(JSON.parse(txt)); toast('📂 Project loaded'); }
    catch (err) { console.error(err); toast('Could not read that project file'); }
  });
  e.target.value = '';
  closeMenu();
});

// autosave
function markDirtySave() { dirtySave = true; }
function autosave() {
  if (!dirtySave) return;
  dirtySave = false;
  try { localStorage.setItem('rigstudio.project', JSON.stringify(projectJSON())); } catch {}
}
setInterval(autosave, 8000);
document.addEventListener('visibilitychange', () => { if (document.hidden) autosave(); });

// ---------------------------------------------------------------- bind & help
$('btnBind').addEventListener('click', () => {
  if (rig.joints.length === 0) { toast('Add bones first ➕'); return; }
  rig.dirty = true;
  if (ensureBound()) {
    setMode('pose');
    toast('🧲 Skin bound! Drag joints to pose your character');
  }
});
$('btnResetPose').addEventListener('click', () => {
  if (rig.bound) { rig.resetPose(); updateSliders(); toast('Pose reset'); }
});
$('btnHelp').addEventListener('click', () => $('help').classList.remove('hidden'));
$('helpClose').addEventListener('click', () => {
  $('help').classList.add('hidden');
  try { localStorage.setItem('rigstudio.seenHelp', '1'); } catch {}
});

// ---------------------------------------------------------------- main loop
let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (anim.playing) {
    anim.time += dt;
    if (anim.time > anim.duration) {
      if (anim.loop) anim.time %= anim.duration;
      else { anim.time = anim.duration; anim.playing = false; updatePlayBtn(); }
    }
    sampleAnim(anim.time);
  }
  if (rig.bound && mode !== 'build') rig.stepPhysics(dt);
  updateOverlay();
  if (mode === 'animate') drawTimeline();
  controls.update();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- boot
buildExprButtons();
resize();
let restored = false;
try {
  const saved = localStorage.getItem('rigstudio.project');
  if (saved) { loadProject(JSON.parse(saved)); restored = true; toast('Restored your last project'); }
} catch (e) { console.warn('restore failed', e); }
if (!restored) newHuman();
try {
  if (!localStorage.getItem('rigstudio.seenHelp')) $('help').classList.remove('hidden');
} catch {}
syncPhysicsBtns();
window.RIGSTUDIO = { rig, anim, THREE, camera, renderer };   // console/debug access
requestAnimationFrame(tick);
