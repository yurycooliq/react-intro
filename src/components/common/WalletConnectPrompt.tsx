import { Card, Text } from '@chakra-ui/react'
import WalletConnectButton from './WalletConnectButton'

/**
 * Prompt card shown when wallet is not connected.
 */
export default function WalletConnectPrompt() {
  return (
    <Card.Root width="360px">
      <Card.Body display="flex" flexDirection="column" gap={2} alignItems="center">
        <Text mt={2} fontSize="lg" fontWeight="bold">
          Simple Swap
        </Text>
        <Text textAlign="center">Connect your wallet to Sepolia network to make a swap. We support sepETH (Sepolia ETH) and USDTest (testnet USDT). You can claim some testnet USDT on the next step.</Text>
      </Card.Body>

      <Card.Footer justifyContent="center">
        <WalletConnectButton />
      </Card.Footer>
    </Card.Root>
  )
}
