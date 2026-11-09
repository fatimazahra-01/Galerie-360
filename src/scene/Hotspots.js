import * as THREE from 'three';

export class Hotspots {
  constructor(scene, artifacts) {
    this.scene = scene;
    this.list = [];

    const texture = new THREE.TextureLoader().load('/textures/hotspot.png');
    texture.colorSpace = THREE.SRGBColorSpace;

    artifacts.forEach((a) => {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(...a.hotspotPosition);
      sprite.scale.set(0.3, 0.3, 1);
      sprite.userData = { artifact: a, baseScale: 0.3 };
      this.scene.add(sprite);
      this.list.push(sprite);
    });
  }
}