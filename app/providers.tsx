"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { defineChain } from "viem";

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
      url: "https://megaeth-testnet-v2.blockscout.com",
    },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [megaethTestnet],
  transports: { [megaethTestnet.id]: http() },
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        defaultChain: megaethTestnet,
        supportedChains: [megaethTestnet],
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
