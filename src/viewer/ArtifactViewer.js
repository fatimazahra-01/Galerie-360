import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadArtifact } from './loadArtifact.js';
import { normalizeModel } from '../objects/normalizeModel.js';
import { AnimationPlayer } from '../objects/AnimationPlayer.js';
import { proceduralWave, proceduralDance } from '../objects/Effects.js';

const CSS = `
.viewer-panel{position:fixed;top:0;left:0;width:var(--viewer-width,55%);height:100%;z-index:20;
  opacity:0;pointer-events:none;transition:opacity .5s ease;
  background:radial-gradient(ellipse at 50% 40%,#3a3328 0%,#1a1712 55%,#0b0b0f 100%);}
.viewer-panel.open{opacity:1;pointer-events:auto;}
.viewer-panel canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab;}
.viewer-panel canvas:active{cursor:grabbing;}
.viewer-hint{position:absolute;bottom:18px;left:0;right:0;text-align:center;
  font:14px sans-serif;color:rgba(255,255,255,.55);pointer-events:none;}
.viewer-panel.loading .viewer-hint{opacity:0;}
@media (max-width:768px){.viewer-panel{width:100%;height:45%;}}
`;

export class ArtifactViewer {
  constructor() {
    this._buildDom();
    this._initRenderer();
    this._initScene();
    this._initControls();

    this.current = null; // { artifact, holder, spin, object, player, fades, calls }
    this.token = 0;
    this.clock = new THREE.Clock();
    this.taps = 0;
    this.dancing = false;
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();

    this._bindTaps();
    window.addEventListener('artifact:select', (e) => this.open(e.detail));
    window.addEventListener('artifact:close', () => this.close());
    new ResizeObserver(() => this._resize()).observe(this.panel);
  }

