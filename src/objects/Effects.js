import * as THREE from 'three';
import gsap from 'gsap';

export function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// Insère un pivot au centre de l'objet : les rotations se font autour du centre,
// peu importe où se trouve l'origine du modèle.
export function makePivot(entry) {
  if (entry.pivot) return entry.pivot;
  const { root, model, focus } = entry;
  const local = root.worldToLocal(focus.center.clone());
  const pivot = new THREE.Group();
  pivot.position.copy(local);
  root.add(pivot);
  pivot.add(model);
  model.position.sub(local);
  entry.pivot = pivot;
  return pivot;
}

// --- Gags procéduraux (marchent même sans animation dans le GLB) ---

function rest(target) {
  target.userData.rest ??= {
    pos: target.position.clone(),
    rot: target.rotation.clone()
  };
  const r = target.userData.rest;
  gsap.killTweensOf([target.position, target.rotation]);
  target.position.copy(r.pos);
  target.rotation.copy(r.rot);
  return r;
}

export function proceduralWave(target) {
  const r = rest(target);
  return gsap.timeline()
    .to(target.position, { y: r.pos.y + 0.12, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }, 0)
    .to(target.rotation, { z: r.rot.z + 0.3, duration: 0.14, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0.1)
    .to(target.rotation, { z: r.rot.z, duration: 0.15 });
}

export function proceduralStartle(target) {
  const r = rest(target);
  return gsap.timeline()
    .to(target.position, { y: r.pos.y + 0.15, duration: 0.1, ease: 'power2.out' }, 0)
    .to(target.rotation, { x: r.rot.x - 0.2, duration: 0.1, yoyo: true, repeat: 1 }, 0)
    .to(target.position, { y: r.pos.y, duration: 0.4, ease: 'bounce.out' });
}

export function proceduralDance(target, onDone) {
  const r = rest(target);
  const tl = gsap.timeline({
    onComplete: () => {
      rest(target);
      onDone?.();
    }
  });
  tl.to(target.rotation, { y: r.rot.y + Math.PI * 4, duration: 2.4, ease: 'power1.inOut' }, 0);
  tl.to(target.position, { y: r.pos.y + 0.12, duration: 0.2, yoyo: true, repeat: 11, ease: 'sine.inOut' }, 0);
  tl.to(target.rotation, { z: r.rot.z + 0.15, duration: 0.3, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0);
  return tl;
}

export function proceduralShake(target, onDone) {
  const r = rest(target);
  return gsap.timeline({
    onComplete: () => {
      rest(target);
      onDone?.();
    }
  })
    .to(target.rotation, { z: r.rot.z + 0.12, duration: 0.05, yoyo: true, repeat: 15, ease: 'none' }, 0)
    .to(target.rotation, { x: r.rot.x + 0.08, duration: 0.07, yoyo: true, repeat: 11, ease: 'none' }, 0)
    .to(target.rotation, { x: r.rot.x, z: r.rot.z, duration: 0.1 });
}

// --- Fumée ---

let smokeTexture;
function getSmokeTexture() {
  if (smokeTexture) return smokeTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  smokeTexture = new THREE.CanvasTexture(c);
  smokeTexture.colorSpace = THREE.SRGBColorSpace;
  return smokeTexture;
}

export function smokePuff(scene, position, count = 12) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: getSmokeTexture(),
      color: 0xcfc6b8,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    const s = new THREE.Sprite(mat);
    s.position.copy(position);
    s.position.x += (Math.random() - 0.5) * 0.15;
    s.position.z += (Math.random() - 0.5) * 0.15;
    const size = 0.15 + Math.random() * 0.15;
    s.scale.set(size, size, 1);
    scene.add(s);

    gsap.to(s.position, {
      x: s.position.x + (Math.random() - 0.5) * 0.6,
      y: s.position.y + 0.6 + Math.random() * 0.6,
      z: s.position.z + (Math.random() - 0.5) * 0.6,
      duration: 1.6 + Math.random() * 0.8,
      ease: 'power1.out'
    });
    gsap.to(s.scale, { x: size * 5, y: size * 5, duration: 2, ease: 'power1.out' });
    gsap.to(mat, {
      opacity: 0,
      duration: 2,
      delay: 0.2,
      onComplete: () => {
        scene.remove(s);
        mat.dispose();
      }
    });
  }
}