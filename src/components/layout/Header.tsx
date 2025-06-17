import { Flex, Heading } from '@chakra-ui/react'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function Header() {
  return (
    <Flex justify="space-between" align="center" py={4}>
      <Heading size="lg">Token Purchase DApp</Heading>
      <ConnectButton />
    </Flex>
  )
}
