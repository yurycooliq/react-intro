/**
 * Quote Service
 * ---------------
 * This module provides a single helper – `getSwapQuote` – that talks to the
 * Uniswap v4 quoter contract on Sepolia and returns an estimated swap amount
 * together with the calculated slippage.  It is intentionally **framework-free**
 * and can therefore be consumed by React components, Vue composables or any
 * other context.
 *
 * Key design points:
 * • Pure function – no React hooks inside, no hidden state.
 * • Uses the viem `PublicClient` already configured in the dApp to avoid
 *   duplicating RPC-URL management.
 * • Falls back gracefully: if the client is missing or the user passes an
 *   amount of 0, we return `null`/`0n` without throwing.
 * • Typed end-to-end – the input/output contracts are expressed via the
 *   `QuoteParams` and `QuoteResult` interfaces living in `src/interfaces`.
 */

import { ethers } from "ethers";
import type { Address } from "viem";
import quoterAbi from "../abis/v4Quoter";
import type { QuoteParams, QuoteResult } from "../interfaces";
import { QUOTER_ADDRESS, POOL_FEE, TICK_SPACING } from "../config/blockchain";

/**
 * Returns a swap quote from the Uniswap v4 Quoter.
 *
 * The function supports two modes via `quoteType`:
 *  • `exactIn`  – you provide the amount you are SELLING and get how much you
 *                 will RECEIVE.
 *  • `exactOut` – you provide the amount you want to RECEIVE and get how much
 *                 you need to SELL.
 *
 * The calculation is performed off-chain by calling the view method on the
 * Quoter contract, which replicates the pool maths (including fees and tick
 * spacing) without executing a real swap.
 *
 * Parameters
 * ----------
 * @param publicClient   viem PublicClient already connected to Sepolia.
 * @param tokenInAddress Address of the token being sold (ETH can be the zero address).
 * @param tokenOutAddress Address of the token being bought.
 * @param amount         Amount (in *raw* units, i.e. 10^decimals) for the quote.
 * @param sellDecimals   Decimals of `tokenInAddress`.
 * @param buyDecimals    Decimals of `tokenOutAddress`.
 * @param quoteType      "exactIn" | "exactOut" – defines direction of the quote.
 *
 * Returns
 * -------
 * A `QuoteResult` with:
 * • `quotedAmount` – bigint amount in *raw* units returned by the contract.
 * • `slippage`     – percentage difference between on-chain quote and the
 *                    expected mid-price (null when not computable).
 *
 * A `null` value is returned when `publicClient` is undefined/mis-configured.
 */
export async function getSwapQuote({
  publicClient,
  tokenInAddress,
  tokenOutAddress,
  amount,
  sellDecimals,
  buyDecimals,
  quoteType,
}: QuoteParams): Promise<QuoteResult | null> {
  // If amount is 0, return 0 quoted amount and no slippage
  if (amount === 0n) return { quotedAmount: 0n, slippage: null };

  // If publicClient is not available, return null
  const url = publicClient?.transport?.url;
  if (!publicClient || !url) {
    console.error("Public client or transport URL is not available.");
    return null;
  }

  const provider = new ethers.JsonRpcProvider(url);
  const quoter = new ethers.Contract(QUOTER_ADDRESS, quoterAbi, provider);
  const [currency0, currency1] = 
    tokenInAddress.toLowerCase() < tokenOutAddress.toLowerCase()
      ? [tokenInAddress, tokenOutAddress]
      : [tokenOutAddress, tokenInAddress];
  const zeroForOne = tokenInAddress.toLowerCase() === currency0.toLowerCase();
  const paramsBase = (exactAmount: bigint) => ({
    poolKey: {
      currency0,
      currency1,
      fee: POOL_FEE,
      tickSpacing: TICK_SPACING,
      hooks: ethers.ZeroAddress as Address,
    },
    zeroForOne,
    exactAmount: exactAmount.toString(),
    hookData: "0x",
  });

  try {
    let quotedAmount: bigint;
    let slippage: number | null = null;

    if (quoteType === 'exactIn') {
      const { amountOut } = await quoter.quoteExactInputSingle.staticCall(paramsBase(amount));
      quotedAmount = BigInt(amountOut.toString());

      const unitInSample = (10n ** BigInt(sellDecimals)) / 1000n || 1n;
      const { amountOut: sampleOut } = await quoter.quoteExactInputSingle.staticCall(paramsBase(unitInSample));
      
      const execPrice = (Number(quotedAmount) / 10 ** buyDecimals) / (Number(amount) / 10 ** sellDecimals);
      const basePrice = (Number(sampleOut) / 10 ** buyDecimals) / (Number(unitInSample) / 10 ** sellDecimals);
      slippage = basePrice === 0 ? null : Math.abs((execPrice - basePrice) / basePrice) * 100;

    } else { // exactOut
      const { amountIn } = await quoter.quoteExactOutputSingle.staticCall(paramsBase(amount));
      quotedAmount = BigInt(amountIn.toString());

      const unitOutSample = (10n ** BigInt(buyDecimals)) / 1000n || 1n;
      const { amountIn: baseInSmall } = await quoter.quoteExactOutputSingle.staticCall(paramsBase(unitOutSample));

      const execPrice = (Number(amount) / 10 ** buyDecimals) / (Number(quotedAmount) / 10 ** sellDecimals);
      const basePrice = (Number(unitOutSample) / 10 ** buyDecimals) / (Number(baseInSmall) / 10 ** sellDecimals);
      slippage = basePrice === 0 ? null : Math.abs((execPrice - basePrice) / basePrice) * 100;
    }

    return { quotedAmount, slippage };

  } catch (err) {
    if (err instanceof Error && (err.message.includes("UnexpectedRevertBytes") || err.message.includes("Pool not found"))) {
      return null; // Gracefully handle no pool/quote
    }
    console.error("Error fetching quote:", err);
    return null;
  }
}
