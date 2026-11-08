import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
  constructor(canvas, loadingManager) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();

    // 1. Caméra
    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 1100
    );
    this.camera.position.set(0, 0, 0.1);

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 3. Charger le panorama
    this.loader = new THREE.TextureLoader(loadingManager);
    this.createPanorama();

    // 4. Contrôles OrbitControls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = -0.3;
    this.controls.minPolarAngle = Math.PI * 0.2;
    this.controls.maxPolarAngle = Math.PI * 0.8;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 0.1;

    // 5. Zoom par FOV
    this.fovMin = 30;
    this.fovMax = 90;
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.fov = THREE.MathUtils.clamp(
        this.camera.fov + e.deltaY * 0.05,
        this.fovMin,
        this.fovMax
      );
      this.camera.updateProjectionMatrix();
    }, { passive: false });

    // Écoute de l'événement de redimensionnement de l'écran
    window.addEventListener('resize', () => this.onResize());
    
    this.animate();
  }

  createPanorama() {
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const texture = this.loader.load('/textures/panorama.jpg');
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshBasicMaterial({ map: texture });
    this.panorama = new THREE.Mesh(geometry, material);
    this.scene.add(this.panorama);
  }

 
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}