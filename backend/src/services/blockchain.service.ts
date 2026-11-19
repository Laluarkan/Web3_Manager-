import { ethers } from "ethers";
import { env } from "../config/env";
import {
  EDITION_TO_INDEX,
  INDEX_TO_EDITION,
  INDEX_TO_POSITION,
  INDEX_TO_RARITY,
  POSITION_TO_INDEX,
  RARITY_TO_INDEX,
} from "../config/constants";

// Minimal ABI (human-readable) — ringkas, tidak perlu menyalin file JSON besar
const KANS_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function mint(address to, uint256 amount) external",
];

const CARD_NFT_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function hasClaimedStarter(address account) view returns (bool)",
  "function getTokensOfOwner(address owner) view returns (uint256[])",
  "function getCard(uint256 tokenId) view returns (tuple(uint32 playerId, uint8 position, uint8 baseOverall, uint8 level, uint8 rarity, uint8 edition, uint16 season, uint64 mintedAt))",
  "function upgradeCardLevel(uint256 tokenId, uint8 newLevel) external",
];

const MARKETPLACE_ABI = [
  "function listings(uint256 listingId) view returns (uint256 listingId, address seller, uint256 tokenId, uint256 price, bool active)",
];

function getProvider() {
  return new ethers.JsonRpcProvider(env.rpcUrl);
}

function getBackendSigner() {
  if (!env.backendSignerPrivateKey) {
    throw new Error("BACKEND_SIGNER_PRIVATE_KEY belum dikonfigurasi");
  }
  return new ethers.Wallet(env.backendSignerPrivateKey, getProvider());
}

export function getKansContract(withSigner = false) {
  return new ethers.Contract(
    env.kansTokenAddress,
    KANS_ABI,
    withSigner ? getBackendSigner() : getProvider()
  );
}

export function getCardNftContract(withSigner = false) {
  return new ethers.Contract(
    env.cardNftAddress,
    CARD_NFT_ABI,
    withSigner ? getBackendSigner() : getProvider()
  );
}

export function getMarketplaceContract() {
  return new ethers.Contract(env.marketplaceAddress, MARKETPLACE_ABI, getProvider());
}

export interface VoucherCardInput {
  playerId: number;
  position: number;
  baseOverall: number;
  rarity: number;
  edition: number;
  season: number;
}

/**
 * Menandatangani voucher EIP-712 untuk mengklaim 11 kartu Starter Pack secara On-Chain.
 */
