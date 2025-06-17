import { Box, Button, Link, Text } from '@chakra-ui/react'

interface CompletionProps {
  hash: `0x${string}` | undefined
  onRestart: () => void
}

export default function CompletionMessage({ hash, onRestart }: CompletionProps) {
  return (
    <Box
      maxW="md"
      w="full"
      mx="auto"
      bg="gray.700"
      rounded="xl"
      p={6}
      shadow="lg"
      color="white"
      textAlign="center"
    >
      <Text fontSize="lg" mb={4}>
        Обмен завершён!
      </Text>
      {hash && (
        <Text mb={6}>
          Tx:{' '}
          <Link
            href={`https://sepolia.etherscan.io/tx/${hash}`}
            target="_blank"
            color="purple.300"
            textDecor="underline"
          >
            {hash}
          </Link>
        </Text>
      )}
      <Button colorScheme="purple" onClick={onRestart}>
        Начать сначала
      </Button>
    </Box>
  )
}
