import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

export class VRManager {
  constructor(sm, navigation, room) {
    this.sm = sm;
    this.renderer = sm.renderer;
    this.camera = sm.camera;
    this.rig = sm.rig;
    this.navigation = navigation;
    this.room = room;

    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.controllers = [];
    this.lastHead = new THREE.Vector3();
    this.saved = { quaternion: new THREE.Quaternion() };

    // Anneau qui indique le point de téléportation
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd27a })
    );
    this.marker.visible = false;
    sm.scene.add(this.marker);

    this._setupControllers();
    this._setupSessionEvents();

    document.body.appendChild(VRButton.createButton(this.renderer));
  }

  _buildRay() {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    line.scale.z = 4;
    return line;
  }

  _setupControllers() {
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.userData.hit = null;
      controller.add(this._buildRay());
      controller.addEventListener('selectend', () => this._teleport(controller));
      this.rig.add(controller); // enfants du rig : ils suivent la téléportation
      this.controllers.push(controller);
    }
  }

  _setupSessionEvents() {
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.saved.quaternion.copy(this.camera.quaternion);
      // Le joueur commence là où il se trouvait en mode normal
      this.rig.position.set(this.camera.position.x, 0, this.camera.position.z);
      this.navigation.unlock();
      this.navigation.enabled = false;
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      const x = this.rig.position.x + this.lastHead.x;
      const z = this.rig.position.z + this.lastHead.z;
      this.rig.position.set(0, 0, 0);
      this.camera.position.set(x, this.navigation.eyeHeight, z);
      this.camera.quaternion.copy(this.saved.quaternion);
      this.navigation.enabled = true;
      this.marker.visible = false;
      this.sm.onResize(); // réinitialise la matrice de projection
    });
  }

  _castFloor(controller) {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
    const hits = this.raycaster.intersectObject(this.room.floor, false);
    return hits.length > 0 ? hits[0].point.clone() : null;
  }

  _teleport(controller) {
    const p = controller.userData.hit;
    if (!p) return;
    const target = new THREE.Vector3(p.x, 0, p.z);
    this.navigation.constrain(target); // respecte murs, socles, colonnes
    this.rig.position.set(
      target.x - this.camera.position.x,
      0,
      target.z - this.camera.position.z
    );
  }

  // À appeler à chaque frame
  update() {
    if (!this.renderer.xr.isPresenting) return;

    this.lastHead.copy(this.camera.position);

    let hit = null;
    for (const c of this.controllers) {
      c.userData.hit = this._castFloor(c);
      if (c.userData.hit && !hit) hit = c.userData.hit;
    }
    if (hit) this.marker.position.set(hit.x, 0.02, hit.z);
    this.marker.visible = !!hit;
  }
}