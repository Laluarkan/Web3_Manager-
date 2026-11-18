import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { ethers } from "ethers";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AuthRequest } from "../middlewares/auth.middleware";

const registerSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  username: z.string().min(3, "Username minimal 3 karakter").max(30),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleLoginSchema = z.object({
  idToken: z.string().min(10),
});

const linkWalletSchema = z.object({
  walletAddress: z.string().refine((v) => ethers.isAddress(v), "Alamat wallet tidak valid"),
  signature: z.string().min(10),
});

function createToken(userId: string) {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: "7d" });
}

function serializeUser(user: {
  id: string;
  email: string;
  username: string;
  walletAddress: string | null;
  hasClaimedStarter: boolean;
  freeMatchWins?: number;
  freeMatchPlayed?: number;
  freeMatchPoints?: number;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    walletAddress: user.walletAddress,
    hasClaimedStarter: user.hasClaimedStarter,
    freeMatchWins: user.freeMatchWins ?? 0,
    freeMatchPlayed: user.freeMatchPlayed ?? 0,
    freeMatchPoints: user.freeMatchPoints ?? 0,
  };
}

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email sudah terdaftar" });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        username: parsed.data.username.trim(),
        passwordHash,
        lineup: { create: { formation: "4-3-3" } },
      },
    });

    res.status(201).json({
      token: createToken(user.id),
      user: serializeUser(user),
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Gagal mendaftar akun" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Email dan password wajib diisi" });
      return;
    }

    const email = parsed.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Email atau password salah" });
      return;
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Email atau password salah" });
      return;
    }

    res.json({
      token: createToken(user.id),
      user: serializeUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Gagal login" });
  }
}

export async function googleLogin(req: Request, res: Response) {
  try {
    if (!env.googleClientId) {
      res.status(501).json({
        error: "Google OAuth belum dikonfigurasi. Isi GOOGLE_CLIENT_ID di .env backend.",
      });
      return;
    }

    const parsed = googleLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Google ID token tidak valid" });
      return;
    }

    const client = new OAuth2Client(env.googleClientId);
    const ticket = await client.verifyIdToken({
      idToken: parsed.data.idToken,
      audience: env.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      res.status(401).json({ error: "Gagal memverifikasi akun Google" });
      return;
    }

    const email = payload.email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          googleId: payload.sub,
          username: payload.name || email.split("@")[0],
          lineup: { create: { formation: "4-3-3" } },
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub },
      });
    }

    res.json({
      token: createToken(user.id),
      user: serializeUser(user),
    });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(401).json({ error: "Autentikasi Google gagal" });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: "User tidak ditemukan" });
    return;
  }
  res.json({ user: serializeUser(user) });
}

export async function getWalletNonce(req: AuthRequest, res: Response) {
  const nonce = crypto.randomBytes(16).toString("hex");
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { walletNonce: nonce },
  });

  const message = `Hubungkan dompet MetaMask ke W3 Football Manager.\nAkun: ${req.user!.email}\nNonce: ${nonce}`;
  res.json({ nonce, message });
}

export async function linkWallet(req: AuthRequest, res: Response) {
  try {
    const parsed = linkWalletSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.walletNonce) {
      res.status(400).json({ error: "Nonce tidak ditemukan. Silakan ulangi proses hubungkan wallet." });
      return;
    }

    const expectedMessage = `Hubungkan dompet MetaMask ke W3 Football Manager.\nAkun: ${user.email}\nNonce: ${user.walletNonce}`;
    const recoveredAddress = ethers.verifyMessage(expectedMessage, parsed.data.signature);
    const normalizedInput = parsed.data.walletAddress.toLowerCase();

    if (recoveredAddress.toLowerCase() !== normalizedInput) {
      res.status(401).json({ error: "Tanda tangan MetaMask tidak cocok dengan alamat wallet" });
      return;
    }

    const walletInUse = await prisma.user.findUnique({
      where: { walletAddress: normalizedInput },
    });
    if (walletInUse && walletInUse.id !== user.id) {
      res.status(409).json({ error: "Wallet ini sudah tertaut ke akun lain" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress: normalizedInput, walletNonce: null },
    });

    res.json({
      message: "Wallet berhasil dihubungkan!",
      user: serializeUser(updated),
    });
  } catch (err) {
    console.error("Link wallet error:", err);
    res.status(400).json({ error: "Gagal memverifikasi tanda tangan wallet" });
  }
}
