export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  walletAddress: string | null;
  hasClaimedStarter: boolean;
  freeMatchWins: number;
  freeMatchPlayed: number;
  freeMatchPoints: number;
}

export interface ClubData {
  id: number;
  name: string;
  leagueName: string;
  country: string;
  logoUrl?: string | null;
}

export interface PlayerData {
  id: number;
  name: string;
  nationality: string;
  position: string;
  detailPosition: string;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  liveForm: string;
  appearances?: number;
  goals?: number;
  assists?: number;
  saves?: number;
  photoUrl?: string | null;
  club: ClubData;
}

export interface UserCardData {
  id: string;
  userId: string;
  playerId: number;
  position: string;
  baseOverall: number;
  level: number;
  rarity: string;
  edition: string;
  season: number;
  isOnChain: boolean;
  tokenId: number | null;
  isListed: boolean;
  isLocked?: boolean;
  player: PlayerData;
}

export interface LineupSlotData {
  id: string;
  slotCode: string;
  userCardId: string;
  userCard: UserCardData;
}

export interface SquadResponse {
  formation: string;
  teamOverall: number;
  hasClaimedStarter: boolean;
  unclaimedStarterCount: number;
  slots: LineupSlotData[];
  cards: UserCardData[];
}

export interface MarketListingData {
  id: string;
  listingId: number;
  tokenId: number;
  sellerWallet: string;
  priceKans: string;
  status: string;
  userCard: UserCardData | null;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("w3_auth_token");
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("w3_auth_token", token);
  else localStorage.removeItem("w3_auth_token");
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request gagal (${res.status})`);
  }
  return data as T;
}

export interface ManagerData {
  id: string;
  username: string;
  walletAddress: string | null;
  freeMatchWins: number;
  freeMatchPoints: number;
  freeMatchPlayed: number;
  createdAt: string;
  cardCount: number;
  friendStatus: "NONE" | "PENDING_SENT" | "PENDING_RECEIVED" | "ACCEPTED";
  friendshipId?: string;
}

export interface CardOfferData {
  id: string;
  cardId: string;
  sellerId: string;
  buyerId: string;
  priceKans: string;
  status: "PENDING" | "COUNTERED" | "ACCEPTED" | "REJECTED" | "COMPLETED" | "CANCELLED";
  lastActionBy: string;
  sellerSignature?: string | null;
  nonce?: number | null;
  deadline?: number | null;
  history: string;
  createdAt: string;
  updatedAt: string;
  card: UserCardData;
  buyer: { id: string; username: string; walletAddress: string | null };
  seller: { id: string; username: string; walletAddress: string | null };
}

export interface NotificationData {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}
