// characters.js — procedural sample characters (human + quadruped), skeleton
// templates that fit them, the face-rig template, and expression presets.
import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';

function capsuleBetween(ax, ay, az, bx, by, bz, r) {
  const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new THREE.CapsuleGeometry(r, len, 6, 16);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  geo.applyQuaternion(q);
  geo.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  return geo;
}

function sphereAt(x, y, z, r) {
  return new THREE.SphereGeometry(r, 20, 14).translate(x, y, z);
}

function makeMesh(parts, color) {
  const geo = mergeGeometries(parts, false);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// ---------------- human ----------------

export function buildHumanMesh() {
  const P = [];
  P.push(sphereAt(0, 1.0, 0, 0.155));                            // pelvis
  P.push(capsuleBetween(0, 1.06, 0, 0, 1.40, 0, 0.165));         // torso
  P.push(capsuleBetween(0, 1.44, 0, 0, 1.53, 0, 0.055));         // neck
  P.push(sphereAt(0, 1.62, 0, 0.125));                           // head
  for (const s of [1, -1]) {
    P.push(capsuleBetween(s * 0.19, 1.40, 0, s * 0.44, 1.24, 0, 0.055));  // upper arm
    P.push(capsuleBetween(s * 0.44, 1.24, 0, s * 0.66, 1.06, 0, 0.045));  // forearm
    P.push(sphereAt(s * 0.70, 1.02, 0, 0.052));                          // hand
    P.push(capsuleBetween(s * 0.09, 0.98, 0, s * 0.11, 0.54, 0, 0.082)); // thigh
    P.push(capsuleBetween(s * 0.11, 0.54, 0, s * 0.12, 0.10, 0, 0.056)); // shin
    P.push(capsuleBetween(s * 0.12, 0.07, 0.02, s * 0.12, 0.055, 0.15, 0.05)); // foot
  }
  return makeMesh(P, 0x6fa8dc);
}

// name, parent, [x,y,z], opts — face joints included so humans arrive face-ready
export const HUMAN_JOINTS = [
  ['hips', null, [0, 1.02, 0]],
  ['spine', 'hips', [0, 1.20, 0]],
  ['chest', 'spine', [0, 1.38, 0]],
  ['neck', 'chest', [0, 1.47, 0]],
  ['head', 'neck', [0, 1.56, 0], { role: 'head' }],
  ['head_top', 'head', [0, 1.75, 0]],
  ['shoulder.L', 'chest', [0.10, 1.42, 0]],
  ['upper_arm.L', 'shoulder.L', [0.19, 1.40, 0]],
  ['forearm.L', 'upper_arm.L', [0.44, 1.24, 0]],
  ['hand.L', 'forearm.L', [0.66, 1.06, 0]],
  ['hand_tip.L', 'hand.L', [0.74, 1.00, 0]],
  ['shoulder.R', 'chest', [-0.10, 1.42, 0]],
  ['upper_arm.R', 'shoulder.R', [-0.19, 1.40, 0]],
  ['forearm.R', 'upper_arm.R', [-0.44, 1.24, 0]],
  ['hand.R', 'forearm.R', [-0.66, 1.06, 0]],
  ['hand_tip.R', 'hand.R', [-0.74, 1.00, 0]],
  ['thigh.L', 'hips', [0.09, 0.98, 0]],
  ['shin.L', 'thigh.L', [0.11, 0.54, 0]],
  ['foot.L', 'shin.L', [0.12, 0.10, 0]],
  ['toe.L', 'foot.L', [0.12, 0.05, 0.16]],
  ['thigh.R', 'hips', [-0.09, 0.98, 0]],
  ['shin.R', 'thigh.R', [-0.11, 0.54, 0]],
  ['foot.R', 'shin.R', [-0.12, 0.10, 0]],
  ['toe.R', 'foot.R', [-0.12, 0.05, 0.16]],
];

// ---------------- animal (quadruped) ----------------

export function buildAnimalMesh() {
  const P = [];
  P.push(capsuleBetween(0, 0.55, -0.26, 0, 0.57, 0.20, 0.165));  // body
  P.push(sphereAt(0, 0.56, 0.20, 0.165));                         // chest
  P.push(sphereAt(0, 0.55, -0.26, 0.155));                        // rump
  P.push(capsuleBetween(0, 0.62, 0.30, 0, 0.78, 0.42, 0.085));    // neck
  P.push(sphereAt(0, 0.82, 0.48, 0.105));                         // head
  P.push(capsuleBetween(0, 0.78, 0.55, 0, 0.765, 0.66, 0.048));   // snout
  for (const s of [1, -1]) {
    P.push(capsuleBetween(s * 0.055, 0.90, 0.44, s * 0.095, 1.01, 0.41, 0.030)); // ear
    for (const z of [0.18, -0.22]) {
      P.push(capsuleBetween(s * 0.10, 0.52, z, s * 0.10, 0.28, z, 0.050));       // upper leg
      P.push(capsuleBetween(s * 0.10, 0.28, z, s * 0.10, 0.05, z - 0.02, 0.040));// lower leg
      P.push(sphereAt(s * 0.10, 0.045, z + 0.01, 0.050));                        // paw
    }
  }
  P.push(capsuleBetween(0, 0.60, -0.36, 0, 0.70, -0.54, 0.034));  // tail 1
  P.push(capsuleBetween(0, 0.70, -0.54, 0, 0.77, -0.70, 0.024));  // tail 2
  return makeMesh(P, 0xd7a35f);
}

export const ANIMAL_JOINTS = [
  ['hips', null, [0, 0.56, -0.24]],
  ['spine', 'hips', [0, 0.57, -0.04]],
  ['chest', 'spine', [0, 0.57, 0.16]],
  ['neck', 'chest', [0, 0.66, 0.32]],
  ['head', 'neck', [0, 0.80, 0.44], { role: 'head' }],
  ['snout', 'head', [0, 0.78, 0.62]],
  ['jaw', 'head', [0, 0.73, 0.52], { role: 'jaw', face: true }],
  ['jaw_tip', 'jaw', [0, 0.70, 0.63], { face: true }],
  ['eye.L', 'head', [0.055, 0.86, 0.52], { role: 'eyeL', face: true }],
  ['eye.R', 'head', [-0.055, 0.86, 0.52], { role: 'eyeR', face: true }],
  ['brow.L', 'head', [0.06, 0.90, 0.50], { role: 'browL', face: true }],
  ['brow.R', 'head', [-0.06, 0.90, 0.50], { role: 'browR', face: true }],
  ['ear.L', 'head', [0.055, 0.90, 0.44], { role: 'earL', dynamic: true }],
  ['ear_tip.L', 'ear.L', [0.095, 1.01, 0.41], { dynamic: true }],
  ['ear.R', 'head', [-0.055, 0.90, 0.44], { role: 'earR', dynamic: true }],
  ['ear_tip.R', 'ear.R', [-0.095, 1.01, 0.41], { dynamic: true }],
  ['front_leg.L', 'chest', [0.10, 0.52, 0.18]],
  ['front_knee.L', 'front_leg.L', [0.10, 0.28, 0.18]],
  ['front_paw.L', 'front_knee.L', [0.10, 0.05, 0.17]],
  ['front_leg.R', 'chest', [-0.10, 0.52, 0.18]],
  ['front_knee.R', 'front_leg.R', [-0.10, 0.28, 0.18]],
  ['front_paw.R', 'front_knee.R', [-0.10, 0.05, 0.17]],
  ['back_leg.L', 'hips', [0.10, 0.52, -0.22]],
  ['back_knee.L', 'back_leg.L', [0.10, 0.28, -0.22]],
  ['back_paw.L', 'back_knee.L', [0.10, 0.05, -0.23]],
  ['back_leg.R', 'hips', [-0.10, 0.52, -0.22]],
  ['back_knee.R', 'back_leg.R', [-0.10, 0.28, -0.22]],
  ['back_paw.R', 'back_knee.R', [-0.10, 0.05, -0.23]],
  ['tail_1', 'hips', [0, 0.60, -0.36], { dynamic: true }],
  ['tail_2', 'tail_1', [0, 0.70, -0.54], { dynamic: true }],
  ['tail_3', 'tail_2', [0, 0.77, -0.70], { dynamic: true }],
];

// ---------------- face rig template ----------------
// Placed relative to a head anchor joint; s scales the whole face.
// Parents are roles/anchor so it can attach to any skeleton with a head.
export function faceJointSpec(s = 1) {
  return [
    ['jaw', 'HEAD', [0, -0.06 * s, 0.06 * s], { role: 'jaw', face: true }],
    ['jaw_tip', 'jaw', [0, -0.10 * s, 0.13 * s], { face: true }],
    ['lip_low', 'jaw', [0, -0.085 * s, 0.115 * s], { role: 'lipLow', face: true }],
    ['lip_up', 'HEAD', [0, -0.045 * s, 0.12 * s], { role: 'lipUp', face: true }],
    ['mouth.L', 'HEAD', [0.045 * s, -0.065 * s, 0.105 * s], { role: 'mouthL', face: true }],
    ['mouth.R', 'HEAD', [-0.045 * s, -0.065 * s, 0.105 * s], { role: 'mouthR', face: true }],
    ['eye.L', 'HEAD', [0.05 * s, 0.02 * s, 0.11 * s], { role: 'eyeL', face: true }],
    ['eye.R', 'HEAD', [-0.05 * s, 0.02 * s, 0.11 * s], { role: 'eyeR', face: true }],
    ['brow.L', 'HEAD', [0.055 * s, 0.075 * s, 0.105 * s], { role: 'browL', face: true }],
    ['brow.R', 'HEAD', [-0.055 * s, 0.075 * s, 0.105 * s], { role: 'browR', face: true }],
    ['cheek.L', 'HEAD', [0.075 * s, -0.02 * s, 0.08 * s], { role: 'cheekL', face: true }],
    ['cheek.R', 'HEAD', [-0.075 * s, -0.02 * s, 0.08 * s], { role: 'cheekR', face: true }],
  ];
}

// ---------------- expression presets ----------------
// Per face-bone role: p = position offset (scaled by face scale), e = euler degrees.
export const EXPRESSIONS = {
  'Neutral': {},
  'Smile': {
    mouthL: { p: [0.02, 0.018, 0.004] }, mouthR: { p: [-0.02, 0.018, 0.004] },
    cheekL: { p: [0.004, 0.012, 0] }, cheekR: { p: [-0.004, 0.012, 0] },
    browL: { p: [0, 0.006, 0] }, browR: { p: [0, 0.006, 0] },
    lipUp: { p: [0, 0.005, 0] },
  },
  'Sad': {
    mouthL: { p: [-0.006, -0.016, 0] }, mouthR: { p: [0.006, -0.016, 0] },
    browL: { p: [0.008, 0.012, 0], e: [0, 0, -12] }, browR: { p: [-0.008, 0.012, 0], e: [0, 0, 12] },
    lipLow: { p: [0, 0.004, 0] },
  },
  'Angry': {
    browL: { p: [0.010, -0.014, 0], e: [0, 0, 18] }, browR: { p: [-0.010, -0.014, 0], e: [0, 0, -18] },
    mouthL: { p: [0, -0.008, 0] }, mouthR: { p: [0, -0.008, 0] },
    jaw: { e: [6, 0, 0] },
  },
  'Surprised': {
    browL: { p: [0, 0.022, 0] }, browR: { p: [0, 0.022, 0] },
    jaw: { e: [24, 0, 0] },
    mouthL: { p: [-0.008, -0.004, 0] }, mouthR: { p: [0.008, -0.004, 0] },
  },
  'Jaw Open': { jaw: { e: [30, 0, 0] } },
  'Wink': { eyeL: { e: [26, 0, 0] }, cheekL: { p: [0.003, 0.010, 0] } },
};
