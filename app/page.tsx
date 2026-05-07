"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTraitFarmer } from "./hooks/useTraitFarmer";

interface WinState {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  x: number;
  y: number;
}

const W98Btn = ({
  children,
  onClick,
  href,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) => {
  const base: React.CSSProperties = {
    padding: "3px 14px",
    fontFamily: "'Share Tech Mono', monospace",
    background: "#c0c0c0",
    cursor: disabled ? "default" : "pointer",
    whiteSpace: "nowrap" as const,
    textDecoration: "none",
    color: disabled ? "#808080" : "black",
    display: "inline-block",
    borderTop: disabled ? "2px solid #808080" : "2px solid #fff",
    borderLeft: disabled ? "2px solid #808080" : "2px solid #fff",
    borderRight: disabled ? "2px solid #fff" : "2px solid #808080",
    borderBottom: disabled ? "2px solid #fff" : "2px solid #808080",
  };
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={base}>
        {children}
      </a>
    );
  return (
    <button
      style={base}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

const Sunken = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      borderTop: "2px solid #808080",
      borderLeft: "2px solid #808080",
      borderRight: "2px solid #fff",
      borderBottom: "2px solid #fff",
      background: "white",
      padding: "3px 6px",
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 19,
      ...style,
    }}
  >
    {children}
  </div>
);

// ── Icon component (outside Home to avoid remount) ─────────────────────────
const Icon = ({ src, size = 48 }: { src: string; size?: number }) => (
  <img
    src={src}
    style={{
      width: size,
      height: size,
      objectFit: "contain",
      imageRendering: "pixelated",
    }}
    alt=""
  />
);

// ── GOOGLE FORM URL ───────────────────────────────────────────────────────
const GOOGLE_FORM_BASE =
  "https://docs.google.com/forms/d/e/1FAIpQLScJvNjr470KGKxXGjLmcsJEHd6YAqBMvhhO8r6ly9Ag9L7aRA/viewform?usp=pp_url&entry.1069278788=";

  const NFT_GALLERY = [
    { id: 1, name: "Stuggy #1", rarity: "Legendary", img: "https://i.ibb.co/Wv27WNnn/1.png" },
    { id: 2, name: "Stuggy #2", rarity: "Rare", img: "https://i.ibb.co/Nd3VS49F/2.png" },
    { id: 3, name: "Stuggy #3", rarity: "Epic", img: "https://i.ibb.co/qMkh7R40/3.png" },
    { id: 4, name: "Stuggy #4", rarity: "Common", img: "https://i.ibb.co/C5hL5H9z/4.png" },
    { id: 5, name: "Stuggy #5", rarity: "Rare", img: "https://i.ibb.co/0VXmz3VQ/5.png" },
    { id: 6, name: "Stuggy #7", rarity: "Legendary", img: "https://i.ibb.co/M5shyL4L/7.png" },
    { id: 7, name: "Stuggy #8", rarity: "Epic", img: "https://i.ibb.co/n45L6W9/8.png" },
    { id: 8, name: "Stuggy #9", rarity: "Common", img: "https://i.ibb.co/W4Zvxrch/9.png" },
    { id: 9, name: "Stuggy #10", rarity: "Rare", img: "https://i.ibb.co/wFJHq9DG/10.png" },
    { id: 10, name: "Stuggy #11", rarity: "Legendary", img: "https://i.ibb.co/HpbNg4N8/11.png" },
    { id: 11, name: "Stuggy #12", rarity: "Epic", img: "https://i.ibb.co/xtR0mDnX/12.png" },
    { id: 12, name: "Stuggy #13", rarity: "Common", img: "https://i.ibb.co/5xBB1xrn/13.png" },
    { id: 13, name: "Stuggy #14", rarity: "Rare", img: "https://i.ibb.co/svTbtTF3/14.png" },
    { id: 14, name: "Stuggy #15", rarity: "Legendary", img: "https://i.ibb.co/qMLmqsw6/15.png" },
    { id: 15, name: "Stuggy #16", rarity: "Epic", img: "https://i.ibb.co/q36qGCzh/16.png" },
    { id: 16, name: "Stuggy #17", rarity: "Common", img: "https://i.ibb.co/ZnBq8L9/17.png" },
    { id: 17, name: "Stuggy #22", rarity: "Rare", img: "https://i.ibb.co/FLPjqxST/22.png" },
    { id: 18, name: "Stuggy #32", rarity: "Legendary", img: "https://i.ibb.co/j9nFdBtw/32.png" },
    { id: 19, name: "Stuggy #55", rarity: "Epic", img: "https://i.ibb.co/SXmJxNMB/55.png" },
    { id: 20, name: "Stuggy #99", rarity: "Rare", img: "https://i.ibb.co/LWxzgTF/99.png" },
    { id: 21, name: "Stuggy #122", rarity: "Legendary", img: "https://i.ibb.co/DfL64Zpr/122.png" },
    { id: 22, name: "Stuggy #345", rarity: "Epic", img: "https://i.ibb.co/8Lrzs28B/1234.png" },
    { id: 23, name: "Stuggy #69", rarity: "Legendary", img: "https://i.ibb.co/tT9bbLxM/detteed.png" },
    { id: 24, name: "Stuggy #89", rarity: "Rare", img: "https://i.ibb.co/HDYKWnKH/dfdffdbdfbbdf.jpg" },
    { id: 25, name: "Stuggy #56", rarity: "Epic", img: "https://i.ibb.co/2YPkGYDB/errev.png" },
    { id: 26, name: "Stuggy #23", rarity: "Common", img: "https://i.ibb.co/J8pK3yq/fdbtrr.png" },
    { id: 27, name: "Stuggy #55", rarity: "Legendary", img: "https://i.ibb.co/pSyTfWC/gojo-gg.jpg" },
    { id: 28, name: "Stuggy #213", rarity: "Rare", img: "https://i.ibb.co/yn7rB3wQ/iuii.png" },
    { id: 29, name: "Stuggy #434", rarity: "Epic", img: "https://i.ibb.co/C3hWpcCM/kk34.jpg" },
  ];

