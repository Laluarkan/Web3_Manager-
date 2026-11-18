import { createConfig, http, injected } from "wagmi";
import { baseSepolia, hardhat } from "wagmi/chains";

export const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);

export const wagmiConfig = createConfig({
  chains: [hardhat, baseSepolia],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
