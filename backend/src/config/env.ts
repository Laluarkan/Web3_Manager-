import dotenv from "dotenv";

dotenv.config();

// Pastikan DATABASE_URL memiliki fallback lokal SQLite saat development
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const isProd = process.env.NODE_ENV === "production";

// Private key publik bawaan Hardhat Account #0 — HANYA dipakai di Hardhat localhost
const HARDHAT_LOCAL_DEV_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Sepolia canonical contract deployments
const SEPOLIA_CONTRACTS = {
  kans: "0x602fb1884765b3bAd6a8365046Dda7a93176A9fb",
  nft: "0xEe52506111cFB71fE0145B7e429604ecaDB9739c",
  market: "0x4Ba34D8F482B82207e96027e97CB15125aFB4279",
  shop: "0x1460b8E8B079618a7f80D49665A50D6FB439f639",
};

// Old Hardhat localhost addresses (to prevent 0x decode errors if left in cloud env)
const OLD_LOCAL_ADDRESSES = new Set([
  "0x99bba657f2bbc93c02d617f8ba121cb8fc104acf",
  "0x0e801d84fa97b50751dbf25036d067dcf18858bf",
  "0x8f86403a4de0bb5791fa46b8e795c547942fe4cf",
  "0x9d4454b023096f34b160d6b654540c56a1f81688",
]);

function resolveContractAddress(raw: string | undefined, sepoliaDefault: string): string {
  const clean = (raw || "").trim();
  if (!clean) return sepoliaDefault;
  if (isProd && OLD_LOCAL_ADDRESSES.has(clean.toLowerCase())) {
    return sepoliaDefault;
  }
  return clean;
}

export const env = {
  isProd,
  port: Number(process.env.PORT || 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  jwtSecret:
    process.env.JWT_SECRET ||
    (isProd ? "" : "local-dev-jwt-secret-change-in-production"),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",

  // Blockchain config
  rpcUrl:
    process.env.RPC_URL ||
    (isProd
      ? "https://ethereum-sepolia-rpc.publicnode.com"
      : "http://127.0.0.1:8545"),
  chainId: Number(process.env.CHAIN_ID || (isProd ? 11155111 : 31337)),
  backendSignerPrivateKey:
    process.env.BACKEND_SIGNER_PRIVATE_KEY ||
    process.env.VOUCHER_SIGNER_PRIVATE_KEY ||
    (isProd ? "" : HARDHAT_LOCAL_DEV_KEY),
  kansTokenAddress: resolveContractAddress(process.env.KANS_TOKEN_ADDRESS, SEPOLIA_CONTRACTS.kans),
  cardNftAddress: resolveContractAddress(process.env.CARD_NFT_ADDRESS, SEPOLIA_CONTRACTS.nft),
  marketplaceAddress: resolveContractAddress(process.env.MARKETPLACE_ADDRESS, SEPOLIA_CONTRACTS.market),
  packShopAddress: resolveContractAddress(process.env.PACK_SHOP_ADDRESS, SEPOLIA_CONTRACTS.shop),
  enableTestFaucet: (process.env.ENABLE_TEST_FAUCET ?? "true") === "true",
};

if (env.isProd && !env.jwtSecret) {
  throw new Error("JWT_SECRET wajib diisi di production!");
}
