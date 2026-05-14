// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ███████╗████████╗██╗   ██╗ ██████╗  ██████╗ ██╗███████╗███████╗
 * ██╔════╝╚══██╔══╝██║   ██║██╔════╝ ██╔════╝ ██║██╔════╝██╔════╝
 * ███████╗   ██║   ██║   ██║██║  ███╗██║  ███╗██║█████╗  ███████╗
 * ╚════██║   ██║   ██║   ██║██║   ██║██║   ██║██║██╔══╝  ╚════██║
 * ███████║   ██║   ╚██████╔╝╚██████╔╝╚██████╔╝██║███████╗███████║
 * ╚══════╝   ╚═╝    ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝╚══════╝╚══════╝
 *
 * @title  StuggiesToken (STUG)
 * @notice Protocol token for the Stuggies NFT ecosystem.
 *
 * DESIGN:
 *  - Fixed supply of 3,333,000,000 STUG (1,000,000 per NFT).
 *  - Entire supply is minted to the DEAD address (0x000...dEaD) at deploy.
 *  - No one holds tokens at launch. The supply is permanently locked there.
 *  - A separate "reward pool" tracks ETH contributed from NFT burns.
 *  - When a holder burns their NFT via StuggiesNFT, they are granted a
 *    proportional ETH claim from the pool (30% of burner's mint price),
 *    split evenly across all *currently unburned* NFTs at the moment of burn.
 *  - Reward accounting uses an ever-increasing accumulator (rewardPerToken)
 *    so gas cost is O(1) per claim regardless of holder count.
 *  - NFT holders (tracked by StuggiesNFT) call claimRewards() to pull
 *    accumulated ETH to their wallet.
 *
 * REWARD MATH (accumulator pattern):
 *  rewardPerToken += holderRewardETH / unburnedSupply
 *  claimed[holder] = snapshot of rewardPerToken when they last claimed
 *  pendingRewards(holder) = (rewardPerToken - claimed[holder]) * nftBalance
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IStuggiesNFT {
    function totalMinted() external view returns (uint256);
    function unburnedSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
}

contract StuggiesToken is ERC20, Ownable, ReentrancyGuard {

    // ─────────────────────────────────────────────
    //  CONSTANTS
    // ─────────────────────────────────────────────

    uint256 public constant TOTAL_NFT_SUPPLY   = 3_333;
    uint256 public constant TOKENS_PER_NFT     = 1_000_000 * 1e18;
    uint256 public constant TOTAL_TOKEN_SUPPLY = TOTAL_NFT_SUPPLY * TOKENS_PER_NFT;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // ─────────────────────────────────────────────
    //  STATE
    // ─────────────────────────────────────────────

    /// @notice Address of the StuggiesNFT contract (set once).
    address public nftContract;

    /// @notice Accumulated ETH reward per unburned NFT (scaled by 1e18).
    uint256 public rewardPerTokenStored;

    /// @notice Snapshot of rewardPerTokenStored at the last claim for each address.
    mapping(address => uint256) public rewardPerTokenPaid;

    /// @notice Unclaimed ETH rewards accrued for each address.
    mapping(address => uint256) public pendingEth;

    // ─────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────

    event NFTContractSet(address indexed nftContract);
    event RewardDeposited(uint256 amount, uint256 unburnedSupply, uint256 newRewardPerToken);
    event RewardClaimed(address indexed holder, uint256 amount);

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    /// @param initialOwner Protocol deployer / multisig
    constructor(address initialOwner)
        ERC20("Stuggies", "STUG")
        Ownable(initialOwner)
    {
        // Entire supply minted to the dead address — nobody holds tokens at launch.
        _mint(DEAD, TOTAL_TOKEN_SUPPLY);
    }

    // ─────────────────────────────────────────────
    //  SETUP
    // ─────────────────────────────────────────────

    /// @notice Link the NFT contract. Can only be called once.
    function setNFTContract(address _nftContract) external onlyOwner {
        require(nftContract == address(0), "Already set");
        require(_nftContract != address(0), "Zero address");
        nftContract = _nftContract;
        emit NFTContractSet(_nftContract);
    }

    // ─────────────────────────────────────────────
    //  REWARD DEPOSIT  (called by StuggiesNFT on every burn)
    // ─────────────────────────────────────────────

    /**
     * @notice Deposit ETH into the holder reward pool, distributing it across
     *         all currently unburned NFTs.
     * @dev    Called by StuggiesNFT.burn() with msg.value = 30% of mint price.
     *         The `unburnedCount` passed in should already *exclude* the NFT
     *         being burned right now — i.e., denominator = supply after burn.
     *         If no NFTs remain, ETH is kept in contract (unreachable edge case).
     */
    function depositHolderReward(uint256 unburnedCount)
        external
        payable
        onlyNFTContract
    {
        require(msg.value > 0, "No ETH sent");
        if (unburnedCount == 0) return; // edge case: last NFT burned

        // rewardPerToken is scaled by 1e18 to preserve precision on small amounts
        uint256 delta = (msg.value * 1e18) / unburnedCount;
        rewardPerTokenStored += delta;

        emit RewardDeposited(msg.value, unburnedCount, rewardPerTokenStored);
    }

    // ─────────────────────────────────────────────
    //  CLAIM REWARDS
    // ─────────────────────────────────────────────

    /**
     * @notice Claim all pending ETH rewards for the caller.
     * @dev    Rewards accumulate based on NFT balance × elapsed rewardPerToken.
     *         Holders must call this before transferring NFTs to avoid
     *         leaving rewards behind (same as standard staking patterns).
     */
    function claimRewards() external nonReentrant {
        _updateReward(msg.sender);

        uint256 reward = pendingEth[msg.sender];
        require(reward > 0, "Nothing to claim");

        pendingEth[msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: reward}("");
        require(ok, "ETH transfer failed");

        emit RewardClaimed(msg.sender, reward);
    }

    // ─────────────────────────────────────────────
    //  VIEW — PENDING REWARDS
    // ─────────────────────────────────────────────

    /**
     * @notice Returns total unclaimed ETH for `holder`.
     * @dev    Includes both previously snapshotted amount and newly accrued.
     */
    function pendingRewards(address holder) public view returns (uint256) {
        uint256 nftBalance = IStuggiesNFT(nftContract).balanceOf(holder);
        uint256 accrued = (
            (rewardPerTokenStored - rewardPerTokenPaid[holder]) * nftBalance
        ) / 1e18;
        return pendingEth[holder] + accrued;
    }

    // ─────────────────────────────────────────────
    //  CHECKPOINT  (called by NFT on every transfer)
    // ─────────────────────────────────────────────

    /**
     * @notice Snapshot rewards for `from` and `to` before an NFT transfer.
     * @dev    StuggiesNFT calls this in _update() so rewards are correctly
     *         attributed before the balance changes.
     */
    function checkpoint(address from, address to) external onlyNFTContract {
        if (from != address(0)) _updateReward(from);
        if (to   != address(0)) _updateReward(to);
    }

    // ─────────────────────────────────────────────
    //  INTERNAL
    // ─────────────────────────────────────────────

    function _updateReward(address holder) internal {
        uint256 nftBalance = IStuggiesNFT(nftContract).balanceOf(holder);
        uint256 accrued = (
            (rewardPerTokenStored - rewardPerTokenPaid[holder]) * nftBalance
        ) / 1e18;
        pendingEth[holder]         += accrued;
        rewardPerTokenPaid[holder]  = rewardPerTokenStored;
    }

    // ─────────────────────────────────────────────
    //  MODIFIER
    // ─────────────────────────────────────────────

    modifier onlyNFTContract() {
        require(msg.sender == nftContract, "Caller is not NFT contract");
        _;
    }

    // ─────────────────────────────────────────────
    //  RECEIVE ETH  (safety fallback)
    // ─────────────────────────────────────────────

    receive() external payable {}
}
