import * as THREE from 'three';
import { makePivot, distanceXZ } from './Effects.js';

export class MaskActor {
  constructor(scene, entry) {
    this.entry = entry;
    this.pivot = makePivot(entry);
    const a = entry.artifact;
    this.range = a.proximityTrigger ?? 6;
    this.maxYaw = THREE.MathUtils.degToRad(a.maxYaw ?? 60);
    this.faceOffset = THREE.MathUtils.degToRad(a.faceOffset ?? 0);
  }

  update(dt, camPos) {
    const c = this.entry.focus.center;
    let target = 0;

    if (distanceXZ(c, camPos) < this.range) {
      const toCam = Math.atan2(camPos.x - c.x, camPos.z - c.z);
      let local = toCam - this.entry.root.rotation.y - this.faceOffset;
      local = Math.atan2(Math.sin(local), Math.cos(local)); // [-π, π]
      target = THREE.MathUtils.clamp(local, -this.maxYaw, this.maxYaw);
    }
    this.pivot.rotation.y = THREE.MathUtils.damp(this.pivot.rotation.y, target, 4, dt);
  }
}