/**
 * Balances Service
 * ----------------
 * Lightweight utility that retrieves the current ETH and USDT balances for a
 * wallet.  It hides the underlying viem contract calls behind a single
 * Promise-based helper so UI components can focus purely on rendering.
 *
 * The helper is kept **framework-agnostic** – no React hooks or global state –
 * making it straightforward to reuse in tests or other runtimes.
 */

import { erc20Abi } from "../abis";
import { USDT_ADDRESS } from "../config/blockchain";
import type { BalancesParams, BalancesResult } from "../interfaces";

/**
 * Returns the wallet’s ETH and USDT balances in a single async call.
 *
 * Implementation details:
 *  • `Promise.allSettled` is used so that a failure in one request does not
 *    prevent the other from resolving.  For example, if the ERC-20 `balanceOf`
 *    reverts we can still show the ETH balance.
 *  • The function is intentionally **pure** – all token addresses are supplied
 *    by the caller (no hidden `useTokenStore` dependency).
 *
 * @param address      Wallet to query.
 * @param publicClient viem `PublicClient` already connected to Sepolia.
 * @returns Object containing `ethBalance` and `usdtBalance` (both `bigint | undefined`).
 */
export async function getBalances({
  address,
  publicClient,
}: BalancesParams): Promise<BalancesResult> {
  const [ethRes, usdtRes] = await Promise.allSettled([
    publicClient.getBalance({ address }),
    publicClient.readContract({
      address: USDT_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }) as Promise<bigint>,
  ]);

  return {
    ethBalance: ethRes.status === "fulfilled" ? ethRes.value : undefined,
    usdtBalance: usdtRes.status === "fulfilled" ? (usdtRes.value as bigint) : undefined,
  };
}
