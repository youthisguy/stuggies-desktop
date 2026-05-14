const { ethers } = require("ethers");
const { MerkleTree } = require("merkletreejs");

// ── GTD List ──
// Add all guaranteed wallets and their max allocations here.
const GTD_LIST = [
  { address: "0x4B03B733DF0dA1999E5435b126436988094604fd", maxAlloc: 2 },
  { address: "0x0f40f9ddA09795061de7a5bf25458df6245ba289", maxAlloc: 2 },
];

const leaves = GTD_LIST.map(({ address, maxAlloc }) =>
  ethers.solidityPackedKeccak256(
    ["address", "uint256"],
    [address.toLowerCase(), maxAlloc]
  )
);

const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });

console.log("✅ GTD Merkle Root:");
console.log(tree.getHexRoot());

console.log("\n=== PROOFS FOR EACH WALLET ===");

GTD_LIST.forEach((item, index) => {
  const proof = tree.getHexProof(leaves[index]);
  console.log(`\nWallet: ${item.address}`);
  console.log("Max Alloc:", item.maxAlloc);
  console.log("Proof:", proof);
});
