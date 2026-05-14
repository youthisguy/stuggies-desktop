// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ---------------------------------------------------------------------------
// Rewards Library
// ---------------------------------------------------------------------------
library StuggiesRewards {
    struct Data {
        uint256 rewardPerTokenStored;
        mapping(address => uint256) rewardPerTokenPaid;
        mapping(address => uint256) pendingEth;
        uint256 reservedForBurns;
    }

    function update(Data storage self, address holder, uint256 balance) internal {
        if (holder == address(0)) return;
        uint256 accrued = (self.rewardPerTokenStored - self.rewardPerTokenPaid[holder]) * balance / 1e18;
        self.pendingEth[holder] += accrued;
        self.rewardPerTokenPaid[holder] = self.rewardPerTokenStored;
    }

    function deposit(Data storage self, uint256 amount, uint256 supply) internal {
        if (amount == 0 || supply == 0) return;
        self.rewardPerTokenStored += (amount * 1e18) / supply;
    }
}

// ---------------------------------------------------------------------------
// Sine-wave approximation library (integer math, no floats)
//
// Approximates sin(x) for x in [0, 2π) using a piecewise cubic Bhaskara
// approximation scaled to avoid floating point.
//
// Input : `angle` in units of 1e6 (i.e. 1e6 == 1 radian, range [0, 6_283_185])
// Output: sin value in range [-1e6, 1e6]  (i.e. 1e6 == 1.0)
// ---------------------------------------------------------------------------
library TrigMath {
    // π * 1e6
    uint256 internal constant PI6     = 3_141_592;
    // 2π * 1e6
    uint256 internal constant TWO_PI6 = 6_283_185;

    /// @dev Returns sin(angle) * 1e6, where angle is in [0, TWO_PI6).
    ///      Result is in [-1e6, 1e6] expressed as int256.
    function sin6(uint256 angle) internal pure returns (int256) {
        // Normalise angle into [0, 2π)
        angle = angle % TWO_PI6;

        // Determine sign and fold into [0, π)
        bool negative = angle >= PI6;
        uint256 a = negative ? angle - PI6 : angle;

        // Bhaskara I approximation:  sin(x) ≈ 16x(π-x) / (5π² - 4x(π-x))
        // All values × 1e6 to stay integer.
        // x  = a (already ×1e6 units)   → treat as numerator friendly
        // π  = PI6
        // Result ×1e6.
        //
        // sin(a) ≈ 16·a·(π-a) / (5·π² - 4·a·(π-a))
        // Scale: numerator   = 16 · a · (PI6 - a)          [units: 1e12]
        //        denominator = 5·PI6² - 4·a·(PI6 - a)      [units: 1e12]
        // Divide num/den gives dimensionless ×1e0 → multiply by 1e6 for output.
        //
        // To avoid overflow we work with reduced magnitudes:
        //   let p = a / 1e3,  q = (PI6 - a) / 1e3   → product p*q is 1e6 scale
        uint256 p = a / 1000;
        uint256 q = (PI6 - a) / 1000;
        uint256 pq = p * q; // ≈ [0, ~2.47e6]  (max when a = π/2)

        uint256 numer = 16 * pq;                          // [0, ~3.95e7]
        uint256 pi2   = (PI6 / 1000) * (PI6 / 1000);     // ≈ 9.87e6
        uint256 denom = 5 * pi2 - 4 * pq;                // always positive

        // Result is dimensionless ≈ 0..1; scale up to ×1e6
        uint256 sinAbs = (numer * 1_000_000) / denom;

        // Cap at 1e6 (rounding edge cases)
        if (sinAbs > 1_000_000) sinAbs = 1_000_000;

        return negative ? -int256(sinAbs) : int256(sinAbs);
    }
}