const RARITY_COLOR: Record<string, string> = {
  Legendary: "#ffd700",
  Epic: "#9b59b6",
  Rare: "#000080",
  Common: "#555",
};

// ── Guardian Quest ────────────────────────────────────────────────────────
function QuestContent() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [postUrl, setPostUrl] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = () => {
    setLocalError("");
    if (!postUrl.trim()) { setLocalError("Paste your X post link first."); return; }
    if (!postUrl.startsWith("https://x.com/") && !postUrl.startsWith("https://twitter.com/")) {
      setLocalError("Must be an x.com or twitter.com link."); return;
    }
  
 
    const params = new URLSearchParams({
      usp: "pp_url",
      "entry.1069278788": postUrl.trim(),
    });
    window.open(
      `https://docs.google.com/forms/d/e/1FAIpQLScJvNjr470KGKxXGjLmcsJEHd6YAqBMvhhO8r6ly9Ag9L7aRA/viewform?${params.toString()}`,
      "_blank"
    );
 
    setPostUrl("");
  };

  return (
    <div
      style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 16,
        minWidth: 340,
        maxWidth: 420,
      }}
    >
      <div
        style={{
          background: "linear-gradient(90deg, #000080, #1084d0)",
          color: "white",
          padding: "8px 12px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 22 }}>🛡️</span>
        <div>
          <div
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: 18,
              letterSpacing: 2,
            }}
          >
            STUGGIES GUARDIAN QUEST
          </div>
          <div style={{ fontSize: 10, opacity: 0.85 }}></div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 14,
          alignItems: "center",
        }}
      >
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: step >= n ? "#000080" : "#c0c0c0",
                color: step >= n ? "white" : "#555",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: 11,
                border: step >= n ? "2px solid #000080" : "2px solid #808080",
              }}
            >
              {step > n ? "✓" : n}
            </div>
            {n < 3 && (
              <div
                style={{
                  width: 30,
                  height: 2,
                  background: step > n ? "#000080" : "#c0c0c0",
                }}
              />
            )}
          </div>
        ))}
        <span style={{ fontSize: 10, color: "#555", marginLeft: 6 }}>
          {step === 1 ? "Screenshot" : step === 2 ? "Post on X" : "Submitted!"}
        </span>
      </div>

      <div
        style={{
          marginBottom: 12,
          padding: "8px 10px",
          background: step === 1 ? "#e8f0ff" : "#f0f0f0",
          borderTop: "2px solid #808080",
          borderLeft: "2px solid #808080",
          borderRight: "2px solid #fff",
          borderBottom: "2px solid #fff",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>
          📸 Step 1 — Take a screenshot of stuggies NFT gallery
        </div>
        <p style={{ color: "#444", lineHeight: 1.6, margin: "0 0 8px" }}>
          Open the <strong>NFT Gallery</strong>, find the Stuggy you love most,
          and take a screenshot.
        </p>
        <W98Btn onClick={() => setStep(2)}>Got my screenshot →</W98Btn>
      </div>

      <div
        style={{
          marginBottom: 12,
          padding: "8px 10px",
          background: step === 2 ? "#e8f0ff" : step > 2 ? "#f0f0f0" : "#f8f8f8",
          borderTop: "2px solid #808080",
          borderLeft: "2px solid #808080",
          borderRight: "2px solid #fff",
          borderBottom: "2px solid #fff",
          opacity: step < 2 ? 0.5 : 1,
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>
          𝕏 Step 2 — Post it on X &amp; submit the link
        </div>
        <p style={{ color: "#444", lineHeight: 1.6, margin: "0 0 8px" }}>
          Tag{" "}
          <a
            href="https://x.com/TheStuggies"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#000080" }}
          >
            @TheStuggies
          </a>{" "}
          and use <strong>#StuggiesGuardian</strong>. Then paste your post link:
        </p>
        <input
          type="text"
          value={postUrl}
          onChange={(e) => {
            setPostUrl(e.target.value);
            setLocalError("");
          }}
          placeholder="https://x.com/yourhandle/status/..."
          disabled={step !== 2}
          style={{
            width: "100%",
            padding: "3px 6px",
            fontSize: 11,
            fontFamily: "'Tahoma', Arial, sans-serif",
            borderTop: "2px solid #808080",
            borderLeft: "2px solid #808080",
            borderRight: "2px solid #fff",
            borderBottom: "2px solid #fff",
            background: step === 2 ? "white" : "#e8e8e8",
            marginBottom: 6,
            boxSizing: "border-box" as const,
          }}
        />
        {localError && (
          <div style={{ color: "red", fontSize: 10, marginBottom: 6 }}>
            ⚠ {localError}
          </div>
        )}
        <W98Btn
          onClick={step === 2 ? handleSubmit : undefined}
          disabled={step !== 2}
        >
          Open Submission Form
        </W98Btn>
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 10,
          color: "#777",
          borderTop: "1px solid #ccc",
          paddingTop: 6,
        }}
      >
        Guardians get priority consideration for mint whitelist.
      </div>
    </div>
  );
}

