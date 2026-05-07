"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useSwitchChain,
} from "wagmi";
import { CONTRACT_ADDRESS, TRAIT_FARMER_ABI } from "../lib/contract";
import { megaethMainnet } from "../providers";

export function useTraitFarmer() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const address = wallets[0]?.address as `0x${string}` | undefined;
  const isConnected = authenticated && !!address;
  const isWrongNetwork = isConnected && chainId !== megaethMainnet.id;

  const ensureChain = async () => {
    if (chainId !== megaethMainnet.id) {
      await switchToMegaETH();
    }
  };

  // ── Reads ──────────────────────────────────────────────────────────────────

  const { data: farmingStatus, refetch: refetchStatus } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TRAIT_FARMER_ABI,
    functionName: "getFarmingStatus",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const { data: reservationsOpen } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TRAIT_FARMER_ABI,
    functionName: "reservationsOpen",
    query: { refetchInterval: 30_000 },
  });

  const { data: traitsRequired } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TRAIT_FARMER_ABI,
    functionName: "traitsRequired",
  });

  const { data: totalReserved } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TRAIT_FARMER_ABI,
    functionName: "totalReserved",
    query: { refetchInterval: 30_000 },
  });

  const { data: adminAddress } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TRAIT_FARMER_ABI,
    functionName: "admin",
  });

  const { data: ownerAddress } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TRAIT_FARMER_ABI,
    functionName: "owner",
  });

  const isAdmin =
    !!address &&
    (address.toLowerCase() === (adminAddress as string)?.toLowerCase() ||
      address.toLowerCase() === (ownerAddress as string)?.toLowerCase());

  // ── Claim write ────────────────────────────────────────────────────────────

  const {
    writeContract,
    data: claimTxHash,
    isPending: isClaimSubmitting,
    error: claimError,
    reset: resetClaim,
  } = useWriteContract();

  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } =
    useWaitForTransactionReceipt({ hash: claimTxHash });

  const claimTrait = async (postUrl: string) => {
    await ensureChain();
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: TRAIT_FARMER_ABI,
      functionName: "claimTrait",
      args: [postUrl],
      chainId: megaethMainnet.id,
    });
  };

  // ── Admin writes ───────────────────────────────────────────────────────────

  const { writeContract: writeAdmin, isPending: isAdminPending } =
    useWriteContract();

  const verifyClaim = async (claimId: bigint) => {
    await ensureChain();
    writeAdmin({
      address: CONTRACT_ADDRESS,
      abi: TRAIT_FARMER_ABI,
      functionName: "verifyClaim",
      args: [claimId],
      chainId: megaethMainnet.id,
    });
  };

  const rejectClaim = async (claimId: bigint) => {
    await ensureChain();
    writeAdmin({
      address: CONTRACT_ADDRESS,
      abi: TRAIT_FARMER_ABI,
      functionName: "rejectClaim",
      args: [claimId],
      chainId: megaethMainnet.id,
    });
  };

  const approveReservation = async (wallet: `0x${string}`) => {
    await ensureChain();
    writeAdmin({
      address: CONTRACT_ADDRESS,
      abi: TRAIT_FARMER_ABI,
      functionName: "approveReservation",
      args: [wallet],
      chainId: megaethMainnet.id,
    });
  };

  const toggleReservations = async (open: boolean) => {
    await ensureChain();
    writeAdmin({
      address: CONTRACT_ADDRESS,
      abi: TRAIT_FARMER_ABI,
      functionName: "toggleReservations",
      args: [open],
      chainId: megaethMainnet.id,
    });
  };

  const approveBatch = async (walletList: `0x${string}`[]) => {
    await ensureChain();
    writeAdmin({
      address: CONTRACT_ADDRESS,
      abi: TRAIT_FARMER_ABI,
      functionName: "approveBatch",
      args: [walletList],
      chainId: megaethMainnet.id,
    });
  };

  const switchToMegaETH = async () => {
    const chainIdHex = "0x18c6"; // 6342 decimal = MegaETH testnet

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (err: any) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: "MegaETH Testnet",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://carrot.megaeth.com/rpc"],
              blockExplorerUrls: ["https://megaeth-testnet-v2.blockscout.com"],
            },
          ],
        });
      }
    }
  };

  // ── Parsed status ──────────────────────────────────────────────────────────

  const cooldownRemaining = farmingStatus ? Number(farmingStatus[0]) : 0;
  const totalClaimCount = farmingStatus ? Number(farmingStatus[1]) : 0;
  const verifiedClaims = farmingStatus ? Number(farmingStatus[2]) : 0;
  const reservedTokenId = farmingStatus ? Number(farmingStatus[3]) : 0;
  const requiredCount = traitsRequired ? Number(traitsRequired) : 9;

  return {
    // wallet
    address,
    isConnected,
    isAdmin,
    isWrongNetwork,
    connect: login,
    disconnect: logout,
    switchToMegaETH,
    ready,

    // status
    cooldownRemaining,
    totalClaimCount,
    verifiedClaims,
    reservedTokenId,
    reservationsOpen: !!reservationsOpen,
    requiredCount,
    totalReserved: totalReserved ? Number(totalReserved) : 0,

    // claim
    claimTrait,
    isClaimPending: isClaimSubmitting || isClaimConfirming,
    isClaimSuccess,
    claimError,
    resetClaim,
    refetchStatus,

    // admin
    verifyClaim,
    rejectClaim,
    approveReservation,
    approveBatch,
    toggleReservations,
    isAdminPending,
  };
}
