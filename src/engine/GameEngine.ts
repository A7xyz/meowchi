import Phaser from 'phaser';
import { MeowchiPhaserScene } from './MeowchiPhaserScene';
import { STAGE_HEIGHT, STAGE_WIDTH } from './RoomProjection';

/**
 * Main Phaser 3 2D portrait game engine wrapper for Meowchi.
 * Completely replaces the legacy Three.js 3D renderer while keeping the exact
 * public interface expected by React (`focusOnCat`, `capturePhotoDataUrl`, `dispose`).
 */
export class GameEngine {
  private readonly game: Phaser.Game;
  private readonly scene: MeowchiPhaserScene;

  constructor(container: HTMLElement) {
    this.scene = new MeowchiPhaserScene();

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      backgroundColor: '#efe4d6',
      antialias: true,
      render: {
        antialias: true,
        pixelArt: false,
        preserveDrawingBuffer: true // Enables clean Photo Mode snapshots
      },
      scale: {
        mode: Phaser.Scale.ENVELOP,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: STAGE_WIDTH,
        height: STAGE_HEIGHT
      },
      scene: [this.scene]
    });
  }

  public focusOnCat(): void {
    if (this.scene && this.scene.cameras?.main) {
      this.scene.focusOnCat();
    }
  }

  public capturePhotoDataUrl(): string {
    const canvas = this.game.canvas;
    if (!canvas) return '';
    try {
      return canvas.toDataURL('image/jpeg', 0.88);
    } catch {
      return '';
    }
  }

  public dispose(): void {
    this.game.destroy(true);
  }
}
