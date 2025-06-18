import { Box, Container, Flex } from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'


import ErrorAlert from './components/common/ErrorAlert'
import WalletConnectPrompt from './components/common/WalletConnectPrompt'
import ExchangeForm from './components/exchange/ExchangeForm'
import SwapProgress from './components/exchange/SwapProgress'

function App() {
  const { address } = useAccount()

  const [view, setView] = useState<'initial' | 'form' | 'progress' | 'completed'>('initial')
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useState<{ currency: 'ETH' | 'USDT'; amount: string; minOut: string } | null>(
    null
  )

  useEffect(() => {
    if (!address) {
      setView('initial')
      return
    }
    setView('form')
  }, [address])

  const handleStart = (currency: 'ETH' | 'USDT', amount: string, minOut: string) => {
    setParams({ currency, amount, minOut })
    setView('progress')
  }

  return (
    <Box minH="100vh" bgGradient="linear(to-b, gray.900, gray.800)" p={4} color="white">
      <Container maxW="100%">
        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        <Flex mt={10} justify="center">
          {view === 'initial' && <WalletConnectPrompt />}
          {view === 'form' && <ExchangeForm onStart={handleStart} />}
          {view === 'progress' && params && (
            <SwapProgress
              currency={params.currency}
              amount={params.amount}
              minOut={params.minOut}
              onError={setError}
            />
          )}
        </Flex>
      </Container>
    </Box>
  )
}

export default App
