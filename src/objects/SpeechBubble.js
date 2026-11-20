import * as THREE from 'three';
import gsap from 'gsap';

export class SpeechBubble {
  constructor(position, width = 1.4) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 256;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0,
      depthTest: false
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.renderOrder = 999;
    this.sprite.visible = false;
    this.base = new THREE.Vector2(width, width / 2);
    this.sprite.scale.set(this.base.x, this.base.y, 1);
    this.sprite.position.copy(position);
    this.timer = null;
  }

  _draw(text) {
    const w = 512, bodyH = 190;
    const c = this.canvas.getContext('2d');
    c.clearRect(0, 0, w, 256);

    c.fillStyle = '#fff8e7';
    c.strokeStyle = '#2a2118';
    c.lineWidth = 8;
    c.beginPath();
    c.roundRect(8, 8, w - 16, bodyH, 36);
    c.fill();
    c.stroke();

    // Queue de la bulle
    c.beginPath();
    c.moveTo(w / 2 - 24, bodyH + 8);
    c.lineTo(w / 2, 248);
    c.lineTo(w / 2 + 24, bodyH + 8);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillRect(w / 2 - 20, bodyH + 4, 40, 8); // masque la jonction

    // Texte avec retour à la ligne
    c.fillStyle = '#2a2118';
    c.font = 'bold 52px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (c.measureText(test).width > 420 && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);

    const lh = 60;
    const startY = 8 + bodyH / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => c.fillText(l, w / 2, startY + i * lh));
  }

  // duration = 0 -> reste affichée jusqu'à hide()
  show(text, duration = 3) {
    this._draw(text);
    this.texture.needsUpdate = true;
    this.timer?.kill();
    gsap.killTweensOf([this.material, this.sprite.scale]);
    this.sprite.visible = true;
    this.sprite.scale.set(0, 0, 1);

    gsap.to(this.material, { opacity: 1, duration: 0.2 });
    gsap.to(this.sprite.scale, {
      x: this.base.x,
      y: this.base.y,
      duration: 0.35,
      ease: 'back.out(2)'
    });

    if (duration) {
      this.timer = gsap.delayedCall(duration, () => this.hide());
    }
  }

  hide() {
    this.timer?.kill();
    gsap.to(this.material, {
      opacity: 0,
      duration: 0.25,
      onComplete: () => {
        this.sprite.visible = false;
      }
    });
  }

  dispose() {
    this.timer?.kill();
    gsap.killTweensOf([this.material, this.sprite.scale]);
    this.texture.dispose();
    this.material.dispose();
  }
}