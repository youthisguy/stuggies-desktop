"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ─── Win-98 sub-components ─────────────────────────────────────── */
const W98Btn = ({ children, onClick, disabled = false }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    style={{
      padding: "3px 16px",
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 12,
      fontWeight: "bold",
      background: "#c0c0c0",
      cursor: disabled ? "default" : "pointer",
      color: disabled ? "#808080" : "#000",
      borderTop: disabled ? "2px solid #808080" : "2px solid #fff",
      borderLeft: disabled ? "2px solid #808080" : "2px solid #fff",
      borderRight: disabled ? "2px solid #fff" : "2px solid #808080",
      borderBottom: disabled ? "2px solid #fff" : "2px solid #808080",
      whiteSpace: "nowrap",
      letterSpacing: "0.5px",
    }}
  >
    {children}
  </button>
);

const HudBox = ({ label, value, color = "#00ff41" }) => (
  <div
    style={{
      background: "#000",
      color,
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 12,
      padding: "2px 8px",
      borderTop: "2px solid #404040",
      borderLeft: "2px solid #404040",
      borderRight: "2px solid #c0c0c0",
      borderBottom: "2px solid #c0c0c0",
      whiteSpace: "nowrap",
      userSelect: "none",
    }}
  >
    {label}: <span style={{ fontWeight: "bold" }}>{value}</span>
  </div>
);

/* ─── Constants ──────────────────────────────────────────────────── */
const CW = 640;
const CH = 360;
const HIT_RADIUS = 34;
const MAX_SWAY = 18;
const HS_KEY = "stuggies_sniper_best_v2";

// Auto-fire intervals (in frames at 60fps)
const FIRE_SLOW   = 180; // 3s — kills 0–4
const FIRE_MEDIUM = 120; // 2s — kills 5–14
const FIRE_FAST   =  60; // 1s — kills 15+

function getFireInterval(killed) {
  if (killed >= 15) return FIRE_FAST;
  if (killed >= 5)  return FIRE_MEDIUM;
  return FIRE_SLOW;
}

function getFireLabel(killed) {
  if (killed >= 15) return "1s";
  if (killed >= 5)  return "2s";
  return "3s";
}

/* ─── Drawing helpers ────────────────────────────────────────────── */
function drawBackground(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, "#0d1b2a");
  sky.addColorStop(0.65, "#1a2a1a");
  sky.addColorStop(1, "#0a1208");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, CH);

  ctx.fillStyle = "rgba(255,255,200,0.55)";
  [17,43,71,113,137,199,233,257,311,373].forEach((s) => {
    ctx.beginPath();
    ctx.arc((s*37)%CW, (s*13)%(CH*0.45), 1, 0, Math.PI*2);
    ctx.fill();
  });

  const buildings = [
    [0,140,75,220],[85,110,55,250],[158,80,95,280],
    [272,120,48,240],[338,60,88,300],[444,110,66,250],[526,90,110,270],
  ];
  buildings.forEach(([bx,,bw,bh]) => {
    ctx.fillStyle = "#080d08";
    ctx.fillRect(bx, CH-bh, bw, bh);
    ctx.fillStyle = "rgba(255,210,0,0.12)";
    for (let wy=CH-bh+14; wy<CH-8; wy+=22)
      for (let wx=bx+7; wx<bx+bw-7; wx+=16)
        ctx.fillRect(wx, wy, 6, 9);
  });

  ctx.fillStyle = "#1a3a10";
  ctx.fillRect(0, CH-36, CW, 36);
  ctx.fillStyle = "#243d18";
  ctx.fillRect(0, CH-38, CW, 5);

  for (let i=0; i<3; i++) {
    ctx.fillStyle = `rgba(160,210,160,${0.018+i*0.008})`;
    ctx.fillRect(0, 190+i*40, CW, 22);
  }
}