// ── NFT Gallery ───────────────────────────────────────────────────────────
const CollectionContent = () => {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div style={{ fontFamily: "'Tahoma', Arial, sans-serif", fontSize: 12, width: "100%" }}>
      <div style={{ background: "linear-gradient(90deg, #000080, #1084d0)", color: "white", padding: "6px 10px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>🖼️</span>
        <div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 16, letterSpacing: 2 }}>STUGGIES NFT GALLERY</div>
          <div style={{ fontSize: 10, opacity: 0.85 }}>Take a screenshot - use it in the Guardian Quest!</div>
        </div>
      </div>

      <div
        style={{
          height: 420,
          overflowY: "auto",
          overflowX: "hidden",
          borderTop: "2px solid #808080",
          borderLeft: "2px solid #808080",
          borderRight: "2px solid #fff",
          borderBottom: "2px solid #fff",
          marginBottom: 8,
          padding: 6,
          background: "#f0f0f0",
        }}
      >
        <div
          style={{
            display: "grid",
            // 2 cols on mobile, 3 on wider screens
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 6,
          }}
        >
          {NFT_GALLERY.map((nft) => (
            <div
              key={nft.id}
              onMouseEnter={() => setHovered(nft.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: hovered === nft.id ? "#e8f0ff" : "white",
                borderTop: "2px solid #fff",
                borderLeft: "2px solid #fff",
                borderRight: "2px solid #808080",
                borderBottom: "2px solid #808080",
                padding: 4,
                textAlign: "center",
                cursor: "default",
                transition: "background 0.1s",
              }}
            >
              <img
                src={nft.img}
                alt={nft.name}
                style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block", marginBottom: 3 }}
              />
              <div style={{ fontWeight: "bold", fontSize: 9, color: "#000", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {nft.name}
              </div>
              <div style={{ fontSize: 8, fontWeight: "bold", color: RARITY_COLOR[nft.rarity] || "#555" }}>
                ★ {nft.rarity}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Sunken style={{ fontSize: 11, lineHeight: 1.6, color: "#333", padding: "6px 10px" }}>
        📸 <strong>Take a Screenshot</strong> then post on X with <strong>#StuggiesGuardian</strong>!
      </Sunken>
      <div style={{ marginTop: 6, fontSize: 10, color: "#777", borderTop: "1px solid #ccc", paddingTop: 5 }}>
        {NFT_GALLERY.length} Stuggies shown · 3,333 total · MegaETH
      </div>
    </div>
  );
};

// ── About (with Stopia lore) ───────────────────────────────────────────────
const AboutContent = () => (
  <div
    style={{
      fontFamily: "'Tahoma', Arial, sans-serif",
      fontSize: 12,
      maxWidth: 380,
    }}
  >
    <div
      style={{
        background: "linear-gradient(135deg, #000080, #1084d0)",
        color: "white",
        padding: "10px 14px",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: 20,
          letterSpacing: 2,
          marginBottom: 4,
        }}
      >
        🌌 WELCOME TO STOPIA
      </div>
      <p style={{ fontSize: 11, lineHeight: 1.7, margin: 0, opacity: 0.95 }}>
        The Stuggies are funny creatures from another world called{" "}
        <strong>Stopia</strong> a place where every Stuggy is born with a
        sparkle of mischief in their eyes. Legends say Stopia was formed when a
        thousand dreams collided in space, and out of the explosion came these
        small, round, colorful beings who could shape their world with emotions.
      </p>
    </div>

    <div
      style={{
        background: "#f8f8f0",
        borderTop: "2px solid #808080",
        borderLeft: "2px solid #808080",
        borderRight: "2px solid #fff",
        borderBottom: "2px solid #fff",
        padding: "8px 10px",
        marginBottom: 12,
        fontSize: 11,
        lineHeight: 1.7,
        color: "#333",
      }}
    >
      For centuries the Stuggies lived in harmony, powered by endless fun and
      creativity. But something began to change, the laughter that once echoed
      across Stopia started to fade. The skies dimmed. The confetti turned to
      dust.
      <br />
      <br />
      Stuggies had begun to forget why they laughed. They had everything they
      could imagine, yet felt something missing: <em>curiosity</em>. One brave
      Stuggy named <strong>Bloop</strong> believed the answer was hidden beyond
      Stopia, somewhere out there in the vast unknown. And so the journey
      began...
    </div>

    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 36, lineHeight: 1 }}>🐾</div>
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: "bold",
            fontFamily: "'VT323', monospace",
            letterSpacing: 1,
          }}
        >
          STUGGIES NFT
        </div>
        <p style={{ marginTop: 4, lineHeight: 1.5, color: "#333" }}>
          3,333 fully rigged 3D NFT characters coming to{" "}
          <strong style={{ color: "#000080" }}>MegaETH</strong>
        </p>
      </div>
    </div>

    <div
      style={{
        borderTop: "1px solid #808080",
        paddingTop: 8,
        display: "flex",
        gap: 8,
        flexWrap: "wrap" as const,
      }}
    >
      <W98Btn href="https://x.com/TheStuggies">𝕏 Twitter</W98Btn>
      <W98Btn href="https://discord.gg/UuRb2cJ3Zn">Discord</W98Btn>
    </div>
  </div>
);

