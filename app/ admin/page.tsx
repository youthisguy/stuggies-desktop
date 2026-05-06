"use client";


export const dynamic = "force-dynamic"; 

import { useState } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { CONTRACT_ADDRESS, TRAIT_FARMER_ABI } from "../lib/contract";

const W98Btn = ({
  children,
  onClick,
  disabled = false,
  color = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  color?: "default" | "green" | "red";
}) => {
  const bg =
    color === "green" ? "#008000" : color === "red" ? "#800000" : "#c0c0c0";
  const fg = color !== "default" ? "white" : disabled ? "#808080" : "black";
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        padding: "2px 10px",
        fontSize: 11,
        fontFamily: "'Tahoma', Arial, sans-serif",
        background: disabled ? "#c0c0c0" : bg,
        color: disabled ? "#808080" : fg,
        cursor: disabled ? "default" : "pointer",
        whiteSpace: "nowrap" as const,
        borderTop: disabled ? "2px solid #808080" : "2px solid #fff",
        borderLeft: disabled ? "2px solid #808080" : "2px solid #fff",
        borderRight: disabled ? "2px solid #fff" : "2px solid #808080",
        borderBottom: disabled ? "2px solid #fff" : "2px solid #808080",
      }}
    >
      {children}
    </button>
  );
};

