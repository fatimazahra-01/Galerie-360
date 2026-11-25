import gsap from 'gsap';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import './ui.css';
import { AudioManager } from './audio.js';

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  on: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
};

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmt = (s) => {
  if (!isFinite(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

function build() {
  const root = document.createElement('div');
  root.id = 'ui-root';
  root.innerHTML = `
    <div id="landing">
      <div class="landing-card">
        <p class="eyebrow">Musée virtuel</p>
        <h1>Galerie 360</h1>
        <p class="tagline">Entre dans la salle… et essaie de ne pas réveiller la momie.</p>
        <div id="loader">
          <div class="track"><div id="loader-bar"></div></div>
          <span>Chargement des collections…</span>
        </div>
        <button id="enter-btn" type="button" disabled>Entrer</button>
        <p class="landing-note">🎧 Son recommandé · Clavier + souris</p>
      </div>
    </div>

    <div id="hud" aria-live="polite">
      <p id="hud-controls">ZQSD / WASD : se déplacer · Souris : regarder · Clic sur un objet : l’examiner · Échap : pause · M : couper le son</p>
      <p id="hud-pause">Clique pour reprendre la visite</p>
    </div>

    <button id="mute-btn" type="button" aria-label="Couper le son" aria-pressed="false">${ICON.on}</button>

    <aside id="info-panel" role="dialog" aria-modal="false" aria-labelledby="ip-title" aria-hidden="true">
      <button id="ip-close" type="button" aria-label="Fermer la fiche (Échap)">✕</button>
      <div class="ip-body">
        <p class="ip-period"></p>
        <h2 id="ip-title"></h2>
        <div class="ip-story"></div>
        <dl class="ip-facts"></dl>
      </div>
      <div class="ip-player">
        <button id="ip-play" type="button" aria-label="Lecture / pause de la narration">${ICON.play}</button>
        <input id="ip-progress" type="range" min="0" max="1000" value="0" aria-label="Progression de la narration" />
        <span id="ip-time">0:00</span>
        <input id="ip-volume" type="range" min="0" max="100" value="90" aria-label="Volume de la narration" />
        <span id="ip-unavailable" hidden>Narration indisponible</span>
      </div>
    </aside>`;
  document.body.appendChild(root);
  return root;
}

export async function initUI() {
  const root = build();
  const $ = (sel) => root.querySelector(sel);
  const audio = new AudioManager();

  let artifacts = [];
  fetch('/artifacts.json')
      .then((r) => r.json())
      .then((data) => (artifacts = data))
      .catch((err) => console.error('[ui] artifacts.json :', err));

  const landing = $('#landing');
  const enterBtn = $('#enter-btn');
  const panel = $('#info-panel');
  const muteBtn = $('#mute-btn');
  const hud = $('#hud');
  const crosshair = document.getElementById('crosshair');
  let entered = false;
  let inArtifact = false;

  // ---------- Écran d'accueil ----------
  // main.js ajoute la classe "hidden" sur #loader quand tout est chargé
  const loader = $('#loader');
  const enableEnter = () => {
    if (loader.classList.contains('hidden')) {
      enterBtn.disabled = false;
      enterBtn.focus({ preventScroll: true });
    }
  };
  new MutationObserver(enableEnter).observe(loader, { attributes: true, attributeFilter: ['class'] });
  enableEnter();

  enterBtn.addEventListener('click', () => {
    entered = true;
    audio.start();
    window.dispatchEvent(new Event('museum:enter')); // main.js verrouille la souris (geste utilisateur)
    document.body.classList.add('in-museum');
    landing.classList.add('gone');
    refreshHud();
  });

  // ---------- HUD ----------
  function refreshHud() {
    const locked = !!document.pointerLockElement;
    hud.classList.toggle('visible', entered && !inArtifact);
    hud.classList.toggle('paused', entered && !inArtifact && !locked);
  }
  document.addEventListener('pointerlockchange', () => {
    pressed.clear();
    audio.stepsOn(false);
    refreshHud();
  });

  // ---------- Bruit de pas ----------
  const pressed = new Set();
  const syncSteps = () => audio.stepsOn(!!document.pointerLockElement && pressed.size > 0);
  window.addEventListener('keydown', (e) => {
    if (MOVE_KEYS.includes(e.code)) { pressed.add(e.code); syncSteps(); }
    if (e.code === 'KeyM' && entered) toggleMute();
    if (e.code === 'Escape' && inArtifact) window.dispatchEvent(new Event('artifact:close'));
  });
  window.addEventListener('keyup', (e) => {
    if (pressed.delete(e.code)) syncSteps();
  });

  // ---------- Son coupé ----------
  function toggleMute() {
    const m = !audio.muted;
    audio.mute(m);
    muteBtn.innerHTML = m ? ICON.off : ICON.on;
    muteBtn.setAttribute('aria-pressed', String(m));
    muteBtn.setAttribute('aria-label', m ? 'Activer le son' : 'Couper le son');
  }
  muteBtn.addEventListener('click', toggleMute);

  // ---------- Clic sur un objet : whoosh au départ du zoom ----------
  document.getElementById('scene-canvas')?.addEventListener('click', () => {
    if (document.pointerLockElement && crosshair?.classList.contains('active')) audio.play('whoosh');
  });

  // ---------- Panneau d'info + lecteur ----------
  const playBtn = $('#ip-play');
  const progress = $('#ip-progress');
  const timeEl = $('#ip-time');
  const volume = $('#ip-volume');
  const unavailable = $('#ip-unavailable');
  const player = $('.ip-player');
  let currentAudio = null;
  let scrubbing = false;
  let raf = 0;

  function setPlayer(state) {
    // state : 'playing' | 'paused' | 'off'
    playBtn.innerHTML = state === 'playing' ? ICON.pause : ICON.play;
    const off = state === 'off';
    [playBtn, progress, volume].forEach((el) => (el.disabled = off));
    unavailable.hidden = !off;
  }

  function tick() {
    const n = audio.narration;
    if (n && n.state() === 'loaded' && !scrubbing) {
      const dur = n.duration() || 1;
      const pos = Number(n.seek()) || 0;
      progress.value = String(Math.round((pos / dur) * 1000));
      timeEl.textContent = `${fmt(pos)} / ${fmt(dur)}`;
    }
    raf = requestAnimationFrame(tick);
  }

  function startNarration() {
    setPlayer('playing');
    audio.playNarration(currentAudio, {
      onEnd: () => setPlayer('paused'),
      onError: () => setPlayer('off')
    });
  }

  playBtn.addEventListener('click', () => {
    if (!currentAudio) return;
    const n = audio.narration;
    if (!n) startNarration();
    else if (n.playing()) { n.pause(); setPlayer('paused'); }
    else { n.play(); setPlayer('playing'); }
  });
  progress.addEventListener('pointerdown', () => (scrubbing = true));
  progress.addEventListener('input', () => {
    const n = audio.narration;
    if (n) n.seek((Number(progress.value) / 1000) * (n.duration() || 0));
  });
  progress.addEventListener('change', () => (scrubbing = false));
  volume.addEventListener('input', () => audio.setNarrationVolume(Number(volume.value) / 100));

  function openPanel(a) {
    inArtifact = true;
    refreshHud();
    audio.stopVoices();
    audio.duck(true);
    audio.play('panel');

    $('.ip-period').textContent = a.text?.period || '';
    $('#ip-title').textContent = a.title || '';
    const story = $('.ip-story');
    story.replaceChildren();
    const paragraphs = (a.text?.story || 'Texte à venir.').split(/\n\s*\n/);
    paragraphs.forEach((t) => {
      const p = document.createElement('p');
      p.textContent = t;
      story.appendChild(p);
    });
    const facts = $('.ip-facts');
    facts.replaceChildren();
    (a.text?.facts || []).forEach(([label, value]) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      facts.append(dt, dd);
    });

    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    $('.ip-body').scrollTop = 0;
    $('#ip-close').focus({ preventScroll: true });

    if (!reduceMotion) {
      gsap.fromTo(
          panel.querySelectorAll('.ip-period, #ip-title, .ip-story p, .ip-facts'),
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.12, delay: 0.25, ease: 'power2.out', clearProps: 'transform,opacity' }
      );
    }

    // Lecteur : seulement pour les objets qui ont un son (la momie), sans lecture auto
    // (sa voix a déjà joué quand le viseur était dessus)
    currentAudio = a.audio || null;
    player.style.display = currentAudio ? '' : 'none';
    progress.value = '0';
    timeEl.textContent = '0:00';
    volume.value = String(Math.round(audio.narrationVolume * 100));
    if (currentAudio) startNarration(); else setPlayer('paused');
    cancelAnimationFrame(raf);
    tick();
  }

  function closePanel() {
    inArtifact = false;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    audio.stopNarration();
    audio.duck(false);
    cancelAnimationFrame(raf);
    refreshHud();
  }

  $('#ip-close').addEventListener('click', () => window.dispatchEvent(new Event('artifact:close')));
  window.addEventListener('artifact:select', (e) => openPanel(e.detail));
  window.addEventListener('artifact:close', closePanel);

  // ---------- Voix de la momie : dès que le viseur est sur l'objet ----------
  window.addEventListener('artifact:hover', (e) => {
    const a = artifacts.find((x) => x.id === e.detail);
    if (a?.hoverAudio && entered && !inArtifact) audio.hoverVoice(a.hoverAudio);
  });
  window.addEventListener('mummy:dance', () => audio.play('dance'));
}