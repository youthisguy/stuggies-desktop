"use client";

import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { createWalletClient, custom, createPublicClient, http } from "viem";
import { megaethTestnet } from "viem/chains";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { GTD_WHITELIST } from "../whitelists/gtd";
import { FCFS_WHITELIST } from "../whitelists/fcfs";
import { megaethMainnet } from "../providers";

const CONTRACT_ADDRESS = "0xe1b4bF1f161aC892086E33a77169A5956b35c226";
const RPC_URL = "https://mainnet.megaeth.com/rpc";

const BURN_REFUND_BPS = 5_000;
const BURN_HOLDER_BPS = 3_000;
const BURN_DEV_BPS = 1_000;
const BURN_BUYBACK_BPS = 1_000;

const ABI = [
  // ERC721Enumerable
  "function totalSupply() view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  // Constants
  "function TOTAL_SUPPLY() view returns (uint256)",
  "function TEAM_RESERVE() view returns (uint256)",
  "function GTD_PRICE() view returns (uint256)",
  "function FCFS_PRICE() view returns (uint256)",
  "function PUBLIC_PRICE() view returns (uint256)",
  "function MAX_TX() view returns (uint256)",
  "function MAX_WALLET() view returns (uint256)",
  "function REFUND_BPS() view returns (uint256)",
  "function HOLDER_BPS() view returns (uint256)",
  "function DEV_BPS() view returns (uint256)",
  "function BUYBACK_BPS() view returns (uint256)",
  // State
  "function remainingSupply() view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  "function burnedCount() view returns (uint256)",
  "function revealed() view returns (bool)",
  "function paused() view returns (bool)",
  "function burnEnabled() view returns (bool)",
  "function currentPhase() view returns (uint8)",
  "function devWallet() view returns (address)",
  "function buybackWallet() view returns (address)",
  "function gtdRoot() view returns (bytes32)",
  "function fcfsRoot() view returns (bytes32)",
  "function gtdMinted(address) view returns (uint256)",
  "function fcfsMinted(address) view returns (uint256)",
  "function publicMinted(address) view returns (uint256)",
  "function mintPriceOf(uint256 tokenId) view returns (uint256)",
  "function pendingRewards(address holder) view returns (uint256)",
  // Mint — mintPublic now takes qty only
  "function mintGTD(uint256 qty, uint256 max, bytes32[] calldata proof) external payable",
  "function mintFCFS(uint256 qty, uint256 max, bytes32[] calldata proof) external payable",
  "function mintPublic(uint256 qty) external payable",
  // Burn & rewards
  "function burn(uint256 tokenId) external",
  "function claimRewards() external",
  // Owner
  "function setPhase(uint8 newPhase) external",
  "function setPaused(bool _paused) external",
  "function setBurnEnabled(bool enabled) external",
  "function reveal(string calldata newBaseURI) external",
  "function setDevWallet(address newDev) external",
  "function setBuybackWallet(address newBuyback) external",
  "function setGtdRoot(bytes32 root) external",
  "function setFcfsRoot(bytes32 root) external",
  "function setUnrevealedURI(string calldata uri) external",
  "function setBaseURI(string calldata uri) external",
  "function setContractURI(string calldata uri) external",
  "function setDefaultRoyalty(address receiver, uint96 fee) external",
  "function withdraw() external",
  "function withdrawPostSellout(uint256 amount) external",
];

const PHASE_LABELS = ["Closed", "Guaranteed", "FCFS", "Public"] as const;
const PHASE_COLORS = ["#808080", "#ffd700", "#00aaff", "#00ff41"] as const;
const PHASE_DESCRIPTIONS = [
  "Minting is currently closed. Stay tuned for announcements.",
  "Guaranteed Whitelist",
  "First-Come-First-Served — open to whitelisted wallets.",
  "Public mint — fixed price. Max 5 per tx, 10 per wallet.",
] as const;

type Phase = 0 | 1 | 2 | 3;

const GTD_OPEN_ALLOC = 2;

/* ─── Win98 Components ──────────────────────────────────────────── */
const W98Btn = ({
  children,
  onClick,
  href,
  disabled = false,
  style = {},
  variant = "normal",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  variant?: "normal" | "primary" | "danger" | "success" | "warning";
}) => {
  const [pressed, setPressed] = useState(false);
  const bg =
    variant === "primary"
      ? "#000080"
      : variant === "danger"
      ? "#8b0000"
      : variant === "success"
      ? "#006600"
      : variant === "warning"
      ? "#cc6600"
      : "#c0c0c0";
  const textColor =
    variant !== "normal"
      ? disabled
        ? "#888"
        : "#fff"
      : disabled
      ? "#808080"
      : "#000";

  const baseStyle: React.CSSProperties = {
    padding: "4px 18px",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 12,
    fontWeight: "bold",
    background: disabled ? "#c0c0c0" : bg,
    cursor: disabled ? "default" : "pointer",
    color: textColor,
    borderTop: pressed || disabled ? "2px solid #404040" : "2px solid #fff",
    borderLeft: pressed || disabled ? "2px solid #404040" : "2px solid #fff",
    borderRight: pressed || disabled ? "2px solid #fff" : "2px solid #404040",
    borderBottom: pressed || disabled ? "2px solid #fff" : "2px solid #404040",
    whiteSpace: "nowrap" as const,
    letterSpacing: "0.5px",
    transition: "none",
    textDecoration: "none",
    display: "inline-block",
    ...style,
  };

  if (href)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={baseStyle}
      >
        {children}
      </a>
    );

  return (
    <button
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={baseStyle}
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
      background: "#fff",
      padding: "4px 8px",
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 12,
      ...style,
    }}
  >
    {children}
  </div>
);

const Raised = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      borderTop: "2px solid #fff",
      borderLeft: "2px solid #fff",
      borderRight: "2px solid #808080",
      borderBottom: "2px solid #808080",
      background: "#c0c0c0",
      padding: "6px 10px",
      ...style,
    }}
  >
    {children}
  </div>
);

