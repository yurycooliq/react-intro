import { useEffect, useState } from 'react'
import { Field, Input, InputGroup, Flex } from '@chakra-ui/react'
import { formatUnits, parseUnits } from 'viem'
import type { TokenAmountFieldProps } from '../../interfaces'

/**
 * Generic field for entering token amounts.
 *
 * ‑ Exposes/accepts `bigint` values (base units).
 * ‑ Handles string ↔ bigint conversion internally through `formatUnits` / `parseUnits` (18dp by default).
 * ‑ Provides basic validation (positive number, ≤ balance).
 * ‑ Can copy the full balance into the field when the (clickable) label is pressed.
 */
export default function TokenAmountField({
  value,
  onChange,
  tokenSymbol,
  decimals = 18,
  balance,
  buyMode = false,
  onValidChange = () => {},
}: TokenAmountFieldProps) {
  const [input, setInput] = useState<string>(() => formatUnits(value, decimals))
  const [error, setError] = useState<string>()

  // Notify parent about validity changes
  useEffect(() => {
    onValidChange?.(error === undefined)
  }, [error, onValidChange])

  // Keep local string in sync when the external bigint updates (e.g. reset)
  useEffect(() => {
    setInput(formatUnits(value, decimals))
  }, [value, decimals])

  // Parse + validate whenever the user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim()
    setInput(raw)
    validateAndCommit(raw)
  }

  // Helper that validates and, if valid, calls onChange
  const validateAndCommit = (raw: string) => {
    if (!raw) {
      setError('Enter a number')
      return
    }

    // Ensure numeric and max `decimals` fractional digits
    const numMatch = raw.match(/^\d*(?:\.(\d+))?$/)
    if (!numMatch) {
      setError('Invalid format')
      return
    }
    const fraction = numMatch[1]
    if (fraction && fraction.length > decimals) {
      setError(`Maximum ${decimals} decimal places`)
      return
    }

    let parsed: bigint
    try {
      parsed = parseUnits(raw as `${string}`, decimals)
    } catch {
      setError('Invalid value')
      return
    }

    if (parsed < 0n) {
      setError('Value cannot be negative')
      return
    }

    if (balance !== undefined && parsed > balance) {
      setError('Insufficient balance')
      return
    }

    // If we reach here – it is valid
    setError(undefined)
    onChange(parsed)
  }

  // Copy full balance into the input when label clicked (if enabled)
  const handleCopyBalance = () => {
    if (balance === undefined) return
    const formatted = formatUnits(balance, decimals)
    setInput(formatted)
    setError(undefined)
    onChange(balance)
  }

  const balanceLabel = balance !== undefined ? formatUnits(balance, decimals) : undefined

  return (
    <Field.Root invalid={!!error}>
      <Field.Label w="full">
        <Flex w="full" justify="space-between" align="center">
          <span>{buyMode ? 'Buy' : 'Sell'} {tokenSymbol}</span>
          {balanceLabel && (
            <small
              style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
              onClick={handleCopyBalance}
            >
              {balanceLabel + ' ' + tokenSymbol}
            </small>
          )}
        </Flex>
      </Field.Label>

      <InputGroup endAddon={tokenSymbol}>
        <Input
          placeholder="0.00"
          value={input}
          onChange={handleInputChange}
          _selection={{ bg: 'blue.500', color: 'white' }}
        />
      </InputGroup>

      <Field.ErrorText>{error}</Field.ErrorText>
    </Field.Root>
  )
}
