// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TraitFarmer
 * @notice Handles 5-hour trait claiming, X post verification (via trusted signer),
 *         and wallet-bound NFT reservation. A wallet that reserves a trait is the
 *         ONLY address that can mint that specific tokenId.
 *
 * Flow:
 *  1. User calls claimTrait()  → gets a random trait assigned (5h cooldown)
 *  2. User posts on X with their wallet + traitId
 *  3. Your backend verifies the post and calls verifyAndUnlock() with a signed message
 *  4. User calls reserveNFT() → their wallet is permanently bound to a tokenId
 *  5. When mint opens, the NFT contract checks reservations here
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract TraitFarmer is Ownable {
    using ECDSA for bytes32;

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant CLAIM_COOLDOWN  = 5 hours;
    uint256 public constant MAX_SUPPLY      = 3333;
    uint256 public constant TRAITS_REQUIRED = 3; // how many verified traits needed to reserve

    // ─── State ────────────────────────────────────────────────────────────────

    // Address that signs off-chain verifications (your backend wallet)
    address public trustedSigner;

    // Total number of distinct trait types in your collection
    uint256 public totalTraitTypes;

    // wallet → last claim timestamp
    mapping(address => uint256) public lastClaimTime;

    // wallet → traitTypeId → count claimed
    mapping(address => mapping(uint256 => uint256)) public traitBalance;

    // wallet → total verified traits count
    mapping(address => uint256) public verifiedTraitCount;

    // wallet → tokenId reserved (0 = none reserved)
    mapping(address => uint256) public reservedTokenId;

    // tokenId → wallet that reserved it (for the mint contract to check)
    mapping(uint256 => address) public tokenReservedBy;

    // Track used verification nonces to prevent replay
    mapping(bytes32 => bool) public usedNonces;

    // Counter for next tokenId to reserve
    uint256 private _nextTokenId = 1;

    // Whether reservations are open
    bool public reservationsOpen = false;

    // ─── Events ───────────────────────────────────────────────────────────────
    event TraitClaimed(address indexed wallet, uint256 traitTypeId, uint256 timestamp);
    event TraitVerified(address indexed wallet, uint256 traitTypeId, uint256 verifiedCount);
    event NFTReserved(address indexed wallet, uint256 tokenId);
    event SignerUpdated(address newSigner);
    event ReservationsToggled(bool open);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error CooldownActive(uint256 secondsRemaining);
    error InvalidSigner();
    error NonceUsed();
    error NotEnoughVerifiedTraits();
    error AlreadyReserved();
    error ReservationsNotOpen();
    error MaxSupplyReached();
    error InvalidTraitType();

    constructor(
        address _trustedSigner,
        uint256 _totalTraitTypes
    ) Ownable(msg.sender) {
        trustedSigner = _trustedSigner;
        totalTraitTypes = _totalTraitTypes;
    }

    // ─── User Functions ───────────────────────────────────────────────────────

    /**
     * @notice Claim a random trait. Can only be called once every 5 hours per wallet.
     *         The trait assigned is pseudo-random — for production consider Chainlink VRF.
     */
    function claimTrait() external returns (uint256 traitTypeId) {
        uint256 lastClaim = lastClaimTime[msg.sender];
        if (lastClaim != 0 && block.timestamp < lastClaim + CLAIM_COOLDOWN) {
            revert CooldownActive((lastClaim + CLAIM_COOLDOWN) - block.timestamp);
        }

        // Pseudo-random trait assignment
        // NOTE: For a fair launch, replace this with Chainlink VRF
        traitTypeId = uint256(
            keccak256(abi.encodePacked(
                block.prevrandao,
                block.timestamp,
                msg.sender,
                _nextTokenId
            ))
        ) % totalTraitTypes;

        lastClaimTime[msg.sender] = block.timestamp;
        traitBalance[msg.sender][traitTypeId]++;

        emit TraitClaimed(msg.sender, traitTypeId, block.timestamp);
        return traitTypeId;
    }

    /**
     * @notice Called after your backend verifies the X post.
     *         The backend signs: keccak256(wallet, traitTypeId, nonce)
     *         and sends the signature to the user, who submits it here.
     *
     * @param traitTypeId   The trait type that was verified
     * @param nonce         Unique nonce from your backend (prevents replay)
     * @param signature     Backend's ECDSA signature over (wallet, traitTypeId, nonce)
     */
    function verifyAndUnlock(
        uint256 traitTypeId,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        if (traitTypeId >= totalTraitTypes) revert InvalidTraitType();
        if (usedNonces[nonce]) revert NonceUsed();

        // Reconstruct what the backend signed
        bytes32 msgHash = keccak256(
            abi.encodePacked(msg.sender, traitTypeId, nonce)
        );
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(msgHash);

        address recovered = ethHash.recover(signature);
        if (recovered != trustedSigner) revert InvalidSigner();

        usedNonces[nonce] = true;
        verifiedTraitCount[msg.sender]++;

        emit TraitVerified(msg.sender, traitTypeId, verifiedTraitCount[msg.sender]);
    }

    /**
     * @notice Reserve your NFT once you have enough verified traits.
     *         The tokenId is permanently bound to msg.sender — no transfers of this reservation.
     */
    function reserveNFT() external returns (uint256 tokenId) {
        if (!reservationsOpen) revert ReservationsNotOpen();
        if (verifiedTraitCount[msg.sender] < TRAITS_REQUIRED) revert NotEnoughVerifiedTraits();
        if (reservedTokenId[msg.sender] != 0) revert AlreadyReserved();
        if (_nextTokenId > MAX_SUPPLY) revert MaxSupplyReached();

        tokenId = _nextTokenId++;
        reservedTokenId[msg.sender] = tokenId;
        tokenReservedBy[tokenId] = msg.sender;

        emit NFTReserved(msg.sender, tokenId);
        return tokenId;
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /**
     * @notice Check how many seconds until a wallet can claim again.
     *         Returns 0 if they can claim now.
     */
    function secondsUntilNextClaim(address wallet) external view returns (uint256) {
        uint256 lastClaim = lastClaimTime[wallet];
        if (lastClaim == 0) return 0;
        uint256 nextClaim = lastClaim + CLAIM_COOLDOWN;
        if (block.timestamp >= nextClaim) return 0;
        return nextClaim - block.timestamp;
    }

    /**
     * @notice Get a wallet's full farming status in one call (useful for frontend)
     */
    function getFarmingStatus(address wallet) external view returns (
        uint256 cooldownRemaining,
        uint256 verifiedCount,
        uint256 reserved,
        bool canReserve
    ) {
        uint256 lastClaim = lastClaimTime[wallet];
        if (lastClaim != 0 && block.timestamp < lastClaim + CLAIM_COOLDOWN) {
            cooldownRemaining = (lastClaim + CLAIM_COOLDOWN) - block.timestamp;
        }
        verifiedCount = verifiedTraitCount[wallet];
        reserved = reservedTokenId[wallet];
        canReserve = reservationsOpen
            && verifiedCount >= TRAITS_REQUIRED
            && reserved == 0
            && _nextTokenId <= MAX_SUPPLY;
    }

    // ─── Owner Functions ──────────────────────────────────────────────────────

    function setTrustedSigner(address _signer) external onlyOwner {
        trustedSigner = _signer;
        emit SignerUpdated(_signer);
    }

    function toggleReservations(bool _open) external onlyOwner {
        reservationsOpen = _open;
        emit ReservationsToggled(_open);
    }

    function setTraitsRequired(uint256 _count) external onlyOwner {
        // Adjust how many verified traits needed before someone can reserve
        // This is set at deploy but left here for flexibility
    }
}
