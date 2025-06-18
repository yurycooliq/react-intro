import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, Button, Stack, Grid, Center, IconButton, Text } from "@chakra-ui/react";
import TokenAmountField from "../common/TokenAmountField";
import { LuArrowDown } from "react-icons/lu";
import { erc20Abi, type Address } from "viem";
import quoterAbi from "../../lib/abis/v4Quoter";
import { useAccount, usePublicClient } from "wagmi";
import { useTokenStore } from "../../store/token";
import ClaimAlert from "../common/ClaimAlert";
import { ethers, ZeroAddress } from "ethers";

// --- Uniswap v4 constants (Sepolia) ---
const ETH_ADDRESS = ZeroAddress as Address;
const QUOTER_ADDRESS = "0x61B3f2011A92d183C7dbaDBdA940a7555Ccf9227" as const;
const POOL_FEE = 10000; // 1% fee tier
const TICK_SPACING = 200; // default tick spacing for 1% tier per Uniswap v4 docs
type Currency = "ETH" | "USDT";


interface ExchangeFormProps {
  onStart: (currency: Currency, amount: string, minOut: string) => void;
}

export default function ExchangeForm({ onStart }: ExchangeFormProps) {
  const [currency, setCurrency] = useState<Currency>("ETH");
  const [amount, setAmount] = useState<bigint>(0n);

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { usdtAddress, usdtDecimals } = useTokenStore();

  const [ethBalance, setEthBalance] = useState<bigint>();
  const [usdtBalance, setUsdtBalance] = useState<bigint>();

  const fetchBalances = useCallback(async () => {
    if (!address || !publicClient) return;
    try {
      const [ethRes, usdtRes] = await Promise.allSettled([
        publicClient.getBalance({ address }),
        publicClient.readContract({
          address: usdtAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        }) as Promise<bigint>,
      ]);
      if (ethRes.status === "fulfilled") setEthBalance(ethRes.value);
      if (usdtRes.status === "fulfilled")
        setUsdtBalance(usdtRes.value as bigint);
    } catch (err) {
      console.error("Failed to fetch balances", err);
    }
  }, [address, publicClient, usdtAddress]);

  useEffect(() => {
    fetchBalances();
    const id = setInterval(fetchBalances, 2000);
    return () => clearInterval(id);
  }, [fetchBalances]);
  const isValidAmount = amount > 0n;
  const [rotated, setRotated] = useState(false);
  const buyTokenSymbol: Currency = currency === "ETH" ? "USDT" : "ETH";
  const buyTokenDecimals = buyTokenSymbol === "ETH" ? 18 : usdtDecimals;

  const [buyAmount, setBuyAmount] = useState<bigint>(0n);
  // which field was edited last -> determines quoting direction
  const [lastEdited, setLastEdited] = useState<'sell' | 'buy'>('sell');
  const [slippage, setSlippage] = useState<number | null>(null);
  const [sellValid, setSellValid] = useState<boolean>(true);
  const [buyValid, setBuyValid] = useState<boolean>(true);

  const buttonLabel = `Swap ${currency} to ${buyTokenSymbol}${
    slippage !== null ? ` with ${slippage.toFixed(2)}% slippage` : ""
  }`;

  const hasQuote = buyAmount > 0n && slippage !== null;
  const hasEnoughBalance =
    currency === "ETH"
      ? ethBalance !== undefined && amount <= (ethBalance ?? 0n)
      : usdtBalance !== undefined && amount <= (usdtBalance ?? 0n);
  const canSwap = isValidAmount && hasQuote && hasEnoughBalance && sellValid && buyValid;

  const provider = useMemo(() => {
    if (!publicClient) return null;
    const url: string | undefined = publicClient?.transport?.url;
    if (!url) return null;
    return new ethers.JsonRpcProvider(url);
  }, [publicClient]);

  const quoter = useMemo(() => {
    if (!provider) return null;
    return new ethers.Contract(QUOTER_ADDRESS, quoterAbi, provider);
  }, [provider]);

  const fetchQuote = useCallback(async () => {
    if (!quoter) return;

    // guard for empty inputs
    if ((lastEdited === 'sell' && amount === 0n) || (lastEdited === 'buy' && buyAmount === 0n)) {
      setBuyAmount(0n);
      setSlippage(null);
      return;
    }

    const tokenIn = currency === "ETH" ? ETH_ADDRESS : usdtAddress;
    const tokenOut = currency === "ETH" ? usdtAddress : ETH_ADDRESS;
    const sellDecimals = currency === "ETH" ? 18 : usdtDecimals;
    // Use a small sample amount (0.001 token) for baseline price to avoid skew when pool liquidity is low.
    const unitInFull = 10n ** BigInt(sellDecimals);
    const unitInSample = unitInFull / 1000n === 0n ? 1n : unitInFull / 1000n;

    // poolKey requires currencies sorted ascending
    const [currency0, currency1] =
      tokenIn.toLowerCase() < tokenOut.toLowerCase()
        ? [tokenIn, tokenOut]
        : [tokenOut, tokenIn];
    const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();

    let outAmount: bigint | null = null;
    let sampleOut: bigint | null = null;

    const paramsBase = (input: bigint) => ({
      poolKey: {
        currency0: currency0 as Address,
        currency1: currency1 as Address,
        fee: POOL_FEE,
        tickSpacing: TICK_SPACING,
        hooks: ZeroAddress as Address,
      },
      zeroForOne,
      exactAmount: input.toString(),
      hookData: "0x",
    });

    try {
      if (lastEdited === 'sell') {
        // Forward quote: exact input -> output
        const { amountOut } = await quoter!.quoteExactInputSingle.staticCall(paramsBase(amount))
        outAmount = BigInt(amountOut.toString())

        const { amountOut: unitOut } = await quoter!.quoteExactInputSingle.staticCall(paramsBase(unitInSample))
        sampleOut = BigInt(unitOut.toString())
      } else {
        // Reverse quote: exact output (buyAmount) -> required input
        const { amountIn } = await quoter!.quoteExactOutputSingle.staticCall(paramsBase(buyAmount))
        const required = BigInt(amountIn.toString())
        setAmount(required) // sync sell field

        // baseline for price/slippage – small sample output
        const unitOutFull = 10n ** BigInt(buyTokenDecimals)
        const unitOutSample = unitOutFull / 1000n === 0n ? 1n : unitOutFull / 1000n
        const { amountIn: baseInSmall } = await quoter!.quoteExactOutputSingle.staticCall(paramsBase(unitOutSample))

        outAmount = buyAmount
        sampleOut = unitOutSample
        // use sampleOut & baseInSmall for price calc
        const baseIn = BigInt(baseInSmall.toString())
        // compute prices
        const execPrice = (Number(outAmount) / 10 ** buyTokenDecimals) / (Number(required) / 10 ** sellDecimals)
        const basePrice = (Number(sampleOut) / 10 ** buyTokenDecimals) / (Number(baseIn) / 10 ** sellDecimals)
        const slip = basePrice === 0 ? null : Math.abs((execPrice - basePrice) / basePrice) * 100
        setSlippage(slip)
      }
    } catch (err) {
      // If pool not found or quote reverts, just treat as no quote.
      if (err instanceof Error && err.message.includes("UnexpectedRevertBytes")) {
        outAmount = null;
        sampleOut = null;
      } else {
        console.error(err);
      }
    }

    if (outAmount !== null && sampleOut !== null) {
      if (lastEdited === 'sell') {
        setBuyAmount(outAmount);
      }

      if (lastEdited === 'sell') {
        const execPrice =
          (Number(outAmount) / 10 ** buyTokenDecimals) /
          (Number(amount) / 10 ** sellDecimals)
        const basePrice = (Number(sampleOut) / 10 ** buyTokenDecimals) / (Number(unitInSample) / 10 ** sellDecimals)
        const slip = basePrice === 0 ? null : Math.abs((execPrice - basePrice) / basePrice) * 100
        setSlippage(slip)
      }
    } else {
      // no quote
      setBuyAmount(0n);
      setSlippage(null);
    }
  }, [quoter, amount, buyAmount, lastEdited, currency, usdtAddress, usdtDecimals, buyTokenDecimals]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  const handleSwapClick = () => {
    setCurrency((prev) => (prev === "ETH" ? "USDT" : "ETH"));
    setRotated((prev) => !prev);
    setAmount(0n);
    setBuyAmount(0n);
    setSlippage(null);
  };

  // handlers passed to amount fields
  const handleSellAmountChange = (v: bigint) => {
    setAmount(v)
    setLastEdited('sell')
  }
  const handleBuyAmountChange = (v: bigint) => {
    setBuyAmount(v)
    setLastEdited('buy')
  }

  const handleExchangeClick = () => {
    if (!isValidAmount) return;
    onStart(currency, amount.toString(), buyAmount.toString());
  };

  return (
    <Card.Root
      w="full"
      maxW="md"
      rounded="xl"
      shadow="lg"
      color="white"
    >
      <Card.Header>
        <Text fontSize="lg" fontWeight="bold">
          Swap with 🦄Uniswap v4
        </Text>
      </Card.Header>

      <Card.Body>
        <ClaimAlert onClaimed={fetchBalances} />
        <Grid templateColumns="min-content 1fr" gap={4} alignItems="stretch">
          <Center>
            <IconButton
              rounded="full"
              aria-label="Change currency"
              variant="outline"
              size="xs"
              onClick={handleSwapClick}
              transition="transform 0.2s"
              transform={rotated ? "rotate(180deg)" : "rotate(0deg)"}
            >
              <LuArrowDown />
            </IconButton>
          </Center>

          <Stack gap={3}>
            <TokenAmountField
              value={amount}
              onChange={handleSellAmountChange}
              tokenSymbol={currency}
              decimals={currency === "ETH" ? 18 : usdtDecimals}
              balance={currency === "ETH" ? ethBalance : usdtBalance}
              onValidChange={setSellValid}
            />
            <TokenAmountField
              value={buyAmount}
              onChange={handleBuyAmountChange}
              tokenSymbol={buyTokenSymbol}
              decimals={buyTokenDecimals}
              balance={buyTokenSymbol === "ETH" ? ethBalance : usdtBalance}
              buyMode
              onValidChange={setBuyValid}
            />
          </Stack>
        </Grid>
      </Card.Body>

      <Card.Footer>
        <Button
          w="full"
          variant="outline"
          colorPalette="blue"
          mt={4}
          disabled={!canSwap}
          onClick={handleExchangeClick}
        >
          {buttonLabel}
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}
