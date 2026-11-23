import { CatVocalCue } from '../simulation/needs';

export interface RequiredCatAudioAsset {
  cue: CatVocalCue;
  path: string;
  description: string;
}

/**
 * Exact manifest of natural licensed real cat recordings expected under `public/audio/cat/`.
 * If a file is present at runtime, SoundManager loads and plays the real recording with
 * spatial panning and natural pitch variation. Otherwise it transparently falls back to
 * Web Audio API synthesis (never claiming synthesized audio is real recordings).
 */
export const REQUIRED_REAL_AUDIO_ASSETS: RequiredCatAudioAsset[] = [
  { cue: 'happy_meow', path: 'audio/cat/happy_meow.ogg', description: 'Warm happy cat meow' },
  { cue: 'soft_meow', path: 'audio/cat/soft_meow.ogg', description: 'Soft affectionate meow' },
  { cue: 'kitten_mew', path: 'audio/cat/kitten_mew.ogg', description: 'High gentle kitten mew' },
  { cue: 'attention_meow', path: 'audio/cat/attention_meow.ogg', description: 'Attention-seeking meow' },
  { cue: 'greeting_meow', path: 'audio/cat/greeting_meow.ogg', description: 'Short friendly greeting meow' },
  { cue: 'purr', path: 'audio/cat/purr.ogg', description: 'Natural continuous cat purring' },
  { cue: 'trill_chirp', path: 'audio/cat/chirp.ogg', description: 'Affectionate trill / bird-watching chirp' },
  { cue: 'play_chirp', path: 'audio/cat/play_vocalization.ogg', description: 'Short playful chirp / vocalization' },
  { cue: 'hiss', path: 'audio/cat/hiss.ogg', description: 'Realistic defensive cat hiss' },
  { cue: 'low_growl', path: 'audio/cat/growl.ogg', description: 'Low warning cat growl' },
  { cue: 'distress', path: 'audio/cat/distress_meow.ogg', description: 'Fearful / distressed meow' },
  { cue: 'bite_snap', path: 'audio/cat/defensive_snap.ogg', description: 'Sharp defensive hiss-snap' },
  { cue: 'drink', path: 'audio/cat/water_lapping.ogg', description: 'Realistic cat water lapping sound' },
  { cue: 'eat', path: 'audio/cat/eating_kibble.ogg', description: 'Cat eating food / soft crunch' }
];

const CUE_COOLDOWN_MS: Partial<Record<CatVocalCue, number>> = {
  purr: 2200,
  hiss: 1400,
  low_growl: 1600,
  bite_snap: 800,
  happy_meow: 2400,
  soft_meow: 2200,
  attention_meow: 2600,
  kitten_mew: 2000,
  trill_chirp: 1800,
  play_chirp: 1600,
  distress: 2400,
  drink: 1200,
  eat: 1200
};

