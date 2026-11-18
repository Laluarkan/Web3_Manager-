import { Router } from "express";
import {
  claimStarterPack,
  confirmStarterOnChain,
  getManagerLeaderboard,
  getPvpOpponents,
  getSquad,
  playFreeMatch,
  playPvpMatch,
  requestStarterVoucher,
  syncWalletCards,
  updateLineup,
  upgradeCard,
} from "../controllers/squad.controller";
import { requireAuth, requireWallet } from "../middlewares/auth.middleware";

const router = Router();

// Publik (Leaderboard Manager)
router.get("/leaderboard", getManagerLeaderboard);

// Fitur dasar (bisa dipakai cukup dengan Login Email/Gmail, tanpa Wallet)
router.get("/", requireAuth, getSquad);
router.post("/starter-pack", requireAuth, claimStarterPack);
router.put("/lineup", requireAuth, updateLineup);
router.post("/free-match", requireAuth, playFreeMatch);
router.get("/opponents", requireAuth, getPvpOpponents);
router.post("/pvp-match", requireAuth, playPvpMatch);
router.post("/cards/:cardId/upgrade", requireAuth, upgradeCard);

// Fitur Web3 On-Chain (wajib sudah Link Wallet MetaMask)
router.post("/starter-pack/voucher", requireAuth, requireWallet, requestStarterVoucher);
router.post("/starter-pack/confirm-claim", requireAuth, requireWallet, confirmStarterOnChain);
router.post("/sync-wallet", requireAuth, requireWallet, syncWalletCards);

export default router;
