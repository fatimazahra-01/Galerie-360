import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager.js';
import { Room } from './scene/Room.js';
import { addBaseLights } from './scene/Lights.js';
import { Navigation } from './scene/Navigation.js';
import { ArtifactPlacer } from './scene/ArtifactPlacer.js';
import { Interaction } from './scene/Interaction.js';
import { CameraTransition } from './scene/CameraTransition.js';
import { VRManager } from './scene/VRManager.js';
const canvas = document.getElementById('scene-canvas');

// Loader (HTML/CSS par C)
const loadingManager = new THREE.LoadingManager();
const hideLoader = () => document.getElementById('loader')?.classList.add('hidden');
loadingManager.onProgress = (url, loaded, total) => {
  const bar = document.getElementById('loader-bar');
  if (bar) bar.style.width = Math.round((loaded / total) * 100) + '%';
};
loadingManager.onLoad = hideLoader;

const sm = new SceneManager(canvas);
const room = new Room();
sm.scene.add(room.group);
addBaseLights(sm.scene);

const navigation = new Navigation(sm.camera, canvas, room);
const placer = new ArtifactPlacer(sm.scene, room, loadingManager);
const transition = new CameraTransition(sm.camera, navigation);
const vr = new VRManager(sm, navigation, room);
const state = { inArtifact: false };

// Point d'intégration avec B et C
function selectArtifact(artifact) {
  if (state.inArtifact) return;
  state.inArtifact = true;
  navigation.unlock(); // libère la souris pour le panneau de C

  const focus = placer.getFocus(artifact.id);
  transition.zoomTo(artifact, focus, () => {
    window.dispatchEvent(new CustomEvent('artifact:select', { detail: artifact }));
    sm.pauseRender = true; // on suspend le rendu de la salle
  });
}

const interaction = new Interaction(sm.camera, placer, room, selectArtifact);

// Chargement des objets depuis artifacts.json
async function init() {
  try {
    const response = await fetch('/artifacts.json');
    if (!response.ok) throw new Error('artifacts.json introuvable');
    const artifacts = await response.json();
    await placer.load(artifacts);
    interaction.refreshTargets();
  } catch (error) {
    console.error('Erreur de chargement des artefacts :', error);
  }
  hideLoader();
}
init();

// Entrée dans la salle / clic sur un objet
canvas.addEventListener('click', () => {
  if (state.inArtifact) return;
  if (!navigation.isLocked) navigation.lock();
  else interaction.click();
});
window.addEventListener('museum:enter', () => {
  if (!state.inArtifact) navigation.lock();
});

window.addEventListener('resize', () => sm.onResize());

const clock = new THREE.Clock();
sm.renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);

  // Mode VR : téléportation seulement
  if (sm.renderer.xr.isPresenting) {
    vr.update();
    sm.renderer.render(sm.scene, sm.camera);
    return;
  }

  if (sm.pauseRender) return;

  navigation.update(dt);
  interaction.enabled = navigation.isLocked && !state.inArtifact;
  interaction.update();

  sm.renderer.render(sm.scene, sm.camera);
});
window.addEventListener('artifact:close', () => {
  sm.pauseRender = false; // on reprend le rendu de la salle
  transition.zoomBack(() => {
    state.inArtifact = false; // le visiteur recliquera pour reprendre la main
  });
});



// --- TEST TEMPORAIRE : à supprimer à l'intégration ---
window.addEventListener('artifact:select', (e) => {
  console.log('artifact:select reçu :', e.detail);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyX') window.dispatchEvent(new Event('artifact:close'));
});
// ------------------------------------------------------