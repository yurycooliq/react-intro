import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Button,
  Stack,
  Grid,
  Center,
  IconButton,
} from '@chakra-ui/react'
import TokenAmountField from '../common/TokenAmountField'
import { LuArrowDown } from 'react-icons/lu'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
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
  const publicClient = usePublicClient()
  const { usdtAddress, usdtDecimals } = useTokenStore()

  const [ethBalance, setEthBalance] = useState<bigint>()
  const [usdtBalance, setUsdtBalance] = useState<bigint>()

  const fetchBalances = useCallback(async () => {
    if (!address || !publicClient) return
    try {
      const [ethRes, usdtRes] = await Promise.allSettled([
        publicClient.getBalance({ address }),
        publicClient.readContract({ address: usdtAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
      ])
      if (ethRes.status === 'fulfilled') setEthBalance(ethRes.value)
      if (usdtRes.status === 'fulfilled') setUsdtBalance(usdtRes.value as bigint)
    } catch (err) {
      console.error('Failed to fetch balances', err)
    }
  }, [address, publicClient, usdtAddress])

  useEffect(() => {
    fetchBalances()
    const id = setInterval(fetchBalances, 2000)
    return () => clearInterval(id)
  }, [fetchBalances])
  const isValidAmount = amount > 0n
  const [rotated, setRotated] = useState(false)
  const buyTokenSymbol: Currency = currency === 'ETH' ? 'USDT' : 'ETH'
  const buyTokenDecimals = buyTokenSymbol === 'ETH' ? 18 : usdtDecimals

  const handleSwapClick = () => {
    setCurrency((prev) => (prev === 'ETH' ? 'USDT' : 'ETH'))
    setRotated((prev) => !prev)
  }

  const handleExchangeClick = () => {
    if (!isValidAmount) return
    onStart(currency, amount.toString())
  }

  return (
    <Box w="full" maxW="md" bg="gray.700" rounded="xl" p={6} shadow="lg" color="white">
      <ClaimAlert onClaimed={fetchBalances} />


      {/* Amount Input */}
      <Grid templateColumns="min-content 1fr" gap={4} alignItems="stretch">
        <Center>
          <IconButton
            rounded="full"
            aria-label="Change currency"
            variant="outline"
            size="xs"
            onClick={handleSwapClick}
            transition="transform 0.2s"
            transform={rotated ? 'rotate(180deg)' : 'rotate(0deg)'}
          >
            <LuArrowDown />
          </IconButton>
        </Center>

        <Stack gap={3}>
          <TokenAmountField
            value={amount}
            onChange={setAmount}
            tokenSymbol={currency}
            decimals={currency === 'ETH' ? 18 : usdtDecimals}
            balance={currency === 'ETH' ? ethBalance : usdtBalance}
          />
          <TokenAmountField
            value={amount}
            onChange={() => {}}
            tokenSymbol={buyTokenSymbol}
            decimals={buyTokenDecimals}
            balance={buyTokenSymbol === 'ETH' ? ethBalance : usdtBalance}
            buyMode
          />
        </Stack>
      </Grid>

      <Button
        w="full"
        variant="outline"
        colorPalette="blue"
        mt={4}
        disabled={!isValidAmount}
        onClick={handleExchangeClick}
      >
        Обмен
      </Button>
    </Box>
  )
}
