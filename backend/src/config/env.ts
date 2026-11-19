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

export const env = {
  isProd,
  port: Number(process.env.PORT || 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  jwtSecret:
    process.env.JWT_SECRET ||
    (isProd ? "" : "local-dev-jwt-secret-change-in-production"),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",

  // Blockchain config
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  chainId: Number(process.env.CHAIN_ID || 31337),
  backendSignerPrivateKey:
    process.env.BACKEND_SIGNER_PRIVATE_KEY || (isProd ? "" : HARDHAT_LOCAL_DEV_KEY),
  kansTokenAddress:
    process.env.KANS_TOKEN_ADDRESS || "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf",
  cardNftAddress:
    process.env.CARD_NFT_ADDRESS || "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF",
  marketplaceAddress:
    process.env.MARKETPLACE_ADDRESS || "0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf",
  packShopAddress:
    process.env.PACK_SHOP_ADDRESS || "0x9d4454B023096f34B160D6B654540c56A1F81688",
  enableTestFaucet: (process.env.ENABLE_TEST_FAUCET ?? "true") === "true",
};

if (env.isProd && !env.jwtSecret) {
  throw new Error("JWT_SECRET wajib diisi di production!");
}
