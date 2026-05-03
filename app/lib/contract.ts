 
export const CONTRACT_ADDRESS = "0x44915C7BFdB9B07ADE82E646403725812e58AEA1" as `0x${string}`;

export const TRAIT_FARMER_ABI = [
  // ── Read ────────────────────────────────────────────────────────────────────
  {
    name: "getFarmingStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [
      { name: "cooldownRemaining", type: "uint256" },
      { name: "totalClaimCount",   type: "uint256" },
      { name: "verifiedClaims",    type: "uint256" },
      { name: "reserved",          type: "uint256" },
    ],
  },
  {
    name: "secondsUntilNextClaim",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "reservationsOpen",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "traitsRequired",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalReserved",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalClaims",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getPendingClaims",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "pending",
        type: "tuple[]",
        components: [
          { name: "wallet",      type: "address" },
          { name: "traitTypeId", type: "uint256" },
          { name: "postUrl",     type: "string"  },
          { name: "timestamp",   type: "uint256" },
          { name: "verified",    type: "bool"    },
          { name: "rejected",    type: "bool"    },
        ],
      },
      { name: "ids", type: "uint256[]" },
    ],
  },
  {
    name: "getWalletClaims",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "wallet",      type: "address" },
          { name: "traitTypeId", type: "uint256" },
          { name: "postUrl",     type: "string"  },
          { name: "timestamp",   type: "uint256" },
          { name: "verified",    type: "bool"    },
          { name: "rejected",    type: "bool"    },
        ],
      },
      { name: "", type: "uint256[]" },
    ],
  },
  {
    name: "admin",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  // ── Write ───────────────────────────────────────────────────────────────────
  {
    name: "claimTrait",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "postUrl", type: "string" }],
    outputs: [{ name: "claimId", type: "uint256" }],
  },
  {
    name: "verifyClaim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "claimId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "rejectClaim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "claimId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "approveReservation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [],
  },
  {
    name: "approveBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "wallets", type: "address[]" }],
    outputs: [],
  },
  {
    name: "toggleReservations",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_open", type: "bool" }],
    outputs: [],
  },
] as const;