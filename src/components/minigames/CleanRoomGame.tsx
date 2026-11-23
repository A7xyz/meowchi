import { Coins, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { soundManager } from '../../audio/SoundManager';
import { ECONOMY_CONFIG, evaluateMinigameReward } from '../../config/economy';
import { useGameStore } from '../../store/useGameStore';

interface TidyItem {
  id: string;
  emoji: string;
  zoneId: 'toy_bin' | 'kitchen' | 'bed_area';
  nameTh: string;
  nameEn: string;
  placed: boolean;
}

const ITEM_POOL: Omit<TidyItem, 'id' | 'placed'>[] = [
  { emoji: '🧶', zoneId: 'toy_bin', nameTh: 'ไหมพรม', nameEn: 'Yarn Ball' },
  { emoji: '🐭', zoneId: 'toy_bin', nameTh: 'หนูของเล่น', nameEn: 'Toy Mouse' },
  { emoji: '🪶', zoneId: 'toy_bin', nameTh: 'ขนนก', nameEn: 'Feather' },
  { emoji: '🔔', zoneId: 'toy_bin', nameTh: 'ลูกบอลกระดิ่ง', nameEn: 'Bell Ball' },
  { emoji: '🥣', zoneId: 'kitchen', nameTh: 'ชามแมว', nameEn: 'Cat Bowl' },
  { emoji: '☕', zoneId: 'kitchen', nameTh: 'แก้วกาแฟ', nameEn: 'Coffee Mug' },
  { emoji: '🐟', zoneId: 'kitchen', nameTh: 'จานขนม', nameEn: 'Snack Dish' },
  { emoji: '🥛', zoneId: 'kitchen', nameTh: 'ขวดนม', nameEn: 'Milk Bottle' },
  { emoji: '🛏️', zoneId: 'bed_area', nameTh: 'หมอนนุ่ม', nameEn: 'Pillow' },
  { emoji: '🧣', zoneId: 'bed_area', nameTh: 'ผ้าห่มอุ่น', nameEn: 'Blanket' },
  { emoji: '🧸', zoneId: 'bed_area', nameTh: 'ตุ๊กตาแมว', nameEn: 'Plushie' }
];

function buildWave(waveNum: number): TidyItem[] {
  const shuffled = [...ITEM_POOL].sort(() => Math.random() - 0.5).slice(0, 6);
  return shuffled.map((spec, idx) => ({
    ...spec,
    id: `w${waveNum}_i${idx}`,
    placed: false
  }));
}

export function CleanRoomGame() {
  const lang = useGameStore((s) => s.settings.language);
  const session = useGameStore((s) => s.activeMinigameSession);
  const completeMinigame = useGameStore((s) => s.completeMinigame);
  const cancelMinigame = useGameStore((s) => s.cancelMinigame);

  const duration = session?.durationSec ?? ECONOMY_CONFIG.MINIGAME_DURATION_SECONDS;
  const [wave, setWave] = useState(1);
  const [items, setItems] = useState<TidyItem[]>(() => buildWave(1));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [claimed, setClaimed] = useState(false);

  const finished = timeLeft <= 0;

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [finished]);

  const remaining = items.filter((i) => !i.placed);

  const placeIntoZone = (zoneId: TidyItem['zoneId']) => {
    if (finished || !selectedItemId) return;
    const item = items.find((i) => i.id === selectedItemId);
    if (!item || item.placed) return;

    if (item.zoneId === zoneId) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      const nextItems = items.map((i) => (i.id === item.id ? { ...i, placed: true } : i));
      const waveCleared = nextItems.every((i) => i.placed);
      setScore((s) => s + 12 + Math.min(10, nextCombo * 2) + (waveCleared ? 30 : 0));
      soundManager.playSoftChime(waveCleared ? 860 : 760);
      setSelectedItemId(null);

      if (waveCleared) {
        const nextWave = wave + 1;
        setWave(nextWave);
        setItems(buildWave(nextWave));
      } else {
        setItems(nextItems);
      }
    } else {
      soundManager.playSoftChime(280);
      setCombo(0);
      setScore((s) => Math.max(0, s - 5));
    }
  };

  if (!session) return null;
  const reward = evaluateMinigameReward('clean_room', score);

  const zones: { id: TidyItem['zoneId']; icon: string; labelTh: string; labelEn: string }[] = [
    { id: 'toy_bin', icon: '🧺', labelTh: 'ตะกร้าของเล่น', labelEn: 'Toy Basket' },
    { id: 'kitchen', icon: '🍽️', labelTh: 'มุมอาหาร & โต๊ะ', labelEn: 'Dining & Table' },
    { id: 'bed_area', icon: '🛋️', labelTh: 'มุมเบาะพักผ่อน', labelEn: 'Cozy Rest Area' }
  ];

  const handleCollect = () => {
    if (claimed || !finished) return;
    setClaimed(true);
    completeMinigame(session.sessionId, score);
  };

  return (
    <div className="minigame-overlay ui-interactive">
      <div className="row-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 15 }}>
          <Sparkles size={18} color="#6d9575" />
          <span>{lang === 'th' ? `จัดเก็บห้อง • รอบ ${wave}` : `Room Cleaning • Wave ${wave}`}</span>
        </div>
        <button
          type="button"
          className="drawer-close"
          onClick={() => cancelMinigame()}
          aria-label="Cancel minigame"
        >
          <X size={16} />
        </button>
      </div>

      <div className="row-between" style={{ fontSize: 12, fontWeight: 700 }}>
        <span className="badge warm">
          {lang === 'th' ? `เวลา ${timeLeft} วิ` : `Time ${timeLeft}s`}
        </span>
        <span className="badge sage">
          {lang === 'th' ? `คะแนน ${score} • คอมโบ x${combo}` : `Score ${score} • Combo x${combo}`}
        </span>
      </div>

      <div style={{ fontSize: 11, color: '#6b5546' }}>
        {lang === 'th'
          ? 'แตะเลือกของที่กระจัดกระจาย แล้วแตะจุดจัดเก็บที่ถูกต้องให้ไวที่สุดใน 60 วินาที!'
          : 'Tap a scattered item, then tap the matching organizer spot before time runs out!'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {zones.map((z) => {
          const countInZone = items.filter((i) => i.zoneId === z.id && i.placed).length;
          return (
            <button
              key={z.id}
              type="button"
              disabled={finished}
              onClick={() => placeIntoZone(z.id)}
              style={{
                padding: '14px 8px',
                borderRadius: 16,
                border: selectedItemId ? '2px dashed #c87a56' : '1px solid rgba(139,114,92,0.2)',
                background: selectedItemId ? '#fff6ee' : '#fff',
                cursor: finished ? 'default' : 'pointer',
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

      <div
        className="section-box"
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(180deg, #f6eee3 0%, #eadbc8 100%)'
        }}
      >
        {finished ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 38 }}>✨🏡✨</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {lang === 'th'
                ? `หมดเวลา! คะแนน ${score} (${reward.tier.toUpperCase()})`
                : `Time's Up! Score ${score} (${reward.tier.toUpperCase()})`}
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

      {finished && (
        <button
          type="button"
          className="btn-primary"
          disabled={claimed}
          style={{ width: '100%', padding: '12px', fontSize: 14 }}
          onClick={handleCollect}
        >
          <Coins size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {lang === 'th'
            ? `รับรางวัล +${reward.coins} เหรียญ และกลับบ้าน`
            : `Collect +${reward.coins} Coins & Return`}
        </button>
      )}
    </div>
  );
}
