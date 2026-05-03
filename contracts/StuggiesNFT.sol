// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.1.0/contracts/access/Ownable.sol";

contract TraitFarmer {

    uint256 public constant CLAIM_COOLDOWN = 5 hours;
    uint256 public constant MAX_SUPPLY     = 3333;
    uint256 public traitsRequired          = 9;
    uint256 public totalTraitTypes;
    address public admin;

    struct Claim {
        address wallet;
        uint256 traitTypeId;
        string  postUrl;
        uint256 timestamp;
        bool    verified;
        bool    rejected;
    }

    mapping(address => uint256) public lastClaimTime;
    mapping(address => mapping(uint256 => uint256)) public traitBalance;
    mapping(address => uint256) public claimCount;
    mapping(address => uint256) public reservedTokenId;
    mapping(uint256 => address) public tokenReservedBy;

    Claim[]  public claims;
    mapping(address => uint256[]) public walletClaimIds;

    uint256 private _nextTokenId = 1;
    bool public reservationsOpen = false;

    event TraitClaimed(address indexed wallet, uint256 claimId, uint256 traitTypeId, string postUrl);
    event ClaimVerified(uint256 indexed claimId, address indexed wallet);
    event ClaimRejected(uint256 indexed claimId, address indexed wallet);
    event NFTReserved(address indexed wallet, uint256 tokenId);
    event ReservationsToggled(bool open);
    event AdminUpdated(address newAdmin);

    error CooldownActive(uint256 secondsRemaining);
    error AlreadyReserved();
    error ReservationsNotOpen();
    error MaxSupplyReached();
    error NotAdmin();
    error ClaimAlreadyProcessed();
    error EmptyUrl();

    modifier onlyAdmin() {
        if (msg.sender != admin && msg.sender != owner()) revert NotAdmin();
        _;
    }

    constructor(uint256 _totalTraitTypes, address _admin) Ownable(msg.sender) {
        totalTraitTypes = _totalTraitTypes;
        admin = _admin;
    }

    // ── User ──────────────────────────────────────────────────────────────────

    function claimTrait(string calldata postUrl) external returns (uint256 claimId) {
        if (bytes(postUrl).length == 0) revert EmptyUrl();

        uint256 lastClaim = lastClaimTime[msg.sender];
        if (lastClaim != 0 && block.timestamp < lastClaim + CLAIM_COOLDOWN)
            revert CooldownActive((lastClaim + CLAIM_COOLDOWN) - block.timestamp);

        uint256 traitTypeId = uint256(keccak256(abi.encodePacked(
            block.prevrandao, block.timestamp, msg.sender, _nextTokenId
        ))) % totalTraitTypes;

        lastClaimTime[msg.sender] = block.timestamp;
        traitBalance[msg.sender][traitTypeId]++;
        claimCount[msg.sender]++;

        claimId = claims.length;
        claims.push(Claim({
            wallet:      msg.sender,
            traitTypeId: traitTypeId,
            postUrl:     postUrl,
            timestamp:   block.timestamp,
            verified:    false,
            rejected:    false
        }));
        walletClaimIds[msg.sender].push(claimId);

        emit TraitClaimed(msg.sender, claimId, traitTypeId, postUrl);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function verifyClaim(uint256 claimId) external onlyAdmin {
        Claim storage c = claims[claimId];
        if (c.verified || c.rejected) revert ClaimAlreadyProcessed();

        c.verified = true;
        emit ClaimVerified(claimId, c.wallet);
    }

    function rejectClaim(uint256 claimId) external onlyAdmin {
        Claim storage c = claims[claimId];
        if (c.verified || c.rejected) revert ClaimAlreadyProcessed();

        c.rejected = true;
        emit ClaimRejected(claimId, c.wallet);
    }

    function approveReservation(address wallet) external onlyAdmin {
        if (!reservationsOpen)           revert ReservationsNotOpen();
        if (reservedTokenId[wallet] != 0) revert AlreadyReserved();
        if (_nextTokenId > MAX_SUPPLY)   revert MaxSupplyReached();

        uint256 tokenId = _nextTokenId++;
        reservedTokenId[wallet]  = tokenId;
        tokenReservedBy[tokenId] = wallet;

        emit NFTReserved(wallet, tokenId);
    }

    function approveBatch(address[] calldata wallets) external onlyAdmin {
        for (uint256 i = 0; i < wallets.length; i++) {
            if (!reservationsOpen)                  revert ReservationsNotOpen();
            if (reservedTokenId[wallets[i]] != 0)  continue;
            if (_nextTokenId > MAX_SUPPLY)          revert MaxSupplyReached();

            uint256 tokenId = _nextTokenId++;
            reservedTokenId[wallets[i]]  = tokenId;
            tokenReservedBy[tokenId]     = wallets[i];

            emit NFTReserved(wallets[i], tokenId);
        }
    }

    function toggleReservations(bool _open) external onlyAdmin {
        reservationsOpen = _open;
        emit ReservationsToggled(_open);
    }

    // ── Owner only ────────────────────────────────────────────────────────────

    function setAdmin(address _admin) external onlyOwner {
        admin = _admin;
        emit AdminUpdated(_admin);
    }

    function setTraitsRequired(uint256 _count) external onlyOwner {
        traitsRequired = _count;
    }

    function setTotalTraitTypes(uint256 _count) external onlyOwner {
        totalTraitTypes = _count;
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function getPendingClaims() external view returns (Claim[] memory pending, uint256[] memory ids) {
        uint256 count;
        for (uint256 i = 0; i < claims.length; i++)
            if (!claims[i].verified && !claims[i].rejected) count++;

        pending = new Claim[](count);
        ids     = new uint256[](count);
        uint256 j;
        for (uint256 i = 0; i < claims.length; i++) {
            if (!claims[i].verified && !claims[i].rejected) {
                pending[j] = claims[i];
                ids[j]     = i;
                j++;
            }
        }
    }

    function getWalletClaims(address wallet) external view returns (Claim[] memory, uint256[] memory) {
        uint256[] memory ids = walletClaimIds[wallet];
        Claim[] memory result = new Claim[](ids.length);
        for (uint256 i = 0; i < ids.length; i++)
            result[i] = claims[ids[i]];
        return (result, ids);
    }

    function secondsUntilNextClaim(address wallet) external view returns (uint256) {
        uint256 lastClaim = lastClaimTime[wallet];
        if (lastClaim == 0 || block.timestamp >= lastClaim + CLAIM_COOLDOWN) return 0;
        return (lastClaim + CLAIM_COOLDOWN) - block.timestamp;
    }

function getFarmingStatus(address wallet) external view returns (
    uint256 cooldownRemaining,
    uint256 totalClaimCount,
    uint256 verifiedClaims,
    uint256 reserved
) {
    uint256 lastClaim = lastClaimTime[wallet];
    if (lastClaim != 0 && block.timestamp < lastClaim + CLAIM_COOLDOWN)
        cooldownRemaining = (lastClaim + CLAIM_COOLDOWN) - block.timestamp;

    totalClaimCount = claimCount[wallet];
    reserved        = reservedTokenId[wallet];

    uint256[] memory ids = walletClaimIds[wallet];
    for (uint256 i = 0; i < ids.length; i++)
        if (claims[ids[i]].verified) verifiedClaims++;
}

    function totalReserved() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function totalClaims() external view returns (uint256) {
        return claims.length;
    }
}