import { Camera, Coins, Heart, Settings } from 'lucide-react';
import {
  BEHAVIOR_LABELS,
  EMOTION_LABELS,
  formatAge,
  STAGE_LABELS,
  UI_TEXT
} from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';

/**
 * Clean Meowchi Top HUD:
 * Displays ONLY Cat Name, Age/Life Stage, Coins, and natural emotion/behavior cues.
 * Strictly NO visible hunger or fullness bars anywhere!
 */
export function TopBar() {
  const cat = useGameStore((s) => s.cat);
  const coins = useGameStore((s) => s.coins);
  const lang = useGameStore((s) => s.settings.language);
  const setShowProfileModal = useGameStore((s) => s.setShowProfileModal);
  const setPhotoMode = useGameStore((s) => s.setPhotoMode);
  const setShowSettings = useGameStore((s) => s.setShowSettings);

  const t = UI_TEXT[lang];
  const stageLabel = STAGE_LABELS[cat.lifeStage][lang];
  const behaviorLabel = BEHAVIOR_LABELS[cat.behavior][lang];
  const emotionInfo = EMOTION_LABELS[cat.emotion];

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
            <Coins size={14} color="#d49a42" />
            <span>{coins}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setPhotoMode(true)}
            aria-label={t.photoMode}
            title={t.photoMode}
          >
            <Camera size={17} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            aria-label={t.settings}
            title={t.settings}
          >
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* Expressive emotion & body-language cue strip (zero numerical hunger/fullness bars!) */}
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
    </div>
  );
}
