import { Card, Text } from "@chakra-ui/react";
import WalletConnectButton from "./WalletConnectButton";

/**
 * Prompt card shown when wallet is not connected.
 */
export default function WalletConnectPrompt() {
  return (
    <Card.Root w="full" maxW="md" rounded="xl" shadow="lg" color="white">
      <Card.Header>
        <Text fontSize="lg" fontWeight="bold">
          Connect wallet
        </Text>
      </Card.Header>
      <Card.Body
        display="flex"
        flexDirection="column"
        gap={2}
        alignItems="center"
      >
        <Text textAlign="center">
          Connect your wallet on <strong>sepolia</strong> network to start the demo.
        </Text>
      </Card.Body>

      <Card.Footer justifyContent="center">
        <WalletConnectButton />
      </Card.Footer>
    </Card.Root>
  );
}
