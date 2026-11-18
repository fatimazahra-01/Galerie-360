import * as THREE from 'three';
import gsap from 'gsap';

export class CameraTransition {
  constructor(camera, navigation) {
    this.camera = camera;
    this.navigation = navigation;
    this.saved = null;
    this.timeline = null;
  }

  zoomTo(artifact, focus, onComplete) {
    const camera = this.camera;
    this.navigation.enabled = false;

    // État sauvegardé pour le retour
    this.saved = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      fov: camera.fov
    };

    // Position d'arrivée : devant l'objet, du côté d'où l'on vient
    const center = focus.center;
    const dir = new THREE.Vector3(
      camera.position.x - center.x, 0, camera.position.z - center.z
    );
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();

    const distance = artifact.zoomDistance ?? Math.max(1.6, focus.size * 1.8);
    const endPos = center.clone().addScaledVector(dir, distance);

    const lookMatrix = new THREE.Matrix4().lookAt(endPos, center, camera.up);
    const endQuat = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);

    const startPos = this.saved.position.clone();
    const startQuat = this.saved.quaternion.clone();
    const state = { t: 0 };

    this.timeline?.kill();
    this.timeline = gsap.timeline({ onComplete });

    this.timeline.to(state, {
      t: 1,
      duration: 1.6,
      ease: 'power2.inOut',
      onUpdate: () => {
        camera.position.lerpVectors(startPos, endPos, state.t);
        camera.quaternion.copy(startQuat).slerp(endQuat, state.t);
      }
    }, 0);

    this.timeline.to(camera, {
      fov: 45,
      duration: 1.6,
      ease: 'power2.inOut',
      onUpdate: () => camera.updateProjectionMatrix()
    }, 0);

    // Fondu vers le mode artefact
    this.timeline.to('#fade-overlay', { opacity: 1, duration: 0.6 }, 1.0);
  }
    zoomBack(onComplete) {
    const camera = this.camera;

    if (!this.saved) {
      this.navigation.enabled = true;
      onComplete?.();
      return;
    }

    const s = this.saved;
    const startPos = camera.position.clone();
    const startQuat = camera.quaternion.clone();
    const state = { t: 0 };

    this.timeline?.kill();
    this.timeline = gsap.timeline({
      onComplete: () => {
        camera.position.copy(s.position);
        camera.quaternion.copy(s.quaternion);
        camera.fov = s.fov;
        camera.updateProjectionMatrix();
        this.navigation.enabled = true;
        this.saved = null;
        onComplete?.();
      }
    });

    this.timeline.to('#fade-overlay', { opacity: 0, duration: 0.6 }, 0);

    this.timeline.to(state, {
      t: 1,
      duration: 1.6,
      ease: 'power2.inOut',
      onUpdate: () => {
        camera.position.lerpVectors(startPos, s.position, state.t);
        camera.quaternion.copy(startQuat).slerp(s.quaternion, state.t);
      }
    }, 0);

    this.timeline.to(camera, {
      fov: s.fov,
      duration: 1.6,
      ease: 'power2.inOut',
      onUpdate: () => camera.updateProjectionMatrix()
    }, 0);
  }
}
