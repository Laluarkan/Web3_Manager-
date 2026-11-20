"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { WagmiProvider, useAccount, useConnect, useSignMessage } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { apiRequest, getStoredToken, setStoredToken, UserProfile } from "@/lib/api";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  linkWallet: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const queryClient = new QueryClient();

function AuthStateProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ user: UserProfile }>("/auth/me");
      setUser(data.user);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: UserProfile }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, username: string, password: string) => {
    const data = await apiRequest<{ token: string; user: UserProfile }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    });
    setStoredToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
  };

  const linkWallet = async (): Promise<string> => {
    if (typeof window !== "undefined" && !(window as any).ethereum) {
      throw new Error(
        "Ekstensi Web3 (MetaMask) belum terpasang di browser Anda!\n\nSilakan instal MetaMask dari https://metamask.io, buat/impor dompet, lalu refresh halaman ini."
      );
    }

    let walletAddr = address;
    if (!isConnected || !walletAddr) {
      const injectedConnector = connectors[0];
      if (!injectedConnector) {
        throw new Error(
          "Ekstensi Web3 (MetaMask) tidak terdeteksi. Silakan pasang MetaMask dari https://metamask.io"
        );
      }
      const connectOnce = () => connectAsync({ connector: injectedConnector });
      const isRejected = (e: any) =>
        e?.code === 4001 || e?.message?.includes("User rejected") || e?.name === "UserRejectedRequestError";
      try {
        let connected;
        // Status kunci MetaMask sebelum meminta koneksi (hanya ada di MetaMask)
        const wasLocked = !(await (window as any).ethereum?._metamask?.isUnlocked?.().catch(() => true) ?? true);
        try {
          connected = await connectOnce();
        } catch (err: any) {
          // MetaMask terkunci: unlock membuka tab/popup baru sehingga permintaan pertama sering otomatis batal.
          // Ulangi sekali setelah wallet dibuka, hanya jika memang tadinya terkunci.
          if (!isRejected(err) || !wasLocked) throw err;
          await new Promise((r) => setTimeout(r, 800));
          connected = await connectOnce();
        }
        walletAddr = connected.accounts[0];
      } catch (err: any) {
        if (err.message?.includes("Provider not found") || err.name === "ProviderNotFoundError") {
          throw new Error(
            "Ekstensi Web3 (MetaMask) tidak ditemukan di browser Anda. Pastikan ekstensi MetaMask aktif lalu refresh browser."
          );
        }
        if (err?.code === -32002 || err.message?.includes("already pending")) {
          throw new Error("Permintaan koneksi sudah terbuka di MetaMask. Buka MetaMask lalu setujui permintaan tersebut.");
        }
        if (isRejected(err)) {
          throw new Error(
            "Koneksi dibatalkan. Jika MetaMask terkunci, unlock dulu (login di tab MetaMask yang terbuka), lalu klik Hubungkan Wallet lagi."
          );
        }
        throw err;
      }
    }

    const { message } = await apiRequest<{ nonce: string; message: string }>("/auth/wallet-nonce");
    let signature: string;
    try {
      signature = await signMessageAsync({ message });
    } catch (err: any) {
      if (err.message?.includes("User rejected") || err.name === "UserRejectedRequestError") {
        throw new Error("Tanda tangan otentikasi dibatalkan di MetaMask.");
      }
      throw err;
    }

    const res = await apiRequest<{ message: string; user: UserProfile }>("/auth/link-wallet", {
      method: "POST",
      body: JSON.stringify({ walletAddress: walletAddr, signature }),
    });

    setUser(res.user);
    return res.message;
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser, linkWallet }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthStateProvider>{children}</AuthStateProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus digunakan di dalam Providers");
  return ctx;
}
