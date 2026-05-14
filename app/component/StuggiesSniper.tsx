"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ethers } from "ethers";
import { usePrivy, useWallets } from "@privy-io/react-auth";

/* ─────────────────────────────────────────────────────────────────
   Contract config
───────────────────────────────────────────────────────────────────*/
const CONTRACT_ADDRESS = "0x";

const CONTRACT_ABI = [
  "function recordGame(uint256 score, uint256 wave, uint256 killed, uint256 saved, uint256 combo) external",
  "function getPlayerStats(address player) external view returns (tuple(uint256 bestScore, uint256 totalScore, uint256 gamesPlayed, uint256 totalKilled, uint256 totalSaved, uint256 highestWave, uint256 lastPlayed))",
  "function getTopN(uint256 n) external view returns (tuple(address player, uint256 score, uint256 wave, uint256 timestamp)[])",
  "function totalGamesPlayed() external view returns (uint256)",
];

const MEGAETH_TESTNET_CHAIN_ID = 6343;
const RPC_URL = "https://carrot.megaeth.com/rpc";

const RECORD_GAS_LIMIT = 500_000n;

/* ─────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────*/
interface LeaderboardEntry {
  player: string;
  score: bigint;
  wave: bigint;
  timestamp: bigint;
}

interface PlayerStats {
  bestScore: bigint;
  totalScore: bigint;
  gamesPlayed: bigint;
  totalKilled: bigint;
  totalSaved: bigint;
  highestWave: bigint;
  lastPlayed: bigint;
}

type GameState = "idle" | "playing" | "dead";
type Tab = "game" | "leaderboard" | "stats";

/* ─────────────────────────────────────────────────────────────────
   Win-98 UI components
───────────────────────────────────────────────────────────────────*/
const W98Btn = ({
  children,
  onClick,
  disabled = false,
  style = {},
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) => (
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
      ...style,
    }}
  >
    {children}
  </button>
);

const HudBox = ({
  label,
  value,
  color = "#00ff41",
}: {
  label: string;
  value: string | number;
  color?: string;
}) => (
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

/* ─────────────────────────────────────────────────────────────────
   Game constants
───────────────────────────────────────────────────────────────────*/
const CW = 640;
const CH = 360;
const HIT_RADIUS = 34;
const MAX_SWAY = 18;
const HS_KEY = "stuggies_sniper_best_v2";

const FIRE_SLOW = 180; // 3 s
const FIRE_MEDIUM = 120; // 2 s
const FIRE_FAST = 60; // 1 s

function getFireInterval(killed: number): number {
  if (killed >= 15) return FIRE_FAST;
  if (killed >= 5) return FIRE_MEDIUM;
  return FIRE_SLOW;
}
function getFireLabel(killed: number): string {
  if (killed >= 15) return "1s";
  if (killed >= 5) return "2s";
  return "3s";
}
function shortAddr(addr: string): string {
  if (!addr || addr === "0x0000000000000000000000000000000000000000")
    return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}
function formatTime(ts: bigint): string {
  if (!ts || ts === 0n) return "—";
  return new Date(Number(ts) * 1000).toLocaleDateString();
}

/* ─────────────────────────────────────────────────────────────────
   Canvas drawing helpers (pure — no React state)
───────────────────────────────────────────────────────────────────*/
function drawBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, "#0d1b2a");
  sky.addColorStop(0.65, "#1a2a1a");
  sky.addColorStop(1, "#0a1208");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, CH);

  ctx.fillStyle = "rgba(255,255,200,0.55)";
  [17, 43, 71, 113, 137, 199, 233, 257, 311, 373].forEach((s) => {
    ctx.beginPath();
    ctx.arc((s * 37) % CW, (s * 13) % (CH * 0.45), 1, 0, Math.PI * 2);
    ctx.fill();
  });

  const buildings: [number, number, number, number][] = [
    [0, 140, 75, 220],
    [85, 110, 55, 250],
    [158, 80, 95, 280],
    [272, 120, 48, 240],
    [338, 60, 88, 300],
    [444, 110, 66, 250],
    [526, 90, 110, 270],
  ];
  buildings.forEach(([bx, , bw, bh]) => {
    ctx.fillStyle = "#080d08";
    ctx.fillRect(bx, CH - bh, bw, bh);
    ctx.fillStyle = "rgba(255,210,0,0.12)";
    for (let wy = CH - bh + 14; wy < CH - 8; wy += 22)
      for (let wx = bx + 7; wx < bx + bw - 7; wx += 16)
        ctx.fillRect(wx, wy, 6, 9);
  });

  ctx.fillStyle = "#1a3a10";
  ctx.fillRect(0, CH - 36, CW, 36);
  ctx.fillStyle = "#243d18";
  ctx.fillRect(0, CH - 38, CW, 5);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = `rgba(160,210,160,${0.018 + i * 0.008})`;
    ctx.fillRect(0, 190 + i * 40, CW, 22);
  }
}

