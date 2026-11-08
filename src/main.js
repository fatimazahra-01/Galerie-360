// main.js
import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager.js';

const loadingManager = new THREE.LoadingManager();

loadingManager.onProgress = (url, loaded, total) => {
  const pct = Math.round((loaded / total) * 100);
  document.getElementById('loader-bar').style.width = pct + '%';
};
loadingManager.onLoad = () => {
  document.getElementById('loader').classList.add('hidden');
};

const sm = new SceneManager(document.getElementById('scene-canvas'), loadingManager);
window.addEventListener('resize', () => sm.onResize());

function animate() {
  requestAnimationFrame(animate);
  sm.controls.update(); 
  sm.renderer.render(sm.scene, sm.camera);
}
animate();