import { Router } from "express";
import {
  faucetTestKans,
  getMarketListings,
  syncCancel,
  syncListing,
  syncSale,
} from "../controllers/market.controller";
import { requireAuth, requireWallet } from "../middlewares/auth.middleware";

const router = Router();

// Siapa saja bisa melihat daftar kartu di Marketplace
router.get("/", getMarketListings);

// Aksi jual-beli & sinkronisasi wajib sudah login + Link Wallet MetaMask
router.post("/sync-listing", requireAuth, requireWallet, syncListing);
router.post("/sync-sale", requireAuth, requireWallet, syncSale);
router.post("/sync-cancel", requireAuth, requireWallet, syncCancel);
router.post("/faucet-kans", requireAuth, requireWallet, faucetTestKans);

export default router;
