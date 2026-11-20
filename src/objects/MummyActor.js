import * as THREE from 'three';
import gsap from 'gsap';
import { AnimationPlayer } from './AnimationPlayer.js';
import { SpeechBubble } from './SpeechBubble.js';
import { makePivot, distanceXZ, proceduralWave, proceduralStartle } from './Effects.js';

export class MummyActor {
  constructor(scene, entry) {
    this.entry = entry;
    const a = entry.artifact;
    this.range = a.proximityTrigger ?? 3;
    this.startleRange = a.startleDistance ?? 1.7;
    this.lines = a.speech ?? ['Salut !', "Tu m'as réveillé..."];
    this.cooldown = 0;
    this.greeted = false;
    this.startled = false;
    this.greetTimer = null;

    // Animations du GLB (si présentes)
    this.player = entry.animations?.length
      ? new AnimationPlayer(entry.model, entry.animations, a.animations)
      : null;
    this.player?.play('idle');

    // Cible des gags procéduraux (fallback)
    this.target = makePivot(entry);

    // Bulle au-dessus de la tête
    const box = new THREE.Box3().setFromObject(entry.root);
    const c = entry.focus.center;
    this.bubble = new SpeechBubble(new THREE.Vector3(c.x, box.max.y + 0.45, c.z));
    scene.add(this.bubble.sprite);
  }

  update(dt, camPos) {
    this.player?.update(dt);
    this.cooldown -= dt;
    const d = distanceXZ(this.entry.focus.center, camPos);

    if (!this.greeted && this.cooldown <= 0 && d < this.range) {
      this.greet();
    } else if (this.greeted && d > this.range + 0.8) {
      this.greeted = false;
      this.greetTimer?.kill();
      this.bubble.hide();
    }

    if (!this.startled && d < this.startleRange) {
      this.startle();
    } else if (this.startled && d > this.startleRange + 0.6) {
      this.startled = false;
    }
  }

  greet() {
    this.greeted = true;
    this.cooldown = 8;
    if (!this.player?.playOnce('wave', 'idle')) {
      proceduralWave(this.target);
    }

    this.bubble.show(this.lines[0], 0);
    this.greetTimer?.kill();
    this.greetTimer = gsap.delayedCall(2, () => {
      if (this.greeted && !this.startled) {
        this.bubble.show(this.lines[1] ?? this.lines[0], 3);
      }
    });

    // C écoute cet événement pour jouer la voix (object = racine 3D, pour PositionalAudio)
    window.dispatchEvent(new CustomEvent('mummy:wave', {
      detail: {
        id: this.entry.artifact.id,
        object: this.entry.root,
        text: this.lines[0]
      }
    }));
  }

  startle() {
    this.startled = true;
    this.greetTimer?.kill();
    proceduralStartle(this.target);
    this.bubble.show('AAAH ! Pas si près !', 2);
  }

  trigger() {
    this.cooldown = 0;
    this.greet();
  }
}