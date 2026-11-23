import { Camera, Coins, Heart, Settings, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  BEHAVIOR_LABELS,
  EMOTION_LABELS,
  formatAge,
  STAGE_LABELS,
  UI_TEXT
} from '../i18n/translations';
import {
  formatClockTime,
  formatCountdownMmSs,
  getEnergyRegenInfo
} from '../simulation/energy';
import { useGameStore } from '../store/useGameStore';

/**
 * Clean Meowchi Top HUD:
 * Displays Cat Name, Age/Life Stage, Coins, Human Player Energy (X/20 + regen countdown),
 * and natural emotion/behavior cues. Strictly ZERO hunger or fullness bars!
 */
export function TopBar() {
  const cat = useGameStore((s) => s.cat);
  const coins = useGameStore((s) => s.coins);
  const playerEnergy = useGameStore((s) => s.playerEnergy);
  const lang = useGameStore((s) => s.settings.language);
  const setShowProfileModal = useGameStore((s) => s.setShowProfileModal);
  const setPhotoMode = useGameStore((s) => s.setPhotoMode);
  const setShowSettings = useGameStore((s) => s.setShowSettings);
  const syncRealTimeClocks = useGameStore((s) => s.syncRealTimeClocks);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      syncRealTimeClocks(now);
    }, 1000);
    return () => clearInterval(id);
  }, [syncRealTimeClocks]);

  const t = UI_TEXT[lang];
  const stageLabel = STAGE_LABELS[cat.lifeStage][lang];
  const behaviorLabel = BEHAVIOR_LABELS[cat.behavior][lang];
  const emotionInfo = EMOTION_LABELS[cat.emotion];
  const energyInfo = getEnergyRegenInfo(playerEnergy, nowMs);

  return (
    <div className="top-hud">
      <div className="top-row">
        <button
          type="button"
          className="cat-pill ui-interactive"
          onClick={() => setShowProfileModal(true)}
          aria-label={t.catProfile}
        >
          <div className="level-badge">
            {t.levelShort}
            {cat.level}
          </div>
          <div className="cat-meta">
            <span className="cat-name-line">{cat.identity.name}</span>
            <span className="cat-sub-line">
              {stageLabel} • {formatAge(cat.ageDays, lang)}
            </span>
          </div>
        </button>

        <div className="top-actions ui-interactive">
          <div className="coin-pill" title="Coins">
            <Coins size={13} color="#d49a42" />
            <span>{coins}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setPhotoMode(true)}
            aria-label={t.photoMode}
            title={t.photoMode}
          >
            <Camera size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            aria-label={t.settings}
            title={t.settings}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Player Energy & Emotion Cue Row */}
      <div className="status-row">
        <div className="behavior-chip">
          <span>{emotionInfo.icon}</span>
          <span>
            {emotionInfo[lang]} • {behaviorLabel}
          </span>
        </div>
        <button
          type="button"
          className="bond-chip ui-interactive"
          onClick={() => setShowProfileModal(true)}
          style={{ cursor: 'pointer' }}
        >
          <Heart size={12} fill="#cf6f72" color="#cf6f72" />
          <span>
            {t.bond} {cat.bondLevel}
          </span>
        </button>
      </div>

      {/* Human Player Energy Bar (Minigames Only — +1 every 20m, Max 20) */}
      <div className="energy-strip ui-interactive" aria-label="Player Energy">
        <span className="energy-value">
          <Zap size={12} fill="#d49a42" color="#d49a42" />
          <strong>
            {t.energyLabel} {energyInfo.current}/{energyInfo.max}
          </strong>
        </span>
        <span className="energy-regen-meta">
          {energyInfo.isFull
            ? lang === 'th'
              ? 'เต็มแล้ว'
              : 'Full'
            : lang === 'th'
              ? `+1 ใน ${formatCountdownMmSs(energyInfo.msUntilNextEnergy)} (${formatClockTime(energyInfo.nextEnergyAtUtc!)})`
              : `+1 in ${formatCountdownMmSs(energyInfo.msUntilNextEnergy)} (at ${formatClockTime(energyInfo.nextEnergyAtUtc!)})`}
        </span>
      </div>
    </div>
  );
}
