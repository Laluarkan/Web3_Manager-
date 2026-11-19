import { parseAbi } from "viem";

export const CONTRACT_ADDRESSES = {
  kansToken: (process.env.NEXT_PUBLIC_KANS_TOKEN_ADDRESS ||
    "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf") as `0x${string}`,
  cardNft: (process.env.NEXT_PUBLIC_CARD_NFT_ADDRESS ||
    "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF") as `0x${string}`,
  marketplace: (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
    "0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf") as `0x${string}`,
  packShop: (process.env.NEXT_PUBLIC_PACK_SHOP_ADDRESS ||
    "0x9d4454B023096f34B160D6B654540c56A1F81688") as `0x${string}`,
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
