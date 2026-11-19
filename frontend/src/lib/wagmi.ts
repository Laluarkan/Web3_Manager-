import { createConfig, http, injected } from "wagmi";
import { baseSepolia, hardhat, sepolia } from "wagmi/chains";

export const TARGET_CHAIN_ID =
  typeof window !== "undefined" && !window.location.hostname.includes("localhost")
    ? 11155111
    : Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155111);

export async function switchToTargetNetwork() {
  if (typeof window === "undefined" || !(window as any).ethereum) return;
  const ethereum = (window as any).ethereum;
  const chainIdHex = `0x${TARGET_CHAIN_ID.toString(16)}`;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (err: any) {
    if (
      err.code === 4902 ||
      err?.data?.originalError?.code === 4902 ||
      err.message?.includes("Unrecognized chain") ||
      err.message?.includes("not found")
    ) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName:
              TARGET_CHAIN_ID === 31337
                ? "Hardhat Localhost"
                : TARGET_CHAIN_ID === 11155111
                ? "Sepolia Testnet"
                : "Base Sepolia",
            nativeCurrency: {
              name: "ETH",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: [
              TARGET_CHAIN_ID === 31337
                ? "http://127.0.0.1:8545"
                : TARGET_CHAIN_ID === 11155111
                ? "https://ethereum-sepolia-rpc.publicnode.com"
                : "https://sepolia.base.org",
            ],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export const wagmiConfig = createConfig({
  chains: [sepolia, baseSepolia, hardhat],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http("https://ethereum-sepolia-rpc.publicnode.com"),
    [baseSepolia.id]: http("https://sepolia.base.org"),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});
