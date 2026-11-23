import { CatVocalCue } from '../simulation/needs';

/**
 * Context-aware feline vocalization & cozy audio synthesizer (Web Audio API).
 * Supports 10 feline vocalizations with age-based pitch scaling, natural random
 * pitch/volume/timing variation, and spam-prevention cooldowns.
 *
 * NOTE: Procedural synthesis placeholder pending licensed real feline recordings
 * (see ASSETS_MANIFEST.md).
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private lastVocalTimeMs = 0;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
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
    return this.ctx;
  }

  private jitter(base: number, spread = 0.08): number {
    return base * (1 + (Math.random() * 2 - 1) * spread);
  }

  private agePitchMultiplier(ageDays: number): number {
    // Newborns/kittens have higher delicate voices; adults are warmer & deeper
    if (ageDays < 21) return 1.45;
    if (ageDays < 70) return 1.24;
    if (ageDays < 180) return 1.08;
    return 0.94;
  }

  public playPurr(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.jitter(50, 0.06), now);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(this.jitter(25, 0.08), now);
    lfoGain.gain.setValueAtTime(0.032, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.16);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.72);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 1.08);
    lfo.stop(now + 1.08);
  }

  public playMeowVariant(
    variant: 'soft_meow' | 'greeting_meow' | 'kitten_mew' | 'distress',
    ageDays = 45
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const ageMult = this.agePitchMultiplier(ageDays);
    const baseFreq =
      variant === 'kitten_mew'
        ? this.jitter(780, 0.09)
        : variant === 'greeting_meow'
          ? this.jitter(520 * ageMult, 0.08)
          : variant === 'distress'
            ? this.jitter(610 * ageMult, 0.07)
            : this.jitter(440 * ageMult, 0.08);

    const dur =
      variant === 'greeting_meow' ? 0.24 : variant === 'kitten_mew' ? 0.28 : 0.42;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq * 0.92, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.32, now + dur * 0.35);
    osc.frequency.exponentialRampToValueAtTime(
      variant === 'greeting_meow' ? baseFreq * 1.1 : baseFreq * 0.78,
      now + dur
    );

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq * 1.85, now);
    filter.Q.setValueAtTime(3.6, now);

    const peakVol = this.jitter(variant === 'soft_meow' ? 0.042 : 0.058, 0.14);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakVol, now + dur * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  public playTrillOrChirp(playful: boolean, ageDays = 60): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    const base = this.jitter((playful ? 640 : 500) * this.agePitchMultiplier(ageDays), 0.08);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.22);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(playful ? 34 : 26, now);
    lfoGain.gain.setValueAtTime(38, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.048, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.26);
    lfo.stop(now + 0.26);
  }

  public playHiss(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 0.42;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3400, now);
    filter.Q.setValueAtTime(1.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public playLowGrowl(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(this.jitter(115, 0.08), now);
    osc.frequency.linearRampToValueAtTime(92, now + 0.45);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playSleepySigh(): void {
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
    gain.connect(ctx.destination);
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
   * Context-aware dispatcher with cooldown protection so cat audio never spams.
   */
  public playVocalCue(cue?: CatVocalCue, ageDays = 45, bypassCooldown = false): void {
    if (!cue) return;
    const nowMs = Date.now();
    if (!bypassCooldown && nowMs - this.lastVocalTimeMs < 900) return;
    this.lastVocalTimeMs = nowMs;

    switch (cue) {
      case 'purr':
        this.playPurr();
        break;
      case 'soft_meow':
      case 'greeting_meow':
      case 'kitten_mew':
      case 'distress':
        this.playMeowVariant(cue, ageDays);
        break;
      case 'trill_chirp':
        this.playTrillOrChirp(false, ageDays);
        break;
      case 'play_chirp':
        this.playTrillOrChirp(true, ageDays);
        break;
      case 'hiss':
        this.playHiss();
        break;
      case 'low_growl':
        this.playLowGrowl();
        break;
      case 'sleepy_sigh':
        this.playSleepySigh();
        break;
      case 'eat':
      case 'drink':
        this.playSoftChime(540);
        break;
      case 'clean':
        this.playSoftChime(740);
        break;
    }
  }
}

export const soundManager = new SoundManager();
