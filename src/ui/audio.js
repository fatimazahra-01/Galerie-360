import { Howl, Howler } from 'howler';

const AMBIENT_VOL = 0.15;
const AMBIENT_DUCK = 0.07;

// Un fichier manquant ne casse rien : le son est simplement ignoré.
const sfxFiles = {
  whoosh: '/audio/whoosh.mp3', // départ du zoom (optionnel)
  panel: '/audio/panel.mp3',   // ouverture de la fiche (optionnel)
  dance: '/audio/dance.mp3'    // easter egg de la momie (optionnel)
};

const warn = (name) => () => console.warn(`[audio] fichier introuvable : ${name}`);

export class AudioManager {
  constructor() {
    this.muted = false;
    this.narration = null;
    this.narrationVolume = 0.9;
    this.voices = new Map(); // src -> Howl (voix au survol)

    this.ambient = new Howl({
      src: ['/audio/ambient.mp3'], loop: true, volume: 0,
      onloaderror: warn('ambient.mp3')
    });
    this.steps = new Howl({
      src: ['/audio/steps.mp3'], loop: true, volume: 0.5,
      onloaderror: warn('steps.mp3')
    });
    this.sfx = {};
    for (const [name, src] of Object.entries(sfxFiles)) {
      this.sfx[name] = new Howl({ src: [src], volume: 0.8, onloaderror: warn(src) });
    }
  }

  // Appelé dans le clic sur « Entrer » : les navigateurs bloquent l'audio avant un clic
  start() {
    Howler.ctx?.resume();
    this.ambient.play();
    this.ambient.fade(0, AMBIENT_VOL, 3000);
  }

  duck(on) {
    this.ambient.fade(this.ambient.volume(), on ? AMBIENT_DUCK : AMBIENT_VOL, 800);
  }

  play(name) {
    this.sfx[name]?.play();
  }

  stepsOn(on) {
    if (on && !this.steps.playing()) this.steps.play();
    if (!on && this.steps.playing()) this.steps.pause();
  }

  mute(m) {
    this.muted = m;
    Howler.mute(m);
  }

  // ---------- Voix jouée quand le viseur est sur l'objet ----------
  hoverVoice(src) {
    if (!src) return;
    let voice = this.voices.get(src);
    if (!voice) {
      voice = new Howl({ src: [src], volume: 1, onloaderror: warn(src) });
      this.voices.set(src, voice);
    }
    if (!voice.playing()) voice.play(); // pas de relance tant qu'elle parle
  }

  stopVoices() {
    this.voices.forEach((v) => v.stop());
  }

  // ---------- Lecteur de la fiche ----------
  playNarration(src, { onEnd, onError } = {}) {
    this.stopNarration();
    if (!src) { onError?.(); return null; }
    this.narration = new Howl({
      src: [src], html5: true, volume: this.narrationVolume,
      onend: () => onEnd?.(),
      onloaderror: () => { warn(src)(); onError?.(); }
    });
    this.narration.play();
    return this.narration;
  }

  stopNarration() {
    this.narration?.stop();
    this.narration?.unload();
    this.narration = null;
  }

  setNarrationVolume(v) {
    this.narrationVolume = v;
    this.narration?.volume(v);
  }
}