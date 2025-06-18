import { useEffect, useState } from 'react'
import {
  Box,
  Link,
  Text,
  Button,
  Stack,
  Steps,
} from '@chakra-ui/react'

import { parseEther, parseUnits } from 'viem'
import { ZeroAddress, AbiCoder } from 'ethers'

import {
  useAccount,
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSignTypedData,
  useChainId,
  usePublicClient,
} from 'wagmi'

import { useTokenStore } from '../../store/token'
import erc20Abi from '../../lib/abis/erc20'
import universalRouterAbi from '../../lib/abis/universalRouter'
const USDT_ADDRESS = useTokenStore.getState().usdtAddress
const USDT_DECIMALS = useTokenStore.getState().usdtDecimals

// --- Uniswap v4 constants (Sepolia) ---
const UNIVERSAL_ROUTER_ADDRESS = '0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b' as const
const ETH_ADDRESS = ZeroAddress as `0x${string}`
const POOL_FEE = 10000
const TICK_SPACING = 200

export type Currency = 'ETH' | 'USDT'

interface SwapProgressProps {
  currency: Currency
  amount: string
  minOut: string
  onComplete: (hash: `0x${string}`) => void
  onError: (msg: string) => void
}

export default function SwapProgress({
  currency,
  amount,
  minOut,
  onComplete,
  onError,
}: SwapProgressProps) {
  const { address } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()
  const { writeContractAsync } = useWriteContract()
  const { signTypedDataAsync } = useSignTypedData()
  const chainId = useChainId()
  const publicClient = usePublicClient()

  const [activeStep, setActiveStep] = useState(0)
  const [hashes, setHashes] = useState<`0x${string}`[]>([])

  // Track mining of last hash
  const lastHash = hashes[hashes.length - 1]
  const { isLoading: isMining } = useWaitForTransactionReceipt({ hash: lastHash })

  useEffect(() => {
    ;(async () => {
      if (!address || !publicClient) {
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
          // Step 0: permit
          setActiveStep(0)
          const value = parseUnits(amount, USDT_DECIMALS)

          // Get nonce for permit
          const nonce: bigint = await publicClient.readContract({
            address: USDT_ADDRESS,
            abi: erc20Abi,
            functionName: 'nonces',
            args: [address],
          }) as bigint

          const deadline: bigint = BigInt(Math.floor(Date.now() / 1000) + 3600) // +1 hour

          // Sign typed data for ERC-2612 Permit
          const domain = {
            name: 'USDTest',
            version: '1',
            chainId,
            verifyingContract: USDT_ADDRESS,
          } as const

          const types = {
            Permit: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          } as const

          const message = {
            owner: address,
            spender: UNIVERSAL_ROUTER_ADDRESS,
            value,
            nonce,
            deadline,
          } as const

          const signature = await signTypedDataAsync({
            domain,
            types,
            primaryType: 'Permit',
            message,
          })

          const r = `0x${signature.slice(2, 66)}` as `0x${string}`
          const s = `0x${signature.slice(66, 130)}` as `0x${string}`
          const v = Number('0x' + signature.slice(130, 132))

          const permitHash = await writeContractAsync({
            address: USDT_ADDRESS,
            abi: erc20Abi,
            functionName: 'permit',
            args: [address, UNIVERSAL_ROUTER_ADDRESS, value, deadline, v, r, s],
          })
          setHashes([permitHash])

          // Step 1: swap via Universal Router
          setActiveStep(1)

          // Build v4 swap planners
          const amountInStr = value.toString()
          const tokenIn = USDT_ADDRESS
          const tokenOut = ETH_ADDRESS
          const [currency0, currency1] = tokenIn.toLowerCase() < tokenOut.toLowerCase()
            ? [tokenIn, tokenOut]
            : [tokenOut, tokenIn]
          const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase()

          // --- Manually encode Uniswap v4 router actions (no sdk) ---
          const abi = AbiCoder.defaultAbiCoder()

          // action bytes sequence: SWAP_EXACT_IN_SINGLE (0x06), SETTLE_ALL (0x0c), TAKE_ALL (0x0f)
          const actionsHex = '0x060c0f'

          // 1) SWAP_EXACT_IN_SINGLE input
          const swapInput = abi.encode(
            ['((address,address,uint24,int24,address),bool,uint128,uint128,bytes)'],
            [[[currency0, currency1, POOL_FEE, TICK_SPACING, ZeroAddress], zeroForOne, amountInStr, minOut, '0x']]
          )

          // 2) SETTLE_ALL input
          const settleAllInput = abi.encode(['address', 'uint256'], [currency0, amountInStr])

          // 3) TAKE_ALL input
          const takeAllInput = abi.encode(['address', 'uint256'], [currency1, '0'])

          const encodedActions = abi.encode(['bytes', 'bytes[]'], [actionsHex, [swapInput, settleAllInput, takeAllInput]])

          const commandsHex = `0x${Number(16).toString(16).padStart(2, '0')}` as `0x${string}`
          const inputs = [encodedActions as `0x${string}`] as [`0x${string}`]

          const deadlineBn: bigint = BigInt(Math.floor(Date.now() / 1000) + 3600)

          const swapHash = await writeContractAsync({
            address: UNIVERSAL_ROUTER_ADDRESS,
            abi: universalRouterAbi,
            functionName: 'execute',
            args: [commandsHex, inputs, deadlineBn],
            value: 0n,
          })
          setHashes([permitHash, swapHash])

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
  }, [address, amount, currency, minOut, onComplete, onError, sendTransactionAsync, writeContractAsync, chainId, signTypedDataAsync, publicClient])

  const steps = [
    {
      title: 'Checking token spending allowance',
      description: currency === 'ETH'
        ? 'Not needed for ETH'
        : activeStep > 0
        ? 'Allowance is enough'
        : 'Checking token spending allowance...',
    },
    {
      title: `Swapping ${amount} ${currency} for ${currency === 'ETH' ? 'USDT' : 'ETH'}`,
      description: (() => {
        if (activeStep < 1) return 'Waiting for allowance...'
        if (isMining) return 'Pending transaction (see link below)'
        return 'Transaction sent'
      })(),
    },
    {
      title: 'Finish!',
      description: 'All done.',
    },
  ]

  const explorer = (hash: `0x${string}`) =>
    `https://sepolia.etherscan.io/tx/${hash}`

  return (
    <Box maxW="md" w="full" bg="gray.700" rounded="xl" p={6} shadow="lg" color="white">
      <Steps.Root orientation="vertical" height="400px" defaultStep={1} count={steps.length}>
        <Steps.List>
          {steps.map((step, index) => (
            <Steps.Item key={index} index={index} title={step.title}>
              <Steps.Indicator />
              <Steps.Title>{step.title}</Steps.Title>
              <Steps.Separator />
            </Steps.Item>
          ))}
        </Steps.List>

        <Stack mt={4}>
          {steps.map((step, index) => (
            <Steps.Content key={index} index={index}>
              <Text>{step.description}</Text>
              {hashes[index] && (
                <Link href={explorer(hashes[index])} target="_blank" color="purple.300">
                  {`${hashes[index].slice(0, 10)}...`}
                </Link>
              )}
            </Steps.Content>
          ))}
          <Steps.CompletedContent>
            <Text mb={3}>All steps are complete!</Text>
            <Button onClick={() => window.location.reload()}>Make another swap</Button>
          </Steps.CompletedContent>
        </Stack>
      </Steps.Root>
    </Box>
  )
}
