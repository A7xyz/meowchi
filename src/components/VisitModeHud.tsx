import { ArrowLeft, Camera, Fish, HandHeart, Heart, Smile, Users } from 'lucide-react';
import { getBreedDefinition } from '../config/breeds';
import { useGameStore } from '../store/useGameStore';
import { useOnlineStore } from '../store/useOnlineStore';

/**
 * Clean Mobile Portrait HUD displayed while visiting another player's or neighbor's home.
 */
export function VisitModeHud() {
  const visitState = useOnlineStore((s) => s.visitState);
  const leaveVisitedHome = useOnlineStore((s) => s.leaveVisitedHome);
  const petVisitedCat = useOnlineStore((s) => s.petVisitedCat);
  const giveVisitedCatTreat = useOnlineStore((s) => s.giveVisitedCatTreat);
  const likeVisitedHome = useOnlineStore((s) => s.likeVisitedHome);
  const waveAtVisitedHome = useOnlineStore((s) => s.waveAtVisitedHome);
  const setShowOnlineModal = useOnlineStore((s) => s.setShowOnlineModal);

  const lang = useGameStore((s) => s.settings.language);
  const setPhotoMode = useGameStore((s) => s.setPhotoMode);
  const toast = useGameStore((s) => s.toast);

  if (!visitState) return null;

  const { home, likedThisVisit } = visitState;
  const isTh = lang === 'th';
  const breed = getBreedDefinition(home.catIdentity.breed);

  return (
    <div className="ui-layer">
      {/* Top Visit Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="top-row">
          <div className="cat-pill ui-interactive" style={{ cursor: 'default' }}>
            <div className="level-badge" style={{ background: home.isLive ? '#4e9a62' : '#c87a56' }}>
              {home.isLive ? 'LIVE' : '🏡'}
            </div>
            <div className="cat-meta">
              <span className="cat-name-line">
                {isTh ? `บ้านของ ${home.ownerName}` : `${home.ownerName}'s Home`}
              </span>
              <span className="cat-sub-line">
                🐾 {home.catIdentity.name} • {isTh ? breed.nameTh : breed.nameEn} • Lv.
                {home.catLevel}
              </span>
            </div>
          </div>

          <div className="top-actions ui-interactive">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPhotoMode(true)}
              aria-label={isTh ? 'ถ่ายรูป' : 'Photo'}
              title={isTh ? 'ถ่ายรูปที่บ้านเพื่อน' : 'Take Photo'}
            >
              <Camera size={15} />
            </button>
            <button
              type="button"
              className="visit-return-btn"
              onClick={() => leaveVisitedHome()}
            >
              <ArrowLeft size={14} />
              <span>{isTh ? 'กลับบ้าน' : 'Home'}</span>
            </button>
          </div>
        </div>

        <div className="behavior-chip" style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
          <span>💬</span>
          <span>{isTh ? home.greetingTh : home.greetingEn}</span>
        </div>

        {toast && (
          <div className={`toast-banner toast-${toast.tone}`} role="status">
            {toast.text}
          </div>
        )}
      </div>

      {/* Bottom Visit Actions */}
      <div className="bottom-stack">
        <div className="hint-bar" style={{ opacity: 0.85 }}>
          <span>
            {isTh
              ? 'แตะพื้นเพื่อเดินเล่นในบ้านเพื่อน • แตะตัวน้องแมวเพื่อลูบหัว'
              : 'Tap floor to walk around • Tap host cat to pet'}
          </span>
        </div>

        <nav className="bottom-nav ui-interactive" aria-label="Visit Home Actions">
          <button type="button" className="nav-btn" onClick={() => petVisitedCat()}>
            <HandHeart size={19} />
            <span>{isTh ? 'ลูบหัว' : 'Pet'}</span>
          </button>
          <button type="button" className="nav-btn" onClick={() => giveVisitedCatTreat()}>
            <Fish size={19} />
            <span>{isTh ? 'ให้ขนม' : 'Treat'}</span>
          </button>
          <button
            type="button"
            className={`nav-btn ${likedThisVisit ? 'active' : ''}`}
            onClick={() => likeVisitedHome()}
          >
            <Heart
              size={19}
              fill={likedThisVisit ? '#cf6f72' : 'none'}
              color={likedThisVisit ? '#cf6f72' : 'currentColor'}
            />
            <span>{home.likesCount}</span>
          </button>
          <button type="button" className="nav-btn" onClick={() => waveAtVisitedHome()}>
            <Smile size={19} />
            <span>{isTh ? 'ทักทาย' : 'Wave'}</span>
          </button>
          <button type="button" className="nav-btn" onClick={() => setShowOnlineModal(true)}>
            <Users size={19} />
            <span>{isTh ? 'สลับบ้าน' : 'Switch'}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
