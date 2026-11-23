import { Coins, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { soundManager } from '../../audio/SoundManager';
import { useGameStore } from '../../store/useGameStore';

interface TidyItem {
  id: string;
  emoji: string;
  zoneId: 'toy_bin' | 'kitchen' | 'bed_area';
  nameTh: string;
  nameEn: string;
  placed: boolean;
}

const INITIAL_ITEMS: TidyItem[] = [
  { id: 'i1', emoji: '🧶', zoneId: 'toy_bin', nameTh: 'ไหมพรม', nameEn: 'Yarn Ball', placed: false },
  { id: 'i2', emoji: '🐭', zoneId: 'toy_bin', nameTh: 'หนูของเล่น', nameEn: 'Toy Mouse', placed: false },
  { id: 'i3', emoji: '🥣', zoneId: 'kitchen', nameTh: 'ชามแมว', nameEn: 'Bowl', placed: false },
  { id: 'i4', emoji: '☕', zoneId: 'kitchen', nameTh: 'แก้วกาแฟ', nameEn: 'Mug', placed: false },
  { id: 'i5', emoji: '🛏️', zoneId: 'bed_area', nameTh: 'หมอนนุ่ม', nameEn: 'Pillow', placed: false },
  { id: 'i6', emoji: '🪶', zoneId: 'toy_bin', nameTh: 'ขนนก', nameEn: 'Feather', placed: false }
];

export function CleanRoomGame() {
  const lang = useGameStore((s) => s.settings.language);
  const completeMinigame = useGameStore((s) => s.completeMinigame);
  const openMinigame = useGameStore((s) => s.openMinigame);

  const [items, setItems] = useState<TidyItem[]>(() => INITIAL_ITEMS.map((i) => ({ ...i })));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);

  const remaining = items.filter((i) => !i.placed);
  const done = remaining.length === 0;
  const rewardCoins = Math.max(20, 38 - mistakes * 3);

  const placeIntoZone = (zoneId: TidyItem['zoneId']) => {
    if (!selectedItemId) return;
    const item = items.find((i) => i.id === selectedItemId);
    if (!item || item.placed) return;

    if (item.zoneId === zoneId) {
      soundManager.playSoftChime(760);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, placed: true } : i)));
      setSelectedItemId(null);
    } else {
      soundManager.playSoftChime(280);
      setMistakes((m) => m + 1);
    }
  };

  const zones: { id: TidyItem['zoneId']; icon: string; labelTh: string; labelEn: string }[] = [
    { id: 'toy_bin', icon: '🧺', labelTh: 'ตะกร้าของเล่น', labelEn: 'Toy Basket' },
    { id: 'kitchen', icon: '🍽️', labelTh: 'มุมอาหาร & โต๊ะ', labelEn: 'Dining & Table' },
    { id: 'bed_area', icon: '🛋️', labelTh: 'มุมเบาะพักผ่อน', labelEn: 'Cozy Rest Area' }
  ];

  return (
    <div className="minigame-overlay ui-interactive">
      <div className="row-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 15 }}>
          <Sparkles size={18} color="#6d9575" />
          <span>{lang === 'th' ? 'จัดเก็บห้องนั่งเล่น' : 'Clean the Room'}</span>
        </div>
        <button type="button" className="drawer-close" onClick={() => openMinigame(null)}>
          <X size={16} />
        </button>
      </div>

      <div style={{ fontSize: 11.5, color: '#6b5546' }}>
        {lang === 'th'
          ? 'แตะเลือกของที่วางกระจัดกระจาย แล้วแตะจุดจัดเก็บที่ถูกต้อง (เล่นฟรีไม่จำกัด!)'
          : 'Tap a scattered item, then tap the matching organizer spot to tidy up!'}
      </div>

      {/* Organizer Target Zones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {zones.map((z) => {
          const countInZone = items.filter((i) => i.zoneId === z.id && i.placed).length;
          return (
            <button
              key={z.id}
              type="button"
              onClick={() => placeIntoZone(z.id)}
              style={{
                padding: '14px 8px',
                borderRadius: 16,
                border: selectedItemId ? '2px dashed #c87a56' : '1px solid rgba(139,114,92,0.2)',
                background: selectedItemId ? '#fff6ee' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span style={{ fontSize: 26 }}>{z.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3b2f27' }}>
                {lang === 'th' ? z.labelTh : z.labelEn}
              </span>
              <span className="badge sage">{countInZone}</span>
            </button>
          );
        })}
      </div>

      {/* Scattered Items Floor Area */}
      <div
        className="section-box"
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(180deg, #f6eee3 0%, #eadbc8 100%)'
        }}
      >
        {done ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 38 }}>✨🏡✨</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {lang === 'th' ? 'ห้องสะอาดเรียบร้อยแล้ว!' : 'Room is spotless & cozy!'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {remaining.map((item) => {
              const isSel = selectedItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItemId(isSel ? null : item.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 18,
                    border: isSel ? '2px solid #c87a56' : '1px solid rgba(139,114,92,0.2)',
                    background: isSel ? '#f5e2d7' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transform: isSel ? 'scale(1.06)' : 'scale(1)',
                    transition: 'transform 0.14s ease'
                  }}
                >
                  <span style={{ fontSize: 28 }}>{item.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>
                    {lang === 'th' ? item.nameTh : item.nameEn}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {done && (
        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: 14 }}
          onClick={() => completeMinigame('clean_room', rewardCoins, 100 - mistakes * 10)}
        >
          <Coins size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {lang === 'th'
            ? `รับรางวัล +${rewardCoins} เหรียญ และกลับบ้าน`
            : `Collect +${rewardCoins} Coins & Return`}
        </button>
      )}
    </div>
  );
}
