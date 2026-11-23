import * as THREE from 'three';

interface Particle {
  sprite: THREE.Sprite;
  velY: number;
  life: number;
  maxLife: number;
}

/**
 * Lightweight 3D floating emotion cues (hearts, zzz, sparkles, music notes).
 */
export class ParticleOverlay {
  public readonly root = new THREE.Group();
  private particles: Particle[] = [];
  private materials: Record<'heart' | 'zzz' | 'sparkle' | 'music', THREE.SpriteMaterial>;

  constructor() {
    this.materials = {
      heart: this.makeEmojiMat('♥', '#df6d6b'),
      zzz: this.makeEmojiMat('Z', '#7c96b2'),
      sparkle: this.makeEmojiMat('✦', '#e6b75c'),
      music: this.makeEmojiMat('♪', '#d4825a')
    };
  }

  private makeEmojiMat(symbol: string, color: string): THREE.SpriteMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(symbol, 32, 34);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  }

  public burst(type: 'heart' | 'zzz' | 'sparkle' | 'music', x: number, y: number, z: number): void {
    const count = type === 'zzz' ? 2 : 4;
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(this.materials[type].clone());
      sprite.position.set(
        x + (Math.random() - 0.5) * 0.28,
        y + 0.18 + Math.random() * 0.14,
        z + (Math.random() - 0.5) * 0.28
      );
      sprite.scale.setScalar(0.11 + Math.random() * 0.05);
      this.root.add(sprite);
      this.particles.push({
        sprite,
        velY: 0.25 + Math.random() * 0.15,
        life: 0,
        maxLife: 1.1 + Math.random() * 0.45
      });
    }
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.root.remove(p.sprite);
        p.sprite.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.sprite.position.y += p.velY * dt;
      const t = p.life / p.maxLife;
      p.sprite.material.opacity = t < 0.2 ? t / 0.2 : Math.max(0, 1 - (t - 0.2) / 0.8);
    }
  }
}
