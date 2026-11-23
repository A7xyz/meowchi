import { Coins, Truck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { soundManager } from '../../audio/SoundManager';
import { ECONOMY_CONFIG, evaluateMinigameReward } from '../../config/economy';
import { useGameStore } from '../../store/useGameStore';

interface RoadItem {
  id: number;
  lane: 0 | 1 | 2;
  y: number;
  kind: 'parcel' | 'salmon' | 'cone';
  emoji: string;
  points: number;
}

/**
 * Minigame 4 — Cat Supply Delivery Game (60-second touch 3-lane runner).
 * Tap or swipe left/center/right lanes to deliver cat supplies & dodge cones!
 */
export function DeliveryGame() {
  const lang = useGameStore((s) => s.settings.language);
  const session = useGameStore((s) => s.activeMinigameSession);
  const completeMinigame = useGameStore((s) => s.completeMinigame);
  const cancelMinigame = useGameStore((s) => s.cancelMinigame);

  const duration = session?.durationSec ?? ECONOMY_CONFIG.MINIGAME_DURATION_SECONDS;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [deliveries, setDeliveries] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [finished, setFinished] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const stateRef = useRef({
    lane: 1 as 0 | 1 | 2,
    playerX: 180,
    items: [] as RoadItem[],
    nextId: 1,
    score: 0,
    deliveries: 0,
    timeLeft: duration,
    finished: false,
    spawnTimer: 0.5,
    roadOffset: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 360;
    const H = 430;
    const laneXs = [68, 180, 292];
    const playerY = H - 64;
    canvas.width = W;
    canvas.height = H;

    const spawnItem = (): RoadItem => {
      const lane = Math.floor(Math.random() * 3) as 0 | 1 | 2;
      const r = Math.random();
      if (r < 0.45) {
        return { id: stateRef.current.nextId++, lane, y: -24, kind: 'parcel', emoji: '📦', points: 14 };
      }
      if (r < 0.72) {
        return { id: stateRef.current.nextId++, lane, y: -24, kind: 'salmon', emoji: '🐟', points: 22 };
      }
      return { id: stateRef.current.nextId++, lane, y: -24, kind: 'cone', emoji: '🚧', points: -16 };
    };

    const setLaneFromClientX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const localX = ((clientX - rect.left) / rect.width) * W;
      const nextLane: 0 | 1 | 2 = localX < W / 3 ? 0 : localX < (W * 2) / 3 ? 1 : 2;
      stateRef.current.lane = nextLane;
    };

    const onDown = (e: PointerEvent) => {
      if (stateRef.current.finished) return;
      setLaneFromClientX(e.clientX);
    };

    const onMove = (e: PointerEvent) => {
      if (stateRef.current.finished || e.buttons === 0) return;
      setLaneFromClientX(e.clientX);
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);

    let rafId = 0;
    let lastMs = performance.now();
    let timerAcc = 0;

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - lastMs) / 1000);
      lastMs = now;
      const st = stateRef.current;

      const speed = 175 + (duration - st.timeLeft) * 2.1;

      if (!st.finished) {
        timerAcc += dt;
        if (timerAcc >= 1) {
          timerAcc -= 1;
          st.timeLeft = Math.max(0, st.timeLeft - 1);
          setTimeLeft(st.timeLeft);
          if (st.timeLeft <= 0) {
            st.finished = true;
            setFinished(true);
          }
        }

        st.roadOffset = (st.roadOffset + speed * dt) % 48;
        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          st.items.push(spawnItem());
          st.spawnTimer = Math.max(0.42, 0.82 - (duration - st.timeLeft) * 0.005);
        }
      }

      const targetX = laneXs[st.lane];
      st.playerX += (targetX - st.playerX) * Math.min(1, dt * 15);

      // Draw cozy neighborhood lane road
      ctx.fillStyle = '#dce7d3';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#6c6864';
      ctx.fillRect(24, 0, W - 48, H);

      // Dashed lane dividers
      ctx.strokeStyle = 'rgba(255, 246, 232, 0.55)';
      ctx.lineWidth = 3;
      ctx.setLineDash([20, 28]);
      ctx.lineDashOffset = -st.roadOffset;
      for (const divX of [124, 236]) {
        ctx.beginPath();
        ctx.moveTo(divX, 0);
        ctx.lineTo(divX, H);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Update & draw road items
      for (let i = st.items.length - 1; i >= 0; i--) {
        const it = st.items[i];
        if (!st.finished) it.y += speed * dt;
        const ix = laneXs[it.lane];

        if (!st.finished && Math.abs(it.y - playerY) < 30 && Math.abs(ix - st.playerX) < 34) {
          st.items.splice(i, 1);
          if (it.kind === 'cone') {
            st.score = Math.max(0, st.score + it.points);
            soundManager.playSoftChime(230);
          } else {
            st.score += it.points;
            st.deliveries += 1;
            soundManager.playSoftChime(it.kind === 'salmon' ? 820 : 720);
          }
          setScore(st.score);
          setDeliveries(st.deliveries);
          continue;
        }

        if (it.y > H + 30) {
          st.items.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.fillStyle =
          it.kind === 'cone' ? 'rgba(219, 98, 76, 0.28)' : 'rgba(255, 250, 242, 0.88)';
        ctx.beginPath();
        ctx.arc(ix, it.y, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.emoji, ix, it.y + 1);
        ctx.restore();
      }

      // Draw cat supply delivery scooter
      ctx.save();
      ctx.fillStyle = '#c87a56';
      ctx.beginPath();
      ctx.roundRect(st.playerX - 24, playerY - 26, 48, 52, 14);
      ctx.fill();
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛵', st.playerX, playerY);
      ctx.restore();
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
    };
  }, [duration]);

  if (!session) return null;
  const reward = evaluateMinigameReward('delivery', score);

  const handleCollect = () => {
    if (claimed || !finished) return;
    setClaimed(true);
    completeMinigame(session.sessionId, score);
  };

  return (
    <div className="minigame-overlay ui-interactive">
      <div className="row-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 15 }}>
          <Truck size={18} color="#c87a56" />
          <span>{lang === 'th' ? 'ส่งอาหารแมวด่วน (60 วิ)' : 'Cat Supply Delivery (60s)'}</span>
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
          {lang === 'th'
            ? `ส่งแล้ว ${deliveries} • ${score} คะแนน`
            : `Delivered ${deliveries} • ${score} pts`}
        </span>
      </div>

      <div style={{ fontSize: 11, color: '#6b5546', textAlign: 'center' }}>
        {lang === 'th'
          ? 'แตะเลน ซ้าย / กลาง / ขวา เพื่อเก็บกล่องอาหาร 📦🐟 และหลบสิ่งกีดขวาง 🚧'
          : 'Tap Left / Center / Right lanes to collect 📦🐟 deliveries and dodge 🚧!'}
      </div>

      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          flex: 1,
          borderRadius: 18,
          touchAction: 'none',
          border: '2px solid rgba(139,114,92,0.18)'
        }}
      />

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
            ? 'ส่งให้ได้มากที่สุดใน 60 วินาทีเพื่อรับรางวัล 15–45 เหรียญ'
            : 'Deliver as many orders as possible in 60s to earn 15–45 Coins!'}
        </div>
      )}
    </div>
  );
}
