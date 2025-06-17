import { Card, Text } from '@chakra-ui/react'
import { ConnectButton } from '@rainbow-me/rainbowkit'

/**
 * Prompt card shown when wallet is not connected.
 */
export default function WalletConnectPrompt() {
  return (
    <Card.Root width="320px" bg="gray.700" color="white">
      <Card.Body display="flex" flexDirection="column" gap={2} alignItems="center">
        <Text mt={2} fontSize="lg" fontWeight="bold">
          Тестовое задание
        </Text>
        <Text textAlign="center">Для начала подключите свой кошелек в сети Sepolia</Text>
      </Card.Body>

      <Card.Footer justifyContent="flex-end">
        <ConnectButton showBalance={false} />
      </Card.Footer>
    </Card.Root>
  )
}
