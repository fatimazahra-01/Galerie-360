import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createSpot, MAX_SHADOW_LIGHTS } from './Lights.js';
import { normalizeModel } from '../objects/normalizeModel.js';

export class ArtifactPlacer {
  constructor(scene, room, loadingManager) {
    this.scene = scene;
    this.room = room;

    const draco = new DRACOLoader(loadingManager);
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.loader = new GLTFLoader(loadingManager);
    this.loader.setDRACOLoader(draco);

    this.entries = new Map(); // id -> { artifact, root, model, animations, materials, focus }
    this.roots = [];          // groupes racines (pour le raycast)
  }

  async load(artifacts) {
    await Promise.all(artifacts.map((a, i) => this._place(a, i)));
  }

  async _place(artifact, index) {
    const [x, y, z] = artifact.position;
    const pedestalHeight = artifact.pedestalHeight ?? 1;
    const pedestalSize = artifact.pedestalSize ?? 0.9;

    // 1. Socle
    const { topY } = this.room.addPedestal(x, y, z, pedestalHeight, pedestalSize);

    // 2. Groupe racine de l'objet (position / rotation / échelle du JSON)
    const root = new THREE.Group();
    root.name = artifact.id;
    root.userData.artifactId = artifact.id;
    root.position.set(x, y + topY, z);
    const [rx, ry, rz] = (artifact.rotation ?? [0, 0, 0]).map(THREE.MathUtils.degToRad);
    root.rotation.set(rx, ry, rz);
    root.scale.setScalar(artifact.scale ?? 1);

    // 3. Modèle GLB (placeholder si introuvable)
    let model;
    let animations = [];
    let isPlaceholder = false;
    try {
      const gltf = await this.loader.loadAsync(artifact.model);
      model = gltf.scene;
      animations = gltf.animations ?? [];
    } catch (error) {
      console.warn(`[${artifact.id}] modèle introuvable (${artifact.model}) → placeholder`);
      model = this._placeholder();
      isPlaceholder = true;
    }

    if (!isPlaceholder && artifact.targetSize) {
      normalizeModel(model, artifact.targetSize, artifact.yOffset ?? 0);
    }

    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.isSkinnedMesh) o.frustumCulled = false;
      }
    });

    root.add(model);
    this.scene.add(root);
    root.updateMatrixWorld(true);

    // 4. Dimensions réelles de l'objet
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // 5. Vitrine ajustée à l'objet
    if (artifact.vitrine !== false) {
      const width = Math.max(pedestalSize, size.x + 0.2, size.z + 0.2);
      this.room.addVitrine(x, y + topY, z, width, size.y + 0.35);
    }

    // 6. Spot dédié (ombres seulement sur les MAX_SHADOW_LIGHTS premiers)
    createSpot(this.scene, center, index < MAX_SHADOW_LIGHTS);

    this.entries.set(artifact.id, {
      artifact,
      root,
      model,
      animations,
      materials: this._collectMaterials(root),
      focus: { center, size: Math.max(size.x, size.y, size.z) }
    });
    this.roots.push(root);
  }

  _placeholder() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.8, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 0.6 })
    );
    mesh.position.y = 0.4; // posé sur le socle
    return mesh;
  }

  _collectMaterials(root) {
    const set = new Set();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m && m.emissive) {
          m.userData.baseEmissive = m.emissive.clone();
          m.userData.baseEmissiveIntensity = m.emissiveIntensity;
          set.add(m);
        }
      });
    });
    return [...set];
  }

  // Surbrillance au survol (émissif)
  setHighlight(id, on) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.materials.forEach((m) => {
      if (on) {
        m.emissive.setHex(0xffc875);
        m.emissiveIntensity = 0.35;
      } else {
        m.emissive.copy(m.userData.baseEmissive);
        m.emissiveIntensity = m.userData.baseEmissiveIntensity;
      }
    });
  }

  getArtifact(id) {
    return this.entries.get(id)?.artifact ?? null;
  }

  getFocus(id) {
    return this.entries.get(id)?.focus ?? null;
  }
}