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
import TokenAmountField from '../common/TokenAmountField'
import { useAccount, useBalance } from 'wagmi'
import { useTokenStore } from '../../store/token'
import ClaimAlert from '../common/ClaimAlert'

type Currency = 'ETH' | 'USDT'

interface ExchangeFormProps {
  onStart: (currency: Currency, amount: string) => void;
}

export default function ExchangeForm({ onStart }: ExchangeFormProps) {
  const [currency, setCurrency] = useState<Currency>('ETH')
  const [amount, setAmount] = useState<bigint>(0n)

  const { address } = useAccount()
  const { usdtAddress, usdtDecimals } = useTokenStore()

  const { data: ethBalance } = useBalance({
    address,
  })
  const { data: usdtBalance } = useBalance({
    address,
    token: usdtAddress,
  })
  const isValidAmount = amount > 0n

  const handleExchangeClick = () => {
    if (!isValidAmount) return
    onStart(currency, amount.toString())
  }

  const balanceLabel = currency === 'ETH'
    ? ethBalance
      ? `${formatEther(ethBalance.value)} ETH`
      : '-'
    : usdtBalance
      ? `${(Number(usdtBalance.value) / 10 ** usdtDecimals).toFixed(2)} USDT`
      : '-'

  return (
    <Box w="full" maxW="md" bg="gray.700" rounded="xl" p={6} shadow="lg" color="white">
      <ClaimAlert onClaimed={() => usdtBalance?.refetch()} />
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
        <TokenAmountField
            value={amount}
            onChange={setAmount}
            tokenSymbol={currency}
            decimals={currency === 'ETH' ? 18 : usdtDecimals}
            balance={currency === 'ETH' ? ethBalance?.value : usdtBalance?.value}
            copyBalance
          />

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