// ── FAQ ───────────────────────────────────────────────────────────────────
const FAQContent = () => {
  const qs: [string, string][] = [
    [
      "What are Stuggies?",
      "3,333 fully rigged 3D NFT characters from Stopia, launching on MegaETH.",
    ],
    [
      "What is Stopia?",
      "The home world of the Stuggies — born from a thousand colliding dreams where emotions shape reality.",
    ],
    [
      "What is MegaETH?",
      "A real-time EVM chain with sub-millisecond latency and 100k+ TPS.",
    ],
    [
      "What is the Guardian Quest?",
      "Screenshot Stuggies, post it on X tagging @TheStuggies with #StuggiesGuardian, then submit your post link. Guardians get priority for the mint whitelist.",
    ],
    [
      "How do I participate?",
      "Open Guardian Quest, screenshot Stuggies from the NFT Gallery, post on X, paste your link, and submit.",
    ],
    ["What is the supply?", "Exactly 3,333 unique Stuggies will ever exist."],
    [
      "Where do I follow updates?",
      "Follow @TheStuggies on X and join the Discord.",
    ],
  ];
  return (
    <div
      style={{
        fontFamily: "'Tahoma', Arial, sans-serif",
        fontSize: 12,
        maxWidth: 360,
      }}
    >
      {qs.map(([q, a]) => (
        <div key={q} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: "bold", marginBottom: 2 }}>Q: {q}</div>
          <div style={{ color: "#333", paddingLeft: 8 }}>A: {a}</div>
        </div>
      ))}
    </div>
  );
};

