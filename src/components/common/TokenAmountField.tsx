import { useEffect, useState } from 'react'
import { Field, Input, InputGroup } from '@chakra-ui/react'
import { formatUnits, parseUnits } from 'viem'

interface TokenAmountFieldProps {
  /** Current value of the input in base (integer) units */
  value: bigint
  /** Called every time a **valid** value is entered */
  onChange: (value: bigint) => void
  /** Token symbol to show as the right-hand addon, e.g. ETH */
  tokenSymbol: string
  /** Number of fraction digits – defaults to 18 */
  decimals?: number
  /** Wallet balance – used for copy-to-input and max-value validation  */
  balance?: bigint
  /** true → buying mode (label 'Buy', balance non-clickable); false → selling mode */
  buyMode?: boolean
}

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
}: TokenAmountFieldProps) {
  const [input, setInput] = useState<string>(() => formatUnits(value, decimals))
  const [error, setError] = useState<string>()

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
      setError('Введите число')
      return
    }

    // Ensure numeric and max `decimals` fractional digits
    const numMatch = raw.match(/^\d*(?:\.(\d+))?$/)
    if (!numMatch) {
      setError('Неверный формат')
      return
    }
    const fraction = numMatch[1]
    if (fraction && fraction.length > decimals) {
      setError(`Максимум ${decimals} знаков после запятой`)
      return
    }

    let parsed: bigint
    try {
      parsed = parseUnits(raw as `${string}`, decimals)
    } catch {
      setError('Неверное значение')
      return
    }

    if (parsed < 0n) {
      setError('Значение не может быть отрицательным')
      return
    }

    if (balance !== undefined && parsed > balance) {
      setError('Недостаточно средств')
      return
    }

    // If we reach here – it is valid
    setError(undefined)
    onChange(parsed)
  }

  // Copy full balance into the input when label clicked (if enabled)
  const handleCopyBalance = () => {
    if (buyMode || balance === undefined) return
    const formatted = formatUnits(balance, decimals)
    setInput(formatted)
    setError(undefined)
    onChange(balance)
  }

  const balanceLabel = balance !== undefined ? formatUnits(balance, decimals) : undefined

  return (
    <Field.Root invalid={!!error}>
      <Field.Label
        cursor={!buyMode && balance !== undefined ? 'pointer' : undefined}
        onClick={!buyMode ? handleCopyBalance : undefined}
      >
        {buyMode ? 'Buy' : 'Sell'}{balanceLabel ? `: ${balanceLabel}` : ''}
      </Field.Label>

      <InputGroup endAddon={tokenSymbol}>
        <Input
          placeholder="0.00"
          value={input}
          onChange={handleInputChange}
        />
      </InputGroup>

      <Field.ErrorText>{error}</Field.ErrorText>
    </Field.Root>
  )
}
