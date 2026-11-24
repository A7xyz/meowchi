import { describe, expect, it } from 'vitest';
import { createInitialSaveData } from '../../persistence/saveManager';
import { createInitialHumanState } from '../../simulation/humanNav';
import { ActiveCareAction } from '../../types/game';
import { screenToWorld, STAGE_HEIGHT, STAGE_WIDTH, worldToScreen } from '../RoomProjection';
import {
  CAT_SPRITE_ACTIONS,
  CatSpriteAction,
  HUMAN_SPRITE_ACTIONS,
  HumanSpriteAction,
  resolveCatSpriteAction,
  resolveHumanSpriteAction
} from '../SpriteManifest';

async function loadNodeFs() {
  const fsId = 'node:fs';
  const pathId = 'node:path';
  const urlId = 'node:url';
  const fsMod = (await import(/* @vite-ignore */ fsId)) as {
    existsSync: (p: string) => boolean;
    readFileSync: (p: string, enc: string) => string;
  };
  const pathMod = (await import(/* @vite-ignore */ pathId)) as {
    join: (...parts: string[]) => string;
    resolve: (...parts: string[]) => string;
  };
  const urlMod = (await import(/* @vite-ignore */ urlId)) as {
    fileURLToPath: (u: string) => string;
  };
  const here = pathMod.resolve(urlMod.fileURLToPath(import.meta.url), '..');
  const spritesRoot = pathMod.resolve(here, '../../../public/sprites');
  return { fs: fsMod, path: pathMod, spritesRoot };
}

