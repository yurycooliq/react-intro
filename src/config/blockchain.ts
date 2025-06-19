import { ZeroAddress } from "ethers";

// --- Uniswap v4 constants (Sepolia) ---
export const QUOTER_ADDRESS = "0x61B3f2011A92d183C7dbaDBdA940a7555Ccf9227" as const;
export const POOL_FEE = 10000; // 1% fee tier
export const TICK_SPACING = 200; // default tick spacing for 1% tier per Uniswap v4 docs
// --- Addresses & constants (Sepolia) ---
export const UNIVERSAL_ROUTER_ADDRESS =
  "0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b" as const;
export const PERMIT2_ADDRESS =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
export const ETH_ADDRESS = ZeroAddress as `0x${string}`;
export const ETH_DECIMALS = 18;
export const USDT_ADDRESS = (import.meta.env.VITE_USDT_ADDRESS || '0xbAce3798896B6e8dcBBe26B7A698150c98ba67d0') as `0x${string}`;
export const USDT_DECIMALS = 18;