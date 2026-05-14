// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StuggiesNFT is
    ERC721,
    ERC721Enumerable,
    ERC721Royalty,
    Ownable,
    ReentrancyGuard
{
    using Strings for uint256;

    // ─────────────────────────────────────────────
    //  MINT CONSTANTS
    // ─────────────────────────────────────────────

    uint256 public constant TOTAL_SUPPLY          = 3_333;
    uint256 public constant TEAM_RESERVE          = 33;
    uint256 public constant BASE_PRICE            = 0.0018 ether;
    uint256 public constant GTD_PRICE             = 0.0013 ether;
    uint256 public constant FCFS_PRICE            = 0.0015 ether;
    uint256 public constant MAX_PUBLIC_PER_TX     = 5;
    uint256 public constant MAX_PUBLIC_PER_WALLET = 10;

    // ─────────────────────────────────────────────
    //  DECAY CONSTANTS  (public price ramp-down)
    // ─────────────────────────────────────────────

    uint256 public constant DECAY_BLOCKS    = 100_800;
    uint256 public constant PEAK_MULTIPLIER = 50;
    uint256 public constant FLOOR_MULTIPLIER = 1;

    // ─────────────────────────────────────────────
    //  BURN SPLIT  (basis points, must sum to 10_000)
    // ─────────────────────────────────────────────

    uint256 public constant BURN_REFUND_BPS  = 5_000; // 50% → burner
    uint256 public constant BURN_HOLDER_BPS  = 3_000; // 30% → holder reward pool
    uint256 public constant BURN_DEV_BPS     = 1_000; // 10% → devWallet
    uint256 public constant BURN_BUYBACK_BPS = 1_000; // 10% → buybackWallet

    // ─────────────────────────────────────────────
    //  METADATA
    // ─────────────────────────────────────────────

    string private _unrevealedURI;
    string private _baseTokenURI;
    string private _contractMetadataURI;

    bool public revealed = false;
    bool public paused   = false;

    // ─────────────────────────────────────────────
    //  PHASE
    // ─────────────────────────────────────────────

    enum Phase { Closed, GTD, FCFS, Public }
    Phase public currentPhase = Phase.Closed;

    uint256 public publicSaleStartBlock;

    // ─────────────────────────────────────────────
    //  SUPPLY TRACKING
    // ─────────────────────────────────────────────

    uint256 public burnedCount;
    uint256 private _totalMinted;

    /// @dev ETH that must stay in the contract to cover future burn refunds
    ///      and holder-pool deposits for already-minted tokens.
    uint256 public reservedForBurns;

    // ─────────────────────────────────────────────
    //  MERKLE ROOTS
    // ─────────────────────────────────────────────

    bytes32 public gtdMerkleRoot;
    bytes32 public fcfsMerkleRoot;

    // ─────────────────────────────────────────────
    //  ADDRESSES
    // ─────────────────────────────────────────────

    address public devWallet;
    address public buybackWallet;

    // ─────────────────────────────────────────────
    //  PER-MINT ACCOUNTING
    // ─────────────────────────────────────────────

    mapping(address => uint256) public gtdMinted;
    mapping(address => uint256) public fcfsMinted;
    mapping(address => uint256) public publicMinted;

    /// @notice The price paid when a token was minted (used for burn refund calc).
    mapping(uint256 => uint256) public mintPriceOf;

    // ─────────────────────────────────────────────
    //  ETH REWARD ACCUMULATOR
    // ─────────────────────────────────────────────

    /// @notice Ever-increasing ETH-per-NFT accumulator (scaled ×1e18).
    uint256 public rewardPerTokenStored;

    /// @notice Snapshot of rewardPerTokenStored at each holder's last update.
    mapping(address => uint256) public rewardPerTokenPaid;

    /// @notice Snapshotted (but not yet claimed) ETH for each holder.
    mapping(address => uint256) public pendingEth;

    // ─────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────

    event PhaseChanged(Phase newPhase, uint256 startBlock);
    event Revealed(string baseURI);
    event BaseURIUpdated(string newBaseURI);
    event Paused(bool status);
    event TeamMinted(address indexed to, uint256 quantity);
    event NFTBurned(
        address indexed burner,
        uint256 indexed tokenId,
        uint256 mintPrice,
        uint256 refund,
        uint256 holderReward,
        uint256 devShare,
        uint256 buybackShare
    );
    event RewardDeposited(uint256 amount, uint256 unburnedSupply, uint256 newRewardPerToken);
    event RewardClaimed(address indexed holder, uint256 amount);

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    constructor(
        address initialOwner,
        address devWallet_,
        address buybackWallet_,
        string memory unrevealedURI_,
        string memory contractURI_,
        address royaltyReceiver,
        uint96  royaltyBps
    ) ERC721("Stuggies", "STUGGIES") Ownable(initialOwner) {
        require(devWallet_     != address(0), "Zero dev wallet");
        require(buybackWallet_ != address(0), "Zero buyback wallet");

        devWallet            = devWallet_;
        buybackWallet        = buybackWallet_;
        _unrevealedURI       = unrevealedURI_;
        _contractMetadataURI = contractURI_;
        _setDefaultRoyalty(royaltyReceiver, royaltyBps);

        for (uint256 i = 0; i < TEAM_RESERVE; i++) {
            uint256 tokenId = _totalMinted + 1;
            _totalMinted++;
            mintPriceOf[tokenId] = BASE_PRICE;
            _safeMint(initialOwner, tokenId);
        }
        emit TeamMinted(initialOwner, TEAM_RESERVE);
    }

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier whenPhaseActive(Phase phase) {
        require(currentPhase == phase, "Phase not active");
        _;
    }

    modifier supplyAvailable(uint256 quantity) {
        require(_totalMinted + quantity <= TOTAL_SUPPLY, "Exceeds total supply");
        _;
    }

    // ─────────────────────────────────────────────
    //  VIEW — SUPPLY
    // ─────────────────────────────────────────────

    function unburnedSupply()   public view returns (uint256) { return totalSupply(); }
    function remainingSupply()  public view returns (uint256) { return TOTAL_SUPPLY - _totalMinted; }
    function totalMinted()      public view returns (uint256) { return _totalMinted; }
    function getCurrentPhase()  public view returns (uint8)   { return uint8(currentPhase); }

    // ─────────────────────────────────────────────
    //  VIEW — PRICING
    // ─────────────────────────────────────────────

    function publicMintPrice() public view returns (uint256) {
        if (publicSaleStartBlock == 0) return 0;
        uint256 elapsed = block.number - publicSaleStartBlock;
        if (elapsed >= DECAY_BLOCKS) return FLOOR_MULTIPLIER * BASE_PRICE;
        uint256 multiplier = PEAK_MULTIPLIER -
            ((PEAK_MULTIPLIER - FLOOR_MULTIPLIER) * elapsed / DECAY_BLOCKS);
        return multiplier * BASE_PRICE;
    }

    function getPriceForCurrentPhase() public view returns (uint256) {
        if (currentPhase == Phase.GTD)    return GTD_PRICE;
        if (currentPhase == Phase.FCFS)   return FCFS_PRICE;
        if (currentPhase == Phase.Public) return publicMintPrice();
        return 0;
    }

    // ─────────────────────────────────────────────
    //  VIEW — REWARDS
    // ─────────────────────────────────────────────

    /**
     * @notice Returns total unclaimed ETH for `holder` (snapshotted + newly accrued).
     */
    function pendingRewards(address holder) public view returns (uint256) {
        uint256 nftBalance = balanceOf(holder);
        uint256 accrued = (
            (rewardPerTokenStored - rewardPerTokenPaid[holder]) * nftBalance
        ) / 1e18;
        return pendingEth[holder] + accrued;
    }

    // ─────────────────────────────────────────────
    //  VIEW — WALLET
    // ─────────────────────────────────────────────

    function walletOfOwner(address wallet) public view returns (uint256[] memory) {
        uint256 count = balanceOf(wallet);
        uint256[] memory tokens = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            tokens[i] = tokenOfOwnerByIndex(wallet, i);
        }
        return tokens;
    }

    function isRevealed() public view returns (bool) { return revealed; }

    // ─────────────────────────────────────────────
    //  OWNER — PHASE / PAUSE
    // ─────────────────────────────────────────────

    function setPhase(Phase newPhase) external onlyOwner {
        if (newPhase == Phase.Public && publicSaleStartBlock == 0) {
            publicSaleStartBlock = block.number;
        }
        currentPhase = newPhase;
        emit PhaseChanged(newPhase, block.number);
    }

    function setPaused(bool isPaused) external onlyOwner {
        paused = isPaused;
        emit Paused(isPaused);
    }

    // ─────────────────────────────────────────────
    //  OWNER — WALLETS
    // ─────────────────────────────────────────────

    function setDevWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Zero address");
        devWallet = newWallet;
    }

    function setBuybackWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Zero address");
        buybackWallet = newWallet;
    }

    // ─────────────────────────────────────────────
    //  OWNER — MERKLE ROOTS
    // ─────────────────────────────────────────────

    function setGtdMerkleRoot(bytes32 root)  external onlyOwner { gtdMerkleRoot  = root; }
    function setFcfsMerkleRoot(bytes32 root) external onlyOwner { fcfsMerkleRoot = root; }

    // ─────────────────────────────────────────────
    //  OWNER — METADATA
    // ─────────────────────────────────────────────

    function setUnrevealedURI(string calldata newURI) external onlyOwner {
        _unrevealedURI = newURI;
    }

    function reveal(string calldata baseURI_) external onlyOwner {
        require(!revealed, "Already revealed");
        _baseTokenURI = baseURI_;
        revealed = true;
        emit Revealed(baseURI_);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function setContractURI(string calldata newURI) external onlyOwner {
        _contractMetadataURI = newURI;
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    // ─────────────────────────────────────────────
    //  OWNER — AIRDROP / WITHDRAW
    // ─────────────────────────────────────────────

    function airdrop(
        address[] calldata recipients,
        uint256[] calldata quantities
    ) external onlyOwner nonReentrant {
        require(recipients.length == quantities.length, "Array mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 qty = quantities[i];
            require(_totalMinted + qty <= TOTAL_SUPPLY, "Exceeds total supply");
            _mintTokens(recipients[i], qty, BASE_PRICE);
        }
    }

    function withdraw() external onlyOwner nonReentrant {
        require(address(this).balance > reservedForBurns, "No free funds");
        uint256 withdrawable = address(this).balance - reservedForBurns;
        (bool ok, ) = payable(owner()).call{value: withdrawable}("");
        require(ok, "Withdraw failed");
    }

    // ─────────────────────────────────────────────
    //  MINT — GTD
    // ─────────────────────────────────────────────

    function mintGTD(
        uint256 quantity,
        uint256 maxAlloc,
        bytes32[] calldata proof
    )
        external
        payable
        nonReentrant
        whenNotPaused
        whenPhaseActive(Phase.GTD)
        supplyAvailable(quantity)
    {
        require(quantity > 0, "Quantity must be > 0");
        require(gtdMinted[msg.sender] + quantity <= maxAlloc, "Exceeds GTD allocation");
        require(msg.value >= GTD_PRICE * quantity, "Insufficient ETH");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, maxAlloc));
        require(MerkleProof.verify(proof, gtdMerkleRoot, leaf), "Invalid GTD proof");

        gtdMinted[msg.sender] += quantity;
        _mintTokens(msg.sender, quantity, GTD_PRICE);
        _refundExcess(GTD_PRICE * quantity);
    }

    // ─────────────────────────────────────────────
    //  MINT — FCFS
    // ─────────────────────────────────────────────

    function mintFCFS(
        uint256 quantity,
        uint256 maxAlloc,
        bytes32[] calldata proof
    )
        external
        payable
        nonReentrant
        whenNotPaused
        whenPhaseActive(Phase.FCFS)
        supplyAvailable(quantity)
    {
        require(quantity > 0, "Quantity must be > 0");
        require(fcfsMinted[msg.sender] + quantity <= maxAlloc, "Exceeds FCFS allocation");
        require(msg.value >= FCFS_PRICE * quantity, "Insufficient ETH");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, maxAlloc));
        require(MerkleProof.verify(proof, fcfsMerkleRoot, leaf), "Invalid FCFS proof");

        fcfsMinted[msg.sender] += quantity;
        _mintTokens(msg.sender, quantity, FCFS_PRICE);
        _refundExcess(FCFS_PRICE * quantity);
    }

    // ─────────────────────────────────────────────
    //  MINT — PUBLIC
    // ─────────────────────────────────────────────

    function mintPublic(uint256 quantity)
        external
        payable
        nonReentrant
        whenNotPaused
        whenPhaseActive(Phase.Public)
        supplyAvailable(quantity)
    {
        require(quantity > 0 && quantity <= MAX_PUBLIC_PER_TX, "Exceeds max per tx");
        require(publicMinted[msg.sender] + quantity <= MAX_PUBLIC_PER_WALLET, "Exceeds wallet limit");

        uint256 price     = publicMintPrice();
        uint256 totalCost = price * quantity;
        require(msg.value >= totalCost, "Insufficient ETH");

        publicMinted[msg.sender] += quantity;
        _mintTokens(msg.sender, quantity, price);
        _refundExcess(totalCost);
    }

    // ─────────────────────────────────────────────
    //  BURN
    // ─────────────────────────────────────────────

    /**
     * @notice Burn your NFT to receive 50% of its mint price back.
     *         30% is distributed to all remaining holders via the accumulator.
     *         10% goes to devWallet, 10% to buybackWallet.
     *
     * @dev  Order of operations:
     *       1. Snapshot rewards for the burner BEFORE their balance drops.
     *       2. Burn the token (balance decreases by 1).
     *       3. Distribute the holder-pool ETH across the NEW (post-burn) supply.
     *       4. Send ETH splits.
     */
    function burn(uint256 tokenId) external nonReentrant whenNotPaused {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");

        uint256 price = mintPriceOf[tokenId];
        require(price > 0, "Mint price not recorded");
        require(address(this).balance >= price, "Insufficient contract balance");

        uint256 refundAmt  = (price * BURN_REFUND_BPS)  / 10_000;
        uint256 holderAmt  = (price * BURN_HOLDER_BPS)  / 10_000;
        uint256 devAmt     = (price * BURN_DEV_BPS)     / 10_000;
        uint256 buybackAmt = (price * BURN_BUYBACK_BPS) / 10_000;

        // 1. Snapshot the burner's rewards while they still hold the token.
        _updateReward(msg.sender);
        reservedForBurns -= (refundAmt + holderAmt);

        // 3. Burn — ERC721Enumerable._update handles balance/supply.
        burnedCount++;
        _burn(tokenId);

        // 4. Distribute holder-pool ETH over the post-burn supply.
        uint256 remainingHolders = totalSupply(); // supply already decreased
        if (holderAmt > 0 && remainingHolders > 0) {
            uint256 delta = (holderAmt * 1e18) / remainingHolders;
            rewardPerTokenStored += delta;
            emit RewardDeposited(holderAmt, remainingHolders, rewardPerTokenStored);
        }

        // 5. Send ETH.
        (bool ok1, ) = payable(msg.sender).call{value: refundAmt}("");
        require(ok1, "Refund failed");

        (bool ok2, ) = payable(devWallet).call{value: devAmt}("");
        require(ok2, "Dev transfer failed");

        (bool ok3, ) = payable(buybackWallet).call{value: buybackAmt}("");
        require(ok3, "Buyback transfer failed");

        emit NFTBurned(msg.sender, tokenId, price, refundAmt, holderAmt, devAmt, buybackAmt);
    }

    // ─────────────────────────────────────────────
    //  CLAIM REWARDS
    // ─────────────────────────────────────────────

    /**
     * @notice Pull all accrued ETH rewards to your wallet.
     * @dev    Call before transferring NFTs to avoid leaving rewards behind.
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
    //  INTERNAL — REWARD SNAPSHOT
    // ─────────────────────────────────────────────

    function _updateReward(address holder) internal {
        if (holder == address(0)) return;
        uint256 nftBalance = balanceOf(holder);
        uint256 accrued = (
            (rewardPerTokenStored - rewardPerTokenPaid[holder]) * nftBalance
        ) / 1e18;
        pendingEth[holder]        += accrued;
        rewardPerTokenPaid[holder] = rewardPerTokenStored;
    }

    // ─────────────────────────────────────────────
    //  INTERNAL — _update  (transfer hook)
    // ─────────────────────────────────────────────

    /**
     * @dev Snapshot rewards for sender and receiver around every transfer so
     *      neither party gains or loses rewards due to the balance change.
     *      this is O(1) and safe to run in a loop.
     *
     *      Skips mints (from == address(0)) and burns (to == address(0))
     *      because those are handled explicitly in their own functions.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) returns (address)
    {
        address from = _ownerOf(tokenId);

        // Only snapshot on real wallet-to-wallet transfers.
        if (from != address(0) && to != address(0)) {
            _updateReward(from);
            _updateReward(to);
        }

        return super._update(to, tokenId, auth);
    }

    // ─────────────────────────────────────────────
    //  INTERNAL — MINT HELPERS
    // ─────────────────────────────────────────────

    function _mintTokens(address to, uint256 quantity, uint256 price) internal {
        // Reserve ETH to cover the refund + holder-pool portions of future burns.
        reservedForBurns += price * quantity * (BURN_REFUND_BPS + BURN_HOLDER_BPS) / 10_000;

        // Snapshot the receiver's rewards before their balance increases.
        _updateReward(to);

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _totalMinted + 1;
            _totalMinted++;
            mintPriceOf[tokenId] = price;
            _safeMint(to, tokenId);
        }
    }

    function _refundExcess(uint256 expected) internal {
        uint256 excess = msg.value - expected;
        if (excess > 0) {
            (bool ok, ) = payable(msg.sender).call{value: excess}("");
            require(ok, "Refund failed");
        }
    }

    // ─────────────────────────────────────────────
    //  METADATA
    // ─────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        if (!revealed) return _unrevealedURI;
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString()));
    }

    function contractURI() public view returns (string memory) {
        return _contractMetadataURI;
    }

    // ─────────────────────────────────────────────
    //  OVERRIDES REQUIRED BY SOLIDITY
    // ─────────────────────────────────────────────

    function _increaseBalance(address account, uint128 value)
        internal override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721Enumerable, ERC721Royalty) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ─────────────────────────────────────────────
    //  RECEIVE ETH
    // ─────────────────────────────────────────────

    receive() external payable {}
}