const ProgressBar = ({
  pct,
  color = "#000080",
}: {
  pct: number;
  color?: string;
}) => (
  <div
    style={{
      borderTop: "2px solid #808080",
      borderLeft: "2px solid #808080",
      borderRight: "2px solid #fff",
      borderBottom: "2px solid #fff",
      background: "#c0c0c0",
      height: 18,
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: `${Math.min(100, Math.max(0, pct))}%`,
        background: color,
        transition: "width 0.4s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingRight: 4,
      }}
    >
      {pct > 12 && (
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 9,
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          {pct.toFixed(1)}%
        </span>
      )}
    </div>
    {pct <= 12 && (
      <span
        style={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 9,
          color: "#000",
        }}
      >
        {pct.toFixed(1)}%
      </span>
    )}
  </div>
);

const StatCell = ({
  label,
  value,
  color = "#000",
}: {
  label: string;
  value: string | number;
  color?: string;
}) => (
  <div
    style={{
      borderTop: "2px solid #808080",
      borderLeft: "2px solid #808080",
      borderRight: "2px solid #fff",
      borderBottom: "2px solid #fff",
      background: "#fff",
      padding: "6px 10px",
      flex: 1,
      minWidth: 90,
    }}
  >
    <div
      style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 9,
        color: "#808080",
        marginBottom: 3,
        textTransform: "uppercase" as const,
        letterSpacing: 1,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 17,
        fontWeight: "bold",
        color,
      }}
    >
      {value}
    </div>
  </div>
);

