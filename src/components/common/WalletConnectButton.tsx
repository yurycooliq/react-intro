import { Button, HStack, Image } from "@chakra-ui/react";
import { LuWallet } from "react-icons/lu";
import { ConnectButton } from "@rainbow-me/rainbowkit";

/**
 * WalletConnectButton
 * --------------------
 * Custom wrapper around RainbowKit's `ConnectButton.Custom` to integrate
 * Chakra-UI button styles used across the app.  When the user is not connected,
 * a single blue solid button with a wallet icon is rendered.  Once connected,
 * separate buttons for the connected network and account are shown so the user
 * can open the corresponding RainbowKit modals.
 */
export default function WalletConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        // If your app does not use authentication, you can remove
        // `authenticationStatus` related checks.
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        if (!connected) {
          // Not yet connected ➜ render primary connect button
          return (
            <Button
              colorPalette="blue"
              variant="solid"
              onClick={openConnectModal}
              disabled={!ready}
            >
              <LuWallet /> Connect Wallet
            </Button>
          );
        }

        if (chain?.unsupported) {
          // Wrong network selected ➜ prompt to switch
          return (
            <Button colorPalette="red" variant="solid" onClick={openChainModal}>
              Wrong network
            </Button>
          );
        }

        // Connected & on supported network ➜ show chain & account buttons
        return (
          <HStack>
            <Button variant="outline" onClick={openChainModal}>
              {chain?.hasIcon && chain?.iconUrl && (
                <Image
                  src={chain.iconUrl}
                  alt={chain.name ?? "Chain icon"}
                  boxSize={3}
                  mr={1}
                  borderRadius="full"
                />
              )}
              {chain?.name}
            </Button>

            <Button onClick={openAccountModal} colorPalette="blue" variant="solid">
              {account?.displayName}
              {account?.displayBalance ? ` (${account.displayBalance})` : ""}
            </Button>
          </HStack>
        );
      }}
    </ConnectButton.Custom>
  );
}
