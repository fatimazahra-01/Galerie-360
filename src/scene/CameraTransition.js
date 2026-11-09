import gsap from 'gsap';

export class CameraTransition {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.saved = null;
  }

  zoomTo(artifact, onComplete) {
    this.controls.enabled = false;

    this.saved = {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      fov: this.camera.fov
    };

    const [tx, ty, tz] = artifact.cameraTarget || artifact.hotspotPosition;

    const tl = gsap.timeline({ onComplete });

    tl.to(this.controls.target, {
      x: tx, y: ty, z: tz,
      duration: 1.5, ease: 'power2.inOut',
      onUpdate: () => this.controls.update()
    }, 0);

    tl.to(this.camera, {
      fov: 25,
      duration: 1.5, ease: 'power2.inOut',
      onUpdate: () => this.camera.updateProjectionMatrix()
    }, 0);

    tl.to('#fade-overlay', { opacity: 1, duration: 0.6 }, 1.0);
  }

  // --- ÉTAPE 9 : TRANSITION RETOUR (ARTEFACT -> SALLE) ---
  zoomBack(onComplete) {
    if (!this.saved) return;
    const s = this.saved;
    const tl = gsap.timeline({
      onComplete: () => {
        this.controls.enabled = true;
        onComplete && onComplete();
      }
    });
    tl.to('#fade-overlay', { opacity: 0, duration: 0.6 }, 0);
    tl.to(this.controls.target, {
      x: s.target.x, y: s.target.y, z: s.target.z,
      duration: 1.5, ease: 'power2.inOut',
      onUpdate: () => this.controls.update()
    }, 0);
    tl.to(this.camera, {
      fov: s.fov,
      duration: 1.5, ease: 'power2.inOut',
      onUpdate: () => this.camera.updateProjectionMatrix()
    }, 0);
  }
}