import { ethers } from "ethers";
import type { Address, PublicClient } from "viem";
import quoterAbi from "../abis/v4Quoter";

// --- Uniswap v4 constants (Sepolia) ---
const QUOTER_ADDRESS = "0x61B3f2011A92d183C7dbaDBdA940a7555Ccf9227" as const;
const POOL_FEE = 10000; // 1% fee tier
const TICK_SPACING = 200; // default tick spacing for 1% tier per Uniswap v4 docs

// --- Types ---
export interface QuoteParams {
  publicClient: PublicClient;
  tokenInAddress: Address;
  tokenOutAddress: Address;
  amount: bigint;
  sellDecimals: number;
  buyDecimals: number;
  quoteType: "exactIn" | "exactOut";
}

export interface QuoteResult {
  quotedAmount: bigint;
  slippage: number | null;
}

export async function getSwapQuote({
  publicClient,
  tokenInAddress,
  tokenOutAddress,
  amount,
  sellDecimals,
  buyDecimals,
  quoteType,
}: QuoteParams): Promise<QuoteResult | null> {
  const url = publicClient?.transport?.url;
  if (!publicClient || !url) {
    console.error("Public client or transport URL is not available.");
    return null;
  }

  const provider = new ethers.JsonRpcProvider(url);
  const quoter = new ethers.Contract(QUOTER_ADDRESS, quoterAbi, provider);

  if (amount === 0n) {
    return { quotedAmount: 0n, slippage: null };
  }

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
