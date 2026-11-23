import { Coins, Feather, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { soundManager } from '../../audio/SoundManager';
import { ECONOMY_CONFIG, evaluateMinigameReward } from '../../config/economy';
import { useGameStore } from '../../store/useGameStore';

interface ToyTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: 'feather' | 'mouse' | 'laser' | 'cactus';
  emoji: string;
  points: number;
  ttl: number;
}

/**
 * Minigame 3 — Cat Toy Challenge (60-second touch reflex & pounce game).
 * Tap moving feathers, mice, and red laser dots while avoiding prickly decoys!
 */
export function CatToyChallengeGame() {
  const lang = useGameStore((s) => s.settings.language);
  const session = useGameStore((s) => s.activeMinigameSession);
  const completeMinigame = useGameStore((s) => s.completeMinigame);
  const cancelMinigame = useGameStore((s) => s.cancelMinigame);

  const duration = session?.durationSec ?? ECONOMY_CONFIG.MINIGAME_DURATION_SECONDS;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [finished, setFinished] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const stateRef = useRef({
    targets: [] as ToyTarget[],
    nextId: 1,
    score: 0,
    combo: 0,
    timeLeft: duration,
    finished: false,
    spawnCooldown: 0.4,
    paws: [] as { x: number; y: number; life: number; good: boolean }[]
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 360;
    const H = 430;
    canvas.width = W;
    canvas.height = H;

    const spawnTarget = (): ToyTarget => {
      const r = Math.random();
      let kind: ToyTarget['kind'] = 'feather';
      let emoji = '🪶';
      let points = 14;
      let speed = 82;
      let radius = 26;

      if (r < 0.42) {
        kind = 'feather';
        emoji = '🪶';
        points = 14;
        speed = 80;
      } else if (r < 0.7) {
        kind = 'mouse';
        emoji = '🐭';
        points = 20;
        speed = 112;
        radius = 24;
      } else if (r < 0.86) {
        kind = 'laser';
        emoji = '🔴';
        points = 30;
        speed = 145;
        radius = 21;
      } else {
        kind = 'cactus';
        emoji = '🌵';
        points = -18;
        speed = 70;
        radius = 24;
      }

      const angle = Math.random() * Math.PI * 2;
      return {
        id: stateRef.current.nextId++,
        x: 42 + Math.random() * (W - 84),
        y: 52 + Math.random() * (H - 104),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        kind,
        emoji,
        points,
        ttl: 3.4 + Math.random() * 1.8
      };
    };

    stateRef.current.targets = [spawnTarget(), spawnTarget(), spawnTarget()];

    const onDown = (e: PointerEvent) => {
      const st = stateRef.current;
      if (st.finished) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;

      let hitIdx = -1;
      for (let i = st.targets.length - 1; i >= 0; i--) {
        const t = st.targets[i];
        if (Math.hypot(t.x - x, t.y - y) <= t.radius + 14) {
          hitIdx = i;
          break;
        }
      }

      if (hitIdx >= 0) {
        const hit = st.targets[hitIdx];
        st.targets.splice(hitIdx, 1);
        if (hit.kind === 'cactus') {
          st.combo = 0;
          st.score = Math.max(0, st.score + hit.points);
          soundManager.playSoftChime(240);
          st.paws.push({ x, y, life: 0.45, good: false });
        } else {
          st.combo += 1;
          const bonus = Math.min(12, st.combo * 2);
          st.score += hit.points + bonus;
          soundManager.playSoftChime(680 + Math.min(240, st.combo * 24));
          st.paws.push({ x, y, life: 0.45, good: true });
        }
        setScore(st.score);
        setCombo(st.combo);
      } else {
        st.combo = 0;
        setCombo(0);
        st.paws.push({ x, y, life: 0.28, good: false });
      }
    };

    canvas.addEventListener('pointerdown', onDown);

    let rafId = 0;
    let lastMs = performance.now();
    let timerAcc = 0;

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - lastMs) / 1000);
      lastMs = now;
      const st = stateRef.current;

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

        st.spawnCooldown -= dt;
        if (st.spawnCooldown <= 0 && st.targets.length < 6) {
          st.targets.push(spawnTarget());
          st.spawnCooldown = 0.65;
        }
      }

      // Cozy sunlit living-room rug background
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#f7ece0');
      grad.addColorStop(1, '#e8d6c1');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(200, 122, 86, 0.14)';
      ctx.lineWidth = 3;
      ctx.strokeRect(18, 18, W - 36, H - 36);

      // Update & draw targets
      for (let i = st.targets.length - 1; i >= 0; i--) {
        const t = st.targets[i];
        t.ttl -= dt;
        if (t.ttl <= 0) {
          st.targets.splice(i, 1);
          continue;
        }
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        if (t.x < t.radius + 14 || t.x > W - t.radius - 14) t.vx *= -1;
        if (t.y < t.radius + 14 || t.y > H - t.radius - 14) t.vy *= -1;

        ctx.save();
        ctx.beginPath();
        ctx.fillStyle =
          t.kind === 'cactus'
            ? 'rgba(207, 111, 114, 0.22)'
            : t.kind === 'laser'
              ? 'rgba(255, 92, 92, 0.28)'
              : 'rgba(255, 255, 255, 0.85)';
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.emoji, t.x, t.y + 1);
        ctx.restore();
      }

      // Draw tap paw effects
      for (let i = st.paws.length - 1; i >= 0; i--) {
        const p = st.paws[i];
        p.life -= dt;
        if (p.life <= 0) {
          st.paws.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 2.4);
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.good ? '🐾' : '✖️', p.x, p.y);
        ctx.restore();
      }
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onDown);
    };
  }, []);

  if (!session) return null;
  const reward = evaluateMinigameReward('toy_challenge', score);

  const handleCollect = () => {
    if (claimed || !finished) return;
    setClaimed(true);
    completeMinigame(session.sessionId, score);
  };

  return (
    <div className="minigame-overlay ui-interactive">
      <div className="row-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 15 }}>
          <Feather size={18} color="#c87a56" />
          <span>{lang === 'th' ? 'ท้าทายตะครุบของเล่น (60 วิ)' : 'Cat Toy Challenge (60s)'}</span>
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

      <div style={{ fontSize: 11, color: '#6b5546', textAlign: 'center' }}>
        {lang === 'th'
          ? 'แตะตะครุบ 🪶 🐭 🔴 ที่เคลื่อนไหวให้ไวที่สุด! ระวังอย่าแตะ 🌵 นะ'
          : 'Tap moving 🪶 🐭 🔴 toys fast for combos! Avoid tapping 🌵.'}
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
            ? 'สะสมแต้มใน 60 วินาทีเพื่อรับรางวัล 15–45 เหรียญ'
            : 'Build your score over 60s to earn 15–45 Coins!'}
        </div>
      )}
    </div>
  );
}
