import { parseAbi } from "viem";

export const CONTRACT_ADDRESSES = {
  kansToken: (process.env.NEXT_PUBLIC_KANS_TOKEN_ADDRESS ||
    "0x602fb1884765b3bAd6a8365046Dda7a93176A9fb") as `0x${string}`,
  cardNft: (process.env.NEXT_PUBLIC_CARD_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_FOOTBALL_CARD_NFT_ADDRESS ||
    "0xEe52506111cFB71fE0145B7e429604ecaDB9739c") as `0x${string}`,
  marketplace: (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
    "0x4Ba34D8F482B82207e96027e97CB15125aFB4279") as `0x${string}`,
  packShop: (process.env.NEXT_PUBLIC_PACK_SHOP_ADDRESS ||
    "0x1460b8E8B079618a7f80D49665A50D6FB439f639") as `0x${string}`,
};

export const KANS_TOKEN_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

export const CARD_NFT_ABI = parseAbi([
  "struct CardInput { uint32 playerId; uint8 position; uint8 baseOverall; uint8 rarity; uint8 edition; uint16 season; }",
  "function claimStarterPack(CardInput[] cards, uint256 nonce, uint256 deadline, bytes signature) returns (uint256[])",
  "function setApprovalForAll(address operator, bool approved)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function hasClaimedStarter(address account) view returns (bool)",
]);

export const MARKETPLACE_ABI = parseAbi([
  "function listCard(uint256 tokenId, uint256 price) returns (uint256)",
  "function buyCard(uint256 listingId)",
  "function cancelListing(uint256 listingId)",
  "function updatePrice(uint256 listingId, uint256 newPrice)",
  "function executePrivateDeal(uint256 tokenId, uint256 price, address seller, uint256 nonce, uint256 deadline, bytes sellerSignature)",
  "event CardListed(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 price)",
  "event CardSold(uint256 indexed listingId, address indexed seller, address indexed buyer, uint256 tokenId, uint256 price, uint256 fee)",
  "event PrivateDealExecuted(address indexed seller, address indexed buyer, uint256 indexed tokenId, uint256 price, uint256 fee, uint256 nonce)",
  "event ListingCanceled(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId)",
]);

export const PACK_SHOP_ABI = parseAbi([
  "struct CardInput { uint32 playerId; uint8 position; uint8 baseOverall; uint8 rarity; uint8 edition; uint16 season; }",
  "function openPack(CardInput card, uint256 price, uint256 nonce, uint256 deadline, bytes signature) returns (uint256)",
  "event PackOpened(address indexed buyer, uint256 indexed tokenId, uint256 price, uint256 burnedAmount, uint256 treasuryAmount)",
]);
