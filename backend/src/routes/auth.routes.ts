import { Router } from "express";
import {
  getMe,
  getWalletNonce,
  googleLogin,
  linkWallet,
  login,
  register,
} from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);

router.get("/me", requireAuth, getMe);
router.get("/wallet-nonce", requireAuth, getWalletNonce);
router.post("/link-wallet", requireAuth, linkWallet);

export default router;
