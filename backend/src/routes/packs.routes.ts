import { Router } from "express";
import {
  confirmPackOpen,
  getPackCatalog,
  requestPackVoucher,
} from "../controllers/packs.controller";
import { requireAuth, requireWallet } from "../middlewares/auth.middleware";

const router = Router();

// Siapa saja boleh melihat katalog Pack & etalase POTW mingguan
router.get("/catalog", getPackCatalog);

// Buka pack pakai KANS wajib login + hubungkan Wallet MetaMask
router.post("/voucher", requireAuth, requireWallet, requestPackVoucher);
router.post("/confirm", requireAuth, requireWallet, confirmPackOpen);

export default router;
