import { useState } from 'react'
import {
  Box,
  Button,
  HStack,
  Input,
  Link,
  Stack,
  Text,
} from '@chakra-ui/react'
import { parseEther, parseUnits, formatEther } from 'viem'
import {
  useAccount,
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from 'wagmi'

const TOKEN_SALE_ADDRESS = '0xYourSaleContract' // TODO: replace with actual sale contract
const USDT_ADDRESS = '0xYourUSDTAddress' // TODO: replace with Sepolia USDT contract or deployed token
const USDT_DECIMALS = 6

// Minimal ERC20 ABI with methods that we need
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
    stateMutability: 'nonpayable',
  },
  {
    constant: false,
    inputs: [
      { name: '_from', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
    stateMutability: 'nonpayable',
  },
] as const

export default function BuyTokenForm() {
  const [currency, setCurrency] = useState<'ETH' | 'USDT'>('ETH')
  const [amount, setAmount] = useState('')
  const [hash, setHash] = useState<`0x${string}` | undefined>()

  const { address } = useAccount()

  const { data: ethBalance } = useBalance({
    address,
  })

  const { data: usdtBalance } = useBalance({
    address,
    token: USDT_ADDRESS as `0x${string}`,
  })

  const { sendTransactionAsync } = useSendTransaction()
  const { writeContractAsync } = useWriteContract()

  // Track tx confirmation
  const { isLoading: isMining } = useWaitForTransactionReceipt({
    hash,
  })

  const isValidAmount = parseFloat(amount) > 0

  async function handleBuy() {
    if (!address) {
      window.alert('Please connect your wallet first')
      return
    }
    if (!isValidAmount) {
      window.alert('Amount must be greater than zero')
      return
    }

    try {
      if (currency === 'ETH') {
        const tx = await sendTransactionAsync({
          to: TOKEN_SALE_ADDRESS as `0x${string}`,
          value: parseEther(amount),
        })
        setHash(tx)
      } else {
        const value = parseUnits(amount, USDT_DECIMALS)

        // 1. approve USDT spending
        const _approveHash = await writeContractAsync({
          address: USDT_ADDRESS as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [TOKEN_SALE_ADDRESS, value],
        })
        console.log('approveHash', _approveHash);
        // Optional: you may wait for the approval receipt here before proceeding

        // 2. transferFrom (buy token)
        const transferHash = await writeContractAsync({
          address: USDT_ADDRESS as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'transferFrom',
          args: [address, TOKEN_SALE_ADDRESS, value],
        })
        setHash(transferHash)
      }
    } catch (error) {
      if (typeof error === 'object' && error !== null) {
        const err = error as { shortMessage?: string; message?: string }
        window.alert(err.shortMessage ?? err.message ?? 'Transaction rejected')
      } else {
        window.alert('Transaction rejected')
      }
    }
  }

  return (
    <Box w="full" maxW="md" bg="gray.700" rounded="xl" p={6} shadow="lg" color="white">
      {/* Currency Switcher */}
      <HStack mb={4} gap={2}>
        <Button flex={1} bg={currency==='ETH' ? 'purple.600' : 'gray.600'} onClick={() => setCurrency('ETH')}>ETH</Button>
        <Button flex={1} bg={currency==='USDT' ? 'purple.600' : 'gray.600'} onClick={() => setCurrency('USDT')}>USDT</Button>
      </HStack>

      {/* Amount Input */}
      <Input
        mb={4}
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        min={0}
      />

      {/* Buy Button */}
      <Button w="full" colorScheme="green" disabled={!isValidAmount || isMining} onClick={handleBuy}>
        {isMining ? 'Processing…' : 'Buy'}
      </Button>

      {hash && (
        <Text fontSize="sm" mt={4} wordBreak="break-all">
          Tx Hash: <Link href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer" color="purple.300" textDecor="underline">{hash}</Link>
        </Text>
      )}

      {address && (
        <Stack gap={1} fontSize="xs" color="gray.300" mt={4}>
          <Text>Balance ETH: {ethBalance ? formatEther(ethBalance.value) : '-'}</Text>
          <Text>
            Balance USDT: {usdtBalance ? (Number(usdtBalance.value) / 10 ** USDT_DECIMALS).toFixed(2) : '-'}
          </Text>
        </Stack>
      )}
    </Box>
  )
}