describe('Meowchi 2D Sprite Pipeline & Manifest QA', () => {
  it('has a valid manifest.json with 9:16 portrait dimensions and final room background', async () => {
    const { fs, path, spritesRoot } = await loadNodeFs();
    const manifestPath = path.join(spritesRoot, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    expect(manifest.portraitResolution).toEqual({ width: 720, height: 1280, aspect: '9:16' });
    expect(fs.existsSync(path.join(spritesRoot, 'room/cozy_living_room_bg.png'))).toBe(true);
    expect(manifest.room.livingRoom.status).toBe('final_ai_generated');
  });

  it('includes all 3 final AI prop texture atlases covering 22 furniture, equipment & toy sprites', async () => {
    const { fs, path, spritesRoot } = await loadNodeFs();
    const atlases = [
      { name: 'props_care', expectedCount: 8 },
      { name: 'props_living', expectedCount: 8 },
      { name: 'props_equipment', expectedCount: 6 }
    ];
    for (const a of atlases) {
      const png = path.join(spritesRoot, 'props', `${a.name}.png`);
      const json = path.join(spritesRoot, 'props', `${a.name}.json`);
      expect(fs.existsSync(png)).toBe(true);
      expect(fs.existsSync(json)).toBe(true);
      const meta = JSON.parse(fs.readFileSync(json, 'utf-8'));
      expect(Object.keys(meta.frames).length).toBe(a.expectedCount);
    }
  });

  it('verifies all 33 Cat sprite sheets have exact frame counts, transparent backgrounds, zero clipping, and distinct frames', async () => {
    const { fs, path, spritesRoot } = await loadNodeFs();
    const actions = Object.keys(CAT_SPRITE_ACTIONS) as CatSpriteAction[];
    expect(actions.length).toBe(33);

    for (const action of actions) {
      const expectedFrames = CAT_SPRITE_ACTIONS[action].frameCount;
      const pngPath = path.join(spritesRoot, 'cat', `${action}.png`);
      const jsonPath = path.join(spritesRoot, 'cat', `${action}.json`);
      expect(fs.existsSync(pngPath), `Missing PNG for cat/${action}`).toBe(true);
      expect(fs.existsSync(jsonPath), `Missing JSON for cat/${action}`).toBe(true);

      const atlas = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      expect(Object.keys(atlas.frames).length).toBe(expectedFrames);
      expect(atlas.meta.qa.transparentCorners).toBe(true);
      expect(atlas.meta.qa.emptyFrames).toBe(0);
      expect(atlas.meta.qa.clippedFrames).toBe(0);
      expect(atlas.meta.qa.avgInterFrameDiff).toBeGreaterThan(0);
    }
  });

  it('verifies all 17 Male and 17 Female Chibi human sprite sheets pass transparency, clipping & distinct-frame checks', async () => {
    const { fs, path, spritesRoot } = await loadNodeFs();
    const actions = Object.keys(HUMAN_SPRITE_ACTIONS) as HumanSpriteAction[];
    expect(actions.length).toBe(17);

    for (const gender of ['female', 'male'] as const) {
      for (const action of actions) {
        const expectedFrames = HUMAN_SPRITE_ACTIONS[action].frameCount;
        const pngPath = path.join(spritesRoot, 'human', gender, `${action}.png`);
        const jsonPath = path.join(spritesRoot, 'human', gender, `${action}.json`);
        expect(fs.existsSync(pngPath), `Missing PNG for human/${gender}/${action}`).toBe(true);
        expect(fs.existsSync(jsonPath), `Missing JSON for human/${gender}/${action}`).toBe(true);

        const atlas = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        expect(Object.keys(atlas.frames).length).toBe(expectedFrames);
        expect(atlas.meta.qa.transparentCorners).toBe(true);
        expect(atlas.meta.qa.emptyFrames).toBe(0);
        expect(atlas.meta.qa.clippedFrames).toBe(0);
        expect(atlas.meta.qa.avgInterFrameDiff).toBeGreaterThan(0);
      }
    }
  });
});

describe('2D Projection & Synchronized Animation State Machine', () => {
  it('projects world floor coordinates cleanly inside 9:16 portrait stage and round-trips accurately', () => {
    expect(STAGE_WIDTH / STAGE_HEIGHT).toBeCloseTo(9 / 16, 4);
    const samples = [
      { x: 0, z: 0 },
      { x: -1.8, z: -1.5 },
      { x: 1.9, z: 1.6 }
    ];
    for (const s of samples) {
      const p = worldToScreen(s.x, s.z, 0);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(STAGE_WIDTH);
      expect(p.y).toBeGreaterThan(500);
      expect(p.y).toBeLessThan(1120);
      const back = screenToWorld(p.x, p.y);
      expect(back.x).toBeCloseTo(s.x, 1);
      expect(back.z).toBeCloseTo(s.z, 1);
    }
  });

  it('synchronizes cat and human sprite animations for pet, brush, feed, pickup/carry, and defensive bite', () => {
    const save = createInitialSaveData('scottish_straight');
    const cat = save.cat;
    const human = createInitialHumanState();
    const baseAction: ActiveCareAction = {
      id: 'a1',
      type: 'pet',
      phase: 'performing',
      startedAtMs: 0,
      phaseStartedAtMs: 0,
      durationMs: 1800,
      contactAtMs: 800,
      maxTotalMs: 8000,
      committed: false,
      targetPoint: { x: 0, z: 0 },
      alignTarget: { x: 0, z: 0 }
    };

    // Pet sync
    human.animState = 'kneel_pet';
    expect(resolveHumanSpriteAction(human, baseAction)).toBe('pet_cat');
    expect(resolveCatSpriteAction(cat, human, baseAction)).toBe('pet_accept');

    // Brush sync
    human.animState = 'brush';
    expect(resolveHumanSpriteAction(human, { ...baseAction, type: 'brush' })).toBe('brush_cat');
    expect(resolveCatSpriteAction(cat, human, { ...baseAction, type: 'brush' })).toBe('brush_react');

    // Pickup & carry sync
    human.carryingCat = true;
    human.animState = 'carry_cat';
    expect(resolveHumanSpriteAction(human, { ...baseAction, type: 'pickup' })).toBe('hold_cat');
    expect(resolveCatSpriteAction(cat, human, { ...baseAction, type: 'pickup' })).toBe('carried');

    // Defensive bite + flinch sync
    human.carryingCat = false;
    human.animState = 'flinch';
    expect(resolveHumanSpriteAction(human, { ...baseAction, bitten: true })).toBe('react_bite');
    expect(resolveCatSpriteAction(cat, human, { ...baseAction, bitten: true })).toBe('bite');

    // Zoomies & Sleep
    cat.behavior = 'zoomies';
    expect(resolveCatSpriteAction(cat, human, null)).toBe('zoomies');
    cat.behavior = 'sleep';
    expect(resolveCatSpriteAction(cat, human, null)).toBe('sleep');
  });
});
