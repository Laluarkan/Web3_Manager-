import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/prisma";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    walletAddress: string | null;
    hasClaimedStarter: boolean;
  };
}

/**
 * Middleware wajib login (Email/Password atau Google OAuth).
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Silakan login terlebih dahulu" });
      return;
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, env.jwtSecret) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        walletAddress: true,
        hasClaimedStarter: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: "Sesi login tidak valid" });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Token tidak valid atau sudah kadaluarsa" });
  }
}

/**
 * Middleware wajib sudah menghubungkan Wallet MetaMask (untuk Marketplace, Claim NFT, Turnamen Koin).
 */
export function requireWallet(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.walletAddress) {
    res.status(403).json({
      error: "Fitur ini membutuhkan Wallet. Silakan hubungkan MetaMask terlebih dahulu.",
      code: "WALLET_REQUIRED",
    });
    return;
  }
  next();
}
