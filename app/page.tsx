"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTraitFarmer } from "./hooks/useTraitFarmer";

interface WinState {
  id: string;
  title: string;
  icon: string;
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

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s
    .toString()
    .padStart(2, "0")}s`;
}

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── Static Window Contents ─────────────────────────────────────────────────

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
      <W98Btn href="https://megaeth.com">MegaETH</W98Btn>
    </div>
  </div>
);

const RoadmapContent = () => {
  const items = [
    {
      icon: "✅",
      phase: "Phase 1",
      desc: "Project announcement & Twitter launch",
      done: true,
    },
    {
      icon: "✅",
      phase: "Phase 2",
      desc: "Discord community opens",
      done: true,
    },
    {
      icon: "🔄",
      phase: "Phase 3",
      desc: "3D character reveals & trait previews",
      done: false,
    },
    {
      icon: "⬜",
      phase: "Phase 4",
      desc: "Trait farming — claim every 5 hours",
      done: false,
    },
    {
      icon: "⬜",
      phase: "Phase 5",
      desc: "Whitelist reservation & mint on MegaETH",
      done: false,
    },
    {
      icon: "⬜",
      phase: "Phase 6",
      desc: "Full 3,333 collection launch",
      done: false,
    },
  ];
  return (
    <div
      style={{
        fontFamily: "'Tahoma', Arial, sans-serif",
        fontSize: 12,
        minWidth: 300,
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 8, fontSize: 13 }}>
        📍 Stuggies Roadmap
      </div>
      {items.map(({ icon, phase, desc, done }) => (
        <div
          key={phase}
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 6,
            alignItems: "flex-start",
          }}
        >
          <span style={{ flexShrink: 0 }}>{icon}</span>
          <span
            style={{
              color: done ? "#000080" : "#666",
              minWidth: 64,
              fontWeight: done ? "bold" : "normal",
            }}
          >
            {phase}
          </span>
          <span style={{ color: done ? "#000" : "#444" }}>{desc}</span>
        </div>
      ))}
    </div>
  );
};

const FAQContent = () => {
  const qs = [
    [
      "What are Stuggies?",
      "3,333 fully rigged 3D NFT characters launching on MegaETH.",
    ],
    [
      "What is MegaETH?",
      "A real-time EVM chain with sub-millisecond latency and 100k+ TPS.",
    ],
    [
      "How do I farm traits?",
      "Connect wallet, post about Stuggies on X, submit your post link. Claim once every 5 hours. Get 9 verified traits to reserve your NFT.",
    ],
    [
      "What is trait farming?",
      "You claim a trait every 5 hours by posting on X. Once verified by the team, it counts toward your reservation.",
    ],
    ["What is the supply?", "Exactly 3,333 unique Stuggies will ever exist."],
  ];
  return (
    <div
      style={{
        fontFamily: "'Tahoma', Arial, sans-serif",
        fontSize: 12,
        maxWidth: 340,
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

const CollectionContent = () => {
  const traits = [
    { name: "Backgrounds", count: "24 types" },
    { name: "Body Types", count: "Fully rigged 3D" },
    { name: "Outfits", count: "100+" },
    { name: "Accessories", count: "200+" },
    { name: "Expressions", count: "Shape keys" },
    { name: "Total Supply", count: "3,333" },
  ];
  return (
    <div style={{ fontFamily: "'Tahoma', Arial, sans-serif", fontSize: 12 }}>
      <div style={{ fontWeight: "bold", marginBottom: 8, fontSize: 13 }}>
        🎨 Collection Details
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse" as const,
          marginBottom: 10,
        }}
      >
        <thead>
          <tr style={{ background: "#000080", color: "white" }}>
            <th style={{ padding: "3px 8px", textAlign: "left" as const }}>
              Trait
            </th>
            <th style={{ padding: "3px 8px", textAlign: "left" as const }}>
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {traits.map(({ name, count }, i) => (
            <tr
              key={name}
              style={{ background: i % 2 === 0 ? "#e8e8e8" : "white" }}
            >
              <td style={{ padding: "3px 8px" }}>{name}</td>
              <td
                style={{
                  padding: "3px 8px",
                  color: "#000080",
                  fontWeight: "bold",
                }}
              >
                {count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TeamContent = () => (
  <div style={{ fontFamily: "'Tahoma', Arial, sans-serif", fontSize: 12 }}>
    <div style={{ fontWeight: "bold", marginBottom: 8, fontSize: 13 }}>
      👥 The Team
    </div>
    {[
      { role: "Founder", handle: "@TheStuggies", emoji: "🐾" },
      { role: "3D Artists", handle: "Anonymous crew", emoji: "🎨" },
      { role: "Devs", handle: "MegaETH builders", emoji: "⚡" },
      { role: "Community", handle: "Discord fam", emoji: "🏘️" },
    ].map(({ role, handle, emoji }) => (
      <div
        key={role}
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 8,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 22 }}>{emoji}</span>
        <div>
          <div style={{ fontWeight: "bold" }}>{role}</div>
          <div style={{ color: "#555" }}>{handle}</div>
        </div>
      </div>
    ))}
    <div style={{ borderTop: "1px solid #aaa", paddingTop: 8, marginTop: 4 }}>
      <W98Btn href="https://x.com/TheStuggies">See updates on 𝕏</W98Btn>
    </div>
  </div>
);

const LinksContent = () => (
  <div style={{ fontFamily: "'Tahoma', Arial, sans-serif", fontSize: 12 }}>
    <div style={{ fontWeight: "bold", marginBottom: 10, fontSize: 13 }}>
      🔗 Official Links
    </div>
    {[
      {
        label: "𝕏  Twitter / X",
        url: "https://x.com/TheStuggies",
        desc: "Latest news & announcements",
      },
      {
        label: "💬 Discord",
        url: "https://discord.gg/UuRb2cJ3Zn",
        desc: "Join the community",
      },
      {
        label: "⚡ MegaETH",
        url: "https://megaeth.com",
        desc: "The chain we're building on",
      },
      {
        label: "📄 Medium Blog",
        url: "https://medium.com/@thestuggies1",
        desc: "Long-form project updates",
      },
    ].map(({ label, url, desc }) => (
      <div key={url} style={{ marginBottom: 10 }}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontWeight: "bold",
            color: "#000080",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          {label}
        </a>
        <div style={{ color: "#555", fontSize: 11 }}>{desc}</div>
      </div>
    ))}
  </div>
);

// ── Farm Window (live contract interaction) ────────────────────────────────

function FarmContent() {
  const {
    isConnected,
    address,
    connect,
    cooldownRemaining,
    totalClaimCount,
    verifiedClaims,
    reservedTokenId,
    reservationsOpen,
    requiredCount,
    totalReserved,
    claimTrait,
    isClaimPending,
    isClaimSuccess,
    claimError,
    resetClaim,
    refetchStatus,
  } = useTraitFarmer();

  const [postUrl, setPostUrl] = useState("");
  const [countdown, setCountdown] = useState(cooldownRemaining);
  const [localError, setLocalError] = useState("");

  // Live countdown ticker
  useEffect(() => {
    setCountdown(cooldownRemaining);
  }, [cooldownRemaining]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  // Refresh status after successful claim
  useEffect(() => {
    if (isClaimSuccess) {
      setPostUrl("");
      resetClaim();
      refetchStatus();
    }
  }, [isClaimSuccess, resetClaim, refetchStatus]);

  const handleClaim = () => {
    setLocalError("");
    if (!postUrl.trim()) {
      setLocalError("Paste your X post URL first.");
      return;
    }
    if (
      !postUrl.startsWith("https://x.com/") &&
      !postUrl.startsWith("https://twitter.com/")
    ) {
      setLocalError("Must be an x.com or twitter.com link.");
      return;
    }
    claimTrait(postUrl.trim());
  };

  const canClaim = countdown === 0 && isConnected;
  const progressPct = Math.min(
    100,
    Math.round((verifiedClaims / requiredCount) * 100)
  );

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div
        style={{
          fontFamily: "'Tahoma', Arial, sans-serif",
          fontSize: 12,
          textAlign: "center",
          minWidth: 280,
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>🌾</div>
        <div
          style={{
            fontWeight: "bold",
            fontSize: 14,
            marginBottom: 6,
            fontFamily: "'VT323', monospace",
            letterSpacing: 1,
          }}
        >
          CLAIM TRAITS
        </div>
        <p style={{ color: "#555", marginBottom: 14, lineHeight: 1.5 }}>
          Connect your wallet to claim your stuggies traits. Post on X every 5
          hours, get verified, reserve your Stuggy.
        </p>
        <W98Btn onClick={connect}>Connect Wallet</W98Btn>
      </div>
    );
  }

  // ── Reserved ───────────────────────────────────────────────────────────────
  if (reservedTokenId > 0) {
    return (
      <div
        style={{
          fontFamily: "'Tahoma', Arial, sans-serif",
          fontSize: 12,
          minWidth: 300,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 36 }}>🎟️</div>
          <div
            style={{
              fontWeight: "bold",
              fontSize: 14,
              fontFamily: "'VT323', monospace",
              letterSpacing: 1,
            }}
          >
            NFT RESERVED
          </div>
        </div>
        <Sunken style={{ marginBottom: 8, textAlign: "center" }}>
          Token #{reservedTokenId} is reserved for your wallet
        </Sunken>
        <div style={{ color: "#555", lineHeight: 1.5 }}>
          Your reservation is locked on-chain. When mint opens you will be able
          to mint token #{reservedTokenId}. Follow{" "}
          <a
            href="https://x.com/TheStuggies"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#000080" }}
          >
            @TheStuggies
          </a>{" "}
          for the mint date.
        </div>
      </div>
    );
  }

  // ── Active farming ─────────────────────────────────────────────────────────
  return (
    <div
      style={{
        fontFamily: "'Tahoma', Arial, sans-serif",
        fontSize: 12,
        minWidth: 320,
      }}
    >
      {/* Stats row */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <Sunken style={{ flex: 1, textAlign: "center" }}>
          <div style={{ color: "#555", fontSize: 10 }}>TOTAL CLAIMS</div>
          <div style={{ fontWeight: "bold", fontSize: 14 }}>
            {totalClaimCount}
          </div>
        </Sunken>
        <Sunken style={{ flex: 1, textAlign: "center" }}>
          <div style={{ color: "#555", fontSize: 10 }}>VERIFIED</div>
          <div style={{ fontWeight: "bold", fontSize: 14, color: "#000080" }}>
            {verifiedClaims}
          </div>
        </Sunken>
        <Sunken style={{ flex: 1, textAlign: "center" }}>
          <div style={{ color: "#555", fontSize: 10 }}>NEEDED</div>
          <div style={{ fontWeight: "bold", fontSize: 14 }}>
            {requiredCount}
          </div>
        </Sunken>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 3,
            fontSize: 10,
            color: "#555",
          }}
        >
          <span>Verification progress</span>
          <span>
            {verifiedClaims}/{requiredCount}
          </span>
        </div>
        <div
          style={{
            height: 12,
            background: "white",
            borderTop: "2px solid #808080",
            borderLeft: "2px solid #808080",
            borderRight: "2px solid #fff",
            borderBottom: "2px solid #fff",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: progressPct >= 100 ? "#008000" : "#000080",
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      {/* Cooldown */}
      {countdown > 0 && (
        <div
          style={{
            background: "#000080",
            color: "#00ff88",
            padding: "4px 10px",
            fontFamily: "'VT323', monospace",
            fontSize: 16,
            letterSpacing: 2,
            marginBottom: 10,
            textAlign: "center",
            border: "2px solid #808080",
          }}
        >
          NEXT CLAIM: {formatCountdown(countdown)}
        </div>
      )}

      {/* Claim form */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ marginBottom: 4, fontSize: 11 }}>
          1. Post about Stuggies on{" "}
          <a
            href="https://x.com/TheStuggies"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#000080" }}
          >
            𝕏 Twitter
          </a>{" "}
          and paste the link:
        </div>
        <input
          type="text"
          value={postUrl}
          onChange={(e) => {
            setPostUrl(e.target.value);
            setLocalError("");
          }}
          placeholder="https://x.com/yourhandle/status/..."
          style={{
            width: "100%",
            padding: "3px 6px",
            fontSize: 11,
            fontFamily: "'Tahoma', Arial, sans-serif",
            borderTop: "2px solid #808080",
            borderLeft: "2px solid #808080",
            borderRight: "2px solid #fff",
            borderBottom: "2px solid #fff",
            background: canClaim ? "white" : "#e8e8e8",
            marginBottom: 6,
          }}
          disabled={!canClaim || isClaimPending}
        />
        {localError && (
          <div style={{ color: "red", fontSize: 10, marginBottom: 6 }}>
            {localError}
          </div>
        )}
        {claimError && (
          <div style={{ color: "red", fontSize: 10, marginBottom: 6 }}>
            {(claimError as Error).message?.includes("CooldownActive")
              ? "Cooldown still active — wait for the timer."
              : "Transaction failed. Check console."}
          </div>
        )}
        <W98Btn onClick={handleClaim} disabled={!canClaim || isClaimPending}>
          {isClaimPending
            ? "Submitting..."
            : countdown > 0
            ? "Cooldown active"
            : "2. Submit Claim"}
        </W98Btn>
      </div>

      {/* Supply ticker */}
      <div
        style={{
          borderTop: "1px solid #808080",
          paddingTop: 6,
          fontSize: 10,
          color: "#555",
        }}
      >
        {totalReserved}/3333 spots reserved
        {reservationsOpen
          ? " · Reservations OPEN"
          : " · Reservations not yet open"}
      </div>
    </div>
  );
}

// ── Icon config ────────────────────────────────────────────────────────────
type IconDef = {
  id: string;
  label: string;
  emoji: string;
  href?: string;
  winConfig?: Omit<WinState, "x" | "y">;
};

// ── Wallet Button (taskbar) ────────────────────────────────────────────────
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
                <span style={{ color: "#008000" }}>MegaETH ✓</span>
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
      id: "farm",
      label: "Claim Traits",
      emoji: "🌾",
      winConfig: {
        id: "farm",
        title: "Claim Your Stuggies",
        icon: "🌾",
        content: <FarmContent />,
      },
    },
    {
      id: "about",
      label: "About",
      emoji: "🐾",
      winConfig: {
        id: "about",
        title: "About Stuggies",
        icon: "🐾",
        content: <AboutContent />,
      },
    },
    {
      id: "collection",
      label: "Collection",
      emoji: "🎨",
      winConfig: {
        id: "collection",
        title: "Collection Details",
        icon: "🎨",
        content: <CollectionContent />,
      },
    },
    {
      id: "roadmap",
      label: "Roadmap",
      emoji: "🗺️",
      winConfig: {
        id: "roadmap",
        title: "Roadmap",
        icon: "🗺️",
        content: <RoadmapContent />,
      },
    },
    {
      id: "faq",
      label: "FAQ",
      emoji: "❓",
      winConfig: {
        id: "faq",
        title: "FAQ",
        icon: "❓",
        content: <FAQContent />,
      },
    },
    {
      id: "team",
      label: "Team",
      emoji: "👥",
      winConfig: {
        id: "team",
        title: "The Team",
        icon: "👥",
        content: <TeamContent />,
      },
    },
    {
      id: "links",
      label: "Links",
      emoji: "🔗",
      winConfig: {
        id: "links",
        title: "Official Links",
        icon: "🔗",
        content: <LinksContent />,
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
      emoji: "💬",
      href: "https://discord.gg/UuRb2cJ3Zn",
    },
    {
      id: "megaeth",
      label: "MegaETH",
      emoji: "⚡",
      href: "https://megaeth.com",
    },
  ];

  const offsets: [number, number][] = [
    [130, 60],
    [160, 80],
    [190, 100],
    [220, 120],
    [150, 90],
    [140, 70],
    [170, 85],
    [200, 110],
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
