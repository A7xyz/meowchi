import { Coins, Grid2x2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { soundManager } from '../../audio/SoundManager';
import { ECONOMY_CONFIG, evaluateMinigameReward } from '../../config/economy';
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
  const session = useGameStore((s) => s.activeMinigameSession);
  const completeMinigame = useGameStore((s) => s.completeMinigame);
  const cancelMinigame = useGameStore((s) => s.cancelMinigame);

  const duration = session?.durationSec ?? ECONOMY_CONFIG.MINIGAME_DURATION_SECONDS;
  const [round, setRound] = useState(1);
  const pairCount = round === 1 ? 6 : 8;
  const cols = round === 1 ? 3 : 4;

  const [tiles, setTiles] = useState<Tile[]>(() => buildDeck(6));
  const [selected, setSelected] = useState<number[]>([]);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [locked, setLocked] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const finished = timeLeft <= 0;

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [finished]);

  const handleFlip = (uid: number) => {
    if (locked || finished) return;
    const target = tiles.find((t) => t.uid === uid);
    if (!target || target.matched || target.flipped) return;

    soundManager.playSoftChime(520);
    const nextTiles = tiles.map((t) => (t.uid === uid ? { ...t, flipped: true } : t));
    const nextSel = [...selected, uid];
    setTiles(nextTiles);
    setSelected(nextSel);

    if (nextSel.length === 2) {
      const [aId, bId] = nextSel;
      const a = nextTiles.find((t) => t.uid === aId)!;
      const b = nextTiles.find((t) => t.uid === bId)!;

      if (a.symbol === b.symbol) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        const updatedTiles = nextTiles.map((t) =>
          t.uid === aId || t.uid === bId ? { ...t, matched: true } : t
        );
        const boardCleared = updatedTiles.every((t) => t.matched);
        const gain = 18 + nextCombo * 6 + (boardCleared ? 40 : 0);
        setScore((s) => s + gain);
        soundManager.playSoftChime(boardCleared ? 880 : 780);
        setTiles(updatedTiles);
        setSelected([]);

        if (boardCleared) {
          setLocked(true);
          setTimeout(() => {
            const nextRound = round + 1;
            setRound(nextRound);
            setTiles(buildDeck(nextRound === 1 ? 6 : 8));
            setLocked(false);
          }, 420);
        }
      } else {
        setCombo(0);
        setLocked(true);
        setTimeout(() => {
          setTiles((prev) =>
            prev.map((t) => (t.uid === aId || t.uid === bId ? { ...t, flipped: false } : t))
          );
          setSelected([]);
          setLocked(false);
        }, 520);
      }
    }
  };

  if (!session) return null;
  const reward = evaluateMinigameReward('matching', score);

  const handleCollect = () => {
    if (claimed || !finished) return;
    setClaimed(true);
    completeMinigame(session.sessionId, score);
  };

  return (
    <div className="minigame-overlay ui-interactive">
      <div className="row-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 15 }}>
          <Grid2x2 size={18} color="#c87a56" />
          <span>
            {lang === 'th' ? `จับคู่ของแมว • รอบ ${round}` : `Cat Matching • Round ${round}`}
          </span>
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

      <div className="row-between" style={{ fontSize: 11.5, fontWeight: 700 }}>
        <span className="badge warm">
          {lang === 'th' ? `เวลา ${timeLeft} วิ` : `Time ${timeLeft}s`}
        </span>
        <span className="badge sage">
          {lang === 'th' ? `คะแนน ${score} • คอมโบ x${combo}` : `Score ${score} • Combo x${combo}`}
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
              key={`${round}_${tile.uid}`}
              type="button"
              disabled={finished}
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
                fontSize: pairCount >= 8 ? 24 : 28,
                cursor: finished ? 'default' : 'pointer',
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

      {finished ? (
        <div className="section-box" style={{ gap: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {lang === 'th'
              ? `หมดเวลา! คะแนน ${score} (${reward.tier.toUpperCase()})`
              : `Time's Up! Score ${score} (${reward.tier.toUpperCase()})`}
          </div>
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
        </div>
      ) : (
        <div style={{ fontSize: 10.5, color: '#756355', textAlign: 'center' }}>
          {lang === 'th'
            ? 'จับคู่การ์ดให้ได้มากที่สุดใน 60 วินาที เพื่อรับรางวัล 15–45 เหรียญ'
            : 'Match as many pairs as you can in 60s to earn 15–45 Coins!'}
        </div>
      )}
    </div>
  );
}
