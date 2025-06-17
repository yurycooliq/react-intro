import { useEffect, useState } from 'react'
import {
  Box,
  Link,
  Text,
} from '@chakra-ui/react'

import { parseEther, parseUnits } from 'viem'
import {
  useAccount,
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'

import { useTokenStore } from '../../store/token'
const USDT_ADDRESS = useTokenStore.getState().usdtAddress
const USDT_DECIMALS = useTokenStore.getState().usdtDecimals

export type Currency = 'ETH' | 'USDT'

interface SwapProgressProps {
  currency: Currency
  amount: string
  onComplete: (hash: `0x${string}`) => void
  onError: (msg: string) => void
}

export default function SwapProgress({
  currency,
  amount,
  onComplete,
  onError,
}: SwapProgressProps) {
  const { address } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()
  const { writeContractAsync } = useWriteContract()

  const [activeStep, setActiveStep] = useState(0)
  const [hashes, setHashes] = useState<`0x${string}`[]>([])

  // Track mining of last hash
  const lastHash = hashes[hashes.length - 1]
  const { isLoading: isMining } = useWaitForTransactionReceipt({ hash: lastHash })

  useEffect(() => {
    ;(async () => {
      if (!address) {
        onError('Wallet not connected')
        return
      }
      try {
        if (currency === 'ETH') {
          setActiveStep(2) // direct swap, skip approve
          const tx = await sendTransactionAsync({
            to: USDT_ADDRESS,
            value: parseEther(amount),
          })
          setHashes([tx])
          onComplete(tx)
        } else {
          // Step 0: approve
          setActiveStep(0)
          const value = parseUnits(amount, USDT_DECIMALS)
          const approveHash = await writeContractAsync({
            address: USDT_ADDRESS,
            abi: [
              {
                name: 'approve',
                type: 'function',
                inputs: [
                  { name: '_spender', type: 'address' },
                  { name: '_value', type: 'uint256' },
                ],
                outputs: [{ name: '', type: 'bool' }],
                stateMutability: 'nonpayable',
              },
            ] as const,
            functionName: 'approve',
            args: [USDT_ADDRESS, value],
          })
          setHashes([approveHash])

          // Step 1: swap (transferFrom)
          setActiveStep(1)
          const swapHash = await writeContractAsync({
            address: USDT_ADDRESS,
            abi: [
              {
                name: 'transferFrom',
                type: 'function',
                inputs: [
                  { name: '_from', type: 'address' },
                  { name: '_to', type: 'address' },
                  { name: '_value', type: 'uint256' },
                ],
                outputs: [{ name: '', type: 'bool' }],
                stateMutability: 'nonpayable',
              },
            ] as const,
            functionName: 'transferFrom',
            args: [address, USDT_ADDRESS, value],
          })
          setHashes([approveHash, swapHash])

          // Step 2 complete
          setActiveStep(2)
          onComplete(swapHash)
        }
      } catch (err) {
        const msg =
          typeof err === 'object' && err !== null
            ? (err as { shortMessage?: string; message?: string }).shortMessage ??
              (err as { shortMessage?: string; message?: string }).message ??
              'Transaction rejected'
            : 'Transaction rejected'
        onError(msg)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stepTitles = ['Approve', 'Swap', 'Complete']

  return (
    <Box maxW="md" w="full" bg="gray.700" rounded="xl" p={6} shadow="lg" color="white">
      {stepTitles.map((title, index) => (
        <Box key={title} mb={4}>
          <Text fontWeight="bold">
            {index < activeStep ? '✔️' : '⏳'} {title}
          </Text>
          {hashes[index] && (
            <Link
              href={`https://sepolia.etherscan.io/tx/${hashes[index]}`}
              target="_blank"
              color="purple.300"
            >
              {`${hashes[index].slice(0, 10)}...`}
            </Link>
          )}
        </Box>
      ))}
      {isMining && <Text mt={4}>Подтверждаем транзакцию...</Text>}
    </Box>
  )
}
