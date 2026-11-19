import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  toggleCardLock,
  getManagersList,
  getManagerLineup,
  sendFriendRequest,
  respondFriendRequest,
  createCardOffer,
  counterCardOffer,
  respondCardOffer,
  saveSellerDealSignature,
  confirmDealExecuted,
  getOffers,
  getNotifications,
  markNotificationsRead,
} from "../controllers/social.controller";

const router = Router();

// Lock / Unlock Kartu
router.post("/cards/:cardId/lock", requireAuth, toggleCardLock);

// Manajer & Lineup Teman
router.get("/managers", requireAuth, getManagersList);
router.get("/lineup/:username", getManagerLineup);

// Pertemanan
router.post("/friends/request", requireAuth, sendFriendRequest);
router.post("/friends/respond", requireAuth, respondFriendRequest);

// Tawar-Menawar & Negosiasi Transfer
router.get("/offers", requireAuth, getOffers);
router.post("/offers", requireAuth, createCardOffer);
router.post("/offers/:offerId/counter", requireAuth, counterCardOffer);
router.post("/offers/:offerId/respond", requireAuth, respondCardOffer);
router.post("/offers/:offerId/seller-sign", requireAuth, saveSellerDealSignature);
router.post("/offers/:offerId/confirm-deal", requireAuth, confirmDealExecuted);

// Notifikasi
router.get("/notifications", requireAuth, getNotifications);
router.post("/notifications/read", requireAuth, markNotificationsRead);

export default router;
