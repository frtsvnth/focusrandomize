import { useEffect, useRef, useState } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { ParticleSystem } from '../engine/particles';
import { easeOutBack, makeRng, setupHiDPICanvas, withAlpha } from '../engine/canvasUtils';
import { shuffleWithSeed } from '../../utils/seededRandom';

type Phase = 'dealing' | 'revealing' | 'winner';

export default function CardsAdapterV2({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
  sound,
}: MechanicAdapterV2Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    // Computed once, inside the effect, so a parent re-render (which creates a
    // new `teams` array reference) can never restart the deal/reveal sequence mid-show.
    const order = shuffleWithSeed(teams.map((t) => t.id), seed);
    const withoutTarget = order.filter((id) => id !== targetTeam.id);
    const revealOrder = [...withoutTarget, targetTeam.id];

    const rng = makeRng(seed);
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    const ctx = setupHiDPICanvas(canvas, width, height);
    const particles = new ParticleSystem(rng);

    const N = revealOrder.length;
    const cardW = Math.min(width * 0.16, height * 0.34, 190);
    const cardH = cardW * 1.42;
    const rx = Math.min(width * 0.42, cardW * N * 0.42);
    const cy = height * 0.5;
    const cx = width / 2;

    const cards = revealOrder.map((id, i) => {
      const angle = N > 1 ? Math.PI * 0.82 - (i / (N - 1)) * Math.PI * 1.64 : 0;
      const team = teams.find((t) => t.id === id)!;
      return {
        id,
        team,
        homeX: cx + Math.cos(angle) * rx,
        homeY: cy - Math.sin(angle) * rx * 0.32,
        rot: -Math.sin(angle) * 0.28,
        dealT: 0,
        flip: 0,
        flipping: false,
        revealed: false,
      };
    });

    const deckX = -cardW;
    const deckY = cy;

    let phase: Phase = 'dealing';
    let phaseStart = performance.now();
    let dealIdx = 0;
    let revealIdx = 0;
    let nextRevealAt = 0;
    let done = false;
    let rafId = 0;

    function drawCardFace(x: number, y: number, scaleX: number, rot: number, size: number, back: boolean, team: typeof teams[number] | null, winner: boolean) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(scaleX, 1);

      const w = cardW * size;
      const h = cardH * size;
      const r = w * 0.09;

      ctx.beginPath();
      ctx.moveTo(-w / 2 + r, -h / 2);
      ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
      ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
      ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
      ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
      ctx.closePath();

      if (back || !team) {
        const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        grad.addColorStop(0, '#1a1f3a');
        grad.addColorStop(1, '#0d1025');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.font = `${w * 0.32}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♠', 0, 0);
      } else {
        const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        grad.addColorStop(0, withAlpha(team.color, 0.95));
        grad.addColorStop(1, withAlpha(team.color, 0.62));
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = winner ? 3 : 2;
        ctx.strokeStyle = winner ? '#fff' : withAlpha(team.color, 0.9);
        if (winner) {
          ctx.shadowColor = team.color;
          ctx.shadowBlur = 40;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (team.logo) {
          ctx.font = `${w * 0.32}px serif`;
          ctx.fillText(team.logo, 0, -h * 0.1);
        }
        ctx.font = `800 ${Math.max(9, w * 0.11)}px Inter, system-ui, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        const label = team.name.length > 12 ? team.name.slice(0, 11) + '…' : team.name;
        ctx.fillText(label, 0, team.logo ? h * 0.22 : 0);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    }

    function frame(now: number) {
      ctx.clearRect(0, 0, width, height);

      if (phase === 'dealing') {
        const stagger = reducedMotion ? 25 : 90;
        const dealDur = reducedMotion ? 40 : 380;
        while (dealIdx < N && now - phaseStart >= dealIdx * stagger) {
          sound.playTick(1 + rng() * 0.3);
          dealIdx++;
        }
        cards.forEach((c, i) => {
          const start = phaseStart + i * stagger;
          const t = Math.max(0, Math.min(1, (now - start) / dealDur));
          c.dealT = easeOutBack(t);
        });
        if (dealIdx >= N && now - phaseStart > (N - 1) * stagger + dealDur + 150) {
          phase = 'revealing';
          phaseStart = now;
          nextRevealAt = now;
        }
      }

      if (phase === 'revealing' || phase === 'winner') {
        const stagger = reducedMotion ? 20 : 260;
        if (revealIdx < N && now >= nextRevealAt) {
          const c = cards[revealIdx];
          c.flipping = true;
          sound.playWhoosh(0.25);
          revealIdx++;
          nextRevealAt = now + stagger;
        }
        cards.forEach((c) => {
          if (c.flipping && c.flip < 1) {
            c.flip = Math.min(1, c.flip + (reducedMotion ? 0.3 : 0.09));
            if (c.flip >= 1) {
              c.revealed = true;
              c.flipping = false;
              if (c.id === targetTeam.id && phase !== 'winner') {
                phase = 'winner';
                sound.playFanfare();
                particles.burstConfetti(c.homeX, c.homeY, teams.map((tm) => tm.color), reducedMotion ? 20 : 110);
                particles.burstSparks(c.homeX, c.homeY, targetTeam.color, reducedMotion ? 0 : 20);
                setShaking(true);
                setTimeout(() => setShaking(false), 300);
                setTimeout(() => {
                  if (!done) {
                    done = true;
                    onComplete(targetTeam);
                  }
                }, reducedMotion ? 200 : 1400);
              }
            }
          }
        });
      }

      cards.forEach((c) => {
        const x = deckX + (c.homeX - deckX) * c.dealT;
        const y = deckY + (c.homeY - deckY) * c.dealT;
        const isWinner = phase === 'winner' && c.id === targetTeam.id;
        const dim = phase === 'winner' && c.id !== targetTeam.id ? 0.28 : 1;

        ctx.save();
        ctx.globalAlpha = dim;

        const flipScale = c.flip < 0.5 ? 1 - c.flip * 4 : (c.flip - 0.5) * 4 - 1;
        const showBack = c.flip < 0.5;
        drawCardFace(
          x,
          y - (isWinner ? 40 : 0),
          Math.max(-1, Math.min(1, flipScale)),
          isWinner ? 0 : c.rot,
          isWinner ? 1.5 : 1,
          showBack,
          c.revealed || c.flipping ? c.team : null,
          isWinner
        );
        ctx.restore();
      });

      particles.update(1 / 60);
      particles.draw(ctx);

      if (phase !== 'winner' || particles.count > 0 || !done) {
        rafId = requestAnimationFrame(frame);
      }
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={shaking ? 'v2-shake' : undefined}
      style={{
        position: 'relative',
        width: 'min(94vw, 1400px)',
        height: 'min(70vh, 620px)',
        margin: '0 auto',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