// ── Icon type ─────────────────────────────────────────────────────────────
type IconDef = {
  id: string;
  label: string;
  emoji: React.ReactNode;
  href?: string;
  winConfig?: Omit<WinState, "x" | "y">;
};

// ── Draggable Window (mouse + touch) ─────────────────────────────────────
function DraggableWindow({
  win,
  onClose,
  zIndex,
  onFocus,
}: {
  win: WinState;
  onClose: (id: string) => void;
  zIndex: number;
  onFocus: (id: string) => void;
}) {
  const [pos, setPos] = useState({ x: win.x, y: win.y });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const startDrag = (clientX: number, clientY: number) => {
    dragging.current = true;
    offset.current = { x: clientX - pos.x, y: clientY - pos.y };
    onFocus(win.id);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, e.clientX - offset.current.x),
        y: Math.max(0, e.clientY - offset.current.y),
      });
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      const t = e.touches[0];
      setPos({
        x: Math.max(0, t.clientX - offset.current.x),
        y: Math.max(0, t.clientY - offset.current.y),
      });
    };
    const stop = () => {
      dragging.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  return (
    <div
    className="win-window"
    style={{
      left: pos.x,
      top: pos.y,
      zIndex,
      // Mobile: full width, desktop: auto
      width: "min(400px, 100vw)",
      maxWidth: "100vw",
      boxSizing: "border-box",
    }}
    onMouseDown={() => onFocus(win.id)}
  >
      <div
        className="win-titlebar"
        style={{ cursor: "move", touchAction: "none" }}
        onMouseDown={(e) => {
          startDrag(e.clientX, e.clientY);
          e.preventDefault();
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          startDrag(t.clientX, t.clientY);
        }}
      >
        <span className="win-titlebar-icon">{win.icon}</span>
        <span className="win-titlebar-title">{win.title}</span>
        <button className="win-btn">_</button>
        <button className="win-btn">□</button>
        <button
          className="win-btn"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={() => onClose(win.id)}
        >
          ✕
        </button>
      </div>
      <div className="win-menubar">
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Help</span>
      </div>
      <div className="win-content">{win.content}</div>
    </div>
  );
}

