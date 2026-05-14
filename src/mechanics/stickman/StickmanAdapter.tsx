import { useEffect, useRef } from 'react';
import type { MechanicAdapterProps } from '../adapter';

const CANVAS_W = 800;
const CANVAS_H = 450;
const GROUND_Y = 380;
const ARENA_LEFT = 40;
const ARENA_RIGHT = 760;

const FIGHT_CONFIG = {
  baseHp: 200,
  baseDamage: 14,
  attackCooldown: 0.95,
  moveSpeed: 1.1,
  combatApproachDist: 65,
  combatRetreatDist: 30,
};

const POST_BATTLE_DELAY = 1500;

export default function StickmanAdapter({
  teams,
  targetTeam,
  onComplete,
}: MechanicAdapterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    if (teams.length < 2) {
      onComplete();
      return;
    }

    let stickmen: any[] = [];
    let particles: any[] = [];
    let gameRunning = true;
    let animFrame = 0;
    let currentWinner: any = null;
    let battleEndTime = 0;
    let completed = false;

    class Stickman {
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
      attackType: number;
      dodgeChance: number;
      lastDodgeTime: number;

      constructor(id: number, x: number, color: string, name: string, teamId: string, isTarget: boolean) {
        this.id = id;
        this.x = x;
        this.y = GROUND_Y;
        this.color = color;
        this.name = name;
        this.teamId = teamId;
        this.hp = isTarget ? FIGHT_CONFIG.baseHp * 3 : FIGHT_CONFIG.baseHp;
        this.maxHp = this.hp;
        this.alive = true;
        this.target = null;
        this.state = 'idle';
        this.stateTimer = 0;
        this.attackCooldown = Math.random() * 0.6;
        this.speed = FIGHT_CONFIG.moveSpeed + Math.random() * 0.5;
        this.damage = isTarget
          ? FIGHT_CONFIG.baseDamage * 2 + Math.floor(Math.random() * 4)
          : FIGHT_CONFIG.baseDamage + Math.floor(Math.random() * 4);
        this.facing = 1;
        this.animPhase = Math.random() * Math.PI * 2;
        this.hitAnim = 0;
        this.deathAnim = 0;
        this.attackType = 0;
        this.dodgeChance = isTarget ? 0.35 + Math.random() * 0.1 : 0.08 + Math.random() * 0.07;
        this.lastDodgeTime = 0;
      }

      findTarget() {
        const alive = stickmen.filter((s: Stickman) => s.alive && s.id !== this.id);
        if (alive.length === 0) {
          this.target = null;
          return;
        }
        let nearest: any = null;
        let minDist = Infinity;
        for (const s of alive) {
          const d = Math.abs(s.x - this.x);
          if (d < minDist) {
            minDist = d;
            nearest = s;
          }
        }
        this.target = nearest;
      }

      update(dt: number) {
        if (!this.alive) {
          if (this.deathAnim < 1) this.deathAnim = Math.min(1, this.deathAnim + dt * 1.5);
          return;
        }
        this.animPhase += dt * 5;
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.hitAnim > 0) this.hitAnim = Math.max(0, this.hitAnim - dt * 3);

        this.findTarget();
        if (!this.target || !this.target.alive) {
          if (stickmen.filter((s: Stickman) => s.alive).length <= 1) {
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
          if (this.stateTimer > 0.15 && this.stateTimer < 0.35 && dist < 60) {
            const dodgeRoll = Math.random();
            const timeSinceDodge = Date.now() - this.target.lastDodgeTime;
            if (dodgeRoll > this.target.dodgeChance || timeSinceDodge < 1500) {
              this.target.takeDamage(this.damage, this);
            } else {
              this.target.lastDodgeTime = Date.now();
              spawnTextParticle(this.target.x, this.target.y - 70, 'MISS!', '#fff');
            }
          }
        } else if (this.state === 'hit') {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) this.state = 'idle';
        } else {
          this.state = 'walk';
          if (dist > FIGHT_CONFIG.combatApproachDist) {
            this.x += this.facing * this.speed * 60 * dt;
          } else if (dist < FIGHT_CONFIG.combatRetreatDist) {
            this.x -= this.facing * this.speed * 35 * dt;
          } else if (this.attackCooldown <= 0) {
            this.attack();
          }
        }
        this.x = Math.max(ARENA_LEFT + 15, Math.min(ARENA_RIGHT - 15, this.x));
      }

      attack() {
        this.state = 'attack';
        this.stateTimer = 0.55;
        this.attackCooldown = FIGHT_CONFIG.attackCooldown + Math.random() * 0.3;
        this.attackType = Math.random() > 0.6 ? 1 : 0;
        this.x += this.facing * 22;
      }

      takeDamage(amount: number, attacker: Stickman) {
        if (!this.alive) return;
        this.hp -= amount;
        this.state = 'hit';
        this.stateTimer = 0.35;
        this.x -= attacker.facing * 28;
        spawnHitParticles(this.x, this.y - 35, this.color);
        if (this.hp <= 0) {
          this.hp = 0;
          this.alive = false;
          this.state = 'dead';
          this.deathAnim = 0;
          spawnDeathParticles(this.x, this.y - 30, this.color);
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

        let armOffset = 0;
        let bodyLean = 0;
        let bobY = 0;
        let legOffset = 0;
        const headR = 12;
        const bodyLen = 32;
        const limbLen = 24;
        const restAngle = 0.35;
        let strikeArmLen = limbLen;
        let strikeThick = 4.5;

        if (this.state === 'walk' && this.alive) {
          bobY = Math.abs(Math.sin(this.animPhase * 2)) * 4;
          legOffset = Math.sin(this.animPhase * 2) * 0.45;
          armOffset = Math.sin(this.animPhase * 2) * 0.15;
        } else if (this.state === 'attack' && this.alive) {
          const t = 1 - this.stateTimer / 0.55;
          if (t < 0.3) {
            armOffset = -1.8 * (t / 0.3);
            bodyLean = -this.facing * 0.12;
          } else {
            const strikeT = (t - 0.3) / 0.7;
            armOffset = -1.8 + 2.5 * strikeT;
            bodyLean = -this.facing * 0.12 + this.facing * 0.25 * strikeT;
            if (strikeT > 0.15 && strikeT < 0.75) {
              strikeArmLen = limbLen * 1.5;
              strikeThick = 6.5;
            }
          }
          if (this.attackType === 1) legOffset = 0.7 * Math.min(1, t * 2.5);
        } else if (this.state === 'hit' && this.alive) {
          const t = this.hitAnim;
          bodyLean = this.facing * 0.25 * t;
          armOffset = 0.4 * t;
          bobY = -7 * t;
        } else if (this.state === 'victory' && this.alive) {
          bobY = Math.sin(this.animPhase) * 6;
          armOffset = -2.4 + Math.sin(this.animPhase * 3) * 0.4;
        }

        ctx.translate(x, y + bobY);
        ctx.rotate(bodyLean);

        ctx.beginPath();
        ctx.arc(0, -headR - bodyLen, headR, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.fillStyle = '#111';
        const eyeOff = this.facing * 3;
        ctx.beginPath();
        ctx.arc(eyeOff - 3, -bodyLen - headR - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eyeOff + 3, -bodyLen - headR - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (this.state === 'hit') ctx.arc(eyeOff, -bodyLen - headR + 4, 3, Math.PI, 0);
        else if (this.state === 'victory') ctx.arc(eyeOff, -bodyLen - headR + 2, 4, 0, Math.PI);
        else ctx.arc(eyeOff, -bodyLen - headR + 3, 2, 0, Math.PI);
        ctx.stroke();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -bodyLen + 8);
        ctx.lineTo(0, 0);
        ctx.stroke();

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

        ctx.lineWidth = 4.5;
        const shoulderY = -bodyLen + 8;
        const trailArmAngle = this.facing > 0 ? -restAngle - armOffset : restAngle + armOffset;
        ctx.beginPath();
        ctx.moveTo(0, shoulderY);
        ctx.lineTo(Math.sin(trailArmAngle) * limbLen, shoulderY + Math.cos(trailArmAngle) * limbLen);
        ctx.stroke();

        ctx.lineWidth = strikeThick;
        const leadArmAngle = this.facing > 0 ? restAngle + armOffset : -restAngle - armOffset;
        ctx.beginPath();
        ctx.moveTo(0, shoulderY);
        ctx.lineTo(Math.sin(leadArmAngle) * strikeArmLen, shoulderY + Math.cos(leadArmAngle) * strikeArmLen);
        ctx.stroke();

        ctx.rotate(-bodyLean);
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 15px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(this.name, 0, -bodyLen - headR - 35);
        ctx.shadowBlur = 0;

        if (this.alive) {
          const barW = 34;
          const barH = 5;
          const hpRatio = this.hp / this.maxHp;
          ctx.fillStyle = '#222';
          ctx.fillRect(-barW / 2, -bodyLen - headR - 25, barW, barH);
          ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
          ctx.fillRect(-barW / 2, -bodyLen - headR - 25, barW * hpRatio, barH);
        }
        ctx.restore();
      }
    }

    function spawnHitParticles(x: number, y: number, color: string) {
      for (let i = 0; i < 10; i++)
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 7,
          vy: (Math.random() - 0.5) * 7 - 3,
          life: 1,
          color,
          size: 3 + Math.random() * 4,
          type: 'hit',
        });
      spawnTextParticle(x, y - 25, `-${Math.floor(Math.random() * 8 + 8)}`, '#ff5555');
    }

    function spawnDeathParticles(x: number, y: number, color: string) {
      for (let i = 0; i < 25; i++)
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 1) * 9,
          life: 1.2,
          color,
          size: 4 + Math.random() * 6,
          type: 'death',
        });
      spawnTextParticle(x, y - 40, '💀', '#fff');
    }

    function spawnTextParticle(x: number, y: number, text: string, color: string) {
      particles.push({ x, y, vx: 0, vy: -2, life: 1.2, color, text, size: 18, type: 'text' });
    }

    function updateParticles(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt * 1.8;
        if (p.type !== 'text') p.vy += 0.15;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }

    function drawParticles() {
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        if (p.type === 'text') {
          ctx.font = `bold ${p.size}px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
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
      ctx.fillStyle = '#16213e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#2a2a5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ARENA_LEFT, GROUND_Y + 2);
      ctx.lineTo(ARENA_RIGHT, GROUND_Y + 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }
    }

    function initGame() {
      stickmen = [];
      particles = [];
      currentWinner = null;
      battleEndTime = 0;
      completed = false;
      const count = teams.length;
      const spacing = (ARENA_RIGHT - ARENA_LEFT) / (count + 1);
      for (let i = 0; i < count; i++) {
        const isTarget = teams[i].id === targetTeam.id;
        stickmen.push(
          new Stickman(i, ARENA_LEFT + spacing * (i + 1), teams[i].color, teams[i].name, teams[i].id, isTarget),
        );
      }
    }

    initGame();

    function loop() {
      const dt = 1 / 60;
      drawArena();

      if (gameRunning) {
        for (const s of stickmen) s.update(dt);
        updateParticles(dt);

        const aliveStickmen = stickmen.filter((s: Stickman) => s.alive);
        const aliveCount = aliveStickmen.length;

        if (!currentWinner && stickmen.length > 1) {
          if (aliveCount === 0) {
            const target = stickmen.find((s: Stickman) => s.teamId === targetTeam.id);
            if (target) {
              target.alive = true;
              target.hp = Math.floor(target.maxHp * 0.5);
              target.state = 'idle';
              target.deathAnim = 0;
              spawnTextParticle(target.x, target.y - 70, '💪 ЕЩЁ!', '#ffdd00');
            }
          } else if (aliveCount === 1) {
            const lastAlive = aliveStickmen[0];
            if (lastAlive.teamId === targetTeam.id) {
              currentWinner = lastAlive;
              currentWinner.state = 'victory';
              battleEndTime = Date.now();
            } else {
              const target = stickmen.find((s: Stickman) => s.teamId === targetTeam.id);
              if (target) {
                target.alive = true;
                target.hp = Math.floor(target.maxHp * 0.4);
                target.state = 'idle';
                target.deathAnim = 0;
                spawnTextParticle(target.x, target.y - 70, '💪 ЕЩЁ!', '#ffdd00');
              }
            }
          }
        }

        if (currentWinner && Date.now() - battleEndTime > POST_BATTLE_DELAY) {
          gameRunning = false;
          if (!completed) {
            completed = true;
            onComplete(targetTeam);
          }
        }
      }

      const sorted = [...stickmen].sort(
        (a, b) => (a.alive ? 1 : 0) - (b.alive ? 1 : 0),
      );
      for (const s of sorted) s.draw();
      drawParticles();

      for (const s of stickmen) {
        if (s.alive) {
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.ellipse(s.x, GROUND_Y + 2, 16, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      animFrame = requestAnimationFrame(loop);
    }

    animFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [teams, targetTeam, onComplete]);

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 0 40px rgba(233,69,96,0.15)',
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ display: 'block', background: '#16213e' }}
      />
    </div>
  );
}