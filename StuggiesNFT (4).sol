// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

contract StuggiesNFT is
    ERC721,
    ERC721Enumerable,
    ERC721Royalty,
    Ownable,
    ReentrancyGuard
{
    using Strings for uint256;
    using StuggiesRewards for StuggiesRewards.Data;

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

    uint256 public constant TOTAL_SUPPLY  = 3333;
    uint256 public constant TEAM_RESERVE  = 33;

    uint256 public constant GTD_PRICE     = 0.0013 ether;
    uint256 public constant FCFS_PRICE    = 0.0015 ether;
    uint256 public constant PUBLIC_PRICE  = 0.0018 ether;

    uint256 public constant REFUND_BPS    = 5000;
    uint256 public constant HOLDER_BPS    = 3000;
    uint256 public constant DEV_BPS       = 1000;
    uint256 public constant BUYBACK_BPS   = 1000;

    uint256 public constant MAX_TX        = 5;
    uint256 public constant MAX_WALLET    = 10;

    string private unrevealedURI;
    string private baseURI;
    string private _contractURI;

    bool public revealed;
    bool public paused;
    bool public burnEnabled = true;

    enum Phase { Closed, GTD, FCFS, Public }
    Phase public currentPhase;

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

    event PhaseSet(Phase phase, uint256 startBlock);
    event Revealed(string baseURI);
    event NFTBurned(address indexed burner, uint256 tokenId, uint256 refund);
    event BurnStatusChanged(bool enabled);
    event PostSelloutWithdrawal(address indexed to, uint256 amount);

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

        for (uint256 i = 0; i < TEAM_RESERVE; ++i) {
            uint256 id = _totalMinted + 1;
            ++_totalMinted;
            mintPriceOf[id] = PUBLIC_PRICE;
            _safeMint(owner_, id);
        }

        rewards.reservedForBurns += PUBLIC_PRICE * TEAM_RESERVE * (REFUND_BPS + HOLDER_BPS) / 10000;
    }

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

    function mintPublic(uint256 qty)
        external
        payable
        notPaused
        rightPhase(Phase.Public)
        enoughSupply(qty)
    {
        if (qty == 0 || qty > MAX_TX)                    revert OverTx();
        if (publicMinted[msg.sender] + qty > MAX_WALLET) revert OverWallet();

        uint256 cost = PUBLIC_PRICE * qty;
        if (msg.value < cost)                            revert LowETH();

        publicMinted[msg.sender] += qty;
        _mintBatch(msg.sender, qty, PUBLIC_PRICE);

        _refund(msg.value - cost);
    }

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

    function burn(uint256 tokenId) external notPaused nonReentrant {
        if (!burnEnabled)                          revert BurnDisabled();
        if (ownerOf(tokenId) != msg.sender)        revert NotOwner();

        uint256 price = mintPriceOf[tokenId];
        if (price == 0)                            revert NoPrice();

        uint256 refund      = price * REFUND_BPS  / 10000;
        uint256 holderShare = price * HOLDER_BPS  / 10000;
        uint256 devShare    = price * DEV_BPS     / 10000;
        uint256 buyShare    = price * BUYBACK_BPS / 10000;

        rewards.update(msg.sender, balanceOf(msg.sender));

        uint256 reserved = price * (REFUND_BPS + HOLDER_BPS) / 10000;
        if (rewards.reservedForBurns >= reserved) {
            rewards.reservedForBurns -= reserved;
        } else {
            rewards.reservedForBurns = 0;
        }

        ++burnedCount;
        _burn(tokenId);

        if (holderShare > 0) {
            uint256 supply = totalSupply();
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

    function _mintBatch(address to, uint256 qty, uint256 price) internal {
        rewards.reservedForBurns += price * qty * (REFUND_BPS + HOLDER_BPS) / 10000;
        rewards.update(to, balanceOf(to));

        for (uint256 i = 0; i < qty; ++i) {
            uint256 id = _totalMinted + 1;
            ++_totalMinted;
            mintPriceOf[id] = price;
            _safeMint(to, id);
        }
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
            rewards.update(from, balanceOf(from));
            rewards.update(to,   balanceOf(to));
        }
        return super._update(to, tokenId, auth);
    }

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

    function setPhase(Phase newPhase) external onlyOwner {
        currentPhase = newPhase;
        emit PhaseSet(newPhase, block.number);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

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

    function withdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal <= rewards.reservedForBurns) revert NoFunds();
        uint256 amount = bal - rewards.reservedForBurns;
        (bool ok, ) = payable(owner()).call{value: amount}("");
        if (!ok) revert TxFail();
    }

    function withdrawPostSellout(uint256 amount) external onlyOwner nonReentrant {
        if (_totalMinted < TOTAL_SUPPLY) revert NotSoldOut();
        if (burnEnabled)                 revert BurnDisabled();
        if (amount == 0 || amount > address(this).balance) revert NoFunds();

        if (amount >= rewards.reservedForBurns) {
            rewards.reservedForBurns = 0;
        } else {
            rewards.reservedForBurns -= amount;
        }

        (bool ok, ) = payable(owner()).call{value: amount}("");
        if (!ok) revert TxFail();

        emit PostSelloutWithdrawal(owner(), amount);
    }

    function totalMinted()     public view returns (uint256) { return _totalMinted; }
    function remainingSupply() public view returns (uint256) { return TOTAL_SUPPLY - _totalMinted; }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return revealed
            ? string(abi.encodePacked(baseURI, tokenId.toString()))
            : unrevealedURI;
    }

    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    receive() external payable {}
}
