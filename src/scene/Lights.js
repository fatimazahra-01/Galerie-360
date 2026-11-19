import * as THREE from 'three';

export const MAX_SHADOW_LIGHTS = 4; // max 3-4 lumières avec ombres (performance)

export function addBaseLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  scene.add(new THREE.HemisphereLight(0xfff1dd, 0x1a1a24, 0.35));
}

// Un SpotLight par objet (effet musée)
export function createSpot(scene, center, castShadow) {
  const spot = new THREE.SpotLight(0xfff2dd, 60, 0, Math.PI / 7, 0.6, 2);
  spot.position.set(center.x, 4.8, center.z + 1.2);
  spot.target.position.copy(center);
  spot.castShadow = castShadow;

  if (castShadow) {
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0005;
    spot.shadow.normalBias = 0.02;
    spot.shadow.camera.near = 1;
    spot.shadow.camera.far = 10;
  }

  scene.add(spot);
  scene.add(spot.target);
  return spot;
}