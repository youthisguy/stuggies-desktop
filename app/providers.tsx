"use client"

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig } from "wagmi";
import { defineChain, http } from "viem";

export const megaethTestnet = defineChain({
  id: 6342,
  name: "MegaETH Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://carrot.megaeth.com/rpc"] },
  },
  blockExplorers: {
    default: {
      name: "MegaExplorer",
      url: "https://megaexplorer.xyz",
    },
  },
  testnet: true,
});

export const megaethMainnet = defineChain({
  id: 4326,
  name: "MegaETH Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://megaeth.blockscout.com/rpc"] },
  },
  blockExplorers: {
    default: {
      name: "MegaExplorer",
      url: "https://megaeth.blockscout.com",
    },
  },
  testnet: false,
});

// Simple config 
export const wagmiConfig = createConfig({
  chains: [megaethMainnet],
  transports: {
    [megaethMainnet.id]: http("https://megaeth.blockscout.com/rpc"),
  },
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        defaultChain: megaethMainnet,
        supportedChains: [megaethMainnet],
        appearance: {
          theme: "dark",
          accentColor: "#000080",
        },
        loginMethods: ["wallet", "email", "apple", "google", "twitter"],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}