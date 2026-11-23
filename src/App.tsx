import { Camera, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ActionDrawer } from './components/ActionDrawer';
import { AdoptionFlow } from './components/AdoptionFlow';
import { BottomNav } from './components/BottomNav';
import { DecorateBar } from './components/DecorateBar';
import { HumanCreator } from './components/HumanCreator';
import { CatToyChallengeGame } from './components/minigames/CatToyChallengeGame';
import { CleanRoomGame } from './components/minigames/CleanRoomGame';
import { DeliveryGame } from './components/minigames/DeliveryGame';
import { FishingGame } from './components/minigames/FishingGame';
import { MatchingPuzzleGame } from './components/minigames/MatchingPuzzleGame';
import {
  AlbumModal,
  CatProfileModal,
  EquipmentModal,
  MemorialModal,
  SettingsModal,
  TasksModal
} from './components/Modals';
import { TopBar } from './components/TopBar';
import { GameEngine } from './engine/GameEngine';
import { UI_TEXT } from './i18n/translations';
import { useGameStore } from './store/useGameStore';

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const hydrateFromStorage = useGameStore((s) => s.hydrateFromStorage);
  const photoMode = useGameStore((s) => s.photoMode);
  const setPhotoMode = useGameStore((s) => s.setPhotoMode);
  const savePhoto = useGameStore((s) => s.savePhoto);
  const activeToy = useGameStore((s) => s.activeToy);
  const activateToy = useGameStore((s) => s.activateToy);
  const activeCareAction = useGameStore((s) => s.activeCareAction);
  const cancelActiveCareAction = useGameStore((s) => s.cancelActiveCareAction);
  const activeMinigameSession = useGameStore((s) => s.activeMinigameSession);
  const decorateMode = useGameStore((s) => s.decorateMode);
  const toast = useGameStore((s) => s.toast);
  const biteFeedback = useGameStore((s) => s.biteFeedback);
  const reduceBiteVisuals = useGameStore((s) => s.settings.reduceBiteVisuals);
  const lang = useGameStore((s) => s.settings.language);
  const t = UI_TEXT[lang];

  const [showBiteOverlay, setShowBiteOverlay] = useState(false);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (biteFeedback.seq <= 0) return;
    setShowBiteOverlay(true);
    // Strict maximum display duration: 0.5 seconds (500ms), non-obstructive smooth fade!
    const id = setTimeout(() => setShowBiteOverlay(false), 500);
    return () => clearTimeout(id);
  }, [biteFeedback.seq]);

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new GameEngine(mountRef.current);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleCapturePhoto = () => {
    if (!engineRef.current) return;
    const dataUrl = engineRef.current.capturePhotoDataUrl();
    savePhoto(dataUrl);
  };

  const handleFocusCat = () => {
    engineRef.current?.focusOnCat();
  };

  const activeGameId = activeMinigameSession?.gameId ?? null;
  const isInteracting = activeCareAction !== null;

  return (
    <div className="app-shell">
      <main className="phone-frame">
        {/* Live 3D Three.js Canvas */}
        <div ref={mountRef} className="canvas-viewport" />

        {/* Subtle 0.5s Non-Obstructive Defensive Bite Screen-Edge Feedback */}
        {showBiteOverlay && (
          <div
            className={`bite-edge-overlay ${reduceBiteVisuals ? 'warning-flash' : 'subtle-tint'}`}
            aria-hidden="true"
          />
        )}

        {/* Photo Mode Minimal HUD */}
        {photoMode ? (
          <div className="photo-overlay">
            <div className="row-between ui-interactive">
              <span className="behavior-chip">📷 {t.photoMode}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPhotoMode(false)}
                aria-label={t.exitPhoto}
              >
                <X size={18} />
              </button>
            </div>

            <div
              className="ui-interactive"
              style={{ display: 'flex', justifyContent: 'center', paddingBottom: 16 }}
            >
              <button
                type="button"
                className="photo-shutter"
                onClick={handleCapturePhoto}
                aria-label={t.takePhoto}
              >
                <Camera size={28} />
              </button>
            </div>
          </div>
        ) : (
          /* Clean Meowchi Gameplay HUD (NO hunger/fullness bars; minimal unobstructed view during interactions!) */
          <div className="ui-layer">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <TopBar />
              {toast && (
                <div className={`toast-banner toast-${toast.tone}`} role="status">
                  {toast.text}
                </div>
              )}
            </div>

            <div className="bottom-stack">
              {isInteracting ? (
                /* Minimal non-blocking indicator during full-body human-to-cat interaction */
                <div className="interaction-minimal-bar ui-interactive">
                  <span>
                    {activeCareAction.phase === 'approaching' || activeCareAction.phase === 'aligning'
                      ? lang === 'th'
                        ? 'กำลังเดินเข้าไปหาน้องแมว...'
                        : 'Walking over...'
                      : lang === 'th'
                        ? 'กำลังดูแลน้องแมว...'
                        : 'Interacting...'}
                  </span>
                  {!activeCareAction.committed && (
                    <button
                      type="button"
                      className="hint-stop-btn"
                      onClick={() => cancelActiveCareAction()}
                    >
                      {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {activeToy && !decorateMode && (
                    <div className="hint-bar ui-interactive">
                      <span>
                        {activeToy === 'feather_wand'
                          ? t.featherHint
                          : activeToy === 'ball'
                            ? t.ballHint
                            : lang === 'th'
                              ? 'หนูไขลานกำลังวิ่งทั่วห้อง!'
                              : 'Wind-up mouse is darting around!'}
                      </span>
                      <button
                        type="button"
                        className="hint-stop-btn"
                        onClick={() => activateToy(null)}
                      >
                        {t.stopToy}
                      </button>
                    </div>
                  )}

                  {!activeToy && !decorateMode && (
                    <div className="hint-bar" style={{ opacity: 0.82 }}>
                      <span>{t.tapCatHint}</span>
                    </div>
                  )}

                  {decorateMode ? (
                    <DecorateBar />
                  ) : (
                    <>
                      <ActionDrawer onFocusCat={handleFocusCat} />
                      <BottomNav />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Full-screen 60-Second Playable Touch Minigames (5 games) */}
        {activeGameId === 'fishing' && <FishingGame />}
        {activeGameId === 'matching' && <MatchingPuzzleGame />}
        {activeGameId === 'toy_challenge' && <CatToyChallengeGame />}
        {activeGameId === 'delivery' && <DeliveryGame />}
        {activeGameId === 'clean_room' && <CleanRoomGame />}

        {/* 3D Human Character Creator & Wardrobe */}
        <HumanCreator />

        {/* First-Run Breed Selection & 3D Kitten Customization */}
        <AdoptionFlow />

        {/* Modals */}
        <CatProfileModal />
        <EquipmentModal />
        <SettingsModal />
        <AlbumModal />
        <TasksModal />
        <MemorialModal />
      </main>
    </div>
  );
}

export default App;