function drawBadActor(ctx, x, y, scale, alpha, ducking) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const sq = ducking ? 0.55 : 1;

  ctx.beginPath();
  ctx.ellipse(0, 23*sq, 15, 4, 0, 0, Math.PI*2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, 6*sq, 13, 17*sq, 0, 0, Math.PI*2);
  ctx.fillStyle = "#161616";
  ctx.fill();
  ctx.strokeStyle = "#ff3333";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (!ducking) {
    ctx.beginPath();
    ctx.arc(0, -15, 12, 0, Math.PI*2);
    ctx.fillStyle = "#222";
    ctx.fill();
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#ff0000";
    [-5,5].forEach((ex) => {
      ctx.beginPath();
      ctx.arc(ex, -15, 3.2, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    [-4,6].forEach((ex) => {
      ctx.beginPath();
      ctx.arc(ex, -16, 1.1, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.fillStyle = "#ff3333";
    ctx.font = "bold 11px serif";
    ctx.textAlign = "center";
    ctx.fillText("☠", 0, 12);
  }
  ctx.restore();
}

function drawStuggy(ctx, x, y, scale, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.beginPath();
  ctx.ellipse(0, 23, 15, 4, 0, 0, Math.PI*2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, 19, 0, Math.PI*2);
  ctx.fillStyle = "#ff9922";
  ctx.fill();
  ctx.strokeStyle = "#c06000";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 6, 9, 8, 0, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fill();

  ctx.fillStyle = "#000";
  [-6,6].forEach((ex) => {
    ctx.beginPath();
    ctx.arc(ex, -3, 4.2, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.fillStyle = "#fff";
  [-5,7].forEach((ex) => {
    ctx.beginPath();
    ctx.arc(ex, -4, 1.6, 0, Math.PI*2);
    ctx.fill();
  });

  ctx.beginPath();
  ctx.arc(0, 4, 7, 0.2, Math.PI-0.2);
  ctx.strokeStyle = "#7a3800";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#ff9922";
  ctx.strokeStyle = "#c06000";
  ctx.lineWidth = 1;
  [[-14,-10,-0.4],[14,-10,0.4]].forEach(([ex,ey,rot]) => {
    ctx.beginPath();
    ctx.ellipse(ex, ey, 5, 7, rot, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.fillStyle = "#ff9922";
  [-8,8].forEach((fx) => {
    ctx.beginPath();
    ctx.ellipse(fx, 21, 6, 4, 0, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();
}

function drawParticles(ctx, particles) {
  particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = (p.life/p.maxLife)*p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });
}

/* ── Auto-fire countdown ring drawn around the scope ── */
function drawScope(ctx, sx, sy, fireProgress, fireInterval, wave, killed) {
  const r = 88;
  ctx.save();

  // vignette
  const vignette = ctx.createRadialGradient(sx, sy, r*0.55, sx, sy, r*1.6);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.65, "rgba(0,0,0,0.55)");
  vignette.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CW, CH);

  ctx.beginPath();
  ctx.rect(0, 0, CW, CH);
  ctx.arc(sx, sy, r, 0, Math.PI*2, true);
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fill("evenodd");

  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI*2);
  ctx.fillStyle = "rgba(0,255,65,0.04)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI*2);
  ctx.strokeStyle = "#00ff41";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Crosshair
  ctx.strokeStyle = "#00ff41";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5,5]);
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.moveTo(sx-r+4,sy); ctx.lineTo(sx-12,sy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx+12,sy); ctx.lineTo(sx+r-4,sy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx,sy-r+4); ctx.lineTo(sx,sy-12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx,sy+12); ctx.lineTo(sx,sy+r-4); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Range rings + mil-dots
  [32,62].forEach((rr) => {
    ctx.beginPath(); ctx.arc(sx,sy,rr,0,Math.PI*2);
    ctx.strokeStyle = "rgba(0,255,65,0.22)"; ctx.lineWidth=1; ctx.stroke();
  });
  ctx.fillStyle = "#00ff41";
  [-62,-32,32,62].forEach((d) => {
    ctx.beginPath(); ctx.arc(sx+d,sy,2.2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx,sy+d,2.2,0,Math.PI*2); ctx.fill();
  });

  // Centre dot
  ctx.beginPath(); ctx.arc(sx,sy,6,0,Math.PI*2);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fill();
  ctx.beginPath(); ctx.arc(sx,sy,3.5,0,Math.PI*2);
  ctx.fillStyle = "#ff3333"; ctx.fill();
  ctx.beginPath(); ctx.arc(sx-1,sy-1,1.2,0,Math.PI*2);
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fill();

  // Corner brackets
  const bl=16, bp=20;
  ctx.strokeStyle="#00ff41"; ctx.lineWidth=2;
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([bsx,bsy]) => {
    const ox=sx+bsx*(r-bp), oy=sy+bsy*(r-bp);
    ctx.beginPath();
    ctx.moveTo(ox+bsx*bl,oy); ctx.lineTo(ox,oy); ctx.lineTo(ox,oy+bsy*bl);
    ctx.stroke();
  });

  // ── AUTO-FIRE countdown arc (outside scope ring) ──────────────
  const pct = fireProgress / fireInterval;
  const isFast = fireInterval <= FIRE_FAST;
  const isMed  = fireInterval <= FIRE_MEDIUM && !isFast;

  // Track (dim)
  ctx.beginPath();
  ctx.arc(sx, sy, r+9, -Math.PI/2, -Math.PI/2 + Math.PI*2);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Fill arc (progress toward next shot)
  const arcColor = isFast ? "#ff3333" : isMed ? "#ff9900" : "#00ff41";
  ctx.beginPath();
  ctx.arc(sx, sy, r+9, -Math.PI/2, -Math.PI/2 + pct*Math.PI*2);
  ctx.strokeStyle = arcColor;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Speed label top-right of canvas
  const speedLabel = getFireLabel(killed);
  ctx.font = 'bold 10px "Share Tech Mono", monospace';
  ctx.fillStyle = arcColor;
  ctx.textAlign = "right";
  ctx.fillText(`AUTO ⚡${speedLabel}`, CW-8, 16);

  ctx.font = 'bold 10px "Share Tech Mono", monospace';
  ctx.fillStyle = "#00ff41";
  ctx.textAlign = "left";
  ctx.fillText(`WAVE ${wave}`, 8, 16);

  ctx.restore();
}

function drawMuzzleFlash(ctx, intensity) {
  ctx.save();
  ctx.globalAlpha = intensity/10;
  ctx.fillStyle = "#fff8cc";
  ctx.fillRect(0, 0, CW, CH);
  ctx.restore();
}

/* ─── Entity / particle factories ───────────────────────────────── */
function makeEntity(type, wave) {
  const side = Math.random() < 0.5 ? "L" : "R";
  const x = side === "L" ? -30 : CW+30;
  const baseY = 55 + Math.random()*(CH-110);
  const spd = (0.6 + Math.random()*0.9 + wave*0.08) * (side==="L" ? 1 : -1);
  return {
    type, x, baseY, y: baseY, speed: spd,
    bobFreq: 0.04+Math.random()*0.03,
    bobAmp: 6+Math.random()*10,
    bobOff: Math.random()*Math.PI*2,
    scale: 1, alpha: 1, alive: true, spawned: false,
    spawnDelay: Math.floor(Math.random()*60),
    ducking: false,
    duckTimer: type==="bad" ? 80+Math.floor(Math.random()*140) : 99999,
    duckFrames: 0,
  };
}

function makeParticle(x, y, type) {
  const color = type==="bad" ? "#ff4444" : "#ffe066";
  const angle = Math.random()*Math.PI*2;
  const speed = 1.5+Math.random()*3.5;
  return {
    x, y,
    vx: Math.cos(angle)*speed,
    vy: Math.sin(angle)*speed-2.2,
    r: 2+Math.random()*4,
    color, alpha: 1,
    life: 28+Math.floor(Math.random()*24),
    maxLife: 52,
  };
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function StuggiesSniper() {
  const canvasRef = useRef(null);

  const [hudScore,    setHudScore]    = useState(0);
  const [hudBest,     setHudBest]     = useState(0);
  const [hudWave,     setHudWave]     = useState(1);
  const [hudCombo,    setHudCombo]    = useState(1);
  const [hudKilled,   setHudKilled]   = useState(0);
  const [hudSaved,    setHudSaved]    = useState(0);
  const [hudSpeed,    setHudSpeed]    = useState("3s");
  const [gameState,   setGameState]   = useState("idle");

  const G = useRef({
    state: "idle",
    score: 0,
    combo: 1,
    comboTimer: 0,
    wave: 1,
    killed: 0,
    saved: 0,
    best: parseInt(typeof window !== "undefined" ? localStorage.getItem(HS_KEY)||"0" : "0"),
    // Auto-fire
    fireTimer: 0,
    fireInterval: FIRE_SLOW,
    frame: 0,
    muzzleFlash: 0,
    // Scope — crosshair follows mouse/touch; sway is always on
    scope: {
      x: CW/2, y: CH/2,
      swayX: 0, swayY: 0,
      velX: 0, velY: 0,
      breathPhase: 0,
      jerkX: 0, jerkY: 0,
      // where the mouse is (canvas-relative)
      targetX: CW/2, targetY: CH/2,
    },
    entities: [],
    particles: [],
    rafId: null,
  });

  /* ── Helpers ────────────────────────────────────────────────── */
  const syncHud = useCallback(() => {
    const g = G.current;
    setHudScore(g.score);
    setHudBest(g.best);
    setHudWave(g.wave);
    setHudCombo(g.combo);
    setHudKilled(g.killed);
    setHudSaved(g.saved);
    setHudSpeed(getFireLabel(g.killed));
  }, []);

  /* ── Fire (called by the auto-fire timer) ───────────────────── */
  const fireShot = useCallback(() => {
    const g = G.current;
    if (g.state !== "playing") return;

    g.muzzleFlash = 9;
    const sc = g.scope;
    sc.jerkX = (Math.random()-0.5)*18;
    sc.jerkY = -(4+Math.random()*8);

    const cx = sc.x + sc.swayX + sc.jerkX;
    const cy = sc.y + sc.swayY + sc.jerkY;

    let hit = null;
    let minDist = HIT_RADIUS;
    g.entities.forEach((e) => {
      if (!e.alive || !e.spawned) return;
      if (e.type==="bad" && e.ducking) return;
      const dist = Math.hypot(e.x-cx, e.y-cy);
      if (dist < minDist) { minDist=dist; hit=e; }
    });

    if (hit) {
      hit.alive = false;
      for (let i=0; i<14; i++) g.particles.push(makeParticle(hit.x,hit.y,hit.type));

      if (hit.type==="stuggy") {
        g.state = "dead";
        setGameState("dead");
        syncHud();
        return;
      } else {
        g.killed++;
        g.combo = Math.min(g.combo+1, 10);
        g.comboTimer = 130;
        g.score += g.combo;
        if (g.score > g.best) {
          g.best = g.score;
          localStorage.setItem(HS_KEY, String(g.best));
        }
        if (g.score >= g.wave*9) g.wave++;
      }
    }

    // Recalculate fire interval after each shot
    g.fireInterval = getFireInterval(g.killed);
    syncHud();
  }, [syncHud]);

  /* ── Start game ─────────────────────────────────────────────── */
  const startGame = useCallback(() => {
    const g = G.current;
    g.state = "playing";
    g.score=0; g.combo=1; g.comboTimer=0; g.wave=1;
    g.killed=0; g.saved=0;
    g.fireTimer=0; g.fireInterval=FIRE_SLOW;
    g.frame=0; g.muzzleFlash=0;
    g.particles=[];
    const sc=g.scope;
    sc.swayX=0; sc.swayY=0; sc.velX=0; sc.velY=0; sc.jerkX=0; sc.jerkY=0;
    sc.x=CW/2; sc.y=CH/2; sc.targetX=CW/2; sc.targetY=CH/2;

    g.entities=[];
    const count=3+g.wave*2;
    for (let i=0; i<count; i++)
      g.entities.push(makeEntity(Math.random()<0.37?"stuggy":"bad", g.wave));

    setGameState("playing");
    syncHud();
  }, [syncHud]);

  /* ── RAF loop ────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const g = G.current;
    let lastHudFrame=0;

    function loop() {
      g.frame++;
      ctx.clearRect(0, 0, CW, CH);
      drawBackground(ctx);

      if (g.state==="playing") {
        const sc = g.scope;

        // Smoothly pull scope centre toward mouse/touch target
        sc.x += (sc.targetX - sc.x) * 0.18;
        sc.y += (sc.targetY - sc.y) * 0.18;

        // Gentle breath sway (always present — makes it feel like a real scope)
        sc.breathPhase += 0.017;
        sc.velX += (Math.random()-0.5)*0.2;
        sc.velY += (Math.random()-0.5)*0.2;
        sc.velX *= 0.92;
        sc.velY *= 0.92;
        sc.swayX = Math.max(-MAX_SWAY, Math.min(MAX_SWAY, sc.swayX+sc.velX+Math.sin(sc.breathPhase)*1.4));
        sc.swayY = Math.max(-MAX_SWAY, Math.min(MAX_SWAY, sc.swayY+sc.velY+Math.sin(sc.breathPhase*0.7)*1.8));
        sc.jerkX *= 0.76;
        sc.jerkY *= 0.76;

        // Combo decay
        if (g.comboTimer>0) { g.comboTimer--; if (g.comboTimer===0) g.combo=1; }

        // ── Auto-fire tick ──────────────────────────────────────
        g.fireTimer++;
        if (g.fireTimer >= g.fireInterval) {
          g.fireTimer = 0;
          if (g.state==="playing") fireShot();
        }

        // Entity maintenance
        const living = g.entities.filter(e=>e.alive&&e.spawned).length;
        const target = 3+g.wave*2;
        if (living < target) {
          const type = Math.random()<0.37?"stuggy":"bad";
          const ne=makeEntity(type, g.wave);
          ne.spawned=true; ne.spawnDelay=0;
          g.entities.push(ne);
        }

        g.entities.forEach((e) => {
          if (!e.spawned) { if(e.spawnDelay>0){e.spawnDelay--;return;} e.spawned=true; }
          if (!e.alive) return;
          e.x += e.speed;
          e.y = e.baseY+Math.sin(g.frame*e.bobFreq+e.bobOff)*e.bobAmp;

          if (e.type==="bad") {
            e.duckTimer--;
            if (e.duckTimer<=0&&!e.ducking) {
              e.ducking=true;
              e.duckFrames=40+Math.floor(Math.random()*60);
            }
            if (e.ducking) {
              e.duckFrames--;
              if (e.duckFrames<=0) { e.ducking=false; e.duckTimer=80+Math.floor(Math.random()*160); }
            }
          }

          if (e.x<-55||e.x>CW+55) {
            if (e.type==="stuggy") g.saved++;
            const ne=makeEntity(e.type,g.wave);
            Object.assign(e,ne);
            e.spawned=true; e.spawnDelay=0;
          }
        });

        g.particles=g.particles.filter(p=>p.life>0);
        g.particles.forEach((p) => { p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life--; });
      }

      // Draw entities
      g.entities.forEach((e) => {
        if (!e.alive||!e.spawned) return;
        if (e.type==="bad") drawBadActor(ctx,e.x,e.y,e.scale,e.alpha,e.ducking);
        else drawStuggy(ctx,e.x,e.y,e.scale,e.alpha);
      });

      drawParticles(ctx, g.particles);

      if (g.state==="playing") {
        const sc=g.scope;
        drawScope(
          ctx,
          sc.x+sc.swayX+sc.jerkX,
          sc.y+sc.swayY+sc.jerkY,
          g.fireTimer,
          g.fireInterval,
          g.wave,
          g.killed,
        );
        if (g.muzzleFlash>0) { drawMuzzleFlash(ctx,g.muzzleFlash); g.muzzleFlash--; }
      }

      if (g.frame-lastHudFrame>=8) {
        lastHudFrame=g.frame;
        setHudScore(g.score);
        setHudCombo(g.combo);
        setHudKilled(g.killed);
        setHudSaved(g.saved);
        setHudWave(g.wave);
        setHudSpeed(getFireLabel(g.killed));
      }

      g.rafId=requestAnimationFrame(loop);
    }

    g.rafId=requestAnimationFrame(loop);
    return () => { if (g.rafId) cancelAnimationFrame(g.rafId); };
  }, [fireShot]);

  /* ── Mouse / touch tracking ─────────────────────────────────── */
  const updateCrosshair = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    G.current.scope.targetX = Math.max(0, Math.min(CW, (clientX-rect.left)*scaleX));
    G.current.scope.targetY = Math.max(0, Math.min(CH, (clientY-rect.top)*scaleY));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e) => updateCrosshair(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      e.preventDefault();
      updateCrosshair(e.touches[0].clientX, e.touches[0].clientY);
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchmove", onTouchMove);
    };
  }, [updateCrosshair]);

  const isPlaying = gameState==="playing";
  const isDead    = gameState==="dead";

  return (
    <div style={{ fontFamily:"'Share Tech Mono', monospace", userSelect:"none" }}>
      {/* HUD */}
      <div style={{ display:"flex", gap:5, marginBottom:5, flexWrap:"wrap" }}>
        <HudBox label="SCORE" value={hudScore} />
        <HudBox label="BEST"  value={hudBest}  color="#ffd700" />
        <HudBox label="WAVE"  value={hudWave}  />
        <HudBox label="COMBO" value={`x${hudCombo}`} color={hudCombo>=4?"#ff9900":"#00ff41"} />
        <div style={{ marginLeft:"auto" }}>
          <HudBox
            label="AUTO-FIRE"
            value={`⚡ ${hudSpeed}`}
            color={hudSpeed==="1s"?"#ff3333":hudSpeed==="2s"?"#ff9900":"#00ff41"}
          />
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position:"relative" }}>
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{
            display:"block",
            width:"100%",
            maxWidth:CW,
            borderTop:"2px solid #404040",
            borderLeft:"2px solid #404040",
            borderRight:"2px solid #fff",
            borderBottom:"2px solid #fff",
            cursor: isPlaying ? "none" : "pointer",
          }}
          onClick={() => { if (!isPlaying) startGame(); }}
          onTouchEnd={(e) => { e.preventDefault(); if (!isPlaying) startGame(); }}
        />

        {/* Overlay */}
        {!isPlaying && (
          <div style={{
            position:"absolute", inset:0,
            background:"rgba(0,0,0,0.82)",
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", gap:12,
          }}>
            <div style={{
              fontFamily:"'Orbitron', monospace",
              fontSize:20, fontWeight:900,
              color: isDead?"#ff4444":"#fff",
              letterSpacing:3, textAlign:"center",
              textShadow: isDead?"0 0 12px #ff0000":"0 0 8px #000080",
            }}>
              {isDead ? "☠ YOU HIT A STUGGY" : "STUGGIES SNIPER"}
            </div>

            {isDead ? (
              <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:12, color:"#00ff41", textAlign:"center", lineHeight:2 }}>
                Score: <strong style={{ color:"#fff" }}>{hudScore}</strong> &nbsp;|&nbsp;
                Best: <strong style={{ color:"#ffd700" }}>{hudBest}</strong>
                <br/>
                Wave: {hudWave} &nbsp;|&nbsp; Eliminated: {hudKilled}
                <br/>
              </div>
            ) : (
              <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:12, color:"#00ff41", textAlign:"center", lineHeight:2 }}>
                Move cursor to aim · auto fire
                <br/>
                Eliminate BAD ACTORS, Spare the STUGGIES 🐾
                <br/>
 
              </div>
            )}

            <W98Btn onClick={startGame}>
              {isDead ? "↩ PLAY AGAIN" : "▶ START MISSION"}
            </W98Btn>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={{ display:"flex", gap:0, borderTop:"1px solid #808080", marginTop:5, paddingTop:3 }}>
        {[
          `Eliminated: ${hudKilled}`,
          `Stuggies saved: ${hudSaved}`,
          "MegaETH · 3,333 Stuggies",
        ].map((t,i) => (
          <div key={i} style={{
            borderTop:"1px solid #404040",
            borderLeft:"1px solid #404040",
            borderRight:"1px solid #fff",
            borderBottom:"1px solid #fff",
            padding:"1px 8px",
            fontFamily:"'Share Tech Mono', monospace",
            fontSize:10,
            marginLeft: i===2?"auto":0,
          }}>{t}</div>
        ))}
      </div>
    </div>
  );
}