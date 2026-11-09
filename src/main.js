import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager.js';
import { Hotspots } from './scene/Hotspots.js';
import { CameraTransition } from './scene/CameraTransition.js';

const loadingManager = new THREE.LoadingManager();

loadingManager.onProgress = (url, loaded, total) => {
  const pct = Math.round((loaded / total) * 100);
  const bar = document.getElementById('loader-bar');
  if (bar) bar.style.width = pct + '%';
};

loadingManager.onLoad = () => {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.add('hidden');
};

const sm = new SceneManager(document.getElementById('scene-canvas'), loadingManager);
window.addEventListener('resize', () => sm.onResize());

const transition = new CameraTransition(sm.camera, sm.controls);
let hotspots = null;

async function initHotspots() {
  try {
    const artifacts = await fetch('/artifacts.json').then((r) => r.json());
    hotspots = new Hotspots(sm.scene, artifacts);

    // Étape 11 : Agrandir légèrement la taille des sprites sur mobile
    const isMobile = window.innerWidth <= 768;
    if (isMobile && hotspots.list) {
      hotspots.list.forEach((s) => {
        s.userData.baseScale *= 1.3;
        s.scale.set(s.userData.baseScale, s.userData.baseScale, 1);
      });
    }
  } catch (error) {
    console.error('Erreur lors du chargement de artifacts.json :', error);
  }
}

initHotspots();

// --- GESTION DU HOVER ET CLIC / TACTILE ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hovered = null;

window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

function checkHover() {
  if (!hotspots || !hotspots.list) return;

  raycaster.setFromCamera(mouse, sm.camera);
  const hits = raycaster.intersectObjects(hotspots.list);

  if (hits.length > 0) {
    hovered = hits[0].object;
    canvas.style.cursor = 'pointer'; // Force le curseur pointer sur le canvas
  } else {
    hovered = null;
    canvas.style.cursor = 'grab'; // Remet la main ouverte
  }
}

const canvas = document.getElementById('scene-canvas');
canvas.addEventListener('click', () => {
  if (hovered) {
    selectArtifact(hovered.userData.artifact);
  }
});

function selectArtifact(artifact) {
  if (!artifact.cameraTarget) {
    artifact.cameraTarget = artifact.hotspotPosition;
  }

  transition.zoomTo(artifact, () => {
    window.dispatchEvent(new CustomEvent('artifact:select', { detail: artifact }));
    sm.pauseRender = true;
  });
}

// --- ÉTAPE 9 : ÉCOUTE DE ARTIFACT:CLOSE ---
window.addEventListener('artifact:close', () => {
  sm.pauseRender = false; // on reprend le rendu
  transition.zoomBack();
});

// --- ÉTAPE 11 : ZOOM FOV AU PINCEMENT (MOBILE) ---
let initialPinchDistance = null;
let initialFov = null;

canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    initialPinchDistance = Math.hypot(dx, dy);
    initialFov = sm.camera.fov;
  }
});

canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && initialPinchDistance) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const currentDistance = Math.hypot(dx, dy);
    const factor = initialPinchDistance / currentDistance;

    sm.camera.fov = Math.max(30, Math.min(90, initialFov * factor));
    sm.camera.updateProjectionMatrix();
  }
});

canvas.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) {
    initialPinchDistance = null;
  }
});

// --- ANIMATION DES HOTSPOTS ---
const clock = new THREE.Clock();

function updateHotspots() {
  if (!hotspots || !hotspots.list) return;

  const t = clock.getElapsedTime();

  hotspots.list.forEach((s) => {
    const base = s.userData.baseScale;
    const isHover = s === hovered;

    const pulse = 1 + Math.sin(t * 3) * 0.1;
    const target = base * pulse * (isHover ? 1.4 : 1);

    s.scale.x += (target - s.scale.x) * 0.15;
    s.scale.y += (target - s.scale.y) * 0.15;
    s.material.opacity += ((isHover ? 1 : 0.75) - s.material.opacity) * 0.15;
  });
}

// --- BOUCLE DE RENDU PRINCIPALE ---
function animate() {
  requestAnimationFrame(animate);
  
  // Étape 9 : suspension du rendu si pauseRender est à true
  if (sm.pauseRender) return;

  sm.controls.update();
  checkHover();
  updateHotspots();
  sm.renderer.render(sm.scene, sm.camera);
}

animate();