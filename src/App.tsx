import { Camera, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ActionDrawer } from './components/ActionDrawer';
import { AdoptionFlow } from './components/AdoptionFlow';
import { BottomNav } from './components/BottomNav';
import { DecorateBar } from './components/DecorateBar';
import { CleanRoomGame } from './components/minigames/CleanRoomGame';
import { FishingGame } from './components/minigames/FishingGame';
import { MatchingPuzzleGame } from './components/minigames/MatchingPuzzleGame';
import { AlbumModal, CatProfileModal, SettingsModal, TasksModal } from './components/Modals';
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
  const activeMinigame = useGameStore((s) => s.activeMinigame);
  const decorateMode = useGameStore((s) => s.decorateMode);
  const toast = useGameStore((s) => s.toast);
  const lang = useGameStore((s) => s.settings.language);
  const t = UI_TEXT[lang];

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

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

  return (
    <div className="app-shell">
      <main className="phone-frame">
        {/* Live 3D Three.js Canvas */}
        <div ref={mountRef} className="canvas-viewport" />

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
          /* Clean Meowchi Gameplay HUD (NO hunger/fullness bars!) */
          <div className="ui-layer">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <TopBar />
              {toast && (
                <div className={`toast-banner toast-${toast.tone}`} role="status">
                  {toast.text}
                </div>
              )}
            </div>

            <div className="bottom-stack">
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
                <div className="hint-bar" style={{ opacity: 0.8 }}>
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
            </div>
          </div>
        )}

        {/* Full-screen Playable Minigames */}
        {activeMinigame === 'fishing' && <FishingGame />}
        {activeMinigame === 'matching' && <MatchingPuzzleGame />}
        {activeMinigame === 'clean_room' && <CleanRoomGame />}

        {/* First-Run Breed Selection & 3D Kitten Customization */}
        <AdoptionFlow />

        {/* Modals */}
        <CatProfileModal />
        <SettingsModal />
        <AlbumModal />
        <TasksModal />
      </main>
    </div>
  );
}

export default App;
