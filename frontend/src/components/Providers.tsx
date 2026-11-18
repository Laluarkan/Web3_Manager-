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
    let walletAddr = address;
    if (!isConnected || !walletAddr) {
      const injectedConnector = connectors[0];
      if (!injectedConnector) {
        throw new Error("MetaMask belum terpasang di browser Anda!");
      }
      const connected = await connectAsync({ connector: injectedConnector });
      walletAddr = connected.accounts[0];
    }

    const { message } = await apiRequest<{ nonce: string; message: string }>("/auth/wallet-nonce");
    const signature = await signMessageAsync({ message });

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
