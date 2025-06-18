import { useState, useEffect, useCallback } from "react"; // useMemo removed
import { Card, Button, Stack, Grid, Center, IconButton, Text } from "@chakra-ui/react";
import TokenAmountField from "../common/TokenAmountField";
import { LuArrowDown, LuRocket } from "react-icons/lu";
import { erc20Abi, type Address, zeroAddress, type PublicClient } from "viem"; // quoterAbi, ethers, ZeroAddress removed, viemZeroAddress added
import { useAccount, usePublicClient } from "wagmi";
import { useTokenStore } from "../../store/token";
import ClaimAlert from "../common/ClaimAlert";
import { getSwapQuote } from "../../services/quoteService";

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
  const [lastEdited, setLastEdited] = useState<'sell' | 'buy'>('sell');
  const [slippage, setSlippage] = useState<number | null>(null);
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
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
  const canSwap = isValidAmount && hasQuote && hasEnoughBalance && sellValid && buyValid && !isQuoting;

  useEffect(() => {
    const fetchQuoteAsync = async (client: PublicClient) => {
      if ((lastEdited === 'sell' && amount === 0n) || (lastEdited === 'buy' && buyAmount === 0n)) {
        setBuyAmount(0n);
        setSlippage(null);
        return;
      }

      setIsQuoting(true);
      setSlippage(null);

      const ETH_ADDRESS = zeroAddress as Address;
      const tokenIn = currency === "ETH" ? ETH_ADDRESS : usdtAddress;
      const tokenOut = currency === "ETH" ? usdtAddress : ETH_ADDRESS;
      const currentSellDecimals = currency === "ETH" ? 18 : usdtDecimals;
      const currentBuyDecimals = buyTokenSymbol === "ETH" ? 18 : usdtDecimals;

      try {
        const result = await getSwapQuote({
          publicClient: client,
          tokenInAddress: tokenIn,
          tokenOutAddress: tokenOut,
          amount: lastEdited === 'sell' ? amount : buyAmount,
          sellDecimals: currentSellDecimals,
          buyDecimals: currentBuyDecimals,
          quoteType: lastEdited === 'sell' ? 'exactIn' : 'exactOut' as 'exactIn' | 'exactOut',
        });
        if (result) {
          if (lastEdited === 'sell') {
            setBuyAmount(result.quotedAmount);
          } else {
            setAmount(result.quotedAmount);
          }
          setSlippage(result.slippage);
        } else {
          if (lastEdited === 'sell') setBuyAmount(0n);
          else setAmount(0n);
          setSlippage(null);
        }
      } catch (error) {
        console.error("Failed to fetch quote from service:", error);
        if (lastEdited === 'sell') setBuyAmount(0n);
        else setAmount(0n);
        setSlippage(null);
      }
      setIsQuoting(false);
    };

    if (publicClient) {
      fetchQuoteAsync(publicClient);
    }
  }, [publicClient, amount, buyAmount, currency, usdtAddress, usdtDecimals, lastEdited, buyTokenSymbol]); 


  const handleSwapClick = () => {
    setCurrency((prev) => (prev === "ETH" ? "USDT" : "ETH"));
    setRotated((prev) => !prev);
    setAmount(0n);
    setBuyAmount(0n);
    setSlippage(null);
  };

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
          loading={isQuoting}
          loadingText="Estimating slippage..."
          spinnerPlacement="start"
          mt={4}
          disabled={!canSwap}
          onClick={handleExchangeClick}
        >
          <LuRocket /> {buttonLabel}
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}
