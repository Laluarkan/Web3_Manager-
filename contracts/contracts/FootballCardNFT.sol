// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title FootballCardNFT
 * @notice Kartu pemain sepak bola ERC-721 dengan atribut on-chain dan verifikasi voucher EIP-712.
 */
contract FootballCardNFT is ERC721, ERC721Enumerable, AccessControl, EIP712 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant STARTER_PACK_SIZE = 11;

    enum Rarity {
        COMMON,
        RARE,
        EPIC,
        LEGENDARY,
        MYTHIC
    }

    enum CardEdition {
        BASE,
        POTW,
        HIGHLIGHT,
        CLUB_SELECTION,
        ICONIC
    }

    struct CardMetadata {
        uint32 playerId;
        uint8 position; // 0=GK, 1=DF, 2=MF, 3=FW
        uint8 baseOverall;
        uint8 level;
        Rarity rarity;
        CardEdition edition;
        uint16 season;
        uint64 mintedAt;
    }

    struct CardInput {
        uint32 playerId;
        uint8 position;
        uint8 baseOverall;
        Rarity rarity;
        CardEdition edition;
        uint16 season;
    }

    bytes32 private constant CARD_INPUT_TYPEHASH = keccak256(
        "CardInput(uint32 playerId,uint8 position,uint8 baseOverall,uint8 rarity,uint8 edition,uint16 season)"
    );

    bytes32 private constant STARTER_CLAIM_TYPEHASH = keccak256(
        "StarterClaim(address recipient,CardInput[] cards,uint256 nonce,uint256 deadline)CardInput(uint32 playerId,uint8 position,uint8 baseOverall,uint8 rarity,uint8 edition,uint16 season)"
    );

    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;
    address public voucherSigner;

    mapping(uint256 => CardMetadata) private _cards;
    mapping(address => bool) public hasClaimedStarter;
    mapping(uint256 => bool) public usedNonces;

    event CardMinted(
        uint256 indexed tokenId,
        address indexed owner,
        uint32 playerId,
        uint8 position,
        uint8 baseOverall,
        Rarity rarity,
        CardEdition edition,
        uint16 season
    );
    event StarterPackClaimed(address indexed owner, uint256[] tokenIds);
    event CardLevelUpgraded(uint256 indexed tokenId, uint8 newLevel);
    event VoucherSignerUpdated(address indexed newSigner);
    event BaseURIUpdated(string newBaseURI);

    constructor(
        address admin,
        address initialVoucherSigner,
        string memory initialBaseURI
    )
        ERC721("W3 Football Card", "W3FC")
        EIP712("W3FootballCardNFT", "1")
    {
        require(admin != address(0), "Admin tidak valid");
        require(initialVoucherSigner != address(0), "Signer tidak valid");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);

        voucherSigner = initialVoucherSigner;
        _baseTokenURI = initialBaseURI;
    }

    /**
     * @notice Klaim 11 kartu Starter Pack sekaligus (1x per wallet) memakai voucher EIP-712 dari backend.
     */
    function claimStarterPack(
        CardInput[] calldata cards,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external returns (uint256[] memory tokenIds) {
        require(!hasClaimedStarter[msg.sender], "Starter pack sudah pernah diklaim");
        require(cards.length == STARTER_PACK_SIZE, "Starter pack harus tepat 11 kartu");
        require(block.timestamp <= deadline, "Voucher sudah kadaluarsa");
        require(!usedNonces[nonce], "Nonce voucher sudah digunakan");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    STARTER_CLAIM_TYPEHASH,
                    msg.sender,
                    _hashCardInputs(cards),
                    nonce,
                    deadline
                )
            )
        );

        address recovered = ECDSA.recover(digest, signature);
        require(recovered == voucherSigner, "Tanda tangan voucher tidak valid");

        hasClaimedStarter[msg.sender] = true;
        usedNonces[nonce] = true;

        tokenIds = new uint256[](STARTER_PACK_SIZE);
        for (uint256 i = 0; i < STARTER_PACK_SIZE; i++) {
            tokenIds[i] = _mintSingleCard(msg.sender, cards[i]);
        }

        emit StarterPackClaimed(msg.sender, tokenIds);
    }

    /**
     * @notice Mint 1 kartu NFT (untuk Pack Shop, Hadiah Turnamen, atau Admin dengan MINTER_ROLE).
     */
    function mintCard(address to, CardInput calldata card)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256)
    {
        return _mintSingleCard(to, card);
    }

    /**
     * @notice Naikkan level kartu NFT (siap digunakan di fase Training/Progression).
     */
    function upgradeCardLevel(uint256 tokenId, uint8 newLevel)
        external
        onlyRole(MINTER_ROLE)
    {
        _requireOwned(tokenId);
        CardMetadata storage meta = _cards[tokenId];
        require(newLevel > meta.level, "Level baru harus lebih tinggi");
        meta.level = newLevel;
        emit CardLevelUpgraded(tokenId, newLevel);
    }

    function setVoucherSigner(address newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newSigner != address(0), "Signer tidak valid");
        voucherSigner = newSigner;
        emit VoucherSignerUpdated(newSigner);
    }

    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function getCard(uint256 tokenId) external view returns (CardMetadata memory) {
        _requireOwned(tokenId);
        return _cards[tokenId];
    }

    function getTokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 count = balanceOf(owner);
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tokenOfOwnerByIndex(owner, i);
        }
        return result;
    }

    function _mintSingleCard(address to, CardInput calldata card) internal returns (uint256) {
        require(to != address(0), "Penerima tidak valid");
        require(card.position <= 3, "Posisi tidak valid");
        require(card.baseOverall >= 1 && card.baseOverall <= 99, "Overall harus 1-99");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        _cards[tokenId] = CardMetadata({
            playerId: card.playerId,
            position: card.position,
            baseOverall: card.baseOverall,
            level: 1,
            rarity: card.rarity,
            edition: card.edition,
            season: card.season,
            mintedAt: uint64(block.timestamp)
        });

        emit CardMinted(
            tokenId,
            to,
            card.playerId,
            card.position,
            card.baseOverall,
            card.rarity,
            card.edition,
            card.season
        );

        return tokenId;
    }

    function _hashCardInputs(CardInput[] calldata cards) internal pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](cards.length);
        for (uint256 i = 0; i < cards.length; i++) {
            hashes[i] = keccak256(
                abi.encode(
                    CARD_INPUT_TYPEHASH,
                    cards[i].playerId,
                    cards[i].position,
                    cards[i].baseOverall,
                    uint8(cards[i].rarity),
                    uint8(cards[i].edition),
                    cards[i].season
                )
            );
        }
        return keccak256(abi.encodePacked(hashes));
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
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
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