export async function signStarterPackVoucher(
  recipient: string,
  cards: Array<{
    playerId: number;
    position: string;
    baseOverall: number;
    rarity: string;
    edition: string;
    season: number;
  }>
) {
  const signer = getBackendSigner();
  const nonce = Date.now();
  const deadline = Math.floor(Date.now() / 1000) + 1800; // berlaku 30 menit

  const formattedCards: VoucherCardInput[] = cards.map((c) => ({
    playerId: c.playerId,
    position: POSITION_TO_INDEX[c.position] ?? 0,
    baseOverall: c.baseOverall,
    rarity: RARITY_TO_INDEX[c.rarity] ?? 0,
    edition: EDITION_TO_INDEX[c.edition] ?? 0,
    season: c.season,
  }));

  const domain = {
    name: "W3FootballCardNFT",
    version: "1",
    chainId: BigInt(env.chainId),
    verifyingContract: env.cardNftAddress,
  };

  const types = {
    StarterClaim: [
      { name: "recipient", type: "address" },
      { name: "cards", type: "CardInput[]" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    CardInput: [
      { name: "playerId", type: "uint32" },
      { name: "position", type: "uint8" },
      { name: "baseOverall", type: "uint8" },
      { name: "rarity", type: "uint8" },
      { name: "edition", type: "uint8" },
      { name: "season", type: "uint16" },
    ],
  };

  const signature = await signer.signTypedData(domain, types, {
    recipient,
    cards: formattedCards,
    nonce,
    deadline,
  });

  return {
    cards: formattedCards,
    nonce,
    deadline,
    signature,
    contractAddress: env.cardNftAddress,
    chainId: env.chainId,
  };
}

/**
 * Membaca seluruh kartu NFT milik suatu alamat wallet langsung dari blockchain.
 */
export async function fetchOnChainCardsOfOwner(walletAddress: string) {
  const nft = getCardNftContract(false);
  const tokenIds: bigint[] = await nft.getTokensOfOwner(walletAddress);

  const cards = await Promise.all(
    tokenIds.map(async (tid) => {
      const meta = await nft.getCard(tid);
      return {
        tokenId: Number(tid),
        playerId: Number(meta.playerId),
        position: INDEX_TO_POSITION[Number(meta.position)] || "MF",
        baseOverall: Number(meta.baseOverall),
        level: Number(meta.level),
        rarity: INDEX_TO_RARITY[Number(meta.rarity)] || "COMMON",
        edition: INDEX_TO_EDITION[Number(meta.edition)] || "BASE",
        season: Number(meta.season),
      };
    })
  );

  return cards;
}

export async function fetchOnChainCard(tokenId: number) {
  const nft = getCardNftContract(false);
  const [owner, meta] = await Promise.all([nft.ownerOf(tokenId), nft.getCard(tokenId)]);
  return {
    tokenId,
    owner: String(owner).toLowerCase(),
    playerId: Number(meta.playerId),
    position: INDEX_TO_POSITION[Number(meta.position)] || "MF",
    baseOverall: Number(meta.baseOverall),
    level: Number(meta.level),
    rarity: INDEX_TO_RARITY[Number(meta.rarity)] || "COMMON",
    edition: INDEX_TO_EDITION[Number(meta.edition)] || "BASE",
    season: Number(meta.season),
  };
}

export async function fetchOnChainListing(listingId: number) {
  const market = getMarketplaceContract();
  const data = await market.listings(listingId);
  return {
    listingId: Number(data.listingId),
    seller: String(data.seller).toLowerCase(),
    tokenId: Number(data.tokenId),
    priceKans: ethers.formatEther(data.price),
    active: Boolean(data.active),
  };
}

export async function mintTestKansFaucet(walletAddress: string, amountKans = "1000") {
  if (!env.enableTestFaucet) {
    throw new Error("Faucet KANS uji coba dinonaktifkan");
  }
  const signer = getBackendSigner();
  const provider = getProvider();
  try {
    const ethBalance = await provider.getBalance(walletAddress);
    if (ethBalance < ethers.parseEther("1")) {
      const fundTx = await signer.sendTransaction({
        to: walletAddress,
        value: ethers.parseEther("10"),
      });
      await fundTx.wait();
    }
  } catch (e) {
    console.warn("Could not fund test ETH:", e);
  }

  const kans = getKansContract(true);
  const tx = await kans.mint(walletAddress, ethers.parseEther(amountKans));
  const receipt = await tx.wait();
  return { txHash: receipt.hash, amountKans };
}

/**
 * Menandatangani voucher EIP-712 untuk membuka 1 Pack NFT di CardPackShop.sol.
 */
export async function signPackOpenVoucher(
  buyer: string,
  card: {
    playerId: number;
    position: string;
    baseOverall: number;
    rarity: string;
    edition: string;
    season: number;
  },
  priceKans: string
) {
  const signer = getBackendSigner();
  const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const deadline = Math.floor(Date.now() / 1000) + 1800;
  const priceWei = ethers.parseEther(priceKans);

  const formattedCard: VoucherCardInput = {
    playerId: card.playerId,
    position: POSITION_TO_INDEX[card.position] ?? 0,
    baseOverall: card.baseOverall,
    rarity: RARITY_TO_INDEX[card.rarity] ?? 0,
    edition: EDITION_TO_INDEX[card.edition] ?? 0,
    season: card.season,
  };

  const domain = {
    name: "W3CardPackShop",
    version: "1",
    chainId: BigInt(env.chainId),
    verifyingContract: env.packShopAddress,
  };

  const types = {
    PackOpen: [
      { name: "buyer", type: "address" },
      { name: "card", type: "CardInput" },
      { name: "price", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    CardInput: [
      { name: "playerId", type: "uint32" },
      { name: "position", type: "uint8" },
      { name: "baseOverall", type: "uint8" },
      { name: "rarity", type: "uint8" },
      { name: "edition", type: "uint8" },
      { name: "season", type: "uint16" },
    ],
  };

  const signature = await signer.signTypedData(domain, types, {
    buyer,
    card: formattedCard,
    price: priceWei,
    nonce,
    deadline,
  });

  return {
    card: formattedCard,
    priceKans,
    priceWei: priceWei.toString(),
    nonce,
    deadline,
    signature,
    contractAddress: env.packShopAddress,
  };
}

/**
 * Menaikkan level kartu NFT langsung di Smart Contract FootballCardNFT.sol.
 */
export async function upgradeOnChainCardLevel(tokenId: number, newLevel: number) {
  const nft = getCardNftContract(true);
  const tx = await nft.upgradeCardLevel(tokenId, newLevel);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}
