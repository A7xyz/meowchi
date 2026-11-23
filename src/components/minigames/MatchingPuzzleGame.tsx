import { Coins, Grid2x2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { soundManager } from '../../audio/SoundManager';
import { useGameStore } from '../../store/useGameStore';

interface Tile {
  uid: number;
  symbol: string;
  matched: boolean;
  flipped: boolean;
}

const SYMBOLS = ['🐟', '🧶', '🐾', '🥛', '🪶', '🐭', '🛏️', '🔔', '📦', '🌿'];

function buildDeck(pairCount: number): Tile[] {
  const chosen = SYMBOLS.slice(0, pairCount);
  const raw = [...chosen, ...chosen];
  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }
  return raw.map((symbol, idx) => ({
    uid: idx,
    symbol,
    matched: false,
    flipped: false
  }));
}

export function MatchingPuzzleGame() {
  const lang = useGameStore((s) => s.settings.language);
  const completeMinigame = useGameStore((s) => s.completeMinigame);
  const openMinigame = useGameStore((s) => s.openMinigame);

  const [level, setLevel] = useState(1);
  const pairCount = level === 1 ? 6 : level === 2 ? 8 : 10;
  const cols = level === 1 ? 3 : 4;

  const [tiles, setTiles] = useState<Tile[]>(() => buildDeck(6));
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [locked, setLocked] = useState(false);

  const allMatched = tiles.every((t) => t.matched);

  useEffect(() => {
    if (allMatched) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [allMatched, level]);

  const handleFlip = (uid: number) => {
    if (locked) return;
    const target = tiles.find((t) => t.uid === uid);
    if (!target || target.matched || target.flipped) return;

    soundManager.playSoftChime(520);
    const nextTiles = tiles.map((t) => (t.uid === uid ? { ...t, flipped: true } : t));
    const nextSel = [...selected, uid];
    setTiles(nextTiles);
    setSelected(nextSel);

    if (nextSel.length === 2) {
      setMoves((m) => m + 1);
      const [aId, bId] = nextSel;
      const a = nextTiles.find((t) => t.uid === aId)!;
      const b = nextTiles.find((t) => t.uid === bId)!;

      if (a.symbol === b.symbol) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        setScore((s) => s + 15 + nextCombo * 5);
        soundManager.playSoftChime(780);
        setTiles((prev) =>
          prev.map((t) => (t.uid === aId || t.uid === bId ? { ...t, matched: true } : t))
        );
        setSelected([]);
      } else {
        setCombo(0);
        setLocked(true);
        setTimeout(() => {
          setTiles((prev) =>
            prev.map((t) => (t.uid === aId || t.uid === bId ? { ...t, flipped: false } : t))
          );
          setSelected([]);
          setLocked(false);
        }, 620);
      }
    }
  };

  const startNextLevel = () => {
    const nextLvl = Math.min(3, level + 1);
    const nextPairs = nextLvl === 1 ? 6 : nextLvl === 2 ? 8 : 10;
    setLevel(nextLvl);
    setTiles(buildDeck(nextPairs));
    setSelected([]);
    setCombo(0);
  };

  const timeBonus = Math.max(0, 30 - elapsed);
  const totalCoins = Math.min(68, 22 + level * 8 + Math.round((score + timeBonus) * 0.14));

  return (
    <div className="minigame-overlay ui-interactive">
      <div className="row-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 15 }}>
          <Grid2x2 size={18} color="#c87a56" />
          <span>
            {lang === 'th' ? `จับคู่ของแมว • ด่าน ${level}` : `Cat Matching • Lv.${level}`}
          </span>
        </div>
        <button type="button" className="drawer-close" onClick={() => openMinigame(null)}>
          <X size={16} />
        </button>
      </div>

      <div className="row-between" style={{ fontSize: 11.5, fontWeight: 700 }}>
        <span className="badge warm">
          {lang === 'th' ? `คะแนน ${score}` : `Score ${score}`}
        </span>
        <span className="badge">
          {lang === 'th' ? `เปิด ${moves} ครั้ง • ${elapsed} วิ` : `Moves ${moves} • ${elapsed}s`}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 8,
          flex: 1,
          alignContent: 'center',
          padding: '8px 0'
        }}
      >
        {tiles.map((tile) => {
          const revealed = tile.flipped || tile.matched;
          return (
            <button
              key={tile.uid}
              type="button"
              onClick={() => handleFlip(tile.uid)}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: 16,
                border: tile.matched
                  ? '2px solid #6d9575'
                  : revealed
                    ? '2px solid #c87a56'
                    : '1px solid rgba(139,114,92,0.22)',
                background: tile.matched
                  ? '#e4efe6'
                  : revealed
                    ? '#fffdf9'
                    : 'linear-gradient(135deg, #e5d5c3, #d7c0a9)',
                fontSize: level === 3 ? 22 : 28,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.14s ease',
                transform: revealed ? 'scale(1)' : 'scale(0.97)'
              }}
            >
              {revealed ? tile.symbol : '🐾'}
            </button>
          );
        })}
      </div>

      {allMatched ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {level < 3 && (
            <button type="button" className="btn-secondary" onClick={startNextLevel}>
              {lang === 'th'
                ? `เล่นด่าน ${level + 1} ต่อเพื่อสะสมเหรียญเพิ่ม!`
                : `Play Level ${level + 1} for Bigger Reward!`}
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: 14 }}
            onClick={() => completeMinigame('matching', totalCoins, score + pairCount * 10)}
          >
            <Coins size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            {lang === 'th'
              ? `รับรางวัล +${totalCoins} เหรียญ และกลับบ้าน`
              : `Collect +${totalCoins} Coins & Return`}
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#756355', textAlign: 'center' }}>
          {lang === 'th'
            ? 'จับคู่การ์ดเหมือนกันให้ครบเพื่อรับเหรียญซื้ออาหารน้องแมว!'
            : 'Match all pairs to earn Coins for cat food and treats!'}
        </div>
      )}
    </div>
  );
}
