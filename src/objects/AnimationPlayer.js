import * as THREE from 'three';

// Petit wrapper AnimationMixer : play('idle'), playOnce('wave', 'idle')...
// `names` = le champ "animations" du JSON (clé logique -> nom du clip)
export class AnimationPlayer {
  constructor(root, clips, names = {}) {
    this.mixer = new THREE.AnimationMixer(root);
    this.clips = clips ?? [];
    this.names = names ?? {};
    this.actions = new Map();
    this.current = null;
  }

  _find(key) {
    const mapped = this.names?.[key] ?? key;
    const wanted = String(mapped).toLowerCase();
    return (
      this.clips.find((c) => c.name.toLowerCase() === wanted) ??
      this.clips.find((c) => c.name.toLowerCase().includes(wanted))
    );
  }

  has(key) {
    return !!this._find(key);
  }

  _action(key) {
    if (!this.actions.has(key)) {
      const clip = this._find(key);
      if (!clip) return null;
      this.actions.set(key, this.mixer.clipAction(clip));
    }
    return this.actions.get(key);
  }

  play(key, fade = 0.3) {
    const next = this._action(key);
    if (!next) return null;
    if (next === this.current && next.isRunning()) return next;
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fade).play();
    if (this.current && this.current !== next) this.current.fadeOut(fade);
    this.current = next;
    return next;
  }

  playOnce(key, backTo = 'idle', fade = 0.25) {
    const action = this._action(key);
    if (!action) return null;

    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.reset().setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(fade).play();
    if (this.current && this.current !== action) this.current.fadeOut(fade);
    this.current = action;

    const onFinish = (e) => {
      if (e.action !== action) return;
      this.mixer.removeEventListener('finished', onFinish);
      this.play(backTo, fade);
    };
    this.mixer.addEventListener('finished', onFinish);
    return action;
  }

  update(dt) {
    this.mixer.update(dt);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}