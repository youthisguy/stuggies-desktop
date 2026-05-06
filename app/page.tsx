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
    fontSize: 11,
    fontFamily: "'Tahoma', Arial, sans-serif",
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
      fontFamily: "'Tahoma', Arial, sans-serif",
      fontSize: 11,
      ...style,
    }}
  >
    {children}
  </div>
);

// ── GOOGLE FORM URL — replace with your actual form link ──────────────────
// The form should accept a "X Post Link" field.
// To pre-fill the URL into the form, map your field entry ID below.
// e.g. https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform?usp=pp_url&entry.123456789=POSTURL
const GOOGLE_FORM_BASE =
  "https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform?usp=pp_url&entry.YOUR_ENTRY_ID=";

// ── Guardian Quest Window ─────────────────────────────────────────────────
function QuestContent() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [postUrl, setPostUrl] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = () => {
    setLocalError("");
    if (!postUrl.trim()) {
      setLocalError("Paste your X post link first.");
      return;
    }
    if (
      !postUrl.startsWith("https://x.com/") &&
      !postUrl.startsWith("https://twitter.com/")
    ) {
      setLocalError("Must be an x.com or twitter.com link.");
      return;
    }
    // Redirect to Google Form with the URL pre-filled
    const target = GOOGLE_FORM_BASE + encodeURIComponent(postUrl.trim());
    window.open(target, "_blank");
    setStep(3);
  };

  return (
    <div
      style={{
        fontFamily: "'Tahoma', Arial, sans-serif",
        fontSize: 12,
        minWidth: 340,
        maxWidth: 420,
      }}
    >
      {/* Header */}
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
          <div style={{ fontSize: 10, opacity: 0.85 }}>
            choose your favorite Stuggy
          </div>
        </div>
      </div>

      {/* Step indicators */}
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
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
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
          {step === 1
            ? "Screenshot"
            : step === 2
            ? "Post on X"
            : "Submitted!"}
        </span>
      </div>

      {/* Step 1 */}
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
          📸 Step 1 — Screenshot your favorite Stuggy
        </div>
        <p style={{ color: "#444", lineHeight: 1.6, margin: "0 0 8px" }}>
          Open the <strong>Collection</strong> gallery, find the Stuggy you love
          most, and take a screenshot. Make it your own — crop it, frame it,
          show your style.
        </p>
        <W98Btn onClick={() => setStep(2)}>Got my screenshot →</W98Btn>
      </div>

      {/* Step 2 */}
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
          Post your screenshot on X (Twitter) — tag{" "}
          <a
            href="https://x.com/TheStuggies"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#000080" }}
          >
            @TheStuggies
          </a>{" "}
          and use <strong>#StuggiesGuardian</strong>. Then paste your post link
          below:
        </p>
        <input
          type="text"
          value={postUrl}
          onChange={(e) => {
            setPostUrl(e.target.value);
            setLocalError("");
          }}
          placeholder="https://x.com/yourhandle/status/..."
          disabled={step < 2 || step > 2}
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
        <W98Btn onClick={step === 2 ? handleSubmit : undefined} disabled={step !== 2}>
          Submit to Guardian Registry →
        </W98Btn>
      </div>

      {/* Step 3 — Success */}
      {step === 3 && (
        <div
          style={{
            padding: "10px 12px",
            background: "#e8ffe8",
            borderTop: "2px solid #808080",
            borderLeft: "2px solid #808080",
            borderRight: "2px solid #fff",
            borderBottom: "2px solid #fff",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 4 }}>🏆</div>
          <div
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: 16,
              color: "#006600",
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            GUARDIAN QUEST SUBMITTED!
          </div>
          <p style={{ color: "#444", fontSize: 11, lineHeight: 1.5, margin: 0 }}>
            Your entry has been logged. The Stuggies team will review and verify
            your Guardian status. Follow{" "}
            <a
              href="https://x.com/TheStuggies"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#000080" }}
            >
              @TheStuggies
            </a>{" "}
            for updates.
          </p>
        </div>
      )}

      {/* Footer note */}
      <div
        style={{
          marginTop: 10,
          fontSize: 10,
          color: "#777",
          borderTop: "1px solid #ccc",
          paddingTop: 6,
        }}
      >
        🛡️ Guardians get priority consideration for mint whitelist. One
        submission per wallet address.
      </div>
    </div>
  );
}

