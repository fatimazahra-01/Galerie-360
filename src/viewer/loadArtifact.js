import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

const MAX_CACHED = 3;
const cache = new Map(); // id -> { promise }  (ordre = récence)

function disposeGltf(gltf) {
  gltf.scene.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      Object.values(m).forEach((v) => v?.isTexture && v.dispose());
      m.dispose();
    });
  });
}

function getEntry(artifact) {
  let entry = cache.get(artifact.id);
  if (entry) cache.delete(artifact.id); // rafraîchit la récence
  else {
    entry = { promise: loader.loadAsync(artifact.model) };
    entry.promise.catch(() => cache.delete(artifact.id));
  }
  cache.set(artifact.id, entry);

  while (cache.size > MAX_CACHED) {
    const [oldId, old] = cache.entries().next().value;
    cache.delete(oldId);
    old.promise.then(disposeGltf).catch(() => {});
  }
  return entry;
}

// Préchargement (lazy loading) : on le lance dès le clic, avant la fin du zoom caméra
export function preloadArtifact(artifact) {
  getEntry(artifact).promise.catch(() => {});
}

// Retourne { object, animations } : un clone indépendant, prêt à ajouter à une scène
export async function loadArtifact(artifact) {
  const gltf = await getEntry(artifact).promise;
  const object = SkeletonUtils.clone(gltf.scene);
  object.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material)
      ? o.material.map((m) => m.clone())
      : o.material.clone();
  });
  return { object, animations: gltf.animations };
}