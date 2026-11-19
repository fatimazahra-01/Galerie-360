import * as THREE from 'three';

export class Interaction {
  constructor(camera, placer, room, onSelect) {
    this.camera = camera;
    this.placer = placer;
    this.room = room;
    this.onSelect = onSelect;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 8;
    this.center = new THREE.Vector2(0, 0);
    this.targets = [];
    this.hoveredId = null;
    this.enabled = true;
    this.crosshair = document.getElementById('crosshair');
  }

  // À appeler une fois les objets placés
  refreshTargets() {
    this.targets = [...this.placer.roots, ...this.room.occluders];
  }

  _findArtifactId(object) {
    let o = object;
    while (o) {
      if (o.userData && o.userData.artifactId) return o.userData.artifactId;
      o = o.parent;
    }
    return null;
  }

  _setHover(id) {
    if (id === this.hoveredId) return;
    if (this.hoveredId) this.placer.setHighlight(this.hoveredId, false);
    this.hoveredId = id;
    if (id) this.placer.setHighlight(id, true);
    this.crosshair?.classList.toggle('active', !!id);
  }

  update() {
    if (!this.enabled) {
      this._setHover(null);
      return;
    }
    this.raycaster.setFromCamera(this.center, this.camera);
    const hits = this.raycaster.intersectObjects(this.targets, true);
    const id = hits.length > 0 ? this._findArtifactId(hits[0].object) : null;
    this._setHover(id);
  }

  click() {
    if (!this.hoveredId) return;
    const artifact = this.placer.getArtifact(this.hoveredId);
    if (artifact) this.onSelect(artifact);
  }
}