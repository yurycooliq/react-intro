import { useState } from 'react'
import {
  Box,
  Button,
  HStack,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react'
import { formatEther } from 'viem'
import { useAccount, useBalance } from 'wagmi'

const USDT_DECIMALS = 6
const USDT_ADDRESS = '0xYourUSDTAddress' as `0x${string}` // TODO: replace with actual Sepolia USDT
export const MY_TOKEN_ADDRESS =
  '0xbAce3798896B6e8dcBBe26B7A698150c98ba67d0' as `0x${string}`

type Currency = 'ETH' | 'USDT'

interface ExchangeFormProps {
  onStart: (currency: Currency, amount: string) => void
}

export default function ExchangeForm({ onStart }: ExchangeFormProps) {
  const [currency, setCurrency] = useState<Currency>('ETH')
  const [amount, setAmount] = useState('')

  const { address } = useAccount()

  const { data: ethBalance } = useBalance({
    address,
  })
  const { data: usdtBalance } = useBalance({
    address,
    token: USDT_ADDRESS,
  })
  const isValidAmount = parseFloat(amount) > 0

  const handleExchangeClick = () => {
    if (!isValidAmount) return
    onStart(currency, amount)
  }

  const balanceLabel = currency === 'ETH'
    ? ethBalance
      ? `${formatEther(ethBalance.value)} ETH`
      : '-'
    : usdtBalance
      ? `${(Number(usdtBalance.value) / 10 ** USDT_DECIMALS).toFixed(2)} USDT`
      : '-'

  return (
    <Box w="full" maxW="md" bg="gray.700" rounded="xl" p={6} shadow="lg" color="white">
      {/* Currency Toggle */}
      <HStack mb={4} gap={2}>
        <Button
          flex={1}
          bg={currency === 'ETH' ? 'purple.600' : 'gray.600'}
          onClick={() => setCurrency('ETH')}
        >
          ETH
        </Button>
        <Button
          flex={1}
          bg={currency === 'USDT' ? 'purple.600' : 'gray.600'}
          onClick={() => setCurrency('USDT')}
        >
          USDT
        </Button>
      </HStack>

      <Text mb={1} fontSize="sm" color="gray.300">
        Баланс: {balanceLabel}
      </Text>

      {/* Amount Input */}
      <Stack gap={3}>
        <HStack>
          <Input
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min={0}
          />
          <Text>{currency}</Text>
        </HStack>

        {/* Output token input (read-only) */}
        <HStack>
          <Input readOnly placeholder="0" />
          <Text>MYT</Text>
        </HStack>
      </Stack>

      <Button
        w="full"
        colorScheme="green"
        mt={4}
        disabled={!isValidAmount}
        onClick={handleExchangeClick}
      >
        Обмен
      </Button>
    </Box>
  )
}