const QuantitySpinner = ({
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
    <W98Btn
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={disabled || value <= min}
      style={{ padding: "2px 10px", fontSize: 14 }}
    >
      −
    </W98Btn>
    <Sunken
      style={{
        minWidth: 40,
        textAlign: "center",
        fontSize: 15,
        fontWeight: "bold",
        padding: "2px 8px",
        background: disabled ? "#e0e0e0" : "#fff",
      }}
    >
      {value}
    </Sunken>
    <W98Btn
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={disabled || value >= max}
      style={{ padding: "2px 10px", fontSize: 14 }}
    >
      +
    </W98Btn>
  </div>
);

function shortAddr(addr: string): string {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function fmtEth(n: bigint): string {
  if (n === 0n) return "0 ETH";

  const s = parseFloat(ethers.formatEther(n));

  if (s < 0.0001) {
    return s.toFixed(8).replace(/\.?0+$/, "") + " ETH";
  }

  if (s < 0.01) {
    return s.toFixed(6) + " ETH";
  }

  return s.toFixed(4) + " ETH";
}

function burnBreakdown(mintPrice: bigint) {
  const refund = (mintPrice * BigInt(BURN_REFUND_BPS)) / 10_000n;
  const holder = (mintPrice * BigInt(BURN_HOLDER_BPS)) / 10_000n;
  const dev = (mintPrice * BigInt(BURN_DEV_BPS)) / 10_000n;
  const buyback = (mintPrice * BigInt(BURN_BUYBACK_BPS)) / 10_000n;
  return { refund, holder, dev, buyback };
}

async function fetchOwnedTokens(
  contract: ethers.Contract,
  addr: string
): Promise<number[]> {
  const balance = Number(await contract.balanceOf(addr));
  if (balance === 0) return [];
  const ids = await Promise.all(
    Array.from({ length: balance }, (_, i) =>
      contract.tokenOfOwnerByIndex(addr, i)
    )
  );
  return ids.map(Number);
}

/* ─── Main Component ────────────────────────────────────────────── */
export default function MintStuggies() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { user } = usePrivy();

  // ── Contract state ──────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>(0);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [totalMax, setTotalMax] = useState<number>(3333);
  const [remaining, setRemaining] = useState<number>(3333);
  const [burnedCount, setBurnedCount] = useState<number>(0);
  const [gtdPrice, setGtdPrice] = useState<bigint>(0n);
  const [fcfsPrice, setFcfsPrice] = useState<bigint>(0n);
  const [publicPrice, setPublicPrice] = useState<bigint>(0n);
  const [maxPerTx, setMaxPerTx] = useState<number>(5);
  const [maxPerWallet, setMaxPerWallet] = useState<number>(10);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [burnEnabled, setBurnEnabledState] = useState<boolean>(true);

  // ── Wallet state ────────────────────────────────────────────────
  const [gtdMinted, setGtdMinted] = useState<number>(0);
  const [fcfsMinted, setFcfsMinted] = useState<number>(0);
  const [publicMinted, setPublicMinted] = useState<number>(0);
  const [ownedTokens, setOwnedTokens] = useState<number[]>([]);
  const [tokenMintPrices, setTokenMintPrices] = useState<
    Record<number, bigint>
  >({});
  const [pendingRewardsAmt, setPendingRewardsAmt] = useState<bigint>(0n);

  // ── Admin inputs ─────────────────────────────────────────────────
  const [adminPhase, setAdminPhase] = useState("0");
  const [adminDevWallet, setAdminDevWallet] = useState("");
  const [adminBuybackWallet, setAdminBuybackWallet] = useState("");
  const [adminGtdRoot, setAdminGtdRoot] = useState("");
  const [adminFcfsRoot, setAdminFcfsRoot] = useState("");
  const [adminBaseURI, setAdminBaseURI] = useState("");
  const [adminUnrevealedURI, setAdminUnrevealedURI] = useState("");
  const [adminContractURI, setAdminContractURI] = useState("");
  const [adminRoyaltyReceiver, setAdminRoyaltyReceiver] = useState("");
  const [adminRoyaltyFee, setAdminRoyaltyFee] = useState("");
  const [adminWithdrawAmt, setAdminWithdrawAmt] = useState("");
  const [adminStatus, setAdminStatus] = useState<{
    msg: string;
    type: "ok" | "err" | "loading";
  } | null>(null);

  // ── UI state ────────────────────────────────────────────────────
  const [quantity, setQuantity] = useState(1);
  const [txStatus, setTxStatus] = useState<{
    msg: string;
    type: "info" | "ok" | "err" | "loading";
  } | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isBurning, setIsBurning] = useState<number | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<
    "mint" | "owned" | "burn" | "admin"
  >("mint");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedBurnToken, setSelectedBurnToken] = useState<number | null>(
    null
  );

  const address: string | undefined =
    user?.wallet?.address || user?.smartWallet?.address;
  const loweraddress = address ? address.toLowerCase() : undefined;

  const isGTDWhitelisted = !!GTD_WHITELIST[loweraddress as any];
  const isFCFSWhitelisted = !!FCFS_WHITELIST[loweraddress as any];

  const userGTDData = GTD_WHITELIST[loweraddress as any];
  const userFCFSData = FCFS_WHITELIST[loweraddress as any];

  const getReadContract = useCallback(
    () =>
      new ethers.Contract(
        CONTRACT_ADDRESS,
        ABI,
        new ethers.JsonRpcProvider(RPC_URL)
      ),
    []
  );

  const sendAdminTx = useCallback(
    async (fnName: string, args: unknown[], value = 0n, gasLimit = 200000n) => {
      if (!authenticated || !wallets.length) throw new Error("Not connected");
      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        chain: megaethTestnet,
        transport: custom(provider),
      });
      const iface = new ethers.Interface(ABI);
      const data = iface.encodeFunctionData(fnName, args);
      const hash = await walletClient.sendTransaction({
        to: CONTRACT_ADDRESS,
        value,
        data: data as `0x${string}`,
        gas: gasLimit,
        gasPrice: 1000000n,
        account: address as `0x${string}`,
      });
      const publicClient = createPublicClient({
        chain: megaethTestnet,
        transport: http(RPC_URL),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      return hash;
    },
    [authenticated, wallets, address]
  );

  // ── Fetch public chain data ──────────────────────────────────────
  const fetchPublicData = useCallback(async () => {
    try {
      const c = getReadContract();
      const [
        supplyRaw,
        remainingRaw,
        phaseRaw,
        gtdP,
        fcfsP,
        pubP,
        maxTx,
        maxWall,
        pausedRaw,
        revealedRaw,
        totalMaxRaw,
        burnedRaw,
        burnEnabledRaw,
      ] = await Promise.all([
        c.totalSupply(),
        c.remainingSupply(),
        c.currentPhase(),
        c.GTD_PRICE(),
        c.FCFS_PRICE(),
        c.PUBLIC_PRICE(),
        c.MAX_TX(),
        c.MAX_WALLET(),
        c.paused(),
        c.revealed(),
        c.TOTAL_SUPPLY(),
        c.burnedCount(),
        c.burnEnabled(),
      ]);

      setTotalSupply(Number(supplyRaw));
      setRemaining(Number(remainingRaw));
      setPhase(Number(phaseRaw) as Phase);
      setGtdPrice(BigInt(gtdP.toString()));
      setFcfsPrice(BigInt(fcfsP.toString()));
      setPublicPrice(BigInt(pubP.toString()));
      setMaxPerTx(Number(maxTx));
      setMaxPerWallet(Number(maxWall));
      setIsPaused(Boolean(pausedRaw));
      setIsRevealed(Boolean(revealedRaw));
      setTotalMax(Number(totalMaxRaw));
      setBurnedCount(Number(burnedRaw));
      setBurnEnabledState(Boolean(burnEnabledRaw));
      setLastRefresh(new Date());
    } catch (err) {
      console.error("fetchPublicData error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [getReadContract]);

  // ── Fetch wallet-specific data ───────────────────────────────────
  const fetchWalletData = useCallback(async () => {
    if (!wallets.length) return;
    const addr = wallets[0].address;
    if (!addr) return;
    try {
      const c = getReadContract();
      const [gtd, fcfs, pub, pendingRaw, tokenIds] = await Promise.all([
        c.gtdMinted(addr),
        c.fcfsMinted(addr),
        c.publicMinted(addr),
        c.pendingRewards(addr),
        fetchOwnedTokens(c, addr),
      ]);

      setGtdMinted(Number(gtd));
      setFcfsMinted(Number(fcfs));
      setPublicMinted(Number(pub));
      setPendingRewardsAmt(BigInt(pendingRaw.toString()));
      setOwnedTokens(tokenIds);

      if (tokenIds.length > 0) {
        const prices = await Promise.all(
          tokenIds.map((id) => c.mintPriceOf(id))
        );
        const priceMap: Record<number, bigint> = {};
        tokenIds.forEach((id, i) => {
          priceMap[id] = BigInt(prices[i].toString());
        });
        setTokenMintPrices(priceMap);
        setSelectedBurnToken((prev) => prev ?? tokenIds[0] ?? null);
      } else {
        setTokenMintPrices({});
        setSelectedBurnToken(null);
      }
    } catch (err) {
      console.error("fetchWalletData error:", err);
    }
  }, [wallets, getReadContract]);

  useEffect(() => {
    fetchPublicData();
    const t = setInterval(fetchPublicData, 15_000);
    return () => clearInterval(t);
  }, [fetchPublicData]);

  useEffect(() => {
    if (!authenticated || !wallets.length) return;
    fetchWalletData();
    const t = setInterval(fetchWalletData, 15_000);
    return () => clearInterval(t);
  }, [authenticated, wallets, fetchWalletData]);

  // ── Mint handler ─────────────────────────────────────────────────
  const handleMint = useCallback(async () => {
    if (!authenticated || !wallets.length) {
      login();
      return;
    }
  
    setIsMinting(true);
    setTxStatus({ msg: "Preparing transaction...", type: "loading" });
  
    try {
      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        chain: megaethTestnet,
        transport: custom(provider),
      });
  
      const iface = new ethers.Interface(ABI);
      let data: string;
      let totalCost: bigint;
  
      // Normalize address
      const rawAddress = user?.wallet?.address || user?.smartWallet?.address;
      const lowerAddress = rawAddress?.toLowerCase();
  
      console.log("🔍 Mint Debug:", {
        phase,
        address: lowerAddress,
        gtdData: !!userGTDData,
        fcfsData: !!userFCFSData,
        quantity,
      });
  
      if (phase === 1) {
        // ==================== GTD ====================
        if (!userGTDData) throw new Error("Not whitelisted for GTD");
  
        totalCost = gtdPrice * BigInt(quantity);
        data = iface.encodeFunctionData("mintGTD", [
          BigInt(quantity),
          BigInt(userGTDData.maxAlloc),
          userGTDData.proof,
        ]);
      } 
      else if (phase === 2) {
        // ==================== FCFS ====================
        if (!userFCFSData) throw new Error("Not whitelisted for FCFS");
  
        totalCost = fcfsPrice * BigInt(quantity);
        data = iface.encodeFunctionData("mintFCFS", [
          BigInt(quantity),
          BigInt(userFCFSData.maxAlloc),
          userFCFSData.proof,
        ]);
      } 
      else if (phase === 3) {
        totalCost = publicPrice * BigInt(quantity);
        data = iface.encodeFunctionData("mintPublic", [BigInt(quantity)]);
      } 
      else {
        throw new Error("Minting is not active");
      }
  
      // ==================== GAS LIMIT ====================
      let gasLimit: bigint;
      if (phase === 1 || phase === 2) {
        gasLimit = BigInt(450_000 + quantity * 300_000);  
      } else {
        gasLimit = BigInt(120_000 + quantity * 200_000);
      }
  
      console.log(`⛽ Using gas: ${gasLimit.toString()}`);
  
      setTxStatus({
        msg: `Sending ${quantity} Stuggy${quantity > 1 ? "s" : ""} — ${fmtEth(totalCost)}`,
        type: "loading",
      });
  
      const hash = await walletClient.sendTransaction({
        to: CONTRACT_ADDRESS,
        value: totalCost,
        data: data as `0x${string}`,
        gas: gasLimit,
        gasPrice: 1_000_000n,
        account: lowerAddress as `0x${string}`,
      });
  
      setTxStatus({
        msg: `Tx sent: ${hash.slice(0, 12)}… Waiting...`,
        type: "loading",
      });
  
      const publicClient = createPublicClient({
        chain: megaethTestnet,
        transport: http(RPC_URL),
      });
  
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
      if (receipt.status === "success") {
        setTxStatus({
          msg: `✅ Successfully minted ${quantity} Stuggy${quantity > 1 ? "s" : ""}!`,
          type: "ok",
        });
        await Promise.all([fetchPublicData(), fetchWalletData()]);
      } else {
        throw new Error("Transaction reverted");
      }
    } catch (err: any) {
      console.error("Full mint error:", err);
      setTxStatus({
        msg: `❌ ${err.message?.slice(0, 220)}`,
        type: "err",
      });
    } finally {
      setIsMinting(false);
    }
  }, [
    authenticated,
    login,
    wallets,
    phase,
    quantity,
    gtdPrice,
    fcfsPrice,
    publicPrice,
    userGTDData,
    userFCFSData,
    user,
    fetchPublicData,
    fetchWalletData,
  ]);

  // ── Burn handler ─────────────────────────────────────────────────
  const handleBurn = useCallback(
    async (tokenId: number) => {
      if (!authenticated || !wallets.length) {
        login();
        return;
      }
      setIsBurning(tokenId);
      setTxStatus({
        msg: `Preparing burn of Stuggy #${tokenId}…`,
        type: "loading",
      });

      try {
        const wallet = wallets[0];
        const provider = await wallet.getEthereumProvider();
        const walletClient = createWalletClient({
          chain: megaethTestnet,
          transport: custom(provider),
        });
        const iface = new ethers.Interface(ABI);
        const data = iface.encodeFunctionData("burn", [BigInt(tokenId)]);

        const hash = await walletClient.sendTransaction({
          to: CONTRACT_ADDRESS,
          value: 0n,
          data: data as `0x${string}`,
          gas: 300000n,
          gasPrice: 1000000n,
          account: address as `0x${string}`,
        });

        setTxStatus({
          msg: `Burn tx sent: ${hash.slice(0, 12)}… Waiting…`,
          type: "loading",
        });
        const publicClient = createPublicClient({
          chain: megaethTestnet,
          transport: http(RPC_URL),
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === "success") {
          setTxStatus({
            msg: `🔥 Stuggy #${tokenId} burned! Refund incoming.`,
            type: "ok",
          });
          setSelectedBurnToken(null);
          await Promise.all([fetchPublicData(), fetchWalletData()]);
        } else {
          throw new Error("Burn transaction reverted");
        }
      } catch (err: any) {
        setTxStatus({
          msg: `❌ Burn failed: ${err.message?.slice(0, 180)}`,
          type: "err",
        });
      } finally {
        setIsBurning(null);
      }
    },
    [authenticated, login, wallets, address, fetchPublicData, fetchWalletData]
  );

  // ── Claim rewards handler ────────────────────────────────────────
  const handleClaimRewards = useCallback(async () => {
    if (!authenticated || !wallets.length) {
      login();
      return;
    }
    if (pendingRewardsAmt === 0n) return;
    setIsClaiming(true);
    setTxStatus({
      msg: `Claiming ${fmtEth(pendingRewardsAmt)} in rewards…`,
      type: "loading",
    });

    try {
      await sendAdminTx("claimRewards", [], 0n, 100000n);
      setTxStatus({
        msg: `✅ Rewards claimed! ${fmtEth(pendingRewardsAmt)} sent.`,
        type: "ok",
      });
      setPendingRewardsAmt(0n);
      await fetchWalletData();
    } catch (err: any) {
      setTxStatus({
        msg: `❌ Claim failed: ${err.message?.slice(0, 180)}`,
        type: "err",
      });
    } finally {
      setIsClaiming(false);
    }
  }, [
    authenticated,
    login,
    wallets,
    pendingRewardsAmt,
    fetchWalletData,
    sendAdminTx,
  ]);

  // ── Admin write handlers ─────────────────────────────────────────
  const adminAction = useCallback(
    async (fn: () => Promise<string>, label: string) => {
      setAdminStatus({ msg: `⏳ Sending ${label}…`, type: "loading" });
      try {
        const hash = await fn();
        setAdminStatus({
          msg: `✅ ${label} OK — ${hash.slice(0, 14)}…`,
          type: "ok",
        });
        await fetchPublicData();
      } catch (err: any) {
        setAdminStatus({
          msg: `❌ ${label} failed: ${err.message?.slice(0, 120)}`,
          type: "err",
        });
      }
    },
    [fetchPublicData]
  );

  /* ── Derived ───────────────────────────────────────────────────── */
  const mintedCount = totalSupply;
  const supplyPct = totalMax > 0 ? (mintedCount / totalMax) * 100 : 0;
  const phaseLabel = PHASE_LABELS[phase] ?? PHASE_LABELS[0];
  const phaseColor = PHASE_COLORS[phase] ?? PHASE_COLORS[0];
  const phaseDesc = PHASE_DESCRIPTIONS[phase] ?? PHASE_DESCRIPTIONS[0];
  const canMint =
    (phase === 1 || phase === 2 || phase === 3) && !isPaused && authenticated;

  const mintedByUser =
    phase === 1
      ? gtdMinted
      : phase === 2
      ? fcfsMinted
      : phase === 3
      ? publicMinted
      : 0;
  const phaseAlloc =
    phase === 1
      ? GTD_OPEN_ALLOC
      : phase === 2
      ? FCFS_WHITELIST[address?.toLowerCase() ?? ""]?.maxAlloc ?? 0
      : maxPerWallet;
  const maxForUser =
    phase === 1 || phase === 2
      ? Math.max(0, phaseAlloc - mintedByUser)
      : Math.max(0, Math.min(maxPerTx, maxPerWallet - publicMinted));

  const displayPrice =
    phase === 3 ? publicPrice : phase === 1 ? gtdPrice : fcfsPrice;
  const totalCost = displayPrice * BigInt(quantity);

  const selectedMintPrice =
    selectedBurnToken != null ? tokenMintPrices[selectedBurnToken] ?? 0n : 0n;
  const selectedBurnBreakdown =
    selectedMintPrice > 0n ? burnBreakdown(selectedMintPrice) : null;

  const statusColor =
    txStatus?.type === "ok"
      ? "#006600"
      : txStatus?.type === "err"
      ? "#cc0000"
      : "#000080";

  const TABS: { id: "mint" | "owned" | "burn" | "admin"; label: string }[] = [
    { id: "mint", label: "💎 Mint" },
    { id: "owned", label: "🖼️ My Stuggies" },
    { id: "burn", label: "🔥 Burn" },
  ];

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div
      style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 12,
        width: "100%",
        maxWidth: 520,
        userSelect: "none" as const,
      }}
    >
      {/* Title Banner */}
      <div
        style={{
          background:
            "linear-gradient(90deg, #000080 0%, #0a0a50 50%, #000089 100%)",
          color: "#fff",
          padding: "8px 12px",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: 20,
              letterSpacing: 2,
              lineHeight: 1,
            }}
          >
            STUGGIES MINT
          </div>
          <div
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 9,
              color: "#8888ff",
              marginTop: 2,
            }}
          >
            {CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-6)} ·
            MegaETH
          </div>
        </div>
        <button
          onClick={() => {
            fetchPublicData();
            if (authenticated) fetchWalletData();
          }}
          title="Refresh"
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.3)",
            color: "#fff",
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 11,
            cursor: "pointer",
            padding: "2px 8px",
          }}
        >
          ↺
        </button>
      </div>

      {/* Tab bar + wallet */}
      <div
        style={{
          display: "flex",
          marginBottom: 8,
          gap: 2,
          flexWrap: "wrap" as const,
          alignItems: "center",
        }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => {
              setActivePanel(id);
              setTxStatus(null);
              setAdminStatus(null);
            }}
            style={{
              padding: "3px 11px",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 10,
              fontWeight: "bold",
              background:
                activePanel === id
                  ? id === "burn"
                    ? "#8b0000"
                    : id === "admin"
                    ? "#333"
                    : "#000080"
                  : "#c0c0c0",
              color: activePanel === id ? "#fff" : "#000",
              borderTop: "2px solid #fff",
              borderLeft: "2px solid #fff",
              borderRight: "2px solid #808080",
              borderBottom:
                activePanel === id
                  ? "2px solid transparent"
                  : "2px solid #808080",
              cursor: "pointer",
              textTransform: "uppercase" as const,
            }}
          >
            {label}
          </button>
        ))}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {ready && !authenticated ? (
            <W98Btn
              onClick={login}
              style={{ fontSize: 10, padding: "2px 10px" }}
            >
              Connect Wallet
            </W98Btn>
          ) : authenticated && wallets.length ? (
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
              {shortAddr(wallets[0].address)}
            </div>
          ) : null}
        </div>
      </div>

      {/* Rewards banner */}
      {authenticated && wallets.length > 0 && (
        <div
          style={{
            marginBottom: 8,
            background: pendingRewardsAmt > 0n ? "#001a00" : "#111",
            borderTop:
              pendingRewardsAmt > 0n ? "2px solid #00aa33" : "2px solid #333",
            borderLeft:
              pendingRewardsAmt > 0n ? "2px solid #00aa33" : "2px solid #333",
            borderRight: "2px solid #001a00",
            borderBottom: "2px solid #001a00",
            padding: "7px 10px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 8,
                color: pendingRewardsAmt > 0n ? "#00aa33" : "#555",
                letterSpacing: 1,
                textTransform: "uppercase" as const,
                marginBottom: 2,
              }}
            >
              CLAIMABLE REWARDS
            </div>
            <div
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 16,
                fontWeight: "bold",
                color: pendingRewardsAmt > 0n ? "#00ff41" : "#444",
              }}
            >
              {pendingRewardsAmt > 0n
                ? fmtEth(pendingRewardsAmt)
                : "No rewards yet"}
            </div>
            {ownedTokens.length > 0 && (
              <div
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 8,
                  color: "#555",
                  marginTop: 1,
                }}
              >
                Accruing across {ownedTokens.length} NFT
                {ownedTokens.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
          {pendingRewardsAmt > 0n && (
            <div style={{ marginLeft: "auto" }}>
              <W98Btn
                onClick={handleClaimRewards}
                disabled={isClaiming}
                variant="success"
                style={{ fontSize: 11 }}
              >
                {isClaiming ? "⏳ Claiming…" : "CLAIM ETH"}
              </W98Btn>
            </div>
          )}
        </div>
      )}

      {/* ══ MINT PANEL ══ */}
      {activePanel === "mint" && (
        <>
          {/* Supply stats */}
          <div
            style={{
              display: "flex",
              gap: 5,
              marginBottom: 8,
              flexWrap: "wrap" as const,
            }}
          >
            <StatCell
              label="Minted"
              value={isLoading ? "…" : mintedCount.toLocaleString()}
              color="#000080"
            />
            <StatCell
              label="Remaining"
              value={isLoading ? "…" : remaining.toLocaleString()}
              color={remaining < 500 ? "#cc0000" : "#006600"}
            />
            <StatCell
              label="Burned"
              value={isLoading ? "…" : burnedCount.toLocaleString()}
              color="#8b0000"
            />
            <StatCell
              label="Max"
              value={isLoading ? "…" : totalMax.toLocaleString()}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 9,
                color: "#808080",
                marginBottom: 3,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>SUPPLY MINTED</span>
              <span>
                {mintedCount} / {totalMax}
              </span>
            </div>
            <ProgressBar
              pct={supplyPct}
              color={
                supplyPct > 90
                  ? "#cc0000"
                  : supplyPct > 70
                  ? "#cc6600"
                  : "#000080"
              }
            />
          </div>

          {/* Price table */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 4,
              marginBottom: 8,
            }}
          >
            {[
              {
                label: "GTD Price",
                val: gtdPrice,
                active: phase === 1,
                sub: `${GTD_OPEN_ALLOC}/wallet`,
              },
              {
                label: "FCFS Price",
                val: fcfsPrice,
                active: phase === 2,
                sub: "2/wallet",
              },
              {
                label: "Public Price",
                val: publicPrice,
                active: phase === 3,
                sub: `${maxPerTx}/tx`,
              },
            ].map(({ label, val, active, sub }) => (
              <div
                key={label}
                style={{
                  background: active ? "#000080" : "#e0e0e0",
                  color: active ? "#fff" : "#666",
                  padding: "5px 6px",
                  borderTop: active ? "2px solid #6666cc" : "2px solid #fff",
                  borderLeft: active ? "2px solid #6666cc" : "2px solid #fff",
                  borderRight: active
                    ? "2px solid #000040"
                    : "2px solid #808080",
                  borderBottom: active
                    ? "2px solid #000040"
                    : "2px solid #808080",
                  textAlign: "center" as const,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 8,
                    marginBottom: 2,
                    opacity: active ? 1 : 0.7,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                >
                  {isLoading ? "…" : fmtEth(val)}
                </div>
                <div
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 8,
                    opacity: 0.8,
                    marginTop: 2,
                  }}
                >
                  {sub}
                </div>
              </div>
            ))}
          </div>

          {/* Wallet mint history */}
          {authenticated && wallets.length > 0 && (
            <Raised style={{ marginBottom: 8, background: "#f0f0f0" }}>
              <div
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 9,
                  color: "#808080",
                  marginBottom: 6,
                  letterSpacing: 1,
                  textTransform: "uppercase" as const,
                }}
              >
                Your Mint History
              </div>

              <div
                style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}
              >
                {[
                  { label: "GTD minted", val: gtdMinted },
                  { label: "FCFS minted", val: fcfsMinted },
                  { label: "Public minted", val: publicMinted },
                  { label: "Total owned", val: ownedTokens.length },
                ].map(({ label, val }) => (
                  <div
                    key={label}
                    style={{
                      background: "#fff",
                      borderTop: "1px solid #808080",
                      borderLeft: "1px solid #808080",
                      borderRight: "1px solid #fff",
                      borderBottom: "1px solid #fff",
                      padding: "3px 8px",
                      fontSize: 10,
                    }}
                  >
                    <span style={{ color: "#555" }}>{label}: </span>
                    <strong>{val}</strong>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {isGTDWhitelisted && (
                  <div style={{ color: "#006600", fontWeight: "bold" }}>
                    ✅ GTD Whitelisted
                  </div>
                )}

                {isFCFSWhitelisted && (
                  <div style={{ color: "#006600", fontWeight: "bold" }}>
                    ✅ FCFS Whitelisted
                  </div>
                )}

                {!isGTDWhitelisted &&
                  !isFCFSWhitelisted &&
                  [0, 1, 2].includes(phase) && (
                    <div style={{ color: "#cc6600", fontWeight: "bold" }}>
                      ⚠ Not whitelisted
                    </div>
                  )}
              </div>
              {(phase === 1 || phase === 2) && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "5px 8px",
                    background: "#e8e8ff",
                    borderTop: "1px solid #808080",
                    borderLeft: "1px solid #808080",
                    borderRight: "1px solid #fff",
                    borderBottom: "1px solid #fff",
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 10,
                  }}
                >
                  <span style={{ color: "#555" }}>
                    {phase === 1 ? "GTD" : "FCFS"} Allocation:{" "}
                  </span>
                  <strong style={{ color: "#000080" }}>{phaseAlloc}</strong>
                  <span style={{ color: "#808080" }}> · Used: </span>
                  <strong>{mintedByUser}</strong>
                  <span style={{ color: "#808080" }}> · Left: </span>
                  <strong
                    style={{ color: maxForUser === 0 ? "#cc0000" : "#006600" }}
                  >
                    {maxForUser}
                  </strong>
                </div>
              )}
            </Raised>
          )}

          {/* Quantity + Mint */}
          {!isPaused && phase > 0 && (
            <Raised style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap" as const,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 9,
                      color: "#808080",
                      marginBottom: 4,
                    }}
                  >
                    QUANTITY
                  </div>
                  <QuantitySpinner
                    value={quantity}
                    min={1}
                    max={Math.max(
                      1,
                      maxForUser || (phase === 3 ? maxPerTx : 99)
                    )}
                    onChange={setQuantity}
                    disabled={isMinting || !canMint}
                  />
                </div>
                <div style={{ textAlign: "right" as const }}>
                  <div
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 9,
                      color: "#808080",
                      marginBottom: 4,
                    }}
                  >
                    TOTAL COST
                  </div>
                  <div
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 18,
                      fontWeight: "bold",
                      color: "#000080",
                    }}
                  >
                    {fmtEth(totalCost)}
                  </div>
                </div>
              </div>

              {(phase === 1 || phase === 2) && (
                <div
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 9,
                    color: "#555",
                    marginTop: 6,
                    marginBottom: 2,
                  }}
                >
                  Allocation: {phaseAlloc}/wallet · Minted: {mintedByUser} ·
                  Available: {maxForUser}
                </div>
              )}

              <div style={{ marginTop: 10 }}>
                {!authenticated ? (
                  <W98Btn
                    onClick={login}
                    variant="primary"
                    style={{ width: "100%" }}
                  >
                    🔗 Connect Wallet to Mint
                  </W98Btn>
                ) : (
                  <W98Btn
                    onClick={handleMint}
                    disabled={
                      isMinting ||
                      !canMint ||
                      quantity < 1 ||
                      ((phase === 1 || phase === 2) && maxForUser === 0)
                    }
                    variant="primary"
                    style={{ width: "100%" }}
                  >
                    {isMinting
                      ? "⏳ Processing…"
                      : `MINT ${quantity} STUGGY${quantity > 1 ? "S" : ""}`}
                  </W98Btn>
                )}
              </div>

              {phase === 3 && (
                <div
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 9,
                    color: "#808080",
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  Max {maxPerTx} per tx · Max {maxPerWallet} per wallet · You've
                  minted {publicMinted}
                </div>
              )}
            </Raised>
          )}

          {phase === 0 && !isPaused && (
            <Raised
              style={{
                textAlign: "center" as const,
                padding: "18px 12px",
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>⛔</div>
              <div
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 11,
                  fontWeight: "bold",
                  color: "#808080",
                  marginBottom: 4,
                }}
              >
                MINT NOT ACTIVE
              </div>
              <div
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 9,
                  color: "#999",
                }}
              >
                Follow @TheStuggies on X for announcements
              </div>
            </Raised>
          )}

          {/* TX Status */}
          {txStatus && (
            <div
              style={{
                borderTop: "2px solid #808080",
                borderLeft: "2px solid #808080",
                borderRight: "2px solid #fff",
                borderBottom: "2px solid #fff",
                background:
                  txStatus.type === "ok"
                    ? "#e8ffe8"
                    : txStatus.type === "err"
                    ? "#ffe8e8"
                    : "#e8e8ff",
                padding: "6px 10px",
                marginBottom: 8,
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 11,
                color: statusColor,
                lineHeight: 1.5,
                wordBreak: "break-all" as const,
              }}
            >
              {txStatus.type === "loading" && (
                <span style={{ marginRight: 6 }}>⏳</span>
              )}
              {txStatus.msg}
              {txStatus.type === "ok" && (
                <div style={{ marginTop: 4 }}>
                  <a
                    href={`https://megaeth.blockscout.com/address/${CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#000080",
                      fontSize: 9,
                      textDecoration: "underline",
                    }}
                  >
                    View contract on explorer
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Links */}
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap" as const,
              borderTop: "1px solid #c0c0c0",
              paddingTop: 6,
            }}
          >
            <W98Btn
              href={`https://megaeth.blockscout.com/address/${CONTRACT_ADDRESS}`}
              style={{ fontSize: 10, padding: "2px 8px" }}
            >
              🔍 Explorer
            </W98Btn>
            <W98Btn
              href="https://x.com/TheStuggies"
              style={{ fontSize: 10, padding: "2px 8px" }}
            >
              𝕏 Twitter
            </W98Btn>
            <W98Btn
              href="https://discord.gg/UuRb2cJ3Zn"
              style={{ fontSize: 10, padding: "2px 8px" }}
            >
              Discord
            </W98Btn>
            {lastRefresh && (
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 9,
                  color: "#808080",
                  alignSelf: "center",
                }}
              >
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>
        </>
      )}

      {/* ══ OWNED PANEL ══ */}
      {activePanel === "owned" && (
        <div>
          {!authenticated ? (
            <Raised
              style={{ textAlign: "center" as const, padding: "30px 12px" }}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>🐾</div>
              <div
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 11,
                  color: "#555",
                  marginBottom: 12,
                }}
              >
                Connect wallet to view your Stuggies
              </div>
              <W98Btn onClick={login} variant="primary">
                Connect Wallet
              </W98Btn>
            </Raised>
          ) : ownedTokens.length === 0 ? (
            <Raised
              style={{ textAlign: "center" as const, padding: "30px 12px" }}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>🥚</div>
              <div
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 11,
                  color: "#555",
                }}
              >
                You don't own any Stuggies yet
              </div>
            </Raised>
          ) : (
            <>
              <div
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 11,
                  color: "#555",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  You own <strong>{ownedTokens.length}</strong> Stuggies
                </span>
                {!isRevealed && (
                  <span style={{ color: "#cc6600" }}>🔒 Unrevealed</span>
                )}
              </div>
              <div
                style={{
                  maxHeight: 280,
                  overflowY: "auto",
                  borderTop: "2px solid #808080",
                  borderLeft: "2px solid #808080",
                  borderRight: "2px solid #fff",
                  borderBottom: "2px solid #fff",
                  background: "#f0f0f0",
                  padding: 6,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                    gap: 5,
                  }}
                >
                  {ownedTokens.map((tokenId) => (
                    <div
                      key={tokenId}
                      style={{
                        background: "#fff",
                        borderTop: "2px solid #fff",
                        borderLeft: "2px solid #fff",
                        borderRight: "2px solid #808080",
                        borderBottom: "2px solid #808080",
                        padding: 5,
                        textAlign: "center" as const,
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        window.open(
                          `https://megaeth.blockscout.com/token/${CONTRACT_ADDRESS}/instance/${tokenId}`,
                          "_blank"
                        )
                      }
                    >
                      <div style={{ fontSize: 22, marginBottom: 3 }}>🥚</div>
                      <div
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: 9,
                          fontWeight: "bold",
                          color: "#000080",
                        }}
                      >
                        #{tokenId}
                      </div>
                      {tokenMintPrices[tokenId] != null && (
                        <div
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: 7,
                            color: "#808080",
                            marginTop: 2,
                          }}
                        >
                          {fmtEth(tokenMintPrices[tokenId])}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 6,
              justifyContent: "center",
            }}
          >
            <W98Btn onClick={fetchWalletData} style={{ fontSize: 10 }}>
              ↺ Refresh
            </W98Btn>
          </div>
        </div>
      )}

      {/* ══ BURN PANEL ══ */}
      {activePanel === "burn" && (
        <div>
          <div
            style={{
              background: "#8b0000",
              color: "#fff",
              padding: "6px 10px",
              marginBottom: 8,
              borderTop: "2px solid #cc4444",
              borderLeft: "2px solid #cc4444",
              borderRight: "2px solid #440000",
              borderBottom: "2px solid #440000",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 10,
              lineHeight: 1.5,
            }}
          >
            ⚠ <strong>BURN IS PERMANENT.</strong> Destroys NFT, distributes mint
            price per breakdown below.
            {!burnEnabled && (
              <span
                style={{ display: "block", marginTop: 4, color: "#ffaaaa" }}
              >
                🚫 Burns are currently DISABLED by the owner.
              </span>
            )}
          </div>

          <Raised style={{ marginBottom: 8 }}>
            <div
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 9,
                color: "#808080",
                marginBottom: 6,
                letterSpacing: 1,
                textTransform: "uppercase" as const,
              }}
            >
              Burn Distribution (of mint price)
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 5,
              }}
            >
              {[
                {
                  label: "You receive",
                  pct: "50%",
                  color: "#006600",
                  icon: "💰",
                },
                {
                  label: "NFT holders pool",
                  pct: "30%",
                  color: "#000080",
                  icon: "🏦",
                },
                { label: "Protocol fee", pct: "10%", color: "#444", icon: "🛠" },
                {
                  label: "Buyback wallet",
                  pct: "10%",
                  color: "#8b0000",
                  icon: "🔄",
                },
              ].map(({ label, pct, color, icon }) => (
                <div
                  key={label}
                  style={{
                    background: "#fff",
                    padding: "5px 8px",
                    borderTop: "1px solid #808080",
                    borderLeft: "1px solid #808080",
                    borderRight: "1px solid #fff",
                    borderBottom: "1px solid #fff",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: 8,
                        color: "#808080",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: 14,
                        fontWeight: "bold",
                        color,
                      }}
                    >
                      {pct}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 9,
                color: "#555",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              💡 30% holder share is distributed to all current holders via{" "}
              <code>claimRewards()</code> proportionally.
            </div>
          </Raised>

          {!authenticated ? (
            <Raised
              style={{ textAlign: "center" as const, padding: "20px 12px" }}
            >
              <W98Btn onClick={login} variant="danger">
                Connect Wallet to Burn
              </W98Btn>
            </Raised>
          ) : ownedTokens.length === 0 ? (
            <Raised
              style={{ textAlign: "center" as const, padding: "20px 12px" }}
            >
              <div
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 11,
                  color: "#555",
                }}
              >
                You don't own any Stuggies to burn.
              </div>
            </Raised>
          ) : (
            <Raised style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 9,
                  color: "#808080",
                  marginBottom: 6,
                  letterSpacing: 1,
                  textTransform: "uppercase" as const,
                }}
              >
                Select Token to Burn
              </div>
              <div
                style={{
                  maxHeight: 120,
                  overflowY: "auto",
                  borderTop: "2px solid #808080",
                  borderLeft: "2px solid #808080",
                  borderRight: "2px solid #fff",
                  borderBottom: "2px solid #fff",
                  background: "#f0f0f0",
                  padding: 4,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}
                >
                  {ownedTokens.map((tokenId) => (
                    <button
                      key={tokenId}
                      onClick={() => setSelectedBurnToken(tokenId)}
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: 10,
                        fontWeight: "bold",
                        padding: "3px 8px",
                        cursor: "pointer",
                        background:
                          selectedBurnToken === tokenId ? "#8b0000" : "#c0c0c0",
                        color: selectedBurnToken === tokenId ? "#fff" : "#000",
                        borderTop:
                          selectedBurnToken === tokenId
                            ? "2px solid #cc4444"
                            : "2px solid #fff",
                        borderLeft:
                          selectedBurnToken === tokenId
                            ? "2px solid #cc4444"
                            : "2px solid #fff",
                        borderRight:
                          selectedBurnToken === tokenId
                            ? "2px solid #440000"
                            : "2px solid #808080",
                        borderBottom:
                          selectedBurnToken === tokenId
                            ? "2px solid #440000"
                            : "2px solid #808080",
                      }}
                    >
                      #{tokenId}
                    </button>
                  ))}
                </div>
              </div>

              {selectedBurnToken != null && selectedBurnBreakdown != null && (
                <div style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 9,
                      color: "#808080",
                      marginBottom: 4,
                    }}
                  >
                    BREAKDOWN — #{selectedBurnToken} (mint price:{" "}
                    {fmtEth(selectedMintPrice)})
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 4,
                    }}
                  >
                    {[
                      {
                        label: "You receive (50%)",
                        val: selectedBurnBreakdown.refund,
                        color: "#006600",
                      },
                      {
                        label: "Holder pool (30%)",
                        val: selectedBurnBreakdown.holder,
                        color: "#000080",
                      },
                      {
                        label: "Protocol (10%)",
                        val: selectedBurnBreakdown.dev,
                        color: "#444",
                      },
                      {
                        label: "Buyback (10%)",
                        val: selectedBurnBreakdown.buyback,
                        color: "#8b0000",
                      },
                    ].map(({ label, val, color }) => (
                      <div
                        key={label}
                        style={{
                          background: "#fff",
                          padding: "4px 8px",
                          borderTop: "1px solid #808080",
                          borderLeft: "1px solid #808080",
                          borderRight: "1px solid #fff",
                          borderBottom: "1px solid #fff",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: 8,
                            color: "#808080",
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: 12,
                            fontWeight: "bold",
                            color,
                          }}
                        >
                          {fmtEth(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <W98Btn
                onClick={() =>
                  selectedBurnToken != null && handleBurn(selectedBurnToken)
                }
                disabled={
                  isBurning != null ||
                  selectedBurnToken == null ||
                  selectedMintPrice === 0n ||
                  isPaused ||
                  !burnEnabled
                }
                variant="danger"
                style={{ width: "100%" }}
              >
                {isBurning != null
                  ? `⏳ Burning #${isBurning}…`
                  : selectedBurnToken != null
                  ? `🔥 BURN STUGGY #${selectedBurnToken}`
                  : "SELECT A TOKEN TO BURN"}
              </W98Btn>
            </Raised>
          )}

          {txStatus && (
            <div
              style={{
                borderTop: "2px solid #808080",
                borderLeft: "2px solid #808080",
                borderRight: "2px solid #fff",
                borderBottom: "2px solid #fff",
                background:
                  txStatus.type === "ok"
                    ? "#e8ffe8"
                    : txStatus.type === "err"
                    ? "#ffe8e8"
                    : "#e8e8ff",
                padding: "6px 10px",
                marginBottom: 8,
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 11,
                color: statusColor,
                lineHeight: 1.5,
                wordBreak: "break-all" as const,
              }}
            >
              {txStatus.type === "loading" && (
                <span style={{ marginRight: 6 }}>⏳</span>
              )}
              {txStatus.msg}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          borderTop: "1px solid #808080",
          marginTop: 8,
          paddingTop: 3,
          gap: 4,
        }}
      />
    </div>
  );
}

declare module "react" {
  interface HTMLAttributes<T> {
    href?: string;
    target?: string;
    rel?: string;
  }
}
