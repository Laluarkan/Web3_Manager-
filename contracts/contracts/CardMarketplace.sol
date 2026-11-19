// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title CardMarketplace
 * @notice Marketplace P2P on-chain untuk jual-beli FootballCardNFT menggunakan token KANS.
 */
contract CardMarketplace is ReentrancyGuard, Ownable, EIP712 {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_FEE_BPS = 1_000; // Maksimal 10%

    IERC721 public immutable cardNft;
    IERC20 public immutable kansToken;

    uint256 public feeBps = 250; // Default 2.5%
    address public treasury;
    uint256 private _nextListingId = 1;

    struct Listing {
        uint256 listingId;
        address seller;
        uint256 tokenId;
        uint256 price; // Harga dalam wei KANS (18 desimal)
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => uint256) public activeListingByToken;
    mapping(uint256 => bool) public usedDealNonces;

    bytes32 private constant PRIVATE_DEAL_TYPEHASH = keccak256(
        "PrivateDeal(address seller,address buyer,uint256 tokenId,uint256 price,uint256 nonce,uint256 deadline)"
    );

    event CardListed(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 price
    );
    event ListingPriceUpdated(uint256 indexed listingId, uint256 newPrice);
    event ListingCanceled(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId);
    event CardSold(
        uint256 indexed listingId,
        address indexed seller,
        address indexed buyer,
        uint256 tokenId,
        uint256 price,
        uint256 fee
    );
    event PrivateDealExecuted(
        address indexed seller,
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 price,
        uint256 fee,
        uint256 nonce
    );
    event FeeUpdated(uint256 newFeeBps);
    event TreasuryUpdated(address indexed newTreasury);

    constructor(
        address cardNftAddress,
        address kansTokenAddress,
        address initialTreasury,
        address initialOwner
    ) Ownable(initialOwner) EIP712("W3CardMarketplace", "1") {
        require(cardNftAddress != address(0), "Alamat NFT tidak valid");
        require(kansTokenAddress != address(0), "Alamat KANS tidak valid");
        require(initialTreasury != address(0), "Alamat treasury tidak valid");

        cardNft = IERC721(cardNftAddress);
        kansToken = IERC20(kansTokenAddress);
        treasury = initialTreasury;
    }

    /**
     * @notice Memasang kartu NFT untuk dijual dengan harga KANS.
     */
    function listCard(uint256 tokenId, uint256 price) external returns (uint256 listingId) {
        require(price > 0, "Harga harus lebih dari 0");
        require(cardNft.ownerOf(tokenId) == msg.sender, "Anda bukan pemilik kartu ini");
        require(
            cardNft.isApprovedForAll(msg.sender, address(this)) ||
                cardNft.getApproved(tokenId) == address(this),
            "Marketplace belum diberi izin transfer NFT"
        );

        // Jika sebelumnya ada listing lama dari pemilik terdahulu (karena transfer manual), bersihkan otomatis
        uint256 existingId = activeListingByToken[tokenId];
        if (existingId != 0) {
            Listing storage oldListing = listings[existingId];
            require(oldListing.seller != msg.sender, "Kartu ini sudah sedang dijual");
            oldListing.active = false;
        }

        listingId = _nextListingId++;
        listings[listingId] = Listing({
            listingId: listingId,
            seller: msg.sender,
            tokenId: tokenId,
            price: price,
            active: true
        });
        activeListingByToken[tokenId] = listingId;

        emit CardListed(listingId, msg.sender, tokenId, price);
    }

    /**
     * @notice Membeli kartu NFT dari listing aktif menggunakan token KANS (atomic swap).
     */
    function buyCard(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing tidak aktif");
        require(msg.sender != listing.seller, "Tidak bisa membeli kartu sendiri");
        require(
            cardNft.ownerOf(listing.tokenId) == listing.seller,
            "Penjual sudah tidak memiliki kartu ini"
        );

        uint256 price = listing.price;
        address seller = listing.seller;
        uint256 tokenId = listing.tokenId;

        uint256 fee = (price * feeBps) / BPS_DENOMINATOR;
        uint256 sellerAmount = price - fee;

        // Effects sebelum interaksi eksternal (CEI pattern)
        listing.active = false;
        if (activeListingByToken[tokenId] == listingId) {
            activeListingByToken[tokenId] = 0;
        }

        // Transfer KANS dari pembeli -> treasury & penjual
        if (fee > 0) {
            kansToken.safeTransferFrom(msg.sender, treasury, fee);
        }
        kansToken.safeTransferFrom(msg.sender, seller, sellerAmount);

        // Transfer NFT dari penjual -> pembeli
        cardNft.safeTransferFrom(seller, msg.sender, tokenId);

        emit CardSold(listingId, seller, msg.sender, tokenId, price, fee);
    }

    /**
     * @notice Mengubah harga KANS pada listing yang masih aktif.
     */
    function updatePrice(uint256 listingId, uint256 newPrice) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing tidak aktif");
        require(listing.seller == msg.sender, "Hanya penjual yang bisa ubah harga");
        require(newPrice > 0, "Harga harus lebih dari 0");

        listing.price = newPrice;
        emit ListingPriceUpdated(listingId, newPrice);
    }

    /**
     * @notice Membatalkan penjualan kartu yang belum terjual.
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing tidak aktif");
        require(listing.seller == msg.sender, "Hanya penjual yang bisa membatalkan");

        listing.active = false;
        if (activeListingByToken[listing.tokenId] == listingId) {
            activeListingByToken[listing.tokenId] = 0;
        }

        emit ListingCanceled(listingId, msg.sender, listing.tokenId);
    }

    /**
     * @notice Eksekusi kesepakatan jual-beli privat (P2P Deal) yang sudah disetujui penjual via tanda tangan EIP-712.
     * @dev Pembeli (msg.sender) membayar KANS on-chain dan menerima NFT, meskipun penjual sedang offline!
     */
    function executePrivateDeal(
        uint256 tokenId,
        uint256 price,
        address seller,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sellerSignature
    ) external nonReentrant {
        require(price > 0, "Harga harus lebih dari 0");
        require(block.timestamp <= deadline, "Kesepakatan sudah kadaluarsa");
        require(!usedDealNonces[nonce], "Nonce kesepakatan sudah digunakan");
        require(msg.sender != seller, "Tidak bisa membeli kartu sendiri");
        require(cardNft.ownerOf(tokenId) == seller, "Penjual sudah tidak memiliki kartu ini");
        require(
            cardNft.isApprovedForAll(seller, address(this)) ||
                cardNft.getApproved(tokenId) == address(this),
            "Penjual belum memberi izin transfer NFT ke Marketplace"
        );

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PRIVATE_DEAL_TYPEHASH,
                    seller,
                    msg.sender,
                    tokenId,
                    price,
                    nonce,
                    deadline
                )
            )
        );

        address recovered = ECDSA.recover(digest, sellerSignature);
        require(recovered == seller, "Tanda tangan kesepakatan penjual tidak valid");

        usedDealNonces[nonce] = true;

        uint256 existingListingId = activeListingByToken[tokenId];
        if (existingListingId != 0 && listings[existingListingId].seller == seller) {
            listings[existingListingId].active = false;
            activeListingByToken[tokenId] = 0;
        }

        uint256 fee = (price * feeBps) / BPS_DENOMINATOR;
        uint256 sellerAmount = price - fee;

        if (fee > 0) {
            kansToken.safeTransferFrom(msg.sender, treasury, fee);
        }
        kansToken.safeTransferFrom(msg.sender, seller, sellerAmount);
        cardNft.safeTransferFrom(seller, msg.sender, tokenId);

        emit PrivateDealExecuted(seller, msg.sender, tokenId, price, fee, nonce);
    }

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "Fee melebihi batas maksimal 10%");
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Alamat treasury tidak valid");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }
}
