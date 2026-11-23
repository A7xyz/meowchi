import { Coins, Fish, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { soundManager } from '../../audio/SoundManager';
import { useGameStore } from '../../store/useGameStore';

interface SwimFish {
  id: number;
  x: number;
  y: number;
  vx: number;
  size: number;
  color: string;
  accent: string;
  points: number;
  nameTh: string;
  nameEn: string;
  biting: boolean;
  biteTimer: number;
}

const FISH_SPECIES = [
  { color: '#8ab4c9', accent: '#d8ebf5', size: 17, speed: 58, points: 10, nameTh: 'ปลาซาร์ดีน', nameEn: 'Sardine' },
  { color: '#6190ad', accent: '#b7d7e8', size: 21, speed: 75, points: 16, nameTh: 'ปลาทู', nameEn: 'Mackerel' },
  { color: '#e08963', accent: '#f7c8b0', size: 25, speed: 95, points: 24, nameTh: 'ปลาแซลมอน', nameEn: 'Salmon' },
  { color: '#e6b447', accent: '#fff0be', size: 28, speed: 122, points: 36, nameTh: 'ปลาคาร์ปทอง', nameEn: 'Golden Koi' }
];

export function FishingGame() {
  const lang = useGameStore((s) => s.settings.language);
  const completeMinigame = useGameStore((s) => s.completeMinigame);
  const openMinigame = useGameStore((s) => s.openMinigame);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [catches, setCatches] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [lastCatchText, setLastCatchText] = useState<string>('');
  const [finished, setFinished] = useState(false);

  const stateRef = useRef({
    bobberX: 180,
    bobberY: 220,
    dragging: false,
    fishes: [] as SwimFish[],
    nextId: 1,
    score: 0,
    catches: 0,
    timeLeft: 30,
    biteFishId: null as number | null,
    finished: false
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

    const spawnFish = (): SwimFish => {
      const r = Math.random();
      const spec =
        r < 0.42
          ? FISH_SPECIES[0]
          : r < 0.72
            ? FISH_SPECIES[1]
            : r < 0.9
              ? FISH_SPECIES[2]
              : FISH_SPECIES[3];
      const fromLeft = Math.random() < 0.5;
      return {
        id: stateRef.current.nextId++,
        x: fromLeft ? -30 : W + 30,
        y: 85 + Math.random() * (H - 130),
        vx: (fromLeft ? 1 : -1) * (spec.speed * (0.85 + Math.random() * 0.3)),
        size: spec.size,
        color: spec.color,
        accent: spec.accent,
        points: spec.points,
        nameTh: spec.nameTh,
        nameEn: spec.nameEn,
        biting: false,
        biteTimer: 0
      };
    };

    stateRef.current.fishes = Array.from({ length: 7 }, spawnFish);

    const toLocal = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * W,
        y: ((clientY - rect.top) / rect.height) * H
      };
    };

    const tryReelCatch = () => {
      const st = stateRef.current;
      if (st.finished) return;
      const bitingFish = st.fishes.find((f) => f.biting);
      if (bitingFish) {
        st.score += bitingFish.points;
        st.catches += 1;
        setScore(st.score);
        setCatches(st.catches);
        setLastCatchText(
          lang === 'th'
            ? `ได้ ${bitingFish.nameTh}! +${bitingFish.points}`
            : `Caught ${bitingFish.nameEn}! +${bitingFish.points}`
        );
        soundManager.playSoftChime(760);
        st.fishes = st.fishes.filter((f) => f.id !== bitingFish.id);
        st.fishes.push(spawnFish());
        st.biteFishId = null;
      } else {
        // Also allow quick tap if fish is very close to bobber
        const near = st.fishes.find(
          (f) => Math.hypot(f.x - st.bobberX, f.y - st.bobberY) < f.size + 18
        );
        if (near) {
          st.score += near.points;
          st.catches += 1;
          setScore(st.score);
          setCatches(st.catches);
          setLastCatchText(
            lang === 'th'
              ? `จับได้ ${near.nameTh}! +${near.points}`
              : `Hooked ${near.nameEn}! +${near.points}`
          );
          soundManager.playSoftChime(720);
          st.fishes = st.fishes.filter((f) => f.id !== near.id);
          st.fishes.push(spawnFish());
        }
      }
    };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const pt = toLocal(e.clientX, e.clientY);
      stateRef.current.dragging = true;
      stateRef.current.bobberX = Math.max(24, Math.min(W - 24, pt.x));
      stateRef.current.bobberY = Math.max(60, Math.min(H - 24, pt.y));
      tryReelCatch();
    };
    const onMove = (e: PointerEvent) => {
      if (!stateRef.current.dragging) return;
      const pt = toLocal(e.clientX, e.clientY);
      stateRef.current.bobberX = Math.max(24, Math.min(W - 24, pt.x));
      stateRef.current.bobberY = Math.max(60, Math.min(H - 24, pt.y));
    };
    const onUp = () => {
      stateRef.current.dragging = false;
      tryReelCatch();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);

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
      }

      // Draw sunlit pond background
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#c6e4ee');
      grad.addColorStop(0.25, '#89c2d6');
      grad.addColorStop(1, '#4c88a4');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Gentle water ripples
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const ry = 70 + i * 95 + Math.sin(now * 0.002 + i) * 6;
        ctx.beginPath();
        ctx.moveTo(20, ry);
        ctx.quadraticCurveTo(W / 2, ry + 10, W - 20, ry);
        ctx.stroke();
      }

      // Update & draw fish
      for (let i = 0; i < st.fishes.length; i++) {
        const f = st.fishes[i];
        const distToBobber = Math.hypot(f.x - st.bobberX, f.y - st.bobberY);

        if (!st.finished && distToBobber < 42 && !f.biting && st.biteFishId === null) {
          f.biting = true;
          f.biteTimer = 1.15; // Generous timing window to pull!
          st.biteFishId = f.id;
          soundManager.playSoftChime(490);
        }

        if (f.biting) {
          f.biteTimer -= dt;
          f.x += (st.bobberX - f.x) * dt * 4;
          f.y += (st.bobberY - f.y) * dt * 4;
          if (f.biteTimer <= 0) {
            f.biting = false;
            st.biteFishId = null;
            f.vx *= 1.35;
          }
        } else {
          f.x += f.vx * dt;
          f.y += Math.sin(now * 0.004 + f.id) * 14 * dt;
        }

        if (f.x < -55 || f.x > W + 55) {
          st.fishes[i] = spawnFish();
          continue;
        }

        // Render organic fish silhouette
        ctx.save();
        ctx.translate(f.x, f.y);
        if (f.vx < 0) ctx.scale(-1, 1);

        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size, f.size * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail fin
        ctx.beginPath();
        ctx.moveTo(-f.size * 0.8, 0);
        ctx.lineTo(-f.size * 1.45, -f.size * 0.45);
        ctx.lineTo(-f.size * 1.45, f.size * 0.45);
        ctx.closePath();
        ctx.fill();

        // Highlight & eye
        ctx.fillStyle = f.accent;
        ctx.beginPath();
        ctx.ellipse(2, -f.size * 0.14, f.size * 0.55, f.size * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1b2730';
        ctx.beginPath();
        ctx.arc(f.size * 0.5, -f.size * 0.1, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Fishing line from top center to bobber
      ctx.strokeStyle = 'rgba(255,250,242,0.75)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(W * 0.5, 0);
      ctx.lineTo(st.bobberX, st.bobberY);
      ctx.stroke();

      // Timing ring when a fish bites!
      const hasBite = st.fishes.some((f) => f.biting);
      if (hasBite) {
        const pulse = 20 + Math.sin(now * 0.02) * 8;
        ctx.strokeStyle = '#ffdf78';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(st.bobberX, st.bobberY, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', st.bobberX, st.bobberY - 22);
      }

      // Bobber float
      ctx.fillStyle = '#e0634e';
      ctx.beginPath();
      ctx.arc(st.bobberX, st.bobberY, 10, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#fff9f0';
      ctx.beginPath();
      ctx.arc(st.bobberX, st.bobberY, 10, 0, Math.PI);
      ctx.fill();
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, [lang]);

  const earnedCoins = Math.min(75, Math.max(15, 15 + Math.round(score * 0.45)));

  return (
    <div className="minigame-overlay ui-interactive">
      <div className="row-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 15 }}>
          <Fish size={18} color="#4e8eb2" />
          <span>{lang === 'th' ? 'ตกปลาให้น้องแมว' : 'Cozy Pond Fishing'}</span>
        </div>
        <button type="button" className="drawer-close" onClick={() => openMinigame(null)}>
          <X size={16} />
        </button>
      </div>

      <div className="row-between" style={{ fontSize: 12, fontWeight: 700 }}>
        <span className="badge warm">
          {lang === 'th' ? `เวลา ${timeLeft} วิ` : `Time ${timeLeft}s`}
        </span>
        <span className="badge sage">
          {lang === 'th' ? `จับได้ ${catches} ตัว • ${score} คะแนน` : `Caught ${catches} • ${score} pts`}
        </span>
      </div>

      <div style={{ fontSize: 11, color: '#6b5546', textAlign: 'center' }}>
        {lastCatchText ||
          (lang === 'th'
            ? 'ลากทุ่นเบ็ดไปใกล้ปลา แล้วแตะทันทีเมื่อขึ้นวงแหวน "!"'
            : 'Drag bobber near swimming fish & tap when "!" ring glows!')}
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
        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: 14 }}
          onClick={() => completeMinigame('fishing', earnedCoins, score)}
        >
          <Coins size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {lang === 'th'
            ? `รับรางวัล +${earnedCoins} เหรียญ และกลับบ้าน`
            : `Collect +${earnedCoins} Coins & Return`}
        </button>
      ) : (
        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%' }}
          onClick={() => completeMinigame('fishing', score > 0 ? earnedCoins : 10, score)}
        >
          {lang === 'th' ? `จบเกมตอนนี้ (+${score > 0 ? earnedCoins : 10} เหรียญ)` : `Finish Early (+${score > 0 ? earnedCoins : 10}c)`}
        </button>
      )}
    </div>
  );
}
