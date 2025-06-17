import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  RainbowKitProvider,
  getDefaultConfig,
  midnightTheme,
} from "@rainbow-me/rainbowkit";
import theme from "./theme.ts";
import { ColorModeProvider } from "./components/ui/color-mode";

import "./index.css";
import "@rainbow-me/rainbowkit/styles.css";

// Create a shared TanStack Query client (required by RainbowKit)
const queryClient = new QueryClient();

const config = getDefaultConfig({
  appName: "Token Purchase DApp",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={theme}>
      <ColorModeProvider forcedTheme="dark">
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={config}>
            <RainbowKitProvider modalSize="compact" theme={midnightTheme()}>
              <App />
            </RainbowKitProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </ColorModeProvider>
    </ChakraProvider>
  </StrictMode>
);
