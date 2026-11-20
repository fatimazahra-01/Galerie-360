import * as THREE from 'three';
import { MummyActor } from './MummyActor.js';
import { MaskActor } from './MaskActor.js';
import { VaseActor } from './VaseActor.js';

const GAGS = { mummy: MummyActor, maskFollow: MaskActor, vaseBoo: VaseActor };
const _cam = new THREE.Vector3();

export class ActorManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.actors = new Map();
  }

  // À appeler après placer.load()
  init(placer) {
    for (const [id, entry] of placer.entries) {
      const Gag = GAGS[entry.artifact.gag];
      if (Gag) this.actors.set(id, new Gag(this.scene, entry));
    }
  }

  update(dt) {
    if (!this.actors.size) return;
    this.camera.getWorldPosition(_cam);
    for (const actor of this.actors.values()) actor.update(dt, _cam);
  }

  trigger(id) {
    this.actors.get(id)?.trigger?.();
  }
}