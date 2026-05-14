const { ethers } = require("ethers");
const { MerkleTree } = require("merkletreejs");
const fs = require("fs");

// ====================== LOAD ADDRESSES ======================
const content = fs.readFileSync('addresses.txt', 'utf8');
const addresses = content.match(/0x[a-fA-F0-9]{40}/g) || [];

const unique = [...new Set(addresses.map(a => a.toLowerCase()))];

console.log(`Found ${unique.length} unique addresses`);

// ====================== GTD WHITELIST ======================
const GTD_LIST = unique.map(addr => ({
  address: addr,
  maxAlloc: 2
}));

const gtdLeaves = GTD_LIST.map(({ address, maxAlloc }) =>
  ethers.solidityPackedKeccak256(["address", "uint256"], [address, maxAlloc])
);

const gtdTree = new MerkleTree(gtdLeaves, ethers.keccak256, { sortPairs: true });

const gtdOutput = {};
GTD_LIST.forEach((item, i) => {
  gtdOutput[item.address] = {
    maxAlloc: item.maxAlloc,
    proof: gtdTree.getHexProof(gtdLeaves[i])
  };
});

fs.writeFileSync('app/whitelists/gtd.ts',
  `export const GTD_WHITELIST: Record<string, { maxAlloc: number; proof: string[] }> = ${JSON.stringify(gtdOutput, null, 2)};`
);

console.log("✅ GTD Whitelist generated → app/whitelists/gtd.ts");
console.log("GTD Root:", gtdTree.getHexRoot());

// ====================== FCFS WHITELIST ======================
const FCFS_LIST = unique.map(addr => ({
  address: addr,
  maxAlloc: 2
}));

const fcfsLeaves = FCFS_LIST.map(({ address, maxAlloc }) =>
  ethers.solidityPackedKeccak256(["address", "uint256"], [address, maxAlloc])
);

const fcfsTree = new MerkleTree(fcfsLeaves, ethers.keccak256, { sortPairs: true });

const fcfsOutput = {};
FCFS_LIST.forEach((item, i) => {
  fcfsOutput[item.address] = {
    maxAlloc: item.maxAlloc,
    proof: fcfsTree.getHexProof(fcfsLeaves[i])
  };
});

fs.writeFileSync('app/whitelists/fcfs.ts',
  `export const FCFS_WHITELIST: Record<string, { maxAlloc: number; proof: string[] }> = ${JSON.stringify(fcfsOutput, null, 2)};`
);

console.log("✅ FCFS Whitelist generated → app/whitelists/fcfs.ts");
console.log("FCFS Root:", fcfsTree.getHexRoot());

console.log("\n🎉 All done!");