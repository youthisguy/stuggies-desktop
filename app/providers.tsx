"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { defineChain } from "viem";

// 1. Define the MegaETH Mainnet chain
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
      url: "https://megaeth.blockscout.com/address",
    },
  },
  testnet: false,
});

// 2. Update Wagmi config to use Mainnet
export const wagmiConfig = createConfig({
  chains: [megaethMainnet],
  transports: { [megaethMainnet.id]: http() },
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // 3. Set default and supported chains to Mainnet
        defaultChain: megaethMainnet,
        supportedChains: [megaethMainnet],
        appearance: {
          theme: "dark",
          accentColor: "#000080",
        },
        loginMethods: ["wallet", "email", "apple", "google", "twitter", "passkey"],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}