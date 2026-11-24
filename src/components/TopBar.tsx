import { AlertTriangle, Camera, ClipboardList, Coins, Heart, Settings, Users, Zap } from 'lucide-react';
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
import { countClaimableQuests, useGameStore } from '../store/useGameStore';
import { useOnlineStore } from '../store/useOnlineStore';

/**
 * Clean Meowchi Top HUD:
 * - Compact Top-Corner Energy Bar (~96px wide, thin progress bar, lightning icon, Energy X/20)
 * - Quest Icon with RED notification dot whenever one or more quest rewards are claimable
 * - Minimal mode during active human-to-cat interactions so animations are never blocked
 * - Natural welfare warnings when cat needs food/water/attention (STRICTLY ZERO hunger bars!)
 */
export function TopBar() {
  const cat = useGameStore((s) => s.cat);
  const survival = useGameStore((s) => s.survival);
  const coins = useGameStore((s) => s.coins);
  const playerEnergy = useGameStore((s) => s.playerEnergy);
  const dailyTasks = useGameStore((s) => s.dailyTasks);
  const activeCareAction = useGameStore((s) => s.activeCareAction);
  const lang = useGameStore((s) => s.settings.language);
  const setShowProfileModal = useGameStore((s) => s.setShowProfileModal);
  const setShowTasksModal = useGameStore((s) => s.setShowTasksModal);
  const setPhotoMode = useGameStore((s) => s.setPhotoMode);
  const setShowSettings = useGameStore((s) => s.setShowSettings);
  const showToast = useGameStore((s) => s.showToast);
  const syncRealTimeClocks = useGameStore((s) => s.syncRealTimeClocks);
  const setShowOnlineModal = useOnlineStore((s) => s.setShowOnlineModal);
  const livePlayersCount = useOnlineStore((s) => s.livePlayers.length);
  const onlineStatus = useOnlineStore((s) => s.connectionStatus);

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
  const energyPct = Math.round((energyInfo.current / Math.max(1, energyInfo.max)) * 100);
  const claimableQuests = countClaimableQuests(dailyTasks);
  const isInteracting = activeCareAction !== null;
  const topWarning = survival.warnings[0] ?? null;

  const handleEnergyTap = () => {
    if (energyInfo.isFull) {
      showToast(
        lang === 'th'
          ? `Energy เต็มแล้ว (${energyInfo.current}/${energyInfo.max}) • ใช้ 5 Energy ต่อมินิเกม`
          : `Energy is full (${energyInfo.current}/${energyInfo.max}) • 5 Energy per minigame`,
        'info'
      );
      return;
    }
    const nextStr = formatCountdownMmSs(energyInfo.msUntilNextEnergy);
    const clockStr = energyInfo.nextEnergyAtUtc ? formatClockTime(energyInfo.nextEnergyAtUtc) : '';
    showToast(
      lang === 'th'
        ? `⚡ Energy ${energyInfo.current}/${energyInfo.max} • ฟื้น +1 ใน ${nextStr} (${clockStr})`
        : `⚡ Energy ${energyInfo.current}/${energyInfo.max} • +1 in ${nextStr} (${clockStr})`,
      'info'
    );
  };

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
            <Coins size={12} color="#d49a42" />
            <span>{coins}</span>
          </div>

          {/* Quest Button with RED Notification Dot */}
          <div className="icon-btn-wrap">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setShowTasksModal(true)}
              aria-label={t.dailyTasks}
              title={t.dailyTasks}
            >
              <ClipboardList size={15} />
            </button>
            {claimableQuests > 0 && (
              <span
                className="quest-notif-dot"
                aria-label={
                  lang === 'th'
                    ? `มี ${claimableQuests} รางวัลภารกิจที่รับได้`
                    : `${claimableQuests} claimable quest reward(s)`
                }
              />
            )}
          </div>

          {!isInteracting && (
            <>
              <div className="icon-btn-wrap">
                <button
                  type="button"
                  className="icon-btn online-top-btn"
                  onClick={() => setShowOnlineModal(true)}
                  aria-label={lang === 'th' ? 'ผู้เล่นออนไลน์และเยี่ยมบ้าน' : 'Online Players & Visit Homes'}
                  title={lang === 'th' ? 'ผู้เล่นออนไลน์ / เยี่ยมบ้าน' : 'Online Players / Visit'}
                >
                  <Users size={15} />
                </button>
                <span
                  className={`online-top-dot ${onlineStatus === 'connected' ? 'live' : 'local'}`}
                  title={
                    lang === 'th'
                      ? `ออนไลน์ ${livePlayersCount + 1} คน`
                      : `${livePlayersCount + 1} online`
                  }
                />
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPhotoMode(true)}
                aria-label={t.photoMode}
                title={t.photoMode}
              >
                <Camera size={15} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowSettings(true)}
                aria-label={t.settings}
                title={t.settings}
              >
                <Settings size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Second Row: Emotion Cue (left) + Compact Top-Corner Energy Bar (right) */}
      <div className="status-row">
        {!isInteracting ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', flex: 1 }}>
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
              <Heart size={11} fill="#cf6f72" color="#cf6f72" />
              <span>{cat.bondLevel}</span>
            </button>
          </div>
        ) : (
          <div />
        )}

        {/* Compact Energy Bar (~96px wide, thin progress bar, rounded edges, subtle colors) */}
        <button
          type="button"
          className="energy-compact ui-interactive"
          onClick={handleEnergyTap}
          aria-label={`Energy ${energyInfo.current}/${energyInfo.max}`}
          title={`Energy ${energyInfo.current}/${energyInfo.max}`}
        >
          <div className="energy-compact-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <Zap size={10} fill="#d49a42" color="#c88d32" />
              <span>{t.energyLabel}</span>
            </span>
            <span>
              {energyInfo.current}/{energyInfo.max}
            </span>
          </div>
          <div className="energy-compact-track">
            <div className="energy-compact-fill" style={{ width: `${energyPct}%` }} />
          </div>
        </button>
      </div>

      {/* Natural Non-Blocking Welfare Warning (No numerical hunger/fullness bar!) */}
      {!isInteracting && topWarning && (
        <div className={`welfare-chip welfare-${topWarning.severity}`} role="status">
          <AlertTriangle size={12} />
          <span>{lang === 'th' ? topWarning.messageTh : topWarning.messageEn}</span>
        </div>
      )}
    </div>
  );
}
