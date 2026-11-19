import * as THREE from 'three';

function makeCanvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function floorTexture() {
  const texture = makeCanvasTexture(512, (g, s) => {
    const h = s / 2;
    g.fillStyle = '#c9c2b4';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#8f887a';
    g.fillRect(0, 0, h, h);
    g.fillRect(h, h, h, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 4;
    g.strokeRect(0, 0, h, h);
    g.strokeRect(h, 0, h, h);
    g.strokeRect(0, h, h, h);
    g.strokeRect(h, h, h, h);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function paintingTexture(hue) {
  return makeCanvasTexture(256, (g, s) => {
    const grad = g.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, `hsl(${hue}, 55%, 35%)`);
    grad.addColorStop(1, `hsl(${(hue + 50) % 360}, 60%, 60%)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    g.fillStyle = `hsla(${(hue + 180) % 360}, 60%, 70%, 0.7)`;
    g.beginPath();
    g.arc(s * 0.65, s * 0.4, s * 0.18, 0, Math.PI * 2);
    g.fill();
  });
}

export class Room {
  constructor() {
    this.size = { width: 16, depth: 24, height: 6 };
    this.group = new THREE.Group();
    this.floor = null;
    this.occluders = []; // murs + colonnes (bloquent le raycast)
    this.colliders = []; // cercles { x, z, r } (collisions)

    this.mats = {
      wall: new THREE.MeshStandardMaterial({ color: 0xd9d0c1, roughness: 0.9 }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 1 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.6 }),
      door: new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.7 }),
      stone: new THREE.MeshStandardMaterial({ color: 0xbdb6a8, roughness: 0.7 }),
      pedestal: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.5 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 1,
        roughness: 0,
        thickness: 0.05,
        ior: 1.45
      })
    };

    this._buildShell();
    this._addColumns();
    this._addDoor(0, this.size.depth / 2 - 0.06, Math.PI);
    this._addDoor(-this.size.width / 2 + 0.06, -8, Math.PI / 2);
    this._addFrames();
  }

  _buildShell() {
    const { width: W, depth: D, height: H } = this.size;

    // Sol
    const floorMap = floorTexture();
    floorMap.repeat.set(W / 4, D / 4);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.35 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);
    this.floor = floor;

    // Plafond
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.mats.ceiling);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = H;
    this.group.add(ceiling);

    // Murs (plans orientés vers l'intérieur de la salle)
    const addWall = (w, x, z, rotY) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, H), this.mats.wall);
      wall.position.set(x, H / 2, z);
      wall.rotation.y = rotY;
      wall.receiveShadow = true;
      this.group.add(wall);
      this.occluders.push(wall);
    };
    addWall(W, 0, -D / 2, 0);
    addWall(W, 0, D / 2, Math.PI);
    addWall(D, -W / 2, 0, Math.PI / 2);
    addWall(D, W / 2, 0, -Math.PI / 2);
  }

  // Colonnes en InstancedMesh (optimisation : 3 draw calls au lieu de 24)
  _addColumns() {
    const H = this.size.height;
    const spots = [];
    for (const side of [-1, 1]) {
      for (const z of [-9, -3, 3, 9]) spots.push([side * 7, z]);
    }

    const shaft = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.28, 0.3, H, 24), this.mats.stone, spots.length
    );
    const base = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.8, 0.25, 0.8), this.mats.stone, spots.length
    );
    const cap = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.8, 0.25, 0.8), this.mats.stone, spots.length
    );

    const dummy = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      dummy.position.set(x, H / 2, z);
      dummy.updateMatrix();
      shaft.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, 0.125, z);
      dummy.updateMatrix();
      base.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, H - 0.125, z);
      dummy.updateMatrix();
      cap.setMatrixAt(i, dummy.matrix);

      this.colliders.push({ x, z, r: 0.45 });
    });

    [shaft, base, cap].forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    });
    this.occluders.push(shaft);
  }

  _addDoor(x, z, rotY) {
    const door = new THREE.Group();
    door.position.set(x, 0, z);
    door.rotation.y = rotY;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.8, 0.12), this.mats.wood);
    frame.position.y = 1.4;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.12), this.mats.door);
    panel.position.set(0, 1.3, 0.03);

    door.add(frame, panel);
    this.group.add(door);
  }

  _addFrame(x, y, z, rotY, w, h, hue) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;

    const border = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.06), this.mats.wood);
    const painting = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: paintingTexture(hue), roughness: 0.85 })
    );
    painting.position.z = 0.032;

    g.add(border, painting);
    this.group.add(g);
  }

  _addFrames() {
    const { width: W, depth: D } = this.size;
    const y = 2.4;
    this._addFrame(-5, y, -D / 2 + 0.03, 0, 1.6, 1.1, 20);
    this._addFrame(5, y, -D / 2 + 0.03, 0, 1.6, 1.1, 200);
    this._addFrame(-5, y, D / 2 - 0.03, Math.PI, 1.6, 1.1, 120);
    this._addFrame(5, y, D / 2 - 0.03, Math.PI, 1.6, 1.1, 280);
    this._addFrame(-W / 2 + 0.03, y, 0, Math.PI / 2, 2.0, 1.4, 340);
    this._addFrame(W / 2 - 0.03, y, 0, -Math.PI / 2, 2.0, 1.4, 60);
  }

  // Socle. Retourne la hauteur du dessus (topY) pour poser l'objet.
  addPedestal(x, y, z, height = 1, size = 0.9) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const body = new THREE.Mesh(new THREE.BoxGeometry(size, height, size), this.mats.pedestal);
    body.position.y = height / 2;

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(size + 0.08, 0.08, size + 0.08), this.mats.stone
    );
    plinth.position.y = 0.04;

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(size + 0.08, 0.05, size + 0.08), this.mats.stone
    );
    slab.position.y = height + 0.025;

    [body, plinth, slab].forEach((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    });

    this.group.add(group);
    this.colliders.push({ x, z, r: size * 0.75 });

    return { group, topY: height + 0.05 };
  }

  // Vitrine en verre (transmission). baseY = hauteur du dessus du socle.
  addVitrine(x, baseY, z, width, height) {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), this.mats.glass);
    glass.position.set(x, baseY + height / 2, z);
    glass.castShadow = false;
    glass.receiveShadow = false;
    this.group.add(glass);
    return glass;
  }
}