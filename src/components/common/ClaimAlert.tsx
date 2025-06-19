import { Alert, Link } from '@chakra-ui/react'
import { LuPlane } from 'react-icons/lu'
import { formatUnits } from 'viem'
import type { Abi } from 'viem'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { useState, useEffect } from 'react'
import erc20Abi from '../../abis/erc20'
import { USDT_ADDRESS, USDT_DECIMALS } from '../../config/blockchain'

interface ClaimAlertProps {
  onClaimed?: () => void
}

export default function ClaimAlert({ onClaimed }: ClaimAlertProps) {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const [isTxPending, setIsTxPending] = useState(false)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

  const { isLoading: isMining, isError: isTxError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })

  // read claimable
  const {
    data: claimable,
    isPending: isClaimableLoading,
    isError: isClaimableError,
    refetch,
  } = useReadContract({
    abi: erc20Abi as Abi,
    address: USDT_ADDRESS,
    functionName: 'claimable',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address,
    },
  })

  // Update UI after tx mined / errored
  useEffect(() => {
    if (!txHash) return
    if (!isMining) {
      if (isTxError) {
        window.alert('Transaction failed')
      } else {
        refetch()
        onClaimed?.()
      }
      setIsTxPending(false)
      setTxHash(undefined)
    }
  }, [txHash, isMining, isTxError, refetch, onClaimed])

  if (isClaimableLoading) {
    return (
      <Alert.Root title="USDT Faucet" status="info" mb={4}>
        <Alert.Content>Checking claimable balance...</Alert.Content>
      </Alert.Root>
    )
  }

  if (isClaimableError || !claimable || claimable === 0n) return null

  const claimableAmount = Number(formatUnits(claimable as bigint, USDT_DECIMALS))

  const handleClaim = async () => {
    if (!address) return
    try {
      setIsTxPending(true)
      const hash = await writeContractAsync({
        abi: erc20Abi as Abi,
        address: USDT_ADDRESS,
        functionName: 'claim',
        args: [claimable as bigint],
      })
      setTxHash(hash as `0x${string}`)
    } catch (err) {
      console.error(err)
      window.alert('Transaction failed')
      setIsTxPending(false)
    }
  }

  return (
    <Alert.Root title="USDT Faucet" status="info" mb={4} opacity={isTxPending ? 0.7 : 1}>
      <Alert.Indicator>
        <LuPlane />
      </Alert.Indicator>
      <Alert.Content color="fg">
        <Alert.Title><strong>Get USDT test token first!</strong></Alert.Title>
        <Alert.Description>
          You have {claimableAmount} USDT tokens to claim with this wallet
        </Alert.Description>
      </Alert.Content>
      <Link
        alignSelf="center"
        fontWeight="medium"
        onClick={handleClaim}
        _hover={{ textDecoration: 'underline' }}
        pointerEvents={isTxPending ? 'none' : 'auto'}
      >
        {isTxPending ? 'Claiming...' : `Claim ${claimableAmount} USDT`}
      </Link>
    </Alert.Root>
  )
}