  // ---------- Setup ----------
  _buildDom() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.panel = document.createElement('div');
    this.panel.id = 'viewer-panel';
    this.panel.className = 'viewer-panel';
    this.panel.innerHTML =
      '<canvas id="viewer-canvas"></canvas>' +
      '<div class="viewer-hint">Glisser pour tourner · Molette pour zoomer</div>';
    document.body.appendChild(this.panel);
    this.canvas = this.panel.querySelector('canvas');
  }

  _initRenderer() {
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);

    // Reflets PBR : environnement procédural (aucun fichier HDRI nécessaire)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();

    // Éclairage studio : key / fill / rim
    const key = new THREE.DirectionalLight(0xfff0dd, 3);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 15 });

    const fill = new THREE.DirectionalLight(0x9db8ff, 1.0);
    fill.position.set(-4, 2, 2);

    const rim = new THREE.DirectionalLight(0xffffff, 2.5);
    rim.position.set(-2, 3, -5);

    this.scene.add(key, fill, rim);

    // Ombre de contact (le fond en dégradé vient du CSS du panneau)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.ShadowMaterial({ opacity: 0.4 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _initControls() {
    const c = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = true;
    c.dampingFactor = 0.07;
    c.enablePan = false;
    c.minDistance = 2.5;
    c.maxDistance = 7;
    c.minPolarAngle = 0.3;
    c.maxPolarAngle = Math.PI * 0.52; // on ne passe pas sous le sol
    c.autoRotate = true;
    c.autoRotateSpeed = 1.2;
    c.addEventListener('start', () => {
      clearTimeout(this.resumeTimer);
      c.autoRotate = false;
    });
    c.addEventListener('end', () => {
      this.resumeTimer = setTimeout(() => (c.autoRotate = true), 3000);
    });
    this.controls = c;
  }

  _resize() {
    const w = this.panel.clientWidth;
    const h = this.panel.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 50 : 35; // portrait (mobile) : champ plus large
    this.camera.updateProjectionMatrix();
  }

  // ---------- Ouverture / fermeture ----------
  async open(artifact) {
    const token = ++this.token;
    this._clear();
    this.panel.classList.add('open', 'loading');
    this._resize();

    let loaded;
    try {
      loaded = await loadArtifact(artifact);
    } catch (err) {
      console.warn('[viewer] modèle introuvable → placeholder', err);
      loaded = {
        object: new THREE.Mesh(
          new THREE.BoxGeometry(1, 1.4, 1),
          new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 0.6 })
        ),
        animations: []
      };
    }
    if (token !== this.token) { // fermé pendant le chargement
      this._disposeMaterials(loaded.object);
      return;
    }

    const { object, animations } = loaded;
    normalizeModel(object, 2, artifact.yOffset ?? 0);
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    object.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.isSkinnedMesh) o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m.map) m.map.anisotropy = maxAniso; });
    });

    // holder (animation d'entrée) > spin (gags procéduraux) > object
    const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    const spin = new THREE.Group();
    const holder = new THREE.Group();
    spin.add(object);
    holder.add(spin);
    this.scene.add(holder);

    const player = animations.length
      ? new AnimationPlayer(object, animations, artifact.animations)
      : null;
    player?.play('idle');

    this.current = { artifact, holder, spin, object, player, fades: [], calls: [] };

    // Cadrage
    this.controls.target.set(0, size.y * 0.5, 0);
    this.camera.position.set(0, size.y * 0.6 + 0.5, 4.5);
    this.controls.autoRotate = true;
    this.controls.update();

    this._playEntryAnimation();
    if (artifact.gag === 'mummy') {
      this.current.calls.push(gsap.delayedCall(1.1, () => this._wave()));
    }

    this.panel.classList.remove('loading');
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  close() {
    this.token++;
    this.panel.classList.remove('open');
    clearTimeout(this.resumeTimer);
    // on attend la fin du fondu CSS avant de stopper le rendu et de libérer la mémoire
    setTimeout(() => {
      if (this.panel.classList.contains('open')) return; // réouvert entre-temps
      this.renderer.setAnimationLoop(null);
      this._clear();
    }, 600);
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.current?.player?.update(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // ---------- Animations ----------
  _collectMaterials(object) {
    const set = new Set();
    object.traverse((o) => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => set.add(m));
    });
    return [...set];
  }

  _playEntryAnimation() {
    const c = this.current;
    c.holder.scale.setScalar(0.6);
    gsap.to(c.holder.scale, { x: 1, y: 1, z: 1, duration: 1.0, ease: 'back.out(1.6)' });

    c.fades = this._collectMaterials(c.object).map((m) => ({
      m,
      t: m.transparent,
      o: m.opacity ?? 1
    }));
    c.fades.forEach(({ m }) => {
      m.transparent = true;
      m.opacity = 0;
      m.needsUpdate = true;
    });
    c.fades.forEach(({ m, t, o }) =>
      gsap.to(m, {
        opacity: o,
        duration: 0.8,
        onComplete: () => {
          m.transparent = t;
          m.needsUpdate = true;
        }
      })
    );
  }

  _wave() {
    const c = this.current;
    if (!c) return;
    if (!c.player?.playOnce('wave', 'idle')) proceduralWave(c.spin);
  }

  _dance() {
    const c = this.current;
    if (!c || this.dancing) return;
    this.dancing = true;
    window.dispatchEvent(new CustomEvent('mummy:dance')); // C peut jouer une musique / un SFX
    const done = () => { this.dancing = false; };
    const action = c.player?.playOnce('dance', 'idle');
    if (action) c.calls.push(gsap.delayedCall(action.getClip().duration, done));
    else proceduralDance(c.spin, done);
  }

  // ---------- Easter egg : 3 taps rapides sur la momie ----------
  _bindTaps() {
    let down = null;
    this.canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved < 6) this._onTap(e); // un vrai tap, pas un drag de rotation
    });
  }

  _onTap(e) {
    const c = this.current;
    if (!c || c.artifact.gag !== 'mummy') return;
    const rect = this.canvas.getBoundingClientRect();
    this._ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this._ray.setFromCamera(this._ndc, this.camera);
    if (!this._ray.intersectObject(c.object, true).length) { this.taps = 0; return; }

    this.taps++;
    clearTimeout(this.tapTimer);
    this.tapTimer = setTimeout(() => (this.taps = 0), 700);
    if (this.taps >= 3) { this.taps = 0; this._dance(); }
  }

  // ---------- Libération mémoire ----------
  _disposeMaterials(object) {
    // matériaux clonés uniquement : géométries et textures appartiennent au cache
    object.traverse((o) => {
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }

  _clear() {
    const c = this.current;
    if (!c) return;
    c.calls.forEach((call) => call.kill());
    gsap.killTweensOf([c.holder.scale, ...c.fades.map((f) => f.m), c.spin.position, c.spin.rotation]);
    c.player?.dispose();
    this.scene.remove(c.holder);
    this._disposeMaterials(c.holder);
    this.current = null;
    this.dancing = false;
  }
}