// rigcore.js — joint/bone data model, auto-connect snapping, automatic
// skin weight binding, and spring-bone physics for RigStudio 3D.
import * as THREE from 'three';

let _nextId = 1;
export function resetIdCounter(n) { _nextId = Math.max(_nextId, n | 0); }

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();

export class Rig {
  constructor() {
    this.joints = [];               // {id,name,parent,children[],pos,dynamic,face,role}
    this.bound = false;             // skeleton + skinned meshes exist
    this.dirty = false;             // skeleton edited since last bind
    this.rigRoot = null;            // Object3D holding root bones
    this.bones = new Map();         // joint id -> THREE.Bone
    this.boneList = [];             // bones in joint order
    this.skeleton = null;
    this.skinnedMeshes = [];
    this.physics = { enabled: true, gravity: 5.0, stiffness: 0.12, damping: 0.12 };
    this._dyn = [];                 // spring-bone particle states
  }

  // ---------- skeleton editing (build mode) ----------

  addJoint(pos, parent = null, opts = {}) {
    const j = {
      id: opts.id || _nextId++,
      name: opts.name || 'bone_' + _nextId,
      parent: null,
      children: [],
      pos: pos.clone(),
      dynamic: !!opts.dynamic,
      face: !!opts.face,
      role: opts.role || null,
    };
    _nextId = Math.max(_nextId, j.id + 1);
    this.joints.push(j);
    if (parent) this.setParent(j, parent);
    this.dirty = true;
    return j;
  }

  removeJoint(j) {
    // children get re-parented to j's parent so chains stay connected
    for (const c of [...j.children]) this.setParent(c, j.parent);
    if (j.parent) j.parent.children.splice(j.parent.children.indexOf(j), 1);
    this.joints.splice(this.joints.indexOf(j), 1);
    this.dirty = true;
  }

  setParent(j, parent) {
    if (parent === j || (parent && this.isDescendant(parent, j))) return false;
    if (j.parent) j.parent.children.splice(j.parent.children.indexOf(j), 1);
    j.parent = parent || null;
    if (parent) parent.children.push(j);
    this.dirty = true;
    return true;
  }

  isDescendant(maybeChild, ancestor) {
    let p = maybeChild.parent;
    while (p) { if (p === ancestor) return true; p = p.parent; }
    return false;
  }

  nearestJoint(pos, exclude = null, maxDist = Infinity) {
    let best = null, bestD = maxDist;
    const skip = new Set();
    if (exclude) { // exclude the joint and its whole subtree
      const stack = [exclude];
      while (stack.length) { const n = stack.pop(); skip.add(n); stack.push(...n.children); }
    }
    for (const j of this.joints) {
      if (skip.has(j)) continue;
      const d = j.pos.distanceTo(pos);
      if (d < bestD) { bestD = d; best = j; }
    }
    return best;
  }

  clear(scene) {
    this.unbind(scene);
    this.joints.length = 0;
    this.dirty = false;
  }

  byId(id) { return this.joints.find(j => j.id === id) || null; }
  byRole(role) { return this.joints.find(j => j.role === role) || null; }

  // joints ordered so parents always precede children
  topoOrder() {
    const out = [], seen = new Set();
    const visit = (j) => {
      if (seen.has(j)) return;
      if (j.parent) visit(j.parent);
      seen.add(j); out.push(j);
    };
    for (const j of this.joints) visit(j);
    return out;
  }

  // ---------- binding: build THREE skeleton + auto skin weights ----------

  unbind(scene) {
    for (const sm of this.skinnedMeshes) {
      sm.removeFromParent();
      sm.geometry.dispose();
    }
    this.skinnedMeshes.length = 0;
    if (this.rigRoot) { this.rigRoot.removeFromParent(); this.rigRoot = null; }
    this.bones.clear();
    this.boneList.length = 0;
    this.skeleton = null;
    this._dyn.length = 0;
    this.bound = false;
  }

  buildSegments(order) {
    // Every joint owns the segments running to its children; leaf joints get a
    // short virtual tail so they still receive localized skin weights.
    const idx = new Map(order.map((j, i) => [j, i]));
    const segs = [];
    for (const j of order) {
      const bi = idx.get(j);
      for (const c of j.children) segs.push({ a: j.pos, b: c.pos, bone: bi });
      if (j.children.length === 0) {
        const dir = j.parent ? _v1.copy(j.pos).sub(j.parent.pos) : _v1.set(0, 0.1, 0);
        const len = Math.max(0.02, dir.length() * 0.5);
        dir.normalize();
        segs.push({ a: j.pos, b: j.pos.clone().addScaledVector(dir, len), bone: bi });
      }
    }
    return segs;
  }

  bind(meshes, scene, onProgress) {
    if (this.joints.length === 0) return false;
    this.unbind(scene);
    const order = this.topoOrder();
    this.joints = order;

    // Bones: rest pose is pure translation offsets, identity rotations.
    this.rigRoot = new THREE.Object3D();
    this.rigRoot.name = 'RigRoot';
    scene.add(this.rigRoot);
    for (const j of order) {
      const b = new THREE.Bone();
      b.name = j.name;
      if (j.parent) {
        b.position.copy(j.pos).sub(j.parent.pos);
        this.bones.get(j.parent.id).add(b);
      } else {
        b.position.copy(j.pos);
        this.rigRoot.add(b);
      }
      b.userData.joint = j;
      b.userData.restPos = b.position.clone();
      this.bones.set(j.id, b);
      this.boneList.push(b);
    }
    this.rigRoot.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.boneList);

    // Auto weights: nearest 4 bone segments, inverse-distance^4 falloff.
    const segs = this.buildSegments(order);
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      const geo = mesh.geometry;
      const posAttr = geo.attributes.position;
      const count = posAttr.count;
      const skinIndex = new Uint16Array(count * 4);
      const skinWeight = new Float32Array(count * 4);
      const cand = [];
      for (let i = 0; i < count; i++) {
        _v1.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
        cand.length = 0;
        for (let s = 0; s < segs.length; s++) {
          const d2 = distSqPointSegment(_v1, segs[s].a, segs[s].b) + 1e-6;
          if (cand.length < 4) {
            cand.push({ d2, bone: segs[s].bone });
            if (cand.length === 4) cand.sort((x, y) => x.d2 - y.d2);
          } else if (d2 < cand[3].d2) {
            cand[3] = { d2, bone: segs[s].bone };
            cand.sort((x, y) => x.d2 - y.d2);
          }
        }
        let sum = 0;
        for (let k = 0; k < cand.length; k++) { cand[k].w = 1 / (cand[k].d2 * cand[k].d2); sum += cand[k].w; }
        for (let k = 0; k < 4; k++) {
          skinIndex[i * 4 + k] = k < cand.length ? cand[k].bone : 0;
          skinWeight[i * 4 + k] = k < cand.length ? cand[k].w / sum : 0;
        }
        if (onProgress && (i & 4095) === 0) onProgress(i / count);
      }
      const smGeo = geo.clone();
      smGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
      smGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
      const sm = new THREE.SkinnedMesh(smGeo, mesh.material);
      sm.frustumCulled = false;
      sm.applyMatrix4(mesh.matrixWorld);
      scene.add(sm);
      sm.updateMatrixWorld(true);
      sm.bind(this.skeleton, sm.matrixWorld.clone());
      this.skinnedMeshes.push(sm);
    }

    this.initPhysics();
    this.bound = true;
    this.dirty = false;
    return true;
  }

  resetPose() {
    for (const b of this.boneList) {
      b.quaternion.identity();
      b.position.copy(b.userData.restPos);
    }
    this.initPhysics();
  }

  worldPos(j, out) {
    if (this.bound && this.bones.has(j.id)) return this.bones.get(j.id).getWorldPosition(out);
    return out.copy(j.pos);
  }

  // ---------- spring-bone physics ----------

  initPhysics() {
    this._dyn.length = 0;
    if (!this.bones.size) return;
    for (const j of this.joints) {
      if (!j.dynamic) continue;
      const bone = this.bones.get(j.id);
      // the bone swings toward its tail: first child, or a virtual tail for leaves
      let tailRest;
      if (j.children.length > 0) {
        tailRest = _v1.copy(j.children[0].pos).sub(j.pos).clone();
      } else if (j.parent) {
        const d = _v1.copy(j.pos).sub(j.parent.pos);
        const len = Math.max(0.03, d.length() * 0.7);
        tailRest = d.normalize().multiplyScalar(len).clone();
      } else {
        tailRest = new THREE.Vector3(0, -0.15, 0);
      }
      const p = bone.getWorldPosition(new THREE.Vector3()).add(tailRest);
      this._dyn.push({ joint: j, bone, tailRest, len: tailRest.length(), p, pPrev: p.clone() });
    }
    // parents first so chains propagate top-down
    const orderIdx = new Map(this.joints.map((j, i) => [j, i]));
    this._dyn.sort((a, b) => orderIdx.get(a.joint) - orderIdx.get(b.joint));
  }

  stepPhysics(dt) {
    if (!this.bound || !this.physics.enabled || this._dyn.length === 0) return;
    dt = Math.min(dt, 1 / 20);
    this.rigRoot.updateMatrixWorld(true);
    const k = 1 - Math.pow(1 - this.physics.stiffness, dt * 60);
    const drag = Math.min(0.95, this.physics.damping);
    const g = this.physics.gravity;
    for (const s of this._dyn) {
      const bone = s.bone;
      const bonePos = _v1.setFromMatrixPosition(bone.matrixWorld);
      const qParent = bone.parent ? bone.parent.getWorldQuaternion(_q1) : _q1.identity();
      // where the tail would rest, following the animated parent
      const target = _v2.copy(s.tailRest).applyQuaternion(qParent).add(bonePos);
      // verlet integration
      _v3.copy(s.p).sub(s.pPrev).multiplyScalar(1 - drag);
      s.pPrev.copy(s.p);
      s.p.add(_v3);
      s.p.y -= g * dt * dt;
      s.p.lerp(target, k);
      // keep bone length
      s.p.sub(bonePos).setLength(s.len).add(bonePos);
      // rotate the bone so its tail points at the particle
      const restDir = _v2.copy(s.tailRest).applyQuaternion(qParent).normalize();
      const curDir = _v3.copy(s.p).sub(bonePos).normalize();
      _q2.setFromUnitVectors(restDir, curDir);
      _q3.copy(qParent).invert();
      bone.quaternion.copy(_q3).multiply(_q2).multiply(qParent);
      bone.updateWorldMatrix(false, true);
    }
  }

  // ---------- serialization ----------

  toJSON() {
    return {
      joints: this.joints.map(j => ({
        id: j.id, name: j.name, parent: j.parent ? j.parent.id : null,
        pos: [j.pos.x, j.pos.y, j.pos.z],
        dynamic: j.dynamic || undefined, face: j.face || undefined, role: j.role || undefined,
      })),
      physics: { ...this.physics },
    };
  }

  fromJSON(data, scene) {
    this.clear(scene);
    const byId = new Map();
    for (const jd of data.joints || []) {
      const j = this.addJoint(new THREE.Vector3().fromArray(jd.pos), null, {
        id: jd.id, name: jd.name, dynamic: !!jd.dynamic, face: !!jd.face, role: jd.role || null,
      });
      byId.set(jd.id, j);
    }
    for (const jd of data.joints || []) {
      if (jd.parent != null && byId.has(jd.parent)) this.setParent(byId.get(jd.id), byId.get(jd.parent));
    }
    if (data.physics) Object.assign(this.physics, data.physics);
    this.dirty = true;
  }
}

export function distSqPointSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = len2 > 0 ? (apx * abx + apy * aby + apz * abz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}