/**
 * Context-aware feline audio engine:
 * - Asset-first loader for licensed real feline recordings (`public/audio/cat/*.ogg`)
 * - Stereo spatial panning based on cat's screen/world position
 * - Natural pitch & volume variation + per-cue and global cooldowns
 * - Transparent Web Audio synthesis fallback when audio files are not yet bundled
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private lastVocalTimeMs = 0;
  private cueLastPlayedMs = new Map<string, number>();
  private realBuffers = new Map<CatVocalCue, AudioBuffer>();
  private attemptedRealLoad = false;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isUsingFallbackAudio(): boolean {
    return this.realBuffers.size < REQUIRED_REAL_AUDIO_ASSETS.length;
  }

  public getLoadedRealCueCount(): number {
    return this.realBuffers.size;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.attemptedRealLoad) {
      this.attemptedRealLoad = true;
      void this.preloadRealAudioAssets();
    }
    return this.ctx;
  }

  /**
   * Probes `public/audio/cat/` for licensed real cat audio files.
   * Silently skips missing files so synthesis fallback works cleanly without console spam.
   */
  public async preloadRealAudioAssets(): Promise<void> {
    if (typeof fetch === 'undefined' || !this.ctx) return;
    for (const asset of REQUIRED_REAL_AUDIO_ASSETS) {
      try {
        const res = await fetch(`./${asset.path}`);
        if (!res.ok) continue;
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('audio') && !contentType.includes('octet-stream')) continue;
        const arr = await res.arrayBuffer();
        if (arr.byteLength < 512) continue;
        const decoded = await this.ctx.decodeAudioData(arr);
        this.realBuffers.set(asset.cue, decoded);
      } catch {
        // Asset not bundled yet; transparent fallback synthesis remains active.
      }
    }
  }

  private connectWithPan(
    ctx: AudioContext,
    node: AudioNode,
    panX = 0
  ): void {
    const clampedPan = Math.max(-0.85, Math.min(0.85, panX));
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(clampedPan, ctx.currentTime);
      node.connect(panner);
      panner.connect(ctx.destination);
    } else {
      node.connect(ctx.destination);
    }
  }

  private jitter(base: number, spread = 0.08): number {
    return base * (1 + (Math.random() * 2 - 1) * spread);
  }

  private agePitchMultiplier(ageDays: number): number {
    if (ageDays < 21) return 1.45;
    if (ageDays < 70) return 1.24;
    if (ageDays < 180) return 1.08;
    return 0.94;
  }

  private playRealBufferIfLoaded(cue: CatVocalCue, ageDays: number, panX: number): boolean {
    const buf = this.realBuffers.get(cue);
    if (!buf || !this.ctx) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    // Natural pitch variation (±6%) + subtle age scaling
    const ageRate = cue === 'kitten_mew' ? 1.0 : 0.9 + (this.agePitchMultiplier(ageDays) - 0.94) * 0.28;
    src.playbackRate.setValueAtTime(this.jitter(ageRate, 0.06), this.ctx.currentTime);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.jitter(0.55, 0.1), this.ctx.currentTime);
    src.connect(gain);
    this.connectWithPan(this.ctx, gain, panX);
    src.start(this.ctx.currentTime);
    return true;
  }

  public playPurr(panX = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.playRealBufferIfLoaded('purr', 120, panX)) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.jitter(48, 0.06), now);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(this.jitter(26, 0.08), now);
    lfoGain.gain.setValueAtTime(0.032, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.16);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.72);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.12);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    this.connectWithPan(ctx, gain, panX);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 1.15);
    lfo.stop(now + 1.15);
  }

  public playMeowVariant(
    variant: 'happy_meow' | 'soft_meow' | 'greeting_meow' | 'attention_meow' | 'kitten_mew' | 'distress',
    ageDays = 45,
    panX = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.playRealBufferIfLoaded(variant, ageDays, panX)) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const ageMult = this.agePitchMultiplier(ageDays);
    const baseFreq =
      variant === 'kitten_mew'
        ? this.jitter(790, 0.08)
        : variant === 'happy_meow'
          ? this.jitter(505 * ageMult, 0.07)
          : variant === 'greeting_meow'
            ? this.jitter(540 * ageMult, 0.08)
            : variant === 'attention_meow'
              ? this.jitter(570 * ageMult, 0.07)
              : variant === 'distress'
                ? this.jitter(625 * ageMult, 0.07)
                : this.jitter(435 * ageMult, 0.08);

    const dur =
      variant === 'greeting_meow'
        ? 0.25
        : variant === 'kitten_mew'
          ? 0.28
          : variant === 'attention_meow'
            ? 0.5
            : 0.42;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq * 0.9, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.32, now + dur * 0.34);
    osc.frequency.exponentialRampToValueAtTime(
      variant === 'greeting_meow' || variant === 'happy_meow'
        ? baseFreq * 1.08
        : baseFreq * 0.76,
      now + dur
    );

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq * 1.85, now);
    filter.Q.setValueAtTime(3.6, now);

    const peakVol = this.jitter(variant === 'soft_meow' ? 0.04 : 0.056, 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakVol, now + dur * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    this.connectWithPan(ctx, gain, panX);

    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  public playTrillOrChirp(playful: boolean, ageDays = 60, panX = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.playRealBufferIfLoaded(playful ? 'play_chirp' : 'trill_chirp', ageDays, panX)) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    const base = this.jitter((playful ? 650 : 500) * this.agePitchMultiplier(ageDays), 0.08);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.36, now + 0.22);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(playful ? 34 : 26, now);
    lfoGain.gain.setValueAtTime(40, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.048, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    this.connectWithPan(ctx, gain, panX);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.26);
    lfo.stop(now + 0.26);
  }

  public playHiss(panX = 0, intense = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.playRealBufferIfLoaded(intense ? 'bite_snap' : 'hiss', 120, panX)) return;

    const now = ctx.currentTime;
    const dur = intense ? 0.34 : 0.46;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = intense
        ? Math.pow(1 - i / len, 0.7)
        : Math.sin((i / len) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(intense ? 3900 : 3300, now);
    filter.Q.setValueAtTime(1.3, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(intense ? 0.11 : 0.085, now);

    src.connect(filter);
    filter.connect(gain);
    this.connectWithPan(ctx, gain, panX);
    src.start(now);
  }

  public playLowGrowl(panX = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.playRealBufferIfLoaded('low_growl', 120, panX)) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(this.jitter(112, 0.08), now);
    osc.frequency.linearRampToValueAtTime(88, now + 0.48);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(310, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.062, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    this.connectWithPan(ctx, gain, panX);

    osc.start(now);
    osc.stop(now + 0.52);
  }

  /**
   * Realistic water-lapping / drinking bursts.
   */
  public playWaterDrink(panX = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.playRealBufferIfLoaded('drink', 120, panX)) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.jitter(360, 0.12), t);
      osc.frequency.exponentialRampToValueAtTime(this.jitter(720, 0.12), t + 0.07);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.036, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      this.connectWithPan(ctx, gain, panX);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  }

  /**
   * Soft eating / kibble crunch cues.
   */
  public playEatCrunch(panX = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.playRealBufferIfLoaded('eat', 120, panX)) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.13;
      const len = Math.floor(ctx.sampleRate * 0.055);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < len; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (len * 0.35));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(this.jitter(1400, 0.2), t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.045, t);
      src.connect(filter);
      filter.connect(gain);
      this.connectWithPan(ctx, gain, panX);
      src.start(t);
    }
  }

  public playMotorHum(panX = 0, duration = 0.55): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.linearRampToValueAtTime(165, now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.025, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    this.connectWithPan(ctx, gain, panX);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playSleepySigh(panX = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.35);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.028, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    this.connectWithPan(ctx, gain, panX);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playSoftChime(pitch = 620): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.24, now + 0.14);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.042, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playShutter(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.06);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.075, now);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public playKnock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.14);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  /**
   * Context-aware dispatcher with global + per-cue cooldown protection and spatial panning.
   */
  public playVocalCue(
    cue?: CatVocalCue,
    ageDays = 45,
    bypassCooldown = false,
    panX = 0
  ): void {
    if (!cue) return;
    const nowMs = Date.now();
    const cueCooldown = CUE_COOLDOWN_MS[cue] ?? 1000;
    const lastForCue = this.cueLastPlayedMs.get(cue) ?? 0;

    if (!bypassCooldown) {
      if (nowMs - this.lastVocalTimeMs < 950) return;
      if (nowMs - lastForCue < cueCooldown) return;
    }

    this.lastVocalTimeMs = nowMs;
    this.cueLastPlayedMs.set(cue, nowMs);

    switch (cue) {
      case 'purr':
        this.playPurr(panX);
        break;
      case 'happy_meow':
      case 'soft_meow':
      case 'greeting_meow':
      case 'attention_meow':
      case 'kitten_mew':
      case 'distress':
        this.playMeowVariant(cue, ageDays, panX);
        break;
      case 'trill_chirp':
        this.playTrillOrChirp(false, ageDays, panX);
        break;
      case 'play_chirp':
        this.playTrillOrChirp(true, ageDays, panX);
        break;
      case 'hiss':
        this.playHiss(panX, false);
        break;
      case 'bite_snap':
        this.playHiss(panX, true);
        break;
      case 'low_growl':
        this.playLowGrowl(panX);
        break;
      case 'sleepy_sigh':
        this.playSleepySigh(panX);
        break;
      case 'eat':
        this.playEatCrunch(panX);
        break;
      case 'drink':
        this.playWaterDrink(panX);
        break;
      case 'feeder_dispense':
      case 'litter_motor':
        this.playMotorHum(panX, 0.5);
        break;
      case 'clean':
        this.playSoftChime(740);
        break;
    }
  }
}

export const soundManager = new SoundManager();