// ---------------------------------------------------------------------------
// Main Contract
// ---------------------------------------------------------------------------
contract StuggiesNFT is
    ERC721,
    ERC721Enumerable,
    ERC721Royalty,
    Ownable,
    ReentrancyGuard
{
    using Strings for uint256;
    using StuggiesRewards for StuggiesRewards.Data;
    using TrigMath for uint256;

    // -----------------------------------------------------------------------
    // Custom Errors
    // -----------------------------------------------------------------------
    error ZeroAddr();
    error Paused();
    error WrongPhase();
    error OverSupply();
    error ZeroQty();
    error LowETH();
    error OverGTD();
    error OverFCFS();
    error OverTx();
    error OverWallet();
    error BadProof();
    error NotOwner();
    error NoPrice();
    error NoFunds();
    error TxFail();
    error AlreadyRevealed();
    error BurnDisabled();
    error NotSoldOut();
    error PriceExceeded();   // caller's maxPrice < current price

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------
    uint256 public constant TOTAL_SUPPLY  = 3333;
    uint256 public constant TEAM_RESERVE  = 33;

    // --- Whitelist prices (fixed) ---
    uint256 public constant GTD_PRICE  = 0.0013 ether;
    uint256 public constant FCFS_PRICE = 0.0015 ether;

    // --- Public sale sine-wave price config ---
    // BASE_PRICE is the mid-point (mean) of the wave.
    uint256 public constant BASE_PRICE = 0.0018 ether;

    // Amplitude: price swings ±AMPLITUDE_BPS basis-points around BASE_PRICE.
    // 5000 BPS = 50% → peak = BASE_PRICE * 1.5, trough = BASE_PRICE * 0.5
    uint256 public constant AMPLITUDE_BPS = 5000;

    // Period: one full sine cycle = 24 hours ≈ 7200 blocks (12-s blocks).
    // Adjust PERIOD_BLOCKS at deploy if your target chain differs.
    uint256 public constant PERIOD_BLOCKS = 7200;

    // Absolute floor / ceiling guards
    uint256 public constant PRICE_FLOOR   = 0.0009 ether; // BASE * 0.5
    uint256 public constant PRICE_CEILING = 0.0027 ether; // BASE * 1.5

    // Slippage tolerance for callers: 2% by default (200 BPS).
    // mintPublic passes a `maxPrice` per token; we refund the difference
    // if the actual price is lower, and revert if price > maxPrice.
    // 200 BPS = 2% headroom callers should add above their quoted price.
    uint256 public constant SLIPPAGE_BPS  = 200;          // informational only

    // --- Revenue split (basis points, must sum to 10000) ---
    uint256 public constant REFUND_BPS   = 5000;
    uint256 public constant HOLDER_BPS   = 3000;
    uint256 public constant DEV_BPS      = 1000;
    uint256 public constant BUYBACK_BPS  = 1000;

    // --- Mint limits ---
    uint256 public constant MAX_TX     = 5;
    uint256 public constant MAX_WALLET = 10;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    string private unrevealedURI;
    string private baseURI;
    string private _contractURI;

    bool public revealed;
    bool public paused;
    bool public burnEnabled = true;  

    enum Phase { Closed, GTD, FCFS, Public }
    Phase public currentPhase;
    uint256 public publicSaleStartBlock;

    uint256 private _totalMinted;
    uint256 public  burnedCount;

    StuggiesRewards.Data public rewards;

    bytes32 public gtdRoot;
    bytes32 public fcfsRoot;

    address public devWallet;
    address public buybackWallet;

    mapping(address => uint256) public gtdMinted;
    mapping(address => uint256) public fcfsMinted;
    mapping(address => uint256) public publicMinted;
    mapping(uint256 => uint256) public mintPriceOf;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    event PhaseSet(Phase phase, uint256 startBlock);
    event Revealed(string baseURI);
    event NFTBurned(address indexed burner, uint256 tokenId, uint256 refund);
    event BurnStatusChanged(bool enabled);
    event PostSelloutWithdrawal(address indexed to, uint256 amount);

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    constructor(
        address owner_,
        address dev_,
        address buyback_,
        string memory unrevealed_,
        string memory contractURI_,
        address royaltyReceiver,
        uint96  royaltyFee
    ) ERC721("Stuggies", "STUGGIES") Ownable(owner_) {
        if (dev_ == address(0) || buyback_ == address(0)) revert ZeroAddr();

        devWallet      = dev_;
        buybackWallet  = buyback_;
        unrevealedURI  = unrevealed_;
        _contractURI   = contractURI_;
        _setDefaultRoyalty(royaltyReceiver, royaltyFee);

        // Mint team reserve to owner — priced at BASE_PRICE for burn accounting
        for (uint256 i = 0; i < TEAM_RESERVE; ++i) {
            uint256 id = _totalMinted + 1;
            ++_totalMinted;
            mintPriceOf[id] = BASE_PRICE;
            _safeMint(owner_, id);
        }

        // Seed reservedForBurns for the team tokens
        // (no ETH actually received, but accounting must match burn logic)
        rewards.reservedForBurns += BASE_PRICE * TEAM_RESERVE * (REFUND_BPS + HOLDER_BPS) / 10000;
    }

    // -----------------------------------------------------------------------
    // Modifiers
    // -----------------------------------------------------------------------
    modifier notPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier rightPhase(Phase p) {
        if (currentPhase != p) revert WrongPhase();
        _;
    }

    modifier enoughSupply(uint256 qty) {
        if (_totalMinted + qty > TOTAL_SUPPLY) revert OverSupply();
        _;
    }

    // -----------------------------------------------------------------------
    // Public Mint  (sine-wave price, with maxPrice tolerance)
    // -----------------------------------------------------------------------
    /// @notice Mint during public sale.
    /// @param qty      Number of tokens to mint (1–MAX_TX).
    /// @param maxPrice Maximum price per token the caller is willing to pay.
    ///                 Pass `publicMintPrice() * (10000 + SLIPPAGE_BPS) / 10000`
    ///                 from the frontend to absorb ~2 % of price drift.
    ///                 Reverts if the actual price exceeds maxPrice.
    ///                 Any ETH above `actualPrice * qty` is refunded.
    function mintPublic(
        uint256 qty,
        uint256 maxPrice
    )
        external
        payable
        notPaused
        rightPhase(Phase.Public)
        enoughSupply(qty)
    {
        if (qty == 0 || qty > MAX_TX)                     revert OverTx();
        if (publicMinted[msg.sender] + qty > MAX_WALLET)  revert OverWallet();

        uint256 price = _currentPrice();
        // Guard: if the wave has moved above the caller's ceiling, revert
        // so they can re-quote instead of being silently overcharged.
        if (price > maxPrice)                             revert PriceExceeded();

        uint256 cost = price * qty;
        if (msg.value < cost)                             revert LowETH();

        publicMinted[msg.sender] += qty;
        _mintBatch(msg.sender, qty, price);

        // Refund any excess ETH (overshoot from maxPrice padding)
        _refund(msg.value - cost);
    }

    // -----------------------------------------------------------------------
    // GTD Mint
    // -----------------------------------------------------------------------
    function mintGTD(
        uint256 qty,
        uint256 max,
        bytes32[] calldata proof
    )
        external
        payable
        notPaused
        rightPhase(Phase.GTD)
        enoughSupply(qty)
    {
        if (qty == 0)                                         revert ZeroQty();
        if (gtdMinted[msg.sender] + qty > max)               revert OverGTD();
        if (msg.value < GTD_PRICE * qty)                     revert LowETH();
        if (!MerkleProof.verify(
            proof,
            gtdRoot,
            keccak256(abi.encodePacked(msg.sender, max))
        ))                                                    revert BadProof();

        gtdMinted[msg.sender] += qty;
        _mintBatch(msg.sender, qty, GTD_PRICE);
        _refund(msg.value - GTD_PRICE * qty);
    }

    // -----------------------------------------------------------------------
    // FCFS Mint
    // -----------------------------------------------------------------------
    function mintFCFS(
        uint256 qty,
        uint256 max,
        bytes32[] calldata proof
    )
        external
        payable
        notPaused
        rightPhase(Phase.FCFS)
        enoughSupply(qty)
    {
        if (qty == 0)                                         revert ZeroQty();
        if (fcfsMinted[msg.sender] + qty > max)              revert OverFCFS();
        if (msg.value < FCFS_PRICE * qty)                    revert LowETH();
        if (!MerkleProof.verify(
            proof,
            fcfsRoot,
            keccak256(abi.encodePacked(msg.sender, max))
        ))                                                    revert BadProof();

        fcfsMinted[msg.sender] += qty;
        _mintBatch(msg.sender, qty, FCFS_PRICE);
        _refund(msg.value - FCFS_PRICE * qty);
    }

    // -----------------------------------------------------------------------
    // Burn & Rewards
    // -----------------------------------------------------------------------
    /// @notice Burn a token for a partial ETH refund.
    ///         Can be disabled by the owner once all NFTs are sold out
    ///         and the project transitions to secondary / OpenSea pricing.
    function burn(uint256 tokenId) external notPaused nonReentrant {
        if (!burnEnabled)                          revert BurnDisabled();
        if (ownerOf(tokenId) != msg.sender)        revert NotOwner();

        uint256 price = mintPriceOf[tokenId];
        if (price == 0)                            revert NoPrice();

        uint256 refund      = price * REFUND_BPS  / 10000;
        uint256 holderShare = price * HOLDER_BPS  / 10000;
        uint256 devShare    = price * DEV_BPS     / 10000;
        uint256 buyShare    = price * BUYBACK_BPS / 10000;

        // Update reward state for burner BEFORE balance changes
        rewards.update(msg.sender, balanceOf(msg.sender));

        // Only reduce reservedForBurns by what was actually reserved for this token
        uint256 reserved = price * (REFUND_BPS + HOLDER_BPS) / 10000;
        // Safety: never underflow (guard for team-reserve tokens seeded without real ETH)
        if (rewards.reservedForBurns >= reserved) {
            rewards.reservedForBurns -= reserved;
        } else {
            rewards.reservedForBurns = 0;
        }

        ++burnedCount;
        _burn(tokenId);

        // Distribute holder share to remaining holders
        if (holderShare > 0) {
            uint256 supply = totalSupply(); // post-burn supply
            rewards.deposit(holderShare, supply > 0 ? supply : 1);
        }

        _sendETH(msg.sender, refund);
        _sendETH(devWallet, devShare);
        _sendETH(buybackWallet, buyShare);

        emit NFTBurned(msg.sender, tokenId, refund);
    }

    function claimRewards() external nonReentrant {
        rewards.update(msg.sender, balanceOf(msg.sender));
        uint256 amount = rewards.pendingEth[msg.sender];
        if (amount == 0) revert LowETH();
        rewards.pendingEth[msg.sender] = 0;
        _sendETH(msg.sender, amount);
    }

    function pendingRewards(address holder) public view returns (uint256) {
        uint256 accrued =
            (rewards.rewardPerTokenStored - rewards.rewardPerTokenPaid[holder])
            * balanceOf(holder) / 1e18;
        return rewards.pendingEth[holder] + accrued;
    }

    // -----------------------------------------------------------------------
    // Internal Helpers
    // -----------------------------------------------------------------------
    function _mintBatch(address to, uint256 qty, uint256 price) internal {
        // Reserve ETH for future burn refunds + holder shares
        rewards.reservedForBurns += price * qty * (REFUND_BPS + HOLDER_BPS) / 10000;

        // Snapshot reward debt at current index for new holder
        rewards.update(to, balanceOf(to));

        for (uint256 i = 0; i < qty; ++i) {
            uint256 id = _totalMinted + 1;
            ++_totalMinted;
            mintPriceOf[id] = price;
            _safeMint(to, id);
        }
    }

    // -----------------------------------------------------------------------
    // Sine-wave price curve
    // -----------------------------------------------------------------------
    /// @dev Returns the current public-sale price per token.
    ///
    ///      Formula:  price = BASE_PRICE * (1 + A * sin(2π * t / T))
    ///      where:
    ///        A = AMPLITUDE_BPS / 10000  (0.5 → ±50%)
    ///        t = blocks elapsed since public sale start
    ///        T = PERIOD_BLOCKS          (7200 ≈ 24 h on Ethereum)
    ///
    ///      The wave starts at sin(0) = 0 (mid-price) and rises immediately,
    ///      peaking at T/4 (6 h), returning to mid at T/2 (12 h), troughing
    ///      at 3T/4 (18 h), then recovering to mid/peak again at T (24 h).
    ///
    ///      Early minters (0–6 h)  → rising price  (FOMO on cheapest entry)
    ///      Mid-session  (6–12 h)  → falling price (wait-and-see risk)
    ///      Late-session (18–24 h) → trough then rising (reward the patient)
    ///
    ///      Result clamped to [PRICE_FLOOR, PRICE_CEILING].
    function _currentPrice() internal view returns (uint256) {
        if (publicSaleStartBlock == 0) return BASE_PRICE;

        uint256 elapsed = block.number - publicSaleStartBlock;

        // Angle in TrigMath units (0 → TWO_PI6 over one period)
        uint256 angle = (elapsed % PERIOD_BLOCKS) * TrigMath.TWO_PI6 / PERIOD_BLOCKS;

        // sin value in [-1e6, 1e6]
        int256 sinVal = TrigMath.sin6(angle);

        // price = BASE_PRICE + BASE_PRICE * AMPLITUDE_BPS/10000 * sinVal/1e6
        //       = BASE_PRICE * (1e6*10000 + AMPLITUDE_BPS * sinVal) / (1e6*10000)
        int256 base    = int256(BASE_PRICE);
        int256 swing   = base * int256(AMPLITUDE_BPS) * sinVal / int256(10000 * 1_000_000);
        int256 rawPrice = base + swing;

        uint256 price = rawPrice > 0 ? uint256(rawPrice) : 0;

        // Clamp
        if (price < PRICE_FLOOR)   price = PRICE_FLOOR;
        if (price > PRICE_CEILING) price = PRICE_CEILING;

        return price;
    }

    function _refund(uint256 amount) internal {
        if (amount > 0) _sendETH(msg.sender, amount);
    }

    function _sendETH(address to, uint256 amt) private {
        if (amt > 0) {
            (bool ok, ) = payable(to).call{value: amt}("");
            if (!ok) revert TxFail();
        }
    }

    // -----------------------------------------------------------------------
    // ERC721 Transfer Hook — maintain reward accounting on transfers
    // -----------------------------------------------------------------------
    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            // Update both sides before balance changes
            rewards.update(from, balanceOf(from));
            rewards.update(to,   balanceOf(to));
        }
        return super._update(to, tokenId, auth);
    }

    // -----------------------------------------------------------------------
    // Required OpenZeppelin Overrides
    // -----------------------------------------------------------------------
    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // -----------------------------------------------------------------------
    // Owner Functions
    // -----------------------------------------------------------------------
    function setPhase(Phase newPhase) external onlyOwner {
        if (newPhase == Phase.Public && publicSaleStartBlock == 0) {
            publicSaleStartBlock = block.number;
        }
        currentPhase = newPhase;
        emit PhaseSet(newPhase, block.number);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /// @notice Enable or disable burns.
    ///         Call `setBurnEnabled(false)` once all 3333 NFTs are sold out
    ///         and you want the floor price to be set by secondary market.
    function setBurnEnabled(bool enabled) external onlyOwner {
        burnEnabled = enabled;
        emit BurnStatusChanged(enabled);
    }

    function reveal(string calldata newBaseURI) external onlyOwner {
        if (revealed) revert AlreadyRevealed();
        baseURI  = newBaseURI;
        revealed = true;
        emit Revealed(newBaseURI);
    }

    function setDevWallet(address newDev) external onlyOwner {
        if (newDev == address(0)) revert ZeroAddr();
        devWallet = newDev;
    }

    function setBuybackWallet(address newBuyback) external onlyOwner {
        if (newBuyback == address(0)) revert ZeroAddr();
        buybackWallet = newBuyback;
    }

    function setGtdRoot(bytes32 root)  external onlyOwner { gtdRoot  = root; }
    function setFcfsRoot(bytes32 root) external onlyOwner { fcfsRoot = root; }

    function setUnrevealedURI(string calldata uri) external onlyOwner { unrevealedURI = uri; }
    function setBaseURI(string calldata uri)        external onlyOwner { baseURI       = uri; }
    function setContractURI(string calldata uri)    external onlyOwner { _contractURI  = uri; }

    function setDefaultRoyalty(address receiver, uint96 fee) external onlyOwner {
        _setDefaultRoyalty(receiver, fee);
    }

    /// @notice Standard withdraw — pulls only freely available ETH
    ///         (total balance minus what is reserved for burns).
    function withdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal <= rewards.reservedForBurns) revert NoFunds();
        uint256 amount = bal - rewards.reservedForBurns;
        (bool ok, ) = payable(owner()).call{value: amount}("");
        if (!ok) revert TxFail();
    }

    /// @notice Post-sellout withdrawal — allows the owner to pull a specific
    ///         `amount` of ETH from the *total* protocol pot (including reserves)
    ///         once all 3333 tokens have been minted AND burns are disabled.
    ///
    ///         Use this to unwind the burn mechanism after the mint is fully
    ///         sold out and you want to transition the project to secondary
    ///         market pricing only.
    ///
    /// @param  amount  Wei to withdraw. Must be <= address(this).balance.
    function withdrawPostSellout(uint256 amount) external onlyOwner nonReentrant {
        if (_totalMinted < TOTAL_SUPPLY) revert NotSoldOut();
        if (burnEnabled)                 revert BurnDisabled(); // burns must be off first
        if (amount == 0 || amount > address(this).balance) revert NoFunds();

        // Also zero out reservedForBurns to keep accounting consistent
        if (amount >= rewards.reservedForBurns) {
            rewards.reservedForBurns = 0;
        } else {
            rewards.reservedForBurns -= amount;
        }

        (bool ok, ) = payable(owner()).call{value: amount}("");
        if (!ok) revert TxFail();

        emit PostSelloutWithdrawal(owner(), amount);
    }

    // -----------------------------------------------------------------------
    // View Functions
    // -----------------------------------------------------------------------
    function totalMinted()      public view returns (uint256) { return _totalMinted; }
    function remainingSupply()  public view returns (uint256) { return TOTAL_SUPPLY - _totalMinted; }

    /// @notice Current public mint price (sine wave).
    ///         Frontend should add ~2% slippage and pass as `maxPrice` to mintPublic.
    function publicMintPrice()  public view returns (uint256) { return _currentPrice(); }

    /// @notice Convenience: returns the recommended `maxPrice` parameter for
    ///         mintPublic, already padded with SLIPPAGE_BPS (2%).
    function publicMintMaxPrice() public view returns (uint256) {
        return _currentPrice() * (10000 + SLIPPAGE_BPS) / 10000;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return revealed
            ? string(abi.encodePacked(baseURI, tokenId.toString()))
            : unrevealedURI;
    }

    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    // -----------------------------------------------------------------------
    // Receive ETH (royalties, donations, etc.)
    // -----------------------------------------------------------------------
    receive() external payable {}
}
