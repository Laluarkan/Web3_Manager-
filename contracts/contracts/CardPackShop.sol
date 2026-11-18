// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./FootballCardNFT.sol";

interface IBurnableERC20 is IERC20 {
    function burn(uint256 value) external;
}

/**
 * @title CardPackShop
 * @notice Membuka Pack Kartu NFT menggunakan koin KANS (50% dibakar untuk deflasi, 50% ke treasury).
 */
contract CardPackShop is ReentrancyGuard, Ownable, EIP712 {
    using SafeERC20 for IBurnableERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    FootballCardNFT public immutable cardNft;
    IBurnableERC20 public immutable kansToken;

    address public treasury;
    address public voucherSigner;
    uint256 public burnBps = 5_000; // Default 50% KANS dari pembelian pack di-burn

    mapping(uint256 => bool) public usedNonces;

    bytes32 private constant CARD_INPUT_TYPEHASH = keccak256(
        "CardInput(uint32 playerId,uint8 position,uint8 baseOverall,uint8 rarity,uint8 edition,uint16 season)"
    );

    bytes32 private constant PACK_OPEN_TYPEHASH = keccak256(
        "PackOpen(address buyer,CardInput card,uint256 price,uint256 nonce,uint256 deadline)CardInput(uint32 playerId,uint8 position,uint8 baseOverall,uint8 rarity,uint8 edition,uint16 season)"
    );

    event PackOpened(
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 price,
        uint256 burnedAmount,
        uint256 treasuryAmount
    );
    event VoucherSignerUpdated(address indexed newSigner);
    event TreasuryUpdated(address indexed newTreasury);
    event BurnBpsUpdated(uint256 newBurnBps);

    constructor(
        address cardNftAddress,
        address kansTokenAddress,
        address initialTreasury,
        address initialVoucherSigner,
        address initialOwner
    ) Ownable(initialOwner) EIP712("W3CardPackShop", "1") {
        require(cardNftAddress != address(0), "Alamat NFT tidak valid");
        require(kansTokenAddress != address(0), "Alamat KANS tidak valid");
        require(initialTreasury != address(0), "Alamat treasury tidak valid");
        require(initialVoucherSigner != address(0), "Alamat signer tidak valid");

        cardNft = FootballCardNFT(cardNftAddress);
        kansToken = IBurnableERC20(kansTokenAddress);
        treasury = initialTreasury;
        voucherSigner = initialVoucherSigner;
    }

    /**
     * @notice Membeli & membuka 1 Pack NFT memakai KANS dengan voucher EIP-712 dari backend.
     */
    function openPack(
        FootballCardNFT.CardInput calldata card,
        uint256 price,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant returns (uint256 tokenId) {
        require(price > 0, "Harga pack harus lebih dari 0");
        require(block.timestamp <= deadline, "Voucher pack sudah kadaluarsa");
        require(!usedNonces[nonce], "Nonce pack sudah digunakan");

        bytes32 cardHash = keccak256(
            abi.encode(
                CARD_INPUT_TYPEHASH,
                card.playerId,
                card.position,
                card.baseOverall,
                uint8(card.rarity),
                uint8(card.edition),
                card.season
            )
        );

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PACK_OPEN_TYPEHASH,
                    msg.sender,
                    cardHash,
                    price,
                    nonce,
                    deadline
                )
            )
        );

        address recovered = ECDSA.recover(digest, signature);
        require(recovered == voucherSigner, "Tanda tangan voucher pack tidak valid");

        usedNonces[nonce] = true;

        // Tarik KANS dari pembeli -> sebagian dibakar (burn), sisanya masuk treasury
        uint256 burnAmount = (price * burnBps) / BPS_DENOMINATOR;
        uint256 treasuryAmount = price - burnAmount;

        if (burnAmount > 0) {
            kansToken.safeTransferFrom(msg.sender, address(this), burnAmount);
            kansToken.burn(burnAmount);
        }
        if (treasuryAmount > 0) {
            kansToken.safeTransferFrom(msg.sender, treasury, treasuryAmount);
        }

        // Langsung cetak NFT ke dompet pembeli
        tokenId = cardNft.mintCard(msg.sender, card);

        emit PackOpened(msg.sender, tokenId, price, burnAmount, treasuryAmount);
    }

    function setVoucherSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Alamat signer tidak valid");
        voucherSigner = newSigner;
        emit VoucherSignerUpdated(newSigner);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Alamat treasury tidak valid");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setBurnBps(uint256 newBurnBps) external onlyOwner {
        require(newBurnBps <= BPS_DENOMINATOR, "Persentase burn tidak valid");
        burnBps = newBurnBps;
        emit BurnBpsUpdated(newBurnBps);
    }
}