// ── NFT Gallery (Collection) ───────────────────────────────────────────────
// Replace the placeholder URLs below with real Stuggies NFT image URLs.
const NFT_GALLERY = [
  {
    id: 1,
    name: "Stuggy #001",
    rarity: "Legendary",
    img: "https://placehold.co/120x120/1a1a2e/ffffff?text=Stuggy+%231",
  },
  {
    id: 2,
    name: "Stuggy #042",
    rarity: "Rare",
    img: "https://placehold.co/120x120/16213e/00ff88?text=Stuggy+%2342",
  },
  {
    id: 3,
    name: "Stuggy #077",
    rarity: "Epic",
    img: "https://placehold.co/120x120/0f3460/ffcc00?text=Stuggy+%2377",
  },
  {
    id: 4,
    name: "Stuggy #128",
    rarity: "Common",
    img: "https://placehold.co/120x120/533483/ffffff?text=Stuggy+%23128",
  },
  {
    id: 5,
    name: "Stuggy #256",
    rarity: "Rare",
    img: "https://placehold.co/120x120/2b2d42/ef233c?text=Stuggy+%23256",
  },
  {
    id: 6,
    name: "Stuggy #333",
    rarity: "Legendary",
    img: "https://placehold.co/120x120/000080/00ffff?text=Stuggy+%23333",
  },
  {
    id: 7,
    name: "Stuggy #512",
    rarity: "Epic",
    img: "https://placehold.co/120x120/4a0e8f/ffffff?text=Stuggy+%23512",
  },
  {
    id: 8,
    name: "Stuggy #777",
    rarity: "Legendary",
    img: "https://placehold.co/120x120/003366/ffd700?text=Stuggy+%23777",
  },
  {
    id: 9,
    name: "Stuggy #999",
    rarity: "Common",
    img: "https://placehold.co/120x120/2d6a4f/ffffff?text=Stuggy+%23999",
  },
];

const RARITY_COLOR: Record<string, string> = {
  Legendary: "#ffd700",
  Epic: "#9b59b6",
  Rare: "#000080",
  Common: "#555",
};

const CollectionContent = () => {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div
      style={{
        fontFamily: "'Tahoma', Arial, sans-serif",
        fontSize: 12,
        minWidth: 380,
        maxWidth: 460,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(90deg, #000080, #1084d0)",
          color: "white",
          padding: "6px 10px",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>🖼️</span>
        <div>
          <div
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: 16,
              letterSpacing: 2,
            }}
          >
            STUGGIES NFT GALLERY
          </div>
          <div style={{ fontSize: 10, opacity: 0.85 }}>
            Screenshot your favorite — use it in the Guardian Quest!
          </div>
        </div>
      </div>

      {/* Gallery grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginBottom: 10,
        }}
      >
        {NFT_GALLERY.map((nft) => (
          <div
            key={nft.id}
            onMouseEnter={() => setHovered(nft.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: hovered === nft.id ? "#e8f0ff" : "#f0f0f0",
              borderTop: "2px solid #fff",
              borderLeft: "2px solid #fff",
              borderRight: "2px solid #808080",
              borderBottom: "2px solid #808080",
              padding: 6,
              textAlign: "center",
              cursor: "default",
              transition: "background 0.1s",
            }}
          >
            <img
              src={nft.img}
              alt={nft.name}
              style={{
                width: "100%",
                aspectRatio: "1/1",
                objectFit: "cover",
                display: "block",
                marginBottom: 4,
                imageRendering: "pixelated",
              }}
            />
            <div
              style={{
                fontWeight: "bold",
                fontSize: 10,
                color: "#000",
                marginBottom: 2,
              }}
            >
              {nft.name}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: "bold",
                color: RARITY_COLOR[nft.rarity] || "#555",
              }}
            >
              ★ {nft.rarity}
            </div>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <Sunken
        style={{
          fontSize: 11,
          lineHeight: 1.6,
          color: "#333",
          padding: "6px 10px",
        }}
      >
        📸 <strong>How to screenshot:</strong> Right-click any Stuggy →
        &quot;Save image&quot;, or use your OS screenshot tool. Then head to the{" "}
        <strong>Guardian Quest</strong> window and post it on X!
      </Sunken>

      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: "#777",
          borderTop: "1px solid #ccc",
          paddingTop: 5,
        }}
      >
        3,333 unique Stuggies · MegaETH · More NFTs revealed soon
      </div>
    </div>
  );
};

// ── About ─────────────────────────────────────────────────────────────────
const AboutContent = () => (
  <div style={{ fontFamily: "'Tahoma', Arial, sans-serif", fontSize: 12 }}>
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 48, lineHeight: 1 }}>🐾</div>
      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: "bold",
            fontFamily: "'VT323', monospace",
            letterSpacing: 1,
          }}
        >
          STUGGIES
        </div>
        <p style={{ marginTop: 4, lineHeight: 1.5, maxWidth: 260 }}>
          3,333 fully rigged 3D NFT characters coming to{" "}
          <strong style={{ color: "#000080" }}>MegaETH</strong> — real-time
          Ethereum with sub-millisecond latency.
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
      "3,333 fully rigged 3D NFT characters launching on MegaETH.",
    ],
    [
      "What is MegaETH?",
      "A real-time EVM chain with sub-millisecond latency and 100k+ TPS.",
    ],
    [
      "What is the Guardian Quest?",
      "Screenshot your favorite Stuggy from the gallery, post it on X tagging @TheStuggies with #StuggiesGuardian, then submit your post link. Guardians get priority consideration for the mint whitelist.",
    ],
    [
      "How do I participate?",
      "Open the Guardian Quest window, take a screenshot from the Collection gallery, post on X, paste your link, and submit. That's it!",
    ],
    ["What is the supply?", "Exactly 3,333 unique Stuggies will ever exist."],
    [
      "Where do I follow updates?",
      "Follow @TheStuggies on X and join the Discord community.",
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

// ── Icon config ────────────────────────────────────────────────────────────
type IconDef = {
  id: string;
  label: string;
  emoji: any;
  href?: string;
  winConfig?: any;
};


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
    fetch(`https://carrot.megaeth.com/rpc`, {
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
        const wei = BigInt(d.result);
        const eth = Number(wei) / 1e18;
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
          {/* Title */}
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

          {/* Info rows */}
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
              <span style={{ color: "#333" }}>Network:</span>
              {isWrongNetwork ? (
                <span style={{ color: "#cc0000" }}>Wrong Network ⚠</span>
              ) : (
                <span style={{ color: "#008000" }}>MegaETH</span>
              )}
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

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "#808080",
              borderBottom: "1px solid #fff",
              margin: "2px 0",
            }}
          />

          {/* Switch Network — shown always, highlighted in red when wrong */}
          <button
            style={{
              ...menuItem,
              color: isWrongNetwork ? "#cc0000" : "black",
              fontWeight: isWrongNetwork ? "bold" : "bold",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#000080";
              e.currentTarget.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = isWrongNetwork
                ? "#cc0000"
                : "black";
            }}
            onClick={() => {
              setOpen(false);
              switchToMegaETH();
            }}
          >
            {isWrongNetwork ? "⚠ Switch to MegaETH" : "Switch Network"}
          </button>

          {/* View on Explorer */}
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

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "#808080",
              borderBottom: "1px solid #fff",
              margin: "2px 0",
            }}
          />

          {/* Disconnect */}
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

      {/* Taskbar button — red tint when wrong network */}
      <button
        onClick={() => setOpen((o) => !o)}
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

