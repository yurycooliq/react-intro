import { create } from 'zustand'

interface TokenState {
  /** Address of the USDT token (Sepolia) */
  usdtAddress: `0x${string}`
  /** Decimals for USDT */
  usdtDecimals: number
}

/**
 * Centralised token configuration.
 * Addresses can be overridden via environment variables at build time.
 */
export const useTokenStore = create<TokenState>(() => ({
  usdtAddress: (import.meta.env.VITE_USDT_ADDRESS || '0xbAce3798896B6e8dcBBe26B7A698150c98ba67d0') as `0x${string}`,
  usdtDecimals: 18,
}))
