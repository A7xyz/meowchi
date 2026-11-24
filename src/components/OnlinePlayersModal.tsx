import { Check, Copy, DoorOpen, Heart, Home, Search, Users, Wifi, WifiOff, X } from 'lucide-react';
import { useState } from 'react';
import { getBreedDefinition } from '../config/breeds';
import { STAGE_LABELS } from '../i18n/translations';
import { OnlinePlayerHome } from '../online/types';
import { useGameStore } from '../store/useGameStore';
import { useOnlineStore } from '../store/useOnlineStore';

export function OnlinePlayersModal() {
  const show = useOnlineStore((s) => s.showOnlineModal);
  const setShow = useOnlineStore((s) => s.setShowOnlineModal);
  const myHomeCode = useOnlineStore((s) => s.myHomeCode);
  const connectionStatus = useOnlineStore((s) => s.connectionStatus);
  const livePlayers = useOnlineStore((s) => s.livePlayers);
  const communityHomes = useOnlineStore((s) => s.communityHomes);
  const homeLikesReceived = useOnlineStore((s) => s.homeLikesReceived);
  const visitHome = useOnlineStore((s) => s.visitHome);
  const visitByHomeCode = useOnlineStore((s) => s.visitByHomeCode);
  const getShareableInviteUrl = useOnlineStore((s) => s.getShareableInviteUrl);
  const currentVisitId = useOnlineStore((s) => s.visitState?.home.playerId ?? null);

  const lang = useGameStore((s) => s.settings.language);
  const humanName = useGameStore((s) => s.humanAppearance.name);
  const catName = useGameStore((s) => s.cat.identity.name);
  const showToast = useGameStore((s) => s.showToast);

  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  if (!show) return null;

  const isTh = lang === 'th';

  const handleCopyInvite = async () => {
    const url = getShareableInviteUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast(
        isTh
          ? `คัดลอกลิงก์ชวนเพื่อนแล้ว! (รหัสบ้าน ${myHomeCode})`
          : `Invite link copied! (Home code ${myHomeCode})`,
        'celebrate'
      );
      setTimeout(() => setCopied(false), 2200);
    } catch {
      showToast(
        isTh ? `รหัสบ้านของคุณคือ ${myHomeCode}` : `Your home code is ${myHomeCode}`,
        'info'
      );
    }
  };

  const handleSearchCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    const ok = visitByHomeCode(codeInput);
    if (ok) {
      setCodeInput('');
    } else {
      showToast(
        isTh
          ? `ไม่พบบ้านรหัส "${codeInput.trim().toUpperCase()}" ในตอนนี้`
          : `Home code "${codeInput.trim().toUpperCase()}" not found online.`,
        'warn'
      );
    }
  };

  const renderHomeCard = (home: OnlinePlayerHome) => {
    const breed = getBreedDefinition(home.catIdentity.breed);
    const stageLabel = STAGE_LABELS[home.catLifeStage][lang];
    const isHere = currentVisitId === home.playerId;

    return (
      <div key={home.playerId} className="online-home-card">
        <div className="online-home-avatar" style={{ background: home.catIdentity.furColor }}>
          <span style={{ fontSize: 20 }}>🐱</span>
          {home.isLive && <span className="online-live-dot-sm" title="Online Live" />}
        </div>

        <div className="online-home-info">
          <div className="online-home-title-row">
            <span className="online-home-owner">{home.ownerName}</span>
            {home.isLive ? (
              <span className="online-badge live">{isTh ? 'ออนไลน์' : 'LIVE'}</span>
            ) : (
              <span className="online-badge neighbor">{isTh ? 'เพื่อนบ้าน' : 'Neighbor'}</span>
            )}
            <span className="online-code-tag">{home.homeCode}</span>
          </div>

          <div className="online-home-sub">
            🐾 {home.catIdentity.name} • {isTh ? breed.nameTh : breed.nameEn} • {stageLabel} • Lv.
            {home.catLevel}
          </div>

          <div className="online-home-quote">
            “{isTh ? home.greetingTh : home.greetingEn}”
          </div>

          <div className="online-home-meta">
            <span>
              <Heart size={11} fill="#cf6f72" color="#cf6f72" /> {home.likesCount}
            </span>
            <span>
              <Home size={11} /> {home.placedFurniture.length} {isTh ? 'เฟอร์นิเจอร์' : 'items'}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={`online-visit-btn ${isHere ? 'active' : ''}`}
          disabled={isHere}
          onClick={() => visitHome(home)}
        >
          <DoorOpen size={14} />
          <span>{isHere ? (isTh ? 'อยู่ที่นี่' : 'Here') : isTh ? 'เยี่ยมบ้าน' : 'Visit'}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="modal-backdrop ui-interactive" onClick={() => setShow(false)}>
      <div
        className="modal-sheet online-modal-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={isTh ? 'ผู้เล่นออนไลน์และเยี่ยมบ้าน' : 'Online Players & Visit Homes'}
      >
        <div className="drawer-header" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="#c87a56" />
            <h2 className="drawer-title">
              {isTh ? 'ผู้เล่นออนไลน์ & เยี่ยมบ้าน' : 'Online Players & Visit'}
            </h2>
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={() => setShow(false)}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Connection Status + Your Own Shareable Home Card */}
        <div className="online-my-home-box">
          <div className="row-between" style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi size={13} color="#4e9a62" />
                  <span style={{ color: '#3e7f4f' }}>
                    {isTh ? 'เชื่อมต่อออนไลน์แล้ว' : 'Connected Online'}
                  </span>
                </>
              ) : connectionStatus === 'local_only' ? (
                <>
                  <Wifi size={13} color="#c89232" />
                  <span style={{ color: '#9c6e1f' }}>
                    {isTh ? 'ออนไลน์เฉพาะเบราว์เซอร์นี้' : 'Local Multi-Tab Mode'}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff size={13} color="#8a796b" />
                  <span style={{ color: '#756355' }}>
                    {isTh ? 'กำลังเชื่อมต่อ...' : 'Connecting...'}
                  </span>
                </>
              )}
            </div>
            <span className="online-likes-pill">
              <Heart size={11} fill="#cf6f72" color="#cf6f72" /> {homeLikesReceived}
            </span>
          </div>

          <div className="row-between" style={{ gap: 8 }}>
            <div style={{ fontSize: 12, color: '#5c4b3f' }}>
              <div>
                <strong>{humanName}</strong> & 🐾 <strong>{catName}</strong>
              </div>
              <div style={{ fontSize: 11, color: '#7b6859', marginTop: 2 }}>
                {isTh ? 'รหัสบ้านของคุณ:' : 'Your Home Code:'}{' '}
                <strong style={{ color: '#a95e3d' }}>{myHomeCode}</strong>
              </div>
            </div>
            <button type="button" className="online-copy-btn" onClick={handleCopyInvite}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? (isTh ? 'คัดลอกแล้ว' : 'Copied') : isTh ? 'แชร์ลิงก์บ้าน' : 'Share Link'}</span>
            </button>
          </div>
        </div>

        {/* Visit by Home Code */}
        <form className="online-code-form" onSubmit={handleSearchCode}>
          <Search size={14} color="#8c7a6b" />
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder={isTh ? 'กรอกรหัสบ้านเพื่อน เช่น MC-MAY1' : 'Enter home code (e.g. MC-MAY1)'}
            className="online-code-input"
            maxLength={12}
          />
          <button type="submit" className="online-code-submit">
            {isTh ? 'ไปเลย' : 'Go'}
          </button>
        </form>

        <div className="online-list-scroll">
          {/* LIVE ONLINE PLAYERS */}
          <div className="online-section-label">
            <span className="online-live-dot-inline" />
            <span>
              {isTh
                ? `ผู้เล่นออนไลน์ตอนนี้ (${livePlayers.length + 1} คนรวมคุณ)`
                : `Live Online Players (${livePlayers.length + 1} incl. you)`}
            </span>
          </div>

          {livePlayers.length > 0 ? (
            <div className="online-card-list">{livePlayers.map(renderHomeCard)}</div>
          ) : (
            <div className="online-empty-live">
              {isTh
                ? 'ยังไม่มีผู้เล่นคนอื่นออนไลน์ในวินาทีนี้ • ลองเปิดเกมอีกแท็บ/ส่งลิงก์ให้เพื่อน หรือแวะเยี่ยมบ้านเพื่อนบ้าน Meowchi ด้านล่างได้เลย!'
                : 'No other live players connected right now. Share your link with a friend (or open another tab) or visit our Meowchi Neighbors below!'}
            </div>
          )}

          {/* COMMUNITY NEIGHBOR HOMES */}
          <div className="online-section-label" style={{ marginTop: 14 }}>
            <span>🏡</span>
            <span>
              {isTh
                ? `เพื่อนบ้าน Meowchi (${communityHomes.length} บ้าน)`
                : `Meowchi Community Homes (${communityHomes.length})`}
            </span>
          </div>
          <div className="online-card-list">{communityHomes.map(renderHomeCard)}</div>
        </div>
      </div>
    </div>
  );
}