const Icon = ({ src, size = 32 }: { src: string; size?: number }) => (
  <img
    src={src}
    style={{ width: size, height: size, objectFit: "contain" }}
    alt=""
  />
);

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Home() {
  const [clock, setClock] = useState("");
  const [wins, setWins] = useState<WinState[]>([]);
  const [sel, setSel] = useState<string | null>(null);

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

  const openWin = useCallback(
    (cfg: Omit<WinState, "x" | "y">, x = 130, y = 60) => {
      setWins((prev) => {
        if (prev.find((w) => w.id === cfg.id)) return prev;
        return [...prev, { ...cfg, x, y }];
      });
    },
    []
  );

  const closeWin = (id: string) =>
    setWins((prev) => prev.filter((w) => w.id !== id));


  
  const icons: IconDef[] = [
    {
      id: "quest",
      label: "Guardian Quest",
      emoji: <Icon src="/fwindoes_folder.png" size={68} />,
      winConfig: {
        id: "quest",
        title: "Stuggies Guardian Quest",
        icon: <Icon src="/fwindoes_folder.png" size={40} />,
        content: <QuestContent />,
      },
    },
    {
      id: "collection",
      label: "NFT Gallery",
      emoji: <Icon src="/b_windows_images.png" size={68} />,
      winConfig: {
        id: "collection",
        title: "Stuggies NFT Gallery",
        icon: <Icon src="/b_windows_images.png" size={60} />,
        content: <CollectionContent />,
      },
    },
    {
      id: "about",
      label: "About",
      emoji: <Icon src="/profile.png" size={68} />,
      winConfig: {
        id: "about",
        title: "About Stuggies",
        icon: <Icon src="/profile.png" size={60} />,
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
      emoji: <Icon src="/discord-removebg-preview.png" size={58} />,
      href: "https://discord.gg/UuRb2cJ3Zn",
    },
  ];

  const offsets: [number, number][] = [
    [100, 50],
    [160, 80],
    [130, 110],
    [180, 60],
    [110, 90],
    [150, 120],
  ];

  return (
    <>
      <div className="desktop" onClick={() => setSel(null)}>
        <div className="desktop-bg" />
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

        {wins.map((win) => (
          <div
            key={win.id}
            className="win-window"
            style={{ left: win.x, top: win.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="win-titlebar">
              <span className="win-titlebar-icon">{win.icon}</span>
              <span className="win-titlebar-title">{win.title}</span>
              <button className="win-btn">_</button>
              <button className="win-btn">□</button>
              <button className="win-btn" onClick={() => closeWin(win.id)}>
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
        ))}
      </div>

      <div className="taskbar">
        <div className="taskbar-divider" />
        {wins.map((win) => (
          <button
            key={win.id}
            className="taskbar-win-btn"
            onClick={() => closeWin(win.id)}
          >
            <span>{win.icon}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {win.title}
            </span>
          </button>
        ))}
        <WalletButton />
        <div className="taskbar-clock">{clock}</div>
      </div>
    </>
  );
}