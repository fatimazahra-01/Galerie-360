import * as THREE from 'three';

// Origine au centre-bas du modèle + plus grande dimension = targetSize (en mètres)
export function normalizeModel(object, targetSize, yOffset = 0) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim === 0) return;

  object.scale.multiplyScalar(targetSize / maxDim);
  object.updateMatrixWorld(true);

  box.setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box.min.y - yOffset;
}