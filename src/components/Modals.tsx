import { Award, Check, CheckCircle2, Lock, Save, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { useState } from 'react';
import { getBreedDefinition } from '../config/breeds';
import {
  BEHAVIOR_LABELS,
  BODY_CONDITION_LABELS,
  EMOTION_LABELS,
  formatAge,
  PATTERN_LABELS,
  STAGE_LABELS,
  TRAIT_LABELS,
  UI_TEXT
} from '../i18n/translations';
import { BOND_MILESTONES } from '../simulation/bond';
import { computeGrowthMetrics } from '../simulation/growth';
import { getDominantPersonalitySummary } from '../simulation/personality';
import { useGameStore } from '../store/useGameStore';
import { PersonalityTraits, QualityPreset } from '../types/game';

/**
 * Detailed Cat Identity, Body Condition, 8-Trait Personality & Bond Profile.
 * Strictly displays ZERO numerical hunger or fullness bars!
 */
export function CatProfileModal() {
  const state = useGameStore();
  const { cat, settings } = state;
  const lang = settings.language;
  const t = UI_TEXT[lang];

  if (!state.showProfileModal) return null;

  const breedDef = getBreedDefinition(cat.identity.breed);
  const metrics = computeGrowthMetrics(cat.identity.breed, cat.ageDays);
  const stageInfo = STAGE_LABELS[cat.lifeStage];
  const bodyInfo = BODY_CONDITION_LABELS[cat.weight.condition];
  const emotionInfo = EMOTION_LABELS[cat.emotion];
  const traitKeys = Object.keys(TRAIT_LABELS) as (keyof PersonalityTraits)[];

  return (
    <div className="modal-backdrop" onClick={() => state.setShowProfileModal(false)}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h3 style={{ margin: 0, fontSize: 15 }}>
            {cat.identity.name} ({cat.identity.sex === 'female' ? t.sexFemale : t.sexMale})
          </h3>
          <button
            type="button"
            className="drawer-close"
            onClick={() => state.setShowProfileModal(false)}
          >
            <X size={15} />
          </button>
        </div>

        {/* Identity & Growth */}
        <div className="section-box">
          <div className="row-between">
            <div style={{ fontSize: 12 }}>
              <strong>{lang === 'th' ? breedDef.nameTh : breedDef.nameEn}</strong> •{' '}
              {PATTERN_LABELS[cat.identity.furPattern][lang]}
              <div style={{ fontSize: 11, color: '#756355', marginTop: 2 }}>
                {stageInfo[lang]} ({formatAge(cat.ageDays, lang)}) • {emotionInfo.icon}{' '}
                {emotionInfo[lang]}
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                state.setShowProfileModal(false);
                state.setShowAdoptFlow(true);
              }}
            >
              {t.adoptNew}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#756355' }}>
            {lang === 'th' ? stageInfo.descTh : stageInfo.descEn}
          </div>
          <div className="bar-track" style={{ height: 6 }}>
            <div
              className="bar-fill"
              style={{
                width: `${Math.round(metrics.overallGrowth * 100)}%`,
                background: 'linear-gradient(90deg, #d89b72, #c87a56)'
              }}
            />
          </div>
        </div>

        {/* Dynamic Weight & Body Condition */}
        <div className="section-box">
          <div className="row-between">
            <span style={{ fontSize: 12, fontWeight: 700 }}>{t.bodyCondition}</span>
            <span
              className={`badge ${
                cat.weight.condition === 'healthy' || cat.weight.condition === 'lean'
                  ? 'sage'
                  : 'warn'
              }`}
            >
              {cat.weight.currentWeightKg} kg • {bodyInfo[lang]}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#6b5546' }}>
            {lang === 'th' ? bodyInfo.tipTh : bodyInfo.tipEn}
          </div>
        </div>

        {/* 8-Trait Personality (Evolves with Care) */}
        <div className="section-box">
          <div style={{ fontSize: 12, fontWeight: 700 }}>{t.personality}</div>
          <div style={{ fontSize: 11, color: '#a95e3d', fontWeight: 600 }}>
            {getDominantPersonalitySummary(cat.traits, lang)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, fontSize: 11 }}>
            {traitKeys.map((k) => {
              const val = Math.round(cat.traits[k]);
              const isCaution = k === 'fearfulness' || k === 'aggression';
              return (
                <div key={k}>
                  <div className="row-between">
                    <span>{TRAIT_LABELS[k][lang]}</span>
                    <span>{val}</span>
                  </div>
                  <div className="bar-track" style={{ marginTop: 3 }}>
                    <div
                      className="bar-fill"
                      style={{
                        width: `${val}%`,
                        background: isCaution ? '#cf7e5b' : '#6d9575'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bond Behavioral Unlocks */}
        <div className="section-box">
          <div className="row-between">
            <span style={{ fontSize: 12, fontWeight: 700 }}>{t.bondUnlocksTitle}</span>
            <span className="badge warm">
              {t.bond} Lv.{cat.bondLevel}
            </span>
          </div>
          {BOND_MILESTONES.map((m) => {
            const unlocked = cat.bondLevel >= m.level;
            return (
              <div
                key={m.key}
                className="row-between"
                style={{ fontSize: 11, opacity: unlocked ? 1 : 0.56 }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {unlocked ? (
                    <CheckCircle2 size={13} color="#6d9575" />
                  ) : (
                    <Lock size={12} color="#8a7a6d" />
                  )}
                  <span>{lang === 'th' ? m.titleTh : m.titleEn}</span>
                </span>
                <span className={`badge ${unlocked ? 'sage' : ''}`}>Lv.{m.level}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SettingsModal() {
  const state = useGameStore();
  const { settings, cat } = state;
  const lang = settings.language;
  const t = UI_TEXT[lang];
  const [nameInput, setNameInput] = useState(cat.identity.name);

  if (!state.showSettings) return null;

  return (
    <div className="modal-backdrop" onClick={() => state.setShowSettings(false)}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h3 style={{ margin: 0, fontSize: 15 }}>{t.settings}</h3>
          <button
            type="button"
            className="drawer-close"
            onClick={() => state.setShowSettings(false)}
          >
            <X size={15} />
          </button>
        </div>

        <div className="section-box">
          <span style={{ fontSize: 12, fontWeight: 700 }}>{t.rename}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="text-input"
              value={nameInput}
              maxLength={20}
              onChange={(e) => setNameInput(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                state.renameCat(nameInput);
                state.showToast(lang === 'th' ? 'เปลี่ยนชื่อเรียบร้อย' : 'Renamed!', 'info');
              }}
            >
              <Check size={14} />
            </button>
          </div>
        </div>

        <div className="section-box">
          <div className="row-between">
            <span style={{ fontSize: 12, fontWeight: 700 }}>{t.language}</span>
            <div className="chip-group">
              <button
                type="button"
                className={`chip-btn ${lang === 'th' ? 'selected' : ''}`}
                onClick={() => state.updateSettings({ language: 'th' })}
              >
                ไทย
              </button>
              <button
                type="button"
                className={`chip-btn ${lang === 'en' ? 'selected' : ''}`}
                onClick={() => state.updateSettings({ language: 'en' })}
              >
                English
              </button>
            </div>
          </div>

          <div className="row-between">
            <span style={{ fontSize: 12, fontWeight: 700 }}>{t.sound}</span>
            <button
              type="button"
              className={`chip-btn ${settings.soundEnabled ? 'selected' : ''}`}
              onClick={() => state.updateSettings({ soundEnabled: !settings.soundEnabled })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              {settings.soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {settings.soundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="row-between">
            <span style={{ fontSize: 12, fontWeight: 700 }}>{t.graphics}</span>
            <div className="chip-group">
              {(['low', 'medium', 'high'] as QualityPreset[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`chip-btn ${settings.quality === q ? 'selected' : ''}`}
                  onClick={() => state.updateSettings({ quality: q })}
                >
                  {q.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="section-box">
          <div className="row-between">
            <span style={{ fontSize: 12, fontWeight: 700 }}>{t.timeSpeed}</span>
            <div className="chip-group">
              {([1, 5, 20] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  className={`chip-btn ${settings.timeScale === spd ? 'selected' : ''}`}
                  onClick={() => state.updateSettings({ timeScale: spd })}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700 }}>{t.growthTest}</div>
          <div className="chip-group">
            {[
              { days: 7, label: '+7d' },
              { days: 14, label: '+14d' },
              { days: 45, label: '+45d' },
              { days: 180, label: '+180d' }
            ].map((opt) => (
              <button
                key={opt.days}
                type="button"
                className="chip-btn"
                onClick={() => state.skipAgeDays(opt.days)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="row-between">
          <button
            type="button"
            className="btn-primary"
            onClick={() => state.persistNow()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Save size={14} />
            {t.saveNow}
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (
                window.confirm(
                  lang === 'th'
                    ? 'ต้องการล้างเซฟและเลือกสายพันธุ์ลูกแมวใหม่หรือไม่?'
                    : 'Reset save and choose a new kitten breed?'
                )
              ) {
                state.resetGame();
              }
            }}
          >
            {t.resetSave}
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 10.5, color: '#756355', lineHeight: 1.4 }}>
          {t.placeholderNotice}
        </p>
      </div>
    </div>
  );
}

export function AlbumModal() {
  const state = useGameStore();
  const lang = state.settings.language;
  const t = UI_TEXT[lang];

  if (!state.showAlbumModal) return null;

  return (
    <div className="modal-backdrop" onClick={() => state.setShowAlbumModal(false)}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h3 style={{ margin: 0, fontSize: 15 }}>
            {t.photoAlbum} ({state.photos.length})
          </h3>
          <button
            type="button"
            className="drawer-close"
            onClick={() => state.setShowAlbumModal(false)}
          >
            <X size={15} />
          </button>
        </div>

        {state.photos.length === 0 ? (
          <p style={{ fontSize: 12, color: '#756355', textAlign: 'center', margin: '18px 0' }}>
            {t.noPhotos}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {state.photos.map((photo) => (
              <div key={photo.id} className="section-box" style={{ padding: 6 }}>
                <img
                  src={photo.dataUrl}
                  alt={photo.catName}
                  style={{
                    width: '100%',
                    aspectRatio: '9 / 12',
                    objectFit: 'cover',
                    borderRadius: 10
                  }}
                />
                <div className="row-between" style={{ fontSize: 10.5 }}>
                  <div>
                    <strong>{photo.catName}</strong> • {formatAge(photo.ageDays, lang)}
                    <div style={{ color: '#756355' }}>
                      {STAGE_LABELS[photo.lifeStage][lang]} •{' '}
                      {BEHAVIOR_LABELS[photo.behavior][lang]}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="drawer-close"
                    onClick={() => state.deletePhoto(photo.id)}
                    aria-label="Delete photo"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TasksModal() {
  const state = useGameStore();
  const lang = state.settings.language;
  const t = UI_TEXT[lang];

  if (!state.showTasksModal) return null;

  return (
    <div className="modal-backdrop" onClick={() => state.setShowTasksModal(false)}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h3 style={{ margin: 0, fontSize: 15 }}>{t.dailyTasks}</h3>
          <button
            type="button"
            className="drawer-close"
            onClick={() => state.setShowTasksModal(false)}
          >
            <X size={15} />
          </button>
        </div>

        {state.dailyTasks.map((task) => {
          const ready = task.progress >= task.target && !task.claimed;
          return (
            <div key={task.id} className="section-box">
              <div className="row-between">
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    {lang === 'th' ? task.titleTh : task.titleEn}
                  </div>
                  <div style={{ fontSize: 11, color: '#756355' }}>
                    {task.progress}/{task.target} • +{task.rewardCoins}c • +{task.rewardXp} XP
                  </div>
                </div>
                {task.claimed ? (
                  <span className="badge sage">{t.claimed}</span>
                ) : ready ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => state.claimDailyTask(task.id)}
                  >
                    {t.claim}
                  </button>
                ) : (
                  <span className="badge">
                    {task.progress}/{task.target}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <h4
          style={{
            margin: '6px 0 0',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Award size={15} color="#d49a42" />
          {t.achievements}
        </h4>

        {state.achievements.map((a) => (
          <div key={a.id} className="section-box" style={{ opacity: a.unlocked ? 1 : 0.65 }}>
            <div className="row-between">
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>
                  {lang === 'th' ? a.titleTh : a.titleEn}
                </div>
                <div style={{ fontSize: 11, color: '#756355' }}>
                  {lang === 'th' ? a.descTh : a.descEn}
                </div>
              </div>
              <span className={`badge ${a.unlocked ? 'sage' : ''}`}>
                {a.unlocked ? '✓' : `+${a.rewardCoins}c`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