// ── Wallet Button ─────────────────────────────────────────────────────────
function WalletButton() {
  const {
    isConnected,
    address,
    connect,
    disconnect,
    ready,
    isWrongNetwork,
    switchToMegaETH,
  } = useTraitFarmer();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState<string>("...");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!address || !isConnected) return;
    fetch("https://carrot.megaeth.com/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        const eth = Number(BigInt(d.result)) / 1e18;
        setBalance(eth.toFixed(4) + " ETH");
      })
      .catch(() => setBalance("— ETH"));
  }, [address, isConnected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!ready) return null;

  if (!isConnected) {
    return (
      <button
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 18px",
          fontSize: 15,
          fontFamily: "'Tahoma', Arial, sans-serif",
          fontWeight: "bold",
          background: "#c0c0c0",
          cursor: "pointer",
          color: "black",
          whiteSpace: "nowrap",
          borderTop: "2px solid #fff",
          borderLeft: "2px solid #fff",
          borderRight: "2px solid #808080",
          borderBottom: "2px solid #808080",
        }}
        onClick={connect}
      >
        Connect Wallet
      </button>
    );
  }

  const menuItem: React.CSSProperties = {
    padding: "8px 16px",
    fontSize: 14,
    fontFamily: "'Tahoma', Arial, sans-serif",
    fontWeight: "bold",
    cursor: "pointer",
    color: "black",
    display: "block",
    width: "100%",
    textAlign: "left" as const,
    background: "transparent",
    border: "none",
    whiteSpace: "nowrap",
  };
  const hoverOn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "#000080";
    e.currentTarget.style.color = "white";
  };
  const hoverOff = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.color = "black";
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 2px)",
            left: 0,
            background: "#c0c0c0",
            borderTop: "2px solid #fff",
            borderLeft: "2px solid #fff",
            borderRight: "2px solid #404040",
            borderBottom: "2px solid #404040",
            boxShadow: "3px 3px 0 #404040",
            minWidth: 240,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "linear-gradient(90deg, #000080, #1084d0)",
              color: "white",
              padding: "5px 10px",
              fontSize: 14,
              fontWeight: "bold",
              fontFamily: "'Tahoma', Arial, sans-serif",
            }}
          >
            Wallet Info
          </div>
          <div style={{ padding: "10px 16px 6px", background: "#d4d0c8" }}>
            <div
              style={{
                fontSize: 13,
                fontFamily: "'Tahoma', Arial, sans-serif",
                fontWeight: "bold",
                color: "#333",
                marginBottom: 5,
              }}
            >
              Address: {address!.slice(0, 6)}...{address!.slice(-4)}
            </div>
            <div
              style={{
                fontSize: 13,
                fontFamily: "'Tahoma', Arial, sans-serif",
                fontWeight: "bold",
                marginBottom: 5,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
       
   
            </div>
            <div
              style={{
                fontSize: 13,
                fontFamily: "'Tahoma', Arial, sans-serif",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              Balance: {isWrongNetwork ? "—" : balance}
            </div>
          </div>
          <div
            style={{
              height: 1,
              background: "#808080",
              borderBottom: "1px solid #fff",
              margin: "2px 0",
            }}
          />

          <button
            style={menuItem}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
            onClick={() => {
              setOpen(false);
              window.open(
                "https://megaeth-testnet-v2.blockscout.com/address/" + address,
                "_blank"
              );
            }}
          >
            View on Explorer
          </button>
          <div
            style={{
              height: 1,
              background: "#808080",
              borderBottom: "1px solid #fff",
              margin: "2px 0",
            }}
          />
          <button
            style={menuItem}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 18px",
          fontSize: 19,
          fontFamily: "'Tahoma', Arial, sans-serif",
          fontWeight: "bold",
          background: "#c0c0c0",
          cursor: "pointer",
          color: isWrongNetwork ? "#cc0000" : "black",
          whiteSpace: "nowrap",
          borderTop: open ? "2px solid #808080" : "2px solid #fff",
          borderLeft: open ? "2px solid #808080" : "2px solid #fff",
          borderRight: open ? "2px solid #fff" : "2px solid #808080",
          borderBottom: open ? "2px solid #fff" : "2px solid #808080",
        }}
      >
        {isWrongNetwork ? "⚠" : "🟢"} {address!.slice(0, 6)}...
        {address!.slice(-4)}
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Home() {
  const [clock, setClock] = useState("");
  const [wins, setWins] = useState<WinState[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [zMap, setZMap] = useState<Record<string, number>>({});
  const zCounter = useRef(100);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  const bringToFront = useCallback((id: string) => {
    zCounter.current += 1;
    setZMap((prev) => ({ ...prev, [id]: zCounter.current }));
  }, []);

  const openWin = useCallback(
    (cfg: Omit<WinState, "x" | "y">, x = 40, y = 40) => {
      setWins((prev) => {
        if (prev.find((w) => w.id === cfg.id)) {
          bringToFront(cfg.id);
          return prev;
        }
        return [...prev, { ...cfg, x, y }];
      });
      zCounter.current += 1;
      setZMap((prev) => ({ ...prev, [cfg.id]: zCounter.current }));
    },
    [bringToFront]
  );

  const closeWin = (id: string) =>
    setWins((prev) => prev.filter((w) => w.id !== id));

  const icons: IconDef[] = [
    {
      id: "quest",
      label: "Guardian Quest",
      emoji: <Icon src="/game.png" size={68} />,
      winConfig: {
        id: "quest",
        title: "Stuggies Guardian Quest",
        icon: <Icon src="/game.png" size={40} />,
        content: <QuestContent />,
      },
    },
    {
      id: "collection",
      label: "NFT Gallery",
      emoji: <Icon src="/camera.webp" size={68} />,
      winConfig: {
        id: "collection",
        title: "Stuggies NFT Gallery",
        icon: <Icon src="/camera.webp" size={20} />,
        content: <CollectionContent />,
      },
    },
    {
      id: "about",
      label: "About",
      emoji: <Icon src="/search-removebg-preview.png" size={68} />,
      winConfig: {
        id: "about",
        title: "About Stuggies",
        icon: <Icon src="/search-removebg-preview.png" size={20} />,
        content: <AboutContent />,
      },
    },
    {
      id: "twitter",
      label: "Twitter / X",
      emoji: "𝕏",
      href: "https://x.com/TheStuggies",
    },
    {
      id: "discord",
      label: "Discord",
      emoji: <Icon src="/discord-removebg-preview.png" size={40} />,
      href: "https://discord.gg/UuRb2cJ3Zn",
    },
  ];

  const offsets: [number, number][] = [
    [40, 40],
    [80, 60],
    [60, 100],
    [100, 40],
    [50, 80],
  ];

  return (
    <>
      <div className="desktop" onClick={() => setSel(null)}>
        <div
          className="desktop-bg"
          style={{ position: "absolute", inset: 0, overflow: "hidden" }}
        >
          <img
            src="/dd.0184.jpeg"
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              transform: "scale(1.346)",
            }}
          />
        </div>

        <div className="desktop-icons" onClick={(e) => e.stopPropagation()}>
          {icons.map((icon, i) => {
            const [ox, oy] = offsets[i % offsets.length];
            const handleActivate = () => {
              setSel(icon.id);
              if (icon.href) {
                window.open(icon.href, "_blank");
                return;
              }
              if (icon.winConfig) openWin(icon.winConfig, ox, oy);
            };
            return (
              <div
                key={icon.id}
                className={`desktop-icon${sel === icon.id ? " active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleActivate();
                }}
              >
                <span className="desktop-icon-img">{icon.emoji}</span>
                <span className="label">{icon.label}</span>
              </div>
            );
          })}
        </div>

        {/* Draggable + touch-moveable windows */}
        {wins.map((win) => (
          <DraggableWindow
            key={win.id}
            win={win}
            onClose={closeWin}
            zIndex={zMap[win.id] || 100}
            onFocus={bringToFront}
          />
        ))}
      </div>

      <div className="taskbar">
        <div className="taskbar-divider" />
        {wins.map((win) => (
          <button
            key={win.id}
            className="taskbar-win-btn"
            onClick={() => bringToFront(win.id)}
          >
            <span>{win.icon}</span>
 
          </button>
        ))}
        <WalletButton />
        <div className="taskbar-clock">{clock}</div>
      </div>
    </>
  );
}