function drawBadActor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  alpha: number,
  ducking: boolean
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const sq = ducking ? 0.55 : 1;
  ctx.beginPath();
  ctx.ellipse(0, 23 * sq, 15, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 6 * sq, 13, 17 * sq, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#161616";
  ctx.fill();
  ctx.strokeStyle = "#ff3333";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (!ducking) {
    ctx.beginPath();
    ctx.arc(0, -15, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#222";
    ctx.fill();
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ff0000";
    [-5, 5].forEach((ex) => {
      ctx.beginPath();
      ctx.arc(ex, -15, 3.2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    [-4, 6].forEach((ex) => {
      ctx.beginPath();
      ctx.arc(ex, -16, 1.1, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#ff3333";
    ctx.font = "bold 11px serif";
    ctx.textAlign = "center";
    ctx.fillText("☠", 0, 12);
  }
  ctx.restore();
}

function drawStuggy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.ellipse(0, 23, 15, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 19, 0, Math.PI * 2);
  ctx.fillStyle = "#ff9922";
  ctx.fill();
  ctx.strokeStyle = "#c06000";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 6, 9, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fill();
  ctx.fillStyle = "#000";
  [-6, 6].forEach((ex) => {
    ctx.beginPath();
    ctx.arc(ex, -3, 4.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#fff";
  [-5, 7].forEach((ex) => {
    ctx.beginPath();
    ctx.arc(ex, -4, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(0, 4, 7, 0.2, Math.PI - 0.2);
  ctx.strokeStyle = "#7a3800";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#ff9922";
  ctx.strokeStyle = "#c06000";
  ctx.lineWidth = 1;
  (
    [
      [-14, -10, -0.4],
      [14, -10, 0.4],
    ] as [number, number, number][]
  ).forEach(([ex, ey, rot]) => {
    ctx.beginPath();
    ctx.ellipse(ex, ey, 5, 7, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.fillStyle = "#ff9922";
  [-8, 8].forEach((fx) => {
    ctx.beginPath();
    ctx.ellipse(fx, 21, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = (p.life / p.maxLife) * p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawScope(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  fireProgress: number,
  fireInterval: number,
  wave: number,
  killed: number
) {
  const r = 88;
  ctx.save();
  const vignette = ctx.createRadialGradient(sx, sy, r * 0.55, sx, sy, r * 1.6);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.65, "rgba(0,0,0,0.55)");
  vignette.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CW, CH);
  ctx.beginPath();
  ctx.rect(0, 0, CW, CH);
  ctx.arc(sx, sy, r, 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fill("evenodd");
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,255,65,0.04)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#00ff41";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = "#00ff41";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(sx - r + 4, sy);
  ctx.lineTo(sx - 12, sy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx + 12, sy);
  ctx.lineTo(sx + r - 4, sy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx, sy - r + 4);
  ctx.lineTo(sx, sy - 12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx, sy + 12);
  ctx.lineTo(sx, sy + r - 4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  [32, 62].forEach((rr) => {
    ctx.beginPath();
    ctx.arc(sx, sy, rr, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,255,65,0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  ctx.fillStyle = "#00ff41";
  [-62, -32, 32, 62].forEach((d) => {
    ctx.beginPath();
    ctx.arc(sx + d, sy, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy + d, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(sx, sy, 6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ff3333";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx - 1, sy - 1, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fill();
  const bl = 16,
    bp = 20;
  ctx.strokeStyle = "#00ff41";
  ctx.lineWidth = 2;
  (
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as [number, number][]
  ).forEach(([bsx, bsy]) => {
    const ox = sx + bsx * (r - bp),
      oy = sy + bsy * (r - bp);
    ctx.beginPath();
    ctx.moveTo(ox + bsx * bl, oy);
    ctx.lineTo(ox, oy);
    ctx.lineTo(ox, oy + bsy * bl);
    ctx.stroke();
  });
  const pct = fireProgress / fireInterval;
  const isFast = fireInterval <= FIRE_FAST,
    isMed = fireInterval <= FIRE_MEDIUM && !isFast;
  ctx.beginPath();
  ctx.arc(sx, sy, r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 4;
  ctx.stroke();
  const arcColor = isFast ? "#ff3333" : isMed ? "#ff9900" : "#00ff41";
  ctx.beginPath();
  ctx.arc(sx, sy, r + 9, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
  ctx.strokeStyle = arcColor;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = 'bold 10px "Share Tech Mono", monospace';
  ctx.fillStyle = arcColor;
  ctx.textAlign = "right";
  ctx.fillText(`AUTO ⚡${getFireLabel(killed)}`, CW - 8, 16);
  ctx.font = 'bold 10px "Share Tech Mono", monospace';
  ctx.fillStyle = "#00ff41";
  ctx.textAlign = "left";
  ctx.fillText(`WAVE ${wave}`, 8, 16);
  ctx.restore();
}

function drawMuzzleFlash(ctx: CanvasRenderingContext2D, intensity: number) {
  ctx.save();
  ctx.globalAlpha = intensity / 10;
  ctx.fillStyle = "#fff8cc";
  ctx.fillRect(0, 0, CW, CH);
  ctx.restore();
}

/* ─────────────────────────────────────────────────────────────────
   Entity helpers
───────────────────────────────────────────────────────────────────*/
interface Entity {
  type: "bad" | "stuggy";
  x: number;
  baseY: number;
  y: number;
  speed: number;
  bobFreq: number;
  bobAmp: number;
  bobOff: number;
  scale: number;
  alpha: number;
  alive: boolean;
  spawned: boolean;
  spawnDelay: number;
  ducking: boolean;
  duckTimer: number;
  duckFrames: number;
}

function makeEntity(type: "bad" | "stuggy", wave: number): Entity {
  const side = Math.random() < 0.5 ? "L" : "R";
  const x = side === "L" ? -30 : CW + 30;
  const baseY = 55 + Math.random() * (CH - 110);
  const spd =
    (0.6 + Math.random() * 0.9 + wave * 0.08) * (side === "L" ? 1 : -1);
  return {
    type,
    x,
    baseY,
    y: baseY,
    speed: spd,
    bobFreq: 0.04 + Math.random() * 0.03,
    bobAmp: 6 + Math.random() * 10,
    bobOff: Math.random() * Math.PI * 2,
    scale: 1,
    alpha: 1,
    alive: true,
    spawned: false,
    spawnDelay: Math.floor(Math.random() * 60),
    ducking: false,
    duckTimer: type === "bad" ? 80 + Math.floor(Math.random() * 140) : 99999,
    duckFrames: 0,
  };
}

function makeParticle(x: number, y: number, type: string): Particle {
  const color = type === "bad" ? "#ff4444" : "#ffe066";
  const angle = Math.random() * Math.PI * 2,
    speed = 1.5 + Math.random() * 3.5;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 2.2,
    r: 2 + Math.random() * 4,
    color,
    alpha: 1,
    life: 28 + Math.floor(Math.random() * 24),
    maxLife: 52,
  };
}

/* ─────────────────────────────────────────────────────────────────
   Game ref type
───────────────────────────────────────────────────────────────────*/
interface GameRef {
  state: GameState;
  score: number;
  combo: number;
  comboTimer: number;
  wave: number;
  killed: number;
  saved: number;
  best: number;
  fireTimer: number;
  fireInterval: number;
  frame: number;
  muzzleFlash: number;
  scope: {
    x: number;
    y: number;
    swayX: number;
    swayY: number;
    velX: number;
    velY: number;
    breathPhase: number;
    jerkX: number;
    jerkY: number;
    targetX: number;
    targetY: number;
  };
  entities: Entity[];
  particles: Particle[];
  rafId: number | null;
}

function getReadContract() {
  return new ethers.Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    new ethers.JsonRpcProvider(RPC_URL)
  );
}

/* ─────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────*/
export default function StuggiesSniper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hudScore, setHudScore] = useState(0);
  const [hudBest, setHudBest] = useState(0);
  const [hudWave, setHudWave] = useState(1);
  const [hudCombo, setHudCombo] = useState(1);
  const [hudKilled, setHudKilled] = useState(0);
  const [hudSaved, setHudSaved] = useState(0);
  const [hudSpeed, setHudSpeed] = useState("3s");
  const [gameState, setGameState] = useState<GameState>("idle");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("game");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [totalGames, setTotalGames] = useState(0);
  const [lbLoading, setLbLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  /* ── Permanent game state ref ──────────────────────────────── */
  const G = useRef<GameRef>({
    state: "idle",
    score: 0,
    combo: 1,
    comboTimer: 0,
    wave: 1,
    killed: 0,
    saved: 0,
    best: parseInt(
      typeof window !== "undefined" ? localStorage.getItem(HS_KEY) || "0" : "0"
    ),
    fireTimer: 0,
    fireInterval: FIRE_SLOW,
    frame: 0,
    muzzleFlash: 0,
    scope: {
      x: CW / 2,
      y: CH / 2,
      swayX: 0,
      swayY: 0,
      velX: 0,
      velY: 0,
      breathPhase: 0,
      jerkX: 0,
      jerkY: 0,
      targetX: CW / 2,
      targetY: CH / 2,
    },
    entities: [],
    particles: [],
    rafId: null,
  });

  /*
   * saveRef: always holds the latest saveGameOnChain so the RAF loop
   * (which runs forever with [] deps) can call it without being a dep itself.
   */
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  /* ─────────────────────────────────────────────────────────────
     Leaderboard / stats
  ─────────────────────────────────────────────────────────────*/
  const fetchLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const c = getReadContract();
      const [entries, total] = await Promise.all([
        c.getTopN(10),
        c.totalGamesPlayed(),
      ]);
      const filtered = (entries as LeaderboardEntry[]).filter(
        (e) =>
          e.player !== "0x0000000000000000000000000000000000000000" &&
          e.score > 0n
      );
      setLeaderboard(filtered);
      setTotalGames(Number(total));
    } catch (err) {
      console.error("Leaderboard fetch:", err);
    } finally {
      setLbLoading(false);
    }
  }, []);

  const fetchPlayerStats = useCallback(async () => {
    if (!wallets.length) return;
    const addr = wallets[0].address;
    if (!addr) return;
    setStatsLoading(true);
    try {
      const stats = await getReadContract().getPlayerStats(addr);
      setPlayerStats(stats as PlayerStats);
    } catch (err) {
      console.error("Stats fetch:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [wallets]);

  useEffect(() => {
    if (activeTab === "leaderboard") fetchLeaderboard();
    if (activeTab === "stats" && authenticated) fetchPlayerStats();
  }, [activeTab, authenticated, fetchLeaderboard, fetchPlayerStats]);

  /* ─────────────────────────────────────────────────────────────
     saveGameOnChain — rebuilt on wallet/auth change, stored in ref
  ─────────────────────────────────────────────────────────────*/
  const saveGameOnChain = useCallback(async () => {
    const g = G.current;
    if (!authenticated || !wallets.length) {
      setSaveStatus("⚠ Connect wallet to save score");
      return;
    }
    setIsSaving(true);
    setSaveStatus("Saving to MegaETH…");
    try {
      const wallet = wallets[0];
      // Switch to MegaETH testnet
      try {
        await wallet.switchChain(MEGAETH_TESTNET_CHAIN_ID);
      } catch {
        setWrongNetwork(true);
        setSaveStatus("❌ Switch to MegaETH Testnet");
        setIsSaving(false);
        return;
      }
      setWrongNetwork(false);

      const provider = new ethers.BrowserProvider(
        await wallet.getEthereumProvider()
      );
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      // Explicit gas limit prevents the bubble-sort from running out of gas
      const tx = await contract.recordGame(
        BigInt(g.score),
        BigInt(g.wave),
        BigInt(g.killed),
        BigInt(g.saved),
        BigInt(Math.min(g.combo || 1, 10)),
        { gasLimit: RECORD_GAS_LIMIT }
      );

      setSaveStatus("Confirming…");
      await tx.wait();
      setSaveStatus(`✅ Score ${g.score} saved on MegaETH!`);
      fetchLeaderboard();
      fetchPlayerStats();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      // Surface the clearest part of the error message
      const clean = raw.replace(/\n/g, " ").slice(0, 120);
      setSaveStatus("❌ " + clean);
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  }, [authenticated, wallets, fetchLeaderboard, fetchPlayerStats]);

  // Keep saveRef in sync whenever the function is rebuilt
  useEffect(() => {
    saveRef.current = saveGameOnChain;
  }, [saveGameOnChain]);

  /* ─────────────────────────────────────────────────────────────
     startGame — just mutates G ref; RAF loop is always running
  ─────────────────────────────────────────────────────────────*/
  const startGame = useCallback(() => {
    if (!authenticated) {
      login();
      return;
    }
    const g = G.current;

    // Reset all game state
    g.state = "playing";
    g.score = 0;
    g.combo = 1;
    g.comboTimer = 0;
    g.wave = 1;
    g.killed = 0;
    g.saved = 0;
    g.fireTimer = 0;
    g.fireInterval = FIRE_SLOW;
    g.frame = 0;
    g.muzzleFlash = 0;
    g.entities = [];
    g.particles = [];

    const sc = g.scope;
    sc.swayX = 0;
    sc.swayY = 0;
    sc.velX = 0;
    sc.velY = 0;
    sc.jerkX = 0;
    sc.jerkY = 0;
    sc.x = CW / 2;
    sc.y = CH / 2;
    sc.targetX = CW / 2;
    sc.targetY = CH / 2;

    for (let i = 0; i < 5; i++)
      g.entities.push(makeEntity(Math.random() < 0.35 ? "stuggy" : "bad", 1));

    setSaveStatus("");
    setGameState("playing");

    // Sync HUD immediately
    setHudScore(0);
    setHudBest(g.best);
    setHudWave(1);
    setHudCombo(1);
    setHudKilled(0);
    setHudSaved(0);
    setHudSpeed("3s");
  }, [authenticated, login]);

  /* ─────────────────────────────────────────────────────────────
     RAF loop — started ONCE on mount, NEVER cancelled/restarted.
     All game logic lives here via G ref. React state only for HUD.
  ─────────────────────────────────────────────────────────────*/
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = G.current;
    let lastHudFrame = 0;
    let alive = true; // cleanup flag

    function fireShot() {
      if (g.state !== "playing") return;
      g.muzzleFlash = 9;
      const sc = g.scope;
      sc.jerkX = (Math.random() - 0.5) * 18;
      sc.jerkY = -(4 + Math.random() * 8);
      const cx = sc.x + sc.swayX + sc.jerkX;
      const cy = sc.y + sc.swayY + sc.jerkY;

      let hit: Entity | null = null;
      let minDist = HIT_RADIUS;
      g.entities.forEach((e) => {
        if (!e.alive || !e.spawned || (e.type === "bad" && e.ducking)) return;
        const d = Math.hypot(e.x - cx, e.y - cy);
        if (d < minDist) {
          minDist = d;
          hit = e;
        }
      });

      if (!hit) return;
      const h = hit as Entity;
      h.alive = false;
      for (let i = 0; i < 14; i++)
        g.particles.push(makeParticle(h.x, h.y, h.type));

      if (h.type === "stuggy") {
        // Game over
        g.state = "dead";
        setGameState("dead");
        setSaveStatus("");
        saveRef.current(); // fire-and-forget via stable ref
        return;
      }

      // Killed a bad actor
      g.killed++;
      g.combo = Math.min(g.combo + 1, 10);
      g.comboTimer = 130;
      g.score += g.combo;
      if (g.score > g.best) {
        g.best = g.score;
        localStorage.setItem(HS_KEY, String(g.best));
      }
      if (g.score >= g.wave * 9) g.wave++;
      g.fireInterval = getFireInterval(g.killed);
    }

    function loop() {
      if (!alive) return;
      g.frame++;
      ctx.clearRect(0, 0, CW, CH);
      drawBackground(ctx);

      if (g.state === "playing") {
        const sc = g.scope;

        // Lerp scope to cursor
        sc.x += (sc.targetX - sc.x) * 0.18;
        sc.y += (sc.targetY - sc.y) * 0.18;

        // Breath sway
        sc.breathPhase += 0.017;
        sc.velX += (Math.random() - 0.5) * 0.2;
        sc.velY += (Math.random() - 0.5) * 0.2;
        sc.velX *= 0.92;
        sc.velY *= 0.92;
        sc.swayX = Math.max(
          -MAX_SWAY,
          Math.min(
            MAX_SWAY,
            sc.swayX + sc.velX + Math.sin(sc.breathPhase) * 1.4
          )
        );
        sc.swayY = Math.max(
          -MAX_SWAY,
          Math.min(
            MAX_SWAY,
            sc.swayY + sc.velY + Math.sin(sc.breathPhase * 0.7) * 1.8
          )
        );
        sc.jerkX *= 0.76;
        sc.jerkY *= 0.76;

        // Combo decay
        if (g.comboTimer > 0) {
          g.comboTimer--;
          if (g.comboTimer === 0) g.combo = 1;
        }

        // Auto-fire
        g.fireTimer++;
        if (g.fireTimer >= g.fireInterval) {
          g.fireTimer = 0;
          fireShot();
        }

        // Entity spawn
        const living = g.entities.filter((e) => e.alive && e.spawned).length;
        const target = 3 + g.wave * 2;
        if (living < target) {
          const ne = makeEntity(
            Math.random() < 0.35 ? "stuggy" : "bad",
            g.wave
          );
          ne.spawned = true;
          ne.spawnDelay = 0;
          g.entities.push(ne);
        }

        // Entity update
        g.entities.forEach((e) => {
          if (!e.spawned) {
            if (e.spawnDelay > 0) {
              e.spawnDelay--;
              return;
            }
            e.spawned = true;
          }
          if (!e.alive) return;
          e.x += e.speed;
          e.y = e.baseY + Math.sin(g.frame * e.bobFreq + e.bobOff) * e.bobAmp;
          if (e.type === "bad") {
            e.duckTimer--;
            if (e.duckTimer <= 0 && !e.ducking) {
              e.ducking = true;
              e.duckFrames = 40 + Math.floor(Math.random() * 60);
            }
            if (e.ducking) {
              e.duckFrames--;
              if (e.duckFrames <= 0) {
                e.ducking = false;
                e.duckTimer = 80 + Math.floor(Math.random() * 160);
              }
            }
          }
          if (e.x < -55 || e.x > CW + 55) {
            if (e.type === "stuggy") g.saved++;
            Object.assign(e, makeEntity(e.type, g.wave));
            e.spawned = true;
            e.spawnDelay = 0;
          }
        });

        // Particles
        g.particles = g.particles.filter((p) => p.life > 0);
        g.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.15;
          p.life--;
        });
      }

      // Draw
      g.entities.forEach((e) => {
        if (!e.alive || !e.spawned) return;
        if (e.type === "bad")
          drawBadActor(ctx, e.x, e.y, e.scale, e.alpha, e.ducking);
        else drawStuggy(ctx, e.x, e.y, e.scale, e.alpha);
      });
      drawParticles(ctx, g.particles);

      if (g.state === "playing") {
        const sc = g.scope;
        drawScope(
          ctx,
          sc.x + sc.swayX + sc.jerkX,
          sc.y + sc.swayY + sc.jerkY,
          g.fireTimer,
          g.fireInterval,
          g.wave,
          g.killed
        );
        if (g.muzzleFlash > 0) {
          drawMuzzleFlash(ctx, g.muzzleFlash);
          g.muzzleFlash--;
        }
      }

      // Throttled HUD sync
      if (g.frame - lastHudFrame >= 8) {
        lastHudFrame = g.frame;
        setHudScore(g.score);
        setHudCombo(g.combo);
        setHudKilled(g.killed);
        setHudSaved(g.saved);
        setHudWave(g.wave);
        setHudBest(g.best);
        setHudSpeed(getFireLabel(g.killed));
      }

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
    return () => {
      alive = false;
    }; // stops the loop on unmount only
  }, []); // ← empty: RAF starts once, mutates G ref, never restarts

  /* ── Crosshair tracking ────────────────────────────────────── */
  const updateCrosshair = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    G.current.scope.targetX = Math.max(
      0,
      Math.min(CW, (clientX - r.left) * (CW / r.width))
    );
    G.current.scope.targetY = Math.max(
      0,
      Math.min(CH, (clientY - r.top) * (CH / r.height))
    );
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mm = (e: MouseEvent) => updateCrosshair(e.clientX, e.clientY);
    const tm = (e: TouchEvent) => {
      e.preventDefault();
      updateCrosshair(e.touches[0].clientX, e.touches[0].clientY);
    };
    canvas.addEventListener("mousemove", mm);
    canvas.addEventListener("touchmove", tm, { passive: false });
    return () => {
      canvas.removeEventListener("mousemove", mm);
      canvas.removeEventListener("touchmove", tm);
    };
  }, [updateCrosshair]);

  const isPlaying = gameState === "playing";
  const isDead = gameState === "dead";

  /* ─────────────────────────────────────────────────────────────
     Render
  ─────────────────────────────────────────────────────────────*/
  return (
    <div
      style={{
        fontFamily: "'Share Tech Mono', monospace",
        userSelect: "none",
        maxWidth: CW,
      }}
    >
      {/* Tab bar */}
      <div style={{ display: "flex", marginBottom: 4 }}>
        {(["game", "leaderboard", "stats"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "3px 14px",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 11,
              fontWeight: "bold",
              background: activeTab === t ? "#000080" : "#c0c0c0",
              color: activeTab === t ? "#fff" : "#000",
              borderTop: "2px solid #fff",
              borderLeft: "2px solid #fff",
              borderRight: "2px solid #808080",
              borderBottom:
                activeTab === t ? "2px solid #000080" : "2px solid #808080",
              cursor: "pointer",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            {t === "game"
              ? "🎯 Game"
              : t === "leaderboard"
              ? "🏆 Leaderboard"
              : "📊 My Stats"}
          </button>
        ))}
        <div
          style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}
        >
          {!ready ? null : authenticated && wallets.length ? (
            <div
              style={{
                background: "#000",
                color: "#00ff41",
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 10,
                padding: "2px 8px",
                borderTop: "2px solid #404040",
                borderLeft: "2px solid #404040",
                borderRight: "2px solid #c0c0c0",
                borderBottom: "2px solid #c0c0c0",
              }}
            >
              🔗 {shortAddr(wallets[0].address)}
            </div>
          ) : (
            <W98Btn
              onClick={login}
              style={{ fontSize: 10, padding: "2px 10px" }}
            >
              Connect Wallet
            </W98Btn>
          )}
        </div>
      </div>

      {/* ══ GAME TAB ══════════════════════════════════════════ */}
      {activeTab === "game" && (
        <>
          <div
            style={{
              display: "flex",
              gap: 5,
              marginBottom: 5,
              flexWrap: "wrap",
            }}
          >
            <HudBox label="SCORE" value={hudScore} />
            <HudBox label="BEST" value={hudBest} color="#ffd700" />
            <HudBox label="WAVE" value={hudWave} />
            <HudBox
              label="COMBO"
              value={`x${hudCombo}`}
              color={hudCombo >= 4 ? "#ff9900" : "#00ff41"}
            />
            <div style={{ marginLeft: "auto" }}>
              <HudBox
                label="AUTO-FIRE"
                value={`⚡ ${hudSpeed}`}
                color={
                  hudSpeed === "1s"
                    ? "#ff3333"
                    : hudSpeed === "2s"
                    ? "#ff9900"
                    : "#00ff41"
                }
              />
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <canvas
              ref={canvasRef}
              width={CW}
              height={CH}
              style={{
                display: "block",
                width: "100%",
                maxWidth: CW,
                borderTop: "2px solid #404040",
                borderLeft: "2px solid #404040",
                borderRight: "2px solid #fff",
                borderBottom: "2px solid #fff",
                cursor: isPlaying ? "none" : "pointer",
              }}
              onClick={() => {
                if (!isPlaying) startGame();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                if (!isPlaying) startGame();
              }}
            />

            {!isPlaying && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.84)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: 20,
                    fontWeight: 900,
                    color: isDead ? "#ff4444" : "#fff",
                    letterSpacing: 3,
                    textAlign: "center",
                    textShadow: isDead ? "0 0 12px #ff0000" : "0 0 8px #000080",
                  }}
                >
                  {isDead ? "☠ YOU HIT A STUGGY" : "🎯 STUGGIES SNIPER"}
                </div>

                {isDead ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#00ff41",
                      textAlign: "center",
                      lineHeight: 2,
                    }}
                  >
                    Score: <strong style={{ color: "#fff" }}>{hudScore}</strong>{" "}
                    &nbsp;|&nbsp; Best:{" "}
                    <strong style={{ color: "#ffd700" }}>{hudBest}</strong>
                    <br />
                    Wave: {hudWave} &nbsp;|&nbsp; Eliminated: {hudKilled}
                    <br />
                    <span style={{ color: "#ff4444" }}>
                      Never shoot the Stuggies!
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#00ff41",
                      textAlign: "center",
                      lineHeight: 2,
                    }}
                  >
                    Move cursor to aim · gun fires automatically
                    <br />
                    Eliminate BAD ACTORS 💀 · Spare STUGGIES 🐾
                    <br />
                    <span style={{ color: "#ff9900" }}>
                      Fire speeds up as kills increase ⚡
                    </span>
                    <br />
                    <span style={{ color: "#87ceeb" }}>
                      3s → 2s (5 kills) → 1s (15 kills)
                    </span>
                  </div>
                )}

                {saveStatus && (
                  <div
                    style={{
                      fontSize: 11,
                      color: saveStatus.startsWith("✅")
                        ? "#00ff41"
                        : saveStatus.startsWith("❌")
                        ? "#ff4444"
                        : "#ff9900",
                      textAlign: "center",
                      maxWidth: 340,
                    }}
                  >
                    {saveStatus}
                  </div>
                )}
                {wrongNetwork && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#ff4444",
                      textAlign: "center",
                    }}
                  >
                    ⚠ Please switch to MegaETH Testnet
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  {!authenticated ? (
                    <W98Btn onClick={login}>🔗 Connect Wallet to Play</W98Btn>
                  ) : (
                    <W98Btn onClick={startGame} disabled={isSaving}>
                      {isSaving
                        ? "💾 Saving…"
                        : isDead
                        ? "↩ RETRY MISSION"
                        : "▶ START MISSION"}
                    </W98Btn>
                  )}
                  {isDead && authenticated && !isSaving && (
                    <W98Btn onClick={saveGameOnChain}>💾 Save Score</W98Btn>
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              borderTop: "1px solid #808080",
              marginTop: 5,
              paddingTop: 3,
            }}
          >
            {[
              `Eliminated: ${hudKilled}`,
              `Stuggies saved: ${hudSaved}`,
              "MegaETH · 3,333 Stuggies",
            ].map((t, i) => (
              <div
                key={i}
                style={{
                  borderTop: "1px solid #404040",
                  borderLeft: "1px solid #404040",
                  borderRight: "1px solid #fff",
                  borderBottom: "1px solid #fff",
                  padding: "1px 8px",
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 10,
                  marginLeft: i === 2 ? "auto" : 0,
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══ LEADERBOARD TAB ════════════════════════════════════ */}
      {activeTab === "leaderboard" && (
        <div
          style={{
            background: "#000",
            border: "2px solid #404040",
            padding: 12,
            minHeight: 280,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span
              style={{ color: "#ffd700", fontSize: 13, fontWeight: "bold" }}
            >
              🏆 GLOBAL TOP 10
            </span>
            <span style={{ color: "#555", fontSize: 10 }}>
              {totalGames > 0 ? `${totalGames} games played` : ""}
            </span>
            <W98Btn
              onClick={fetchLeaderboard}
              disabled={lbLoading}
              style={{ fontSize: 10, padding: "2px 8px" }}
            >
              {lbLoading ? "…" : "↺ Refresh"}
            </W98Btn>
          </div>
          {lbLoading ? (
            <div
              style={{
                color: "#00ff41",
                fontSize: 12,
                textAlign: "center",
                paddingTop: 40,
              }}
            >
              Loading…
            </div>
          ) : leaderboard.length === 0 ? (
            <div
              style={{
                color: "#555",
                fontSize: 12,
                textAlign: "center",
                paddingTop: 40,
              }}
            >
              No scores yet — be the first!
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 11,
              }}
            >
              <thead>
                <tr style={{ color: "#555", textAlign: "left" }}>
                  <td style={{ padding: "3px 6px", width: 28 }}>#</td>
                  <td style={{ padding: "3px 6px" }}>Player</td>
                  <td style={{ padding: "3px 6px", textAlign: "right" }}>
                    Score
                  </td>
                  <td style={{ padding: "3px 6px", textAlign: "right" }}>
                    Wave
                  </td>
                  <td style={{ padding: "3px 6px", textAlign: "right" }}>
                    Date
                  </td>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((e, i) => {
                  const isMe =
                    wallets[0]?.address?.toLowerCase() ===
                    e.player.toLowerCase();
                  return (
                    <tr
                      key={i}
                      style={{
                        color:
                          i === 0
                            ? "#ffd700"
                            : i === 1
                            ? "#c0c0c0"
                            : i === 2
                            ? "#cd7f32"
                            : "#00ff41",
                        background: isMe
                          ? "rgba(0,255,65,0.08)"
                          : "transparent",
                        borderTop: "1px solid #111",
                      }}
                    >
                      <td style={{ padding: "4px 6px" }}>
                        {i === 0
                          ? "🥇"
                          : i === 1
                          ? "🥈"
                          : i === 2
                          ? "🥉"
                          : i + 1}
                      </td>
                      <td
                        style={{ padding: "4px 6px", fontFamily: "monospace" }}
                      >
                        {shortAddr(e.player)}
                        {isMe ? " 👈" : ""}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          fontWeight: "bold",
                        }}
                      >
                        {Number(e.score)}
                      </td>
                      <td style={{ padding: "4px 6px", textAlign: "right" }}>
                        {Number(e.wave)}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          color: "#555",
                          fontSize: 10,
                        }}
                      >
                        {formatTime(e.timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div
            style={{
              marginTop: 12,
              fontSize: 10,
              color: "#333",
              textAlign: "center",
            }}
          >
            Contract:{" "}
            <span style={{ color: "#555" }}>
              {CONTRACT_ADDRESS.slice(0, 10)}…
            </span>{" "}
            · MegaETH Testnet
          </div>
        </div>
      )}

      {/* ══ STATS TAB ══════════════════════════════════════════ */}
      {activeTab === "stats" && (
        <div
          style={{
            background: "#000",
            border: "2px solid #404040",
            padding: 12,
            minHeight: 280,
          }}
        >
          {!authenticated ? (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <div style={{ color: "#555", fontSize: 12, marginBottom: 12 }}>
                Connect your wallet to see your on-chain stats
              </div>
              <W98Btn onClick={login}>🔗 Connect Wallet</W98Btn>
            </div>
          ) : statsLoading ? (
            <div
              style={{
                color: "#00ff41",
                fontSize: 12,
                textAlign: "center",
                paddingTop: 60,
              }}
            >
              Loading…
            </div>
          ) : !playerStats || playerStats.gamesPlayed === 0n ? (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <div style={{ color: "#555", fontSize: 12, marginBottom: 12 }}>
                No games recorded on-chain yet
              </div>
              <div style={{ color: "#333", fontSize: 10 }}>
                Play and save a game to see your stats here
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  color: "#ffd700",
                  fontSize: 13,
                  fontWeight: "bold",
                  marginBottom: 12,
                }}
              >
                📊 ON-CHAIN STATS — {shortAddr(wallets[0]?.address ?? "")}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {[
                  {
                    label: "Best Score",
                    value: Number(playerStats.bestScore),
                    color: "#ffd700",
                  },
                  {
                    label: "Total Score",
                    value: Number(playerStats.totalScore),
                    color: "#00ff41",
                  },
                  {
                    label: "Games Played",
                    value: Number(playerStats.gamesPlayed),
                    color: "#87ceeb",
                  },
                  {
                    label: "Highest Wave",
                    value: Number(playerStats.highestWave),
                    color: "#ff9900",
                  },
                  {
                    label: "Total Kills",
                    value: Number(playerStats.totalKilled),
                    color: "#ff4444",
                  },
                  {
                    label: "Stuggies Saved",
                    value: Number(playerStats.totalSaved),
                    color: "#ffe066",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid #222",
                      padding: "8px 10px",
                    }}
                  >
                    <div
                      style={{ color: "#444", fontSize: 9, marginBottom: 2 }}
                    >
                      {label.toUpperCase()}
                    </div>
                    <div style={{ color, fontSize: 20, fontWeight: "bold" }}>
                      {value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  color: "#333",
                  fontSize: 10,
                  textAlign: "right",
                  marginTop: 4,
                }}
              >
                Last played: {formatTime(playerStats.lastPlayed)}
              </div>
              <div style={{ marginTop: 10 }}>
                <W98Btn
                  onClick={fetchPlayerStats}
                  disabled={statsLoading}
                  style={{ fontSize: 10 }}
                >
                  ↺ Refresh Stats
                </W98Btn>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
