import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Navigation {
  constructor(camera, domElement, room) {
    this.camera = camera;
    this.room = room;
    this.controls = new PointerLockControls(camera, domElement);

    this.enabled = true;
    this.eyeHeight = 1.7;
    this.playerRadius = 0.35;
    this.speed = 3;            // m/s
    this.sprintMultiplier = 1.8;
    this.damping = 8;          // plus grand = arrêt plus rapide

    this.velocity = new THREE.Vector2(); // x = droite, y = avant
    this._dir = new THREE.Vector2();
    this.keys = { forward: false, backward: false, left: false, right: false, sprint: false };

    this._bindKeys();
    this.controls.addEventListener('unlock', () => this._resetKeys());
  }

  get isLocked() {
    return this.controls.isLocked;
  }

  lock() {
    this.controls.lock();
  }

  unlock() {
    this.controls.unlock();
  }

  // e.code = touche physique : sur AZERTY, "Z" = KeyW et "Q" = KeyA, donc ZQSD fonctionne
  _setKey(code, value) {
    switch (code) {
      case 'KeyW': case 'ArrowUp': this.keys.forward = value; break;
      case 'KeyS': case 'ArrowDown': this.keys.backward = value; break;
      case 'KeyA': case 'ArrowLeft': this.keys.left = value; break;
      case 'KeyD': case 'ArrowRight': this.keys.right = value; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = value; break;
    }
  }

  _bindKeys() {
    window.addEventListener('keydown', (e) => this._setKey(e.code, true));
    window.addEventListener('keyup', (e) => this._setKey(e.code, false));
    window.addEventListener('blur', () => this._resetKeys());
  }

  _resetKeys() {
    Object.keys(this.keys).forEach((k) => (this.keys[k] = false));
  }

  // Limites de la salle + cercles de collision (socles, colonnes)
  constrain(position) {
    const { width, depth } = this.room.size;
    const hx = width / 2 - this.playerRadius;
    const hz = depth / 2 - this.playerRadius;
    position.x = THREE.MathUtils.clamp(position.x, -hx, hx);
    position.z = THREE.MathUtils.clamp(position.z, -hz, hz);

    for (const c of this.room.colliders) {
      const dx = position.x - c.x;
      const dz = position.z - c.z;
      const min = c.r + this.playerRadius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.0001;
        position.x = c.x + (dx / d) * min;
        position.z = c.z + (dz / d) * min;
      }
    }
  }

  update(dt) {
    if (!this.enabled || !this.controls.isLocked) {
      this.velocity.set(0, 0);
      return;
    }

    const accel = this.damping * this.speed * (this.keys.sprint ? this.sprintMultiplier : 1);

    this._dir.set(
      (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0),
      (this.keys.forward ? 1 : 0) - (this.keys.backward ? 1 : 0)
    );
    if (this._dir.lengthSq() > 0) this._dir.normalize();

    // inertie (damping)
    this.velocity.x -= this.velocity.x * this.damping * dt;
    this.velocity.y -= this.velocity.y * this.damping * dt;
    this.velocity.x += this._dir.x * accel * dt;
    this.velocity.y += this._dir.y * accel * dt;

    this.controls.moveRight(this.velocity.x * dt);
    this.controls.moveForward(this.velocity.y * dt);

    this.constrain(this.camera.position);
    this.camera.position.y = this.eyeHeight;
  }
}