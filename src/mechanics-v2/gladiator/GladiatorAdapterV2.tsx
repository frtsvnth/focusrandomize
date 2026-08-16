import { useEffect, useRef, memo } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { ParticleSystem } from '../engine/particles';
import { ScreenShake, setupHiDPICanvas } from '../engine/canvasUtils';

const BASE_W = 800;
const BASE_H = 450;
const BASE_GROUND_Y = 380;
const BASE_ARENA_LEFT = 60;
const BASE_ARENA_RIGHT = 740;

const CONFIG = {
  baseHp: 220,
  baseDamage: 16,
  attackCooldown: 0.9,
  moveSpeed: 1.2,
  combatApproachDist: 70,
  combatRetreatDist: 35,
};

const POST_BATTLE_DELAY = 1800;

function GladiatorAdapterV2({ teams, targetTeam, reducedMotion, onComplete, sound }: MechanicAdapterV2Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    if (teams.length < 2) {
      onComplete(targetTeam);
      return;
    }

    const W = wrapper.clientWidth;
    const H = wrapper.clientHeight;
    const scale = Math.min(W / BASE_W, H / BASE_H);
    const GROUND_Y = BASE_GROUND_Y * scale;
    const ARENA_LEFT = BASE_ARENA_LEFT * scale;
    const ARENA_RIGHT = W - (BASE_W - BASE_ARENA_RIGHT) * scale;

    const ctx = setupHiDPICanvas(canvas, W, H);
    const shake = new ScreenShake();
    const confetti = new ParticleSystem();

    let gladiators: any[] = [];
    let particles: any[] = [];
    let gameRunning = true;
    let animFrame = 0;
    let currentWinner: any = null;
    let battleEndTime = 0;
    let completed = false;
    let lastClang = 0;

    class Gladiator {
      id: number;
      x: number;
      y: number;
      color: string;
      name: string;
      teamId: string;
      hp: number;
      maxHp: number;
      alive: boolean;
      target: any;
      state: string;
      stateTimer: number;
      attackCooldown: number;
      speed: number;
      damage: number;
      facing: number;
      animPhase: number;
      hitAnim: number;
      deathAnim: number;
      weaponType: number;
      blockChance: number;
      lastBlockTime: number;

      constructor(id: number, x: number, color: string, name: string, teamId: string, isTarget: boolean) {
        this.id = id;
        this.x = x;
        this.y = GROUND_Y;
        this.color = color;
        this.name = name;
        this.teamId = teamId;
        this.hp = isTarget ? CONFIG.baseHp * 3.5 : CONFIG.baseHp;
        this.maxHp = this.hp;
        this.alive = true;
        this.target = null;
        this.state = 'idle';
        this.stateTimer = 0;
        this.attackCooldown = Math.random() * 0.5;
        this.speed = CONFIG.moveSpeed + Math.random() * 0.4;
        this.damage = isTarget ? CONFIG.baseDamage * 2.2 + Math.floor(Math.random() * 5) : CONFIG.baseDamage + Math.floor(Math.random() * 5);
        this.facing = 1;
        this.animPhase = Math.random() * Math.PI * 2;
        this.hitAnim = 0;
        this.deathAnim = 0;
        this.weaponType = Math.floor(Math.random() * 3);
        this.blockChance = isTarget ? 0.3 + Math.random() * 0.1 : 0.06 + Math.random() * 0.06;
        this.lastBlockTime = 0;
      }

      findTarget() {
        const alive = gladiators.filter((g) => g.alive && g.id !== this.id);
        if (alive.length === 0) { this.target = null; return; }
        let nearest: any = null; let minDist = Infinity;
        for (const g of alive) {
          const d = Math.abs(g.x - this.x);
          if (d < minDist) { minDist = d; nearest = g; }
        }
        this.target = nearest;
      }

      update(dt: number) {
        if (!this.alive) {
          if (this.deathAnim < 1) this.deathAnim = Math.min(1, this.deathAnim + dt * 1.2);
          return;
        }
        this.animPhase += dt * 5;
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.hitAnim > 0) this.hitAnim = Math.max(0, this.hitAnim - dt * 3);

        this.findTarget();
        if (!this.target || !this.target.alive) {
          if (gladiators.filter((g) => g.alive).length <= 1) {
            this.state = 'victory';
            return;
          }
          this.findTarget();
          if (!this.target) return;
        }

        const dist = Math.abs(this.target.x - this.x);
        this.facing = this.target.x > this.x ? 1 : -1;

        if (this.state === 'attack') {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) this.state = 'idle';
          if (this.stateTimer > 0.12 && this.stateTimer < 0.35 && dist < 65 * scale) {
            const blockRoll = Math.random();
            const timeSinceBlock = Date.now() - this.target.lastBlockTime;
            if (blockRoll > this.target.blockChance || timeSinceBlock < 2000) {
              this.target.takeDamage(this.damage, this);
            } else {
              this.target.lastBlockTime = Date.now();
              spawnTextParticle(this.target.x, this.target.y - 75 * scale, '🛡️ БЛОК!', '#60a5fa');
              const now = performance.now();
              if (now - lastClang > 120) {
                lastClang = now;
                sound.playTick(1.5);
              }
            }
          }
        } else if (this.state === 'hit') {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) this.state = 'idle';
        } else {
          this.state = 'walk';
          if (dist > CONFIG.combatApproachDist * scale) {
            this.x += this.facing * this.speed * 60 * dt * scale;
          } else if (dist < CONFIG.combatRetreatDist * scale) {
            this.x -= this.facing * this.speed * 35 * dt * scale;
          } else if (this.attackCooldown <= 0) {
            this.attack();
          }
        }
        this.x = Math.max(ARENA_LEFT + 20 * scale, Math.min(ARENA_RIGHT - 20 * scale, this.x));
      }

      attack() {
        this.state = 'attack';
        this.stateTimer = 0.6;
        this.attackCooldown = CONFIG.attackCooldown + Math.random() * 0.3;
        this.x += this.facing * 24 * scale;
      }

      takeDamage(amount: number, attacker: Gladiator) {
        if (!this.alive) return;
        this.hp -= amount;
        this.state = 'hit';
        this.stateTimer = 0.4;
        this.x -= attacker.facing * 30 * scale;
        spawnHitParticles(this.x, this.y - 40 * scale, this.color);
        const now = performance.now();
        if (now - lastClang > 90) {
          lastClang = now;
          sound.playClunk(1.6);
        }
        shake.addTrauma(0.12);
        if (this.hp <= 0) {
          this.hp = 0;
          this.alive = false;
          this.state = 'dead';
          this.deathAnim = 0;
          spawnDeathParticles(this.x, this.y - 35 * scale, this.color);
          sound.playHoofbeat(0.5);
          shake.addTrauma(0.25);
        }
      }

      draw() {
        ctx.save();
        const alpha = this.alive ? 1 : Math.max(0, 1 - this.deathAnim);
        ctx.globalAlpha = alpha;
        const x = this.x;
        const y = this.y;

        if (!this.alive) {
          const angle = (this.deathAnim * Math.PI) / 2 * (this.facing > 0 ? 1 : -1);
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.translate(-x, -y);
        }

        let armOffset = 0, bodyLean = 0, bobY = 0, legOffset = 0;
        const headR = 13 * scale;
        const bodyLen = 34 * scale;
        const limbLen = 26 * scale;
        const restAngle = 0.35;
        let weaponExtend = 0;
        let strikeThick = 5 * scale;

        if (this.state === 'walk' && this.alive) {
          bobY = Math.abs(Math.sin(this.animPhase * 2)) * 4 * scale;
          legOffset = Math.sin(this.animPhase * 2) * 0.45;
          armOffset = Math.sin(this.animPhase * 2) * 0.15;
        } else if (this.state === 'attack' && this.alive) {
          const t = 1 - this.stateTimer / 0.6;
          if (t < 0.25) {
            armOffset = -1.8 * (t / 0.25);
            bodyLean = -this.facing * 0.15;
            weaponExtend = -0.3;
          } else {
            const strikeT = (t - 0.25) / 0.75;
            armOffset = -1.8 + 2.8 * strikeT;
            bodyLean = -this.facing * 0.15 + this.facing * 0.3 * strikeT;
            weaponExtend = -0.3 + 1.5 * strikeT;
            if (strikeT > 0.1 && strikeT < 0.7) strikeThick = 7.5 * scale;
          }
        } else if (this.state === 'hit' && this.alive) {
          const t = this.hitAnim;
          bodyLean = this.facing * 0.3 * t;
          armOffset = 0.5 * t;
          bobY = -8 * t * scale;
        } else if (this.state === 'victory' && this.alive) {
          bobY = Math.sin(this.animPhase) * 7 * scale;
          armOffset = -2.6 + Math.sin(this.animPhase * 3) * 0.5;
        }

        ctx.translate(x, y + bobY);
        ctx.rotate(bodyLean);

        ctx.beginPath();
        ctx.arc(0, -headR - bodyLen, headR, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#111';
        const eyeOff = this.facing * 3.5 * scale;
        ctx.beginPath(); ctx.arc(eyeOff - 3.5 * scale, -bodyLen - headR - 2 * scale, 2.2 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeOff + 3.5 * scale, -bodyLen - headR - 2 * scale, 2.2 * scale, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(-6 * scale, -bodyLen - headR - 12 * scale);
        ctx.lineTo(0, -bodyLen - headR - 22 * scale);
        ctx.lineTo(6 * scale, -bodyLen - headR - 12 * scale);
        ctx.fill();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 5 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -bodyLen + 8 * scale);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.lineWidth = 5 * scale;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const llX = Math.sin(legOffset) * limbLen;
        const llY = Math.cos(legOffset) * limbLen;
        ctx.lineTo(-llX, llY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const rlX = Math.sin(-legOffset) * limbLen;
        const rlY = Math.cos(-legOffset) * limbLen;
        ctx.lineTo(-rlX, rlY);
        ctx.stroke();

        const shieldArmAngle = this.facing > 0 ? -restAngle - armOffset * 0.5 : restAngle + armOffset * 0.5;
        ctx.lineWidth = 4.5 * scale;
        ctx.beginPath();
        ctx.moveTo(0, -bodyLen + 8 * scale);
        ctx.lineTo(Math.sin(shieldArmAngle) * limbLen, -bodyLen + 8 * scale + Math.cos(shieldArmAngle) * limbLen);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const sx = Math.sin(shieldArmAngle) * (limbLen + 8 * scale);
        const sy = -bodyLen + 8 * scale + Math.cos(shieldArmAngle) * (limbLen + 8 * scale);
        ctx.ellipse(sx, sy, 10 * scale, 14 * scale, shieldArmAngle, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.lineWidth = strikeThick;
        const weaponArmAngle = this.facing > 0 ? restAngle + armOffset : -restAngle - armOffset;
        ctx.beginPath();
        ctx.moveTo(0, -bodyLen + 8 * scale);
        const wx = Math.sin(weaponArmAngle) * (limbLen + weaponExtend * 20 * scale);
        const wy = -bodyLen + 8 * scale + Math.cos(weaponArmAngle) * (limbLen + weaponExtend * 20 * scale);
        ctx.lineTo(wx, wy);
        ctx.stroke();

        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(weaponArmAngle + (this.facing > 0 ? 0.5 : -0.5));
        ctx.strokeStyle = '#cbd5e1';
        ctx.fillStyle = '#94a3b8';
        ctx.lineWidth = 3 * scale;
        if (this.weaponType === 0) {
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22 * scale); ctx.stroke();
          ctx.fillRect(-4 * scale, -2 * scale, 8 * scale, 4 * scale);
        } else if (this.weaponType === 1) {
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18 * scale); ctx.stroke();
          ctx.fillStyle = '#64748b';
          ctx.fillRect(-6 * scale, -18 * scale, 12 * scale, 8 * scale);
        } else {
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -28 * scale); ctx.stroke();
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath(); ctx.moveTo(-3 * scale, -28 * scale); ctx.lineTo(0, -36 * scale); ctx.lineTo(3 * scale, -28 * scale); ctx.fill();
        }
        ctx.restore();

        ctx.rotate(-bodyLean);
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${14 * scale}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(this.name, 0, -bodyLen - headR - 38 * scale);
        ctx.shadowBlur = 0;

        if (this.alive) {
          const barW = 38 * scale;
          const barH = 5 * scale;
          const hpRatio = this.hp / this.maxHp;
          ctx.fillStyle = '#222';
          ctx.fillRect(-barW / 2, -bodyLen - headR - 28 * scale, barW, barH);
          ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
          ctx.fillRect(-barW / 2, -bodyLen - headR - 28 * scale, barW * hpRatio, barH);
        }
        ctx.restore();
      }
    }

    function spawnHitParticles(x: number, y: number, color: string) {
      for (let i = 0; i < 12; i++)
        particles.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8 - 3, life: 1, color, size: (3 + Math.random() * 4) * scale, type: 'hit' });
      spawnTextParticle(x, y - 30 * scale, `-${Math.floor(Math.random() * 10 + 8)}`, '#ff5555');
    }

    function spawnDeathParticles(x: number, y: number, color: string) {
      for (let i = 0; i < 30; i++)
        particles.push({ x, y, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 1) * 10, life: 1.4, color, size: (4 + Math.random() * 6) * scale, type: 'death' });
      spawnTextParticle(x, y - 45 * scale, '💀', '#fff');
    }

    function spawnTextParticle(x: number, y: number, text: string, color: string) {
      particles.push({ x, y, vx: 0, vy: -2.2, life: 1.4, color, text, size: 18 * scale, type: 'text' });
    }

    function updateParticles(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= dt * 1.8;
        if (p.type !== 'text') p.vy += 0.15;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }

    function drawParticles() {
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        if (p.type === 'text') {
          ctx.font = `bold ${p.size}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = p.color;
          ctx.textAlign = 'center';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 4;
          ctx.fillText(p.text, p.x, p.y);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * Math.max(0, p.life), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    function drawArena() {
      ctx.fillStyle = '#1a1510';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#c2a878';
      ctx.fillRect(ARENA_LEFT, GROUND_Y - 4 * scale, ARENA_RIGHT - ARENA_LEFT, H - GROUND_Y + 4 * scale);
      const colColors = ['#8b7355', '#7a6548'];
      [ARENA_LEFT - 20 * scale, ARENA_RIGHT + 20 * scale].forEach((cx, ci) => {
        ctx.fillStyle = colColors[ci % 2];
        ctx.fillRect(cx - 12 * scale, 40 * scale, 24 * scale, GROUND_Y - 40 * scale);
        ctx.fillStyle = '#a08b6d';
        ctx.fillRect(cx - 16 * scale, 36 * scale, 32 * scale, 8 * scale);
        ctx.fillRect(cx - 16 * scale, GROUND_Y - 8 * scale, 32 * scale, 8 * scale);
      });
      ctx.strokeStyle = '#a08b6d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ARENA_LEFT, GROUND_Y + 2 * scale);
      ctx.lineTo(ARENA_RIGHT, GROUND_Y + 2 * scale);
      ctx.stroke();
    }

    function initGame() {
      gladiators = [];
      particles = [];
      currentWinner = null;
      battleEndTime = 0;
      completed = false;
      const count = teams.length;
      const spacing = (ARENA_RIGHT - ARENA_LEFT) / (count + 1);
      for (let i = 0; i < count; i++) {
        const isTarget = teams[i].id === targetTeam.id;
        gladiators.push(new Gladiator(i, ARENA_LEFT + spacing * (i + 1), teams[i].color, teams[i].name, teams[i].id, isTarget));
      }
    }

    initGame();
    let lastTime: number | null = null;

    function loop(now: number) {
      const dt = reducedMotion ? 1 / 60 : Math.min(0.033, lastTime ? (now - lastTime) / 1000 : 1 / 60);
      lastTime = now;
      shake.update(dt);
      drawArena();

      if (gameRunning) {
        for (const g of gladiators) g.update(dt);
        updateParticles(dt);

        const aliveGladiators = gladiators.filter((g) => g.alive);
        const aliveCount = aliveGladiators.length;

        if (!currentWinner && gladiators.length > 1) {
          if (aliveCount === 0) {
            const target = gladiators.find((g) => g.teamId === targetTeam.id);
            if (target) {
              target.alive = true;
              target.hp = Math.floor(target.maxHp * 0.5);
              target.state = 'idle';
              target.deathAnim = 0;
              spawnTextParticle(target.x, target.y - 75 * scale, '💪 ЕЩЁ!', '#ffdd00');
            }
          } else if (aliveCount === 1) {
            const lastAlive = aliveGladiators[0];
            if (lastAlive.teamId === targetTeam.id) {
              currentWinner = lastAlive;
              currentWinner.state = 'victory';
              battleEndTime = Date.now();
              sound.playFanfare();
              confetti.burstConfetti(currentWinner.x, currentWinner.y - 60 * scale, teams.map((t) => t.color), reducedMotion ? 20 : 100);
              shake.addTrauma(0.3);
            } else {
              const target = gladiators.find((g) => g.teamId === targetTeam.id);
              if (target) {
                target.alive = true;
                target.hp = Math.floor(target.maxHp * 0.4);
                target.state = 'idle';
                target.deathAnim = 0;
                spawnTextParticle(target.x, target.y - 75 * scale, '💪 ЕЩЁ!', '#ffdd00');
              }
            }
          }
        }

        if (currentWinner && Date.now() - battleEndTime > POST_BATTLE_DELAY) {
          gameRunning = false;
          if (!completed) { completed = true; onComplete(targetTeam); }
        }
      }

      ctx.save();
      const off = shake.offset(10);
      ctx.translate(off.x, off.y);

      const sorted = [...gladiators].sort((a, b) => (a.alive ? 1 : 0) - (b.alive ? 1 : 0));
      for (const g of sorted) g.draw();
      drawParticles();

      for (const g of gladiators) {
        if (g.alive) {
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.ellipse(g.x, GROUND_Y + 2 * scale, 18 * scale, 6 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      confetti.update(dt);
      confetti.draw(ctx);
      ctx.restore();

      animFrame = requestAnimationFrame(loop);
    }

    animFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrame);
      gameRunning = false;
      gladiators = [];
      particles = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: 'min(92vw, 1300px)',
        height: 'min(78vh, 730px)',
        margin: '0 auto',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 0 50px rgba(251,191,36,0.14)',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', background: '#1a1510' }} />
    </div>
  );
}

export default memo(GladiatorAdapterV2);