function formatTime(ts: bigint) {
  return new Date(Number(ts) * 1000).toLocaleString();
}

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function AdminPage() {
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const address = wallets[0]?.address as `0x${string}` | undefined;

  const [batchInput, setBatchInput] = useState("");
  const [txStatus, setTxStatus] = useState<
    Record<string, "pending" | "done" | "error">
  >({});

  // ── Reads ──────────────────────────────────────────────────────────────────

  const { data: pendingData, refetch: refetchPending } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TRAIT_FARMER_ABI,
    functionName: "getPendingClaims",
    query: { refetchInterval: 15_000 },
  });

  const { data: reservationsOpen, refetch: refetchOpen } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TRAIT_FARMER_ABI,
    functionName: "reservationsOpen",
    query: { refetchInterval: 15_000 },
  });

  const { data: totalReserved } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TRAIT_FARMER_ABI,
    functionName: "totalReserved",
    query: { refetchInterval: 15_000 },
  });

  const { data: totalClaimsCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TRAIT_FARMER_ABI,
    functionName: "totalClaims",
    query: { refetchInterval: 15_000 },
  });

  // ── Writes ─────────────────────────────────────────────────────────────────

  const { writeContract, isPending } = useWriteContract();

  const call = (fn: () => void, key: string) => {
    setTxStatus((s) => ({ ...s, [key]: "pending" }));
    try {
      fn();
    } catch {
      setTxStatus((s) => ({ ...s, [key]: "error" }));
    }
  };

  const verifyClaim = (claimId: bigint) =>
    writeContract(
      {
        address: CONTRACT_ADDRESS,
        abi: TRAIT_FARMER_ABI,
        functionName: "verifyClaim",
        args: [claimId],
      },
      { onSuccess: () => refetchPending(), onError: () => {} }
    );

  const rejectClaim = (claimId: bigint) =>
    writeContract(
      {
        address: CONTRACT_ADDRESS,
        abi: TRAIT_FARMER_ABI,
        functionName: "rejectClaim",
        args: [claimId],
      },
      { onSuccess: () => refetchPending(), onError: () => {} }
    );

  const approveReservation = (wallet: `0x${string}`) =>
    writeContract(
      {
        address: CONTRACT_ADDRESS,
        abi: TRAIT_FARMER_ABI,
        functionName: "approveReservation",
        args: [wallet],
      },
      { onSuccess: () => refetchPending() }
    );

  const toggleReservations = (open: boolean) =>
    writeContract(
      {
        address: CONTRACT_ADDRESS,
        abi: TRAIT_FARMER_ABI,
        functionName: "toggleReservations",
        args: [open],
      },
      { onSuccess: () => refetchOpen() }
    );

  const approveBatch = () => {
    const wallets = batchInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith("0x") && s.length === 42) as `0x${string}`[];
    if (!wallets.length) return;
    writeContract(
      {
        address: CONTRACT_ADDRESS,
        abi: TRAIT_FARMER_ABI,
        functionName: "approveBatch",
        args: [wallets],
      },
      {
        onSuccess: () => {
          setBatchInput("");
          refetchPending();
        },
      }
    );
  };

  // ── Layout ─────────────────────────────────────────────────────────────────

  const win: React.CSSProperties = {
    background: "#c0c0c0",
    borderTop: "2px solid #fff",
    borderLeft: "2px solid #fff",
    borderRight: "2px solid #808080",
    borderBottom: "2px solid #808080",
    boxShadow: "3px 3px 0 #404040",
    marginBottom: 16,
  };
  const titlebar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    padding: "2px 4px",
    background: "linear-gradient(90deg, #000080, #1084d0)",
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
    fontFamily: "'Tahoma', Arial, sans-serif",
  };
  const content: React.CSSProperties = {
    padding: 10,
    fontFamily: "'Tahoma', Arial, sans-serif",
    fontSize: 11,
  };
  const sunken: React.CSSProperties = {
    borderTop: "2px solid #808080",
    borderLeft: "2px solid #808080",
    borderRight: "2px solid #fff",
    borderBottom: "2px solid #fff",
    background: "white",
    padding: "3px 6px",
  };
  const th: React.CSSProperties = {
    background: "#000080",
    color: "white",
    padding: "3px 8px",
    textAlign: "left" as const,
    fontSize: 11,
    fontFamily: "'Tahoma', Arial, sans-serif",
  };
  const td: React.CSSProperties = {
    padding: "4px 8px",
    borderBottom: "1px solid #e0e0e0",
    fontSize: 11,
    fontFamily: "'Tahoma', Arial, sans-serif",
    verticalAlign: "top" as const,
  };

  const pending = pendingData?.[0] ?? [];
  const ids = pendingData?.[1] ?? [];

  if (!authenticated) {
    return (
      <div
        style={{
          background: "#008080",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={win}>
          <div style={titlebar}>🔐 Admin — Stuggies TraitFarmer</div>
          <div style={{ ...content, textAlign: "center" }}>
            <p style={{ marginBottom: 12 }}>
              Connect your admin wallet to continue.
            </p>
            <W98Btn onClick={login}>Connect Wallet</W98Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#008080",
        minHeight: "100vh",
        padding: 16,
        fontFamily: "'Tahoma', Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div style={win}>
        <div style={titlebar}>🐾 Stuggies Admin — TraitFarmer Dashboard</div>
        <div
          style={{
            ...content,
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap" as const,
          }}
        >
          <div>
            Connected: <strong>{address ? shortenAddr(address) : "—"}</strong>
          </div>
          <div style={sunken}>
            Pending claims: <strong>{pending.length}</strong>
          </div>
          <div style={sunken}>
            Total claims: <strong>{totalClaimsCount?.toString() ?? "—"}</strong>
          </div>
          <div style={sunken}>
            Reserved: <strong>{totalReserved?.toString() ?? "—"} / 3333</strong>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>Reservations:</span>
            <div
              style={{
                ...sunken,
                color: reservationsOpen ? "#008000" : "#800000",
                fontWeight: "bold",
              }}
            >
              {reservationsOpen ? "OPEN" : "CLOSED"}
            </div>
            <W98Btn
              onClick={() => toggleReservations(!reservationsOpen)}
              disabled={isPending}
              color={reservationsOpen ? "red" : "green"}
            >
              {reservationsOpen ? "Close" : "Open"}
            </W98Btn>
          </div>
          <W98Btn
            onClick={() => {
              refetchPending();
              refetchOpen();
            }}
          >
            ↻ Refresh
          </W98Btn>
        </div>
      </div>

      {/* Pending claims table */}
      <div style={win}>
        <div style={titlebar}>
          📋 Pending Claims — review X posts and verify or reject
        </div>
        <div style={content}>
          {pending.length === 0 ? (
            <div style={{ color: "#555", padding: "8px 0" }}>
              No pending claims. All caught up.
            </div>
          ) : (
            <div style={{ overflowX: "auto" as const }}>
              <table
                style={{ width: "100%", borderCollapse: "collapse" as const }}
              >
                <thead>
                  <tr>
                    <th style={th}>ID</th>
                    <th style={th}>Wallet</th>
                    <th style={th}>Trait #</th>
                    <th style={th}>X Post</th>
                    <th style={th}>Time</th>
                    <th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((claim, i) => {
                    const claimId = ids[i];
                    return (
                      <tr
                        key={claimId.toString()}
                        style={{
                          background: i % 2 === 0 ? "#e8e8e8" : "white",
                        }}
                      >
                        <td style={td}>{claimId.toString()}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>
                          <a
                            href={`https://megaeth-testnet-v2.blockscout.com/address/${claim.wallet}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#000080",
                              textDecoration: "underline",
                            }}
                          >
                            {shortenAddr(claim.wallet)}
                          </a>
                        </td>
                        <td style={td}>{claim.traitTypeId.toString()}</td>
                        <td style={td}>
                          <a
                            href={claim.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#000080",
                              textDecoration: "underline",
                              wordBreak: "break-all" as const,
                            }}
                          >
                            View post ↗
                          </a>
                        </td>
                        <td style={td}>{formatTime(claim.timestamp)}</td>
                        <td
                          style={{
                            ...td,
                            display: "flex",
                            gap: 4,
                            flexWrap: "wrap" as const,
                          }}
                        >
                          <W98Btn
                            onClick={() => verifyClaim(claimId)}
                            disabled={isPending}
                            color="green"
                          >
                            ✓ Verify
                          </W98Btn>
                          <W98Btn
                            onClick={() => rejectClaim(claimId)}
                            disabled={isPending}
                            color="red"
                          >
                            ✕ Reject
                          </W98Btn>
                          {reservationsOpen && (
                            <W98Btn
                              onClick={() =>
                                approveReservation(
                                  claim.wallet as `0x${string}`
                                )
                              }
                              disabled={isPending}
                            >
                              Reserve →
                            </W98Btn>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Batch approve */}
      <div style={win}>
        <div style={titlebar}>⚡ Batch Approve Reservations</div>
        <div style={content}>
          <p style={{ marginBottom: 6, color: "#444" }}>
            Paste wallet addresses (one per line or comma-separated) to approve
            reservations in a single tx. Reservations must be open.
          </p>
          <textarea
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
            placeholder={"0xWallet1\n0xWallet2\n0xWallet3"}
            rows={5}
            style={{
              width: "100%",
              padding: "4px 6px",
              fontSize: 11,
              fontFamily: "monospace",
              marginBottom: 8,
              borderTop: "2px solid #808080",
              borderLeft: "2px solid #808080",
              borderRight: "2px solid #fff",
              borderBottom: "2px solid #fff",
              resize: "vertical" as const,
            }}
          />
          <W98Btn
            onClick={approveBatch}
            disabled={isPending || !batchInput.trim()}
          >
            Approve Batch
          </W98Btn>
        </div>
      </div>

      {/* Contract link */}
      <div
        style={{ fontSize: 10, color: "white", textAlign: "center" as const }}
      >
        Contract:{" "}
        <a
          href={`https://megaeth-testnet-v2.blockscout.com/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#88ccff" }}
        >
          {CONTRACT_ADDRESS}
        </a>
      </div>
    </div>
  );
}
