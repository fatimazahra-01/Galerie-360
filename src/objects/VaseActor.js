import * as THREE from 'three';
import gsap from 'gsap';
import { SpeechBubble } from './SpeechBubble.js';
import { makePivot, distanceXZ, proceduralShake, smokePuff } from './Effects.js';

export class VaseActor {
  constructor(scene, entry) {
    this.scene = scene;
    this.entry = entry;
    this.pivot = makePivot(entry);
    const a = entry.artifact;
    this.range = a.proximityTrigger ?? 2.5;
    this.lines = a.speech ?? ['BOO !'];
    this.cooldown = 0;
    this.near = false;

    const box = new THREE.Box3().setFromObject(entry.root);
    const c = entry.focus.center;
    this.top = new THREE.Vector3(c.x, box.max.y, c.z);
    this.bubble = new SpeechBubble(new THREE.Vector3(c.x, box.max.y + 0.4, c.z), 1.0);
    scene.add(this.bubble.sprite);
  }

  update(dt, camPos) {
    this.cooldown -= dt;
    const d = distanceXZ(this.entry.focus.center, camPos);

    if (!this.near && this.cooldown <= 0 && d < this.range) {
      this.near = true;
      this.boo();
    } else if (this.near && d > this.range + 0.8) {
      this.near = false;
    }
  }

  boo() {
    this.cooldown = 10;
    proceduralShake(this.pivot);
    gsap.delayedCall(0.6, () => {
      this.bubble.show(this.lines[0], 1.8);
      smokePuff(this.scene, this.top);
    });
  }

  trigger() {
    this.cooldown = 0;
    this.boo();
  }
}