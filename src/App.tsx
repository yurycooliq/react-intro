import { Box, Container, Flex, Card, CardBody, CardFooter, Text } from '@chakra-ui/react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'

import Header from './components/layout/Header'
import ErrorAlert from './components/common/ErrorAlert'
import ExchangeForm from './components/exchange/ExchangeForm'
import SwapProgress from './components/exchange/SwapProgress'
import CompletionMessage from './components/exchange/CompletionMessage'

function App() {
  const { address } = useAccount()

  const [view, setView] = useState<'initial' | 'form' | 'progress' | 'completed'>('initial')
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useState<{ currency: 'ETH' | 'USDT'; amount: string } | null>(
    null
  )
  const [finalHash, setFinalHash] = useState<`0x${string}` | undefined>()

  useEffect(() => {
    if (address) {
      setView('form')
    } else {
      setView('initial')
    }
  }, [address])

  const handleStart = (currency: 'ETH' | 'USDT', amount: string) => {
    setParams({ currency, amount })
    setView('progress')
  }

  const handleComplete = (hash: `0x${string}`) => {
    setFinalHash(hash)
    setView('completed')
  }

  const restart = () => {
    setParams(null)
    setFinalHash(undefined)
    setView(address ? 'form' : 'initial')
  }

  return (
    <Box minH="100vh" bgGradient="linear(to-b, gray.900, gray.800)" p={4} color="white">
      <Container maxW="100%">
        <Header />

        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        <Flex mt={10} justify="center">
          {view === 'initial' && (
            <Card width="320px" bg="gray.700" color="white">
              <CardBody display="flex" flexDirection="column" gap={2} alignItems="center">
                <Text mt={2} fontSize="lg" fontWeight="bold">Тестовое задание</Text>
                <Text textAlign="center">Для начала подключите свой кошелек в сети Sepolia</Text>
              </CardBody>
              <CardFooter justifyContent="flex-end">
                <ConnectButton showBalance={false} />
              </CardFooter>
            </Card>
          )}
          {view === 'form' && <ExchangeForm onStart={handleStart} />}
          {view === 'progress' && params && (
            <SwapProgress
              currency={params.currency}
              amount={params.amount}
              onComplete={handleComplete}
              onError={setError}
            />
          )}
          {view === 'completed' && (
            <CompletionMessage hash={finalHash} onRestart={restart} />
          )}
        </Flex>
      </Container>
    </Box>
  )
}

export default App
