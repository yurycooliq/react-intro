import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  Stack,
  Grid,
  Center,
  IconButton,
  Text,
} from "@chakra-ui/react";
import TokenAmountField from "../common/TokenAmountField";
import { LuArrowDown, LuRocket } from "react-icons/lu";
import type { PublicClient } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { getBalances } from "../../services/balancesService";
import ClaimAlert from "../common/ClaimAlert";
import { getSwapQuote } from "../../services/quoteService";
import {
  ETH_DECIMALS,
  USDT_DECIMALS,
  USDT_ADDRESS,
  ETH_ADDRESS,
} from "../../config/blockchain";
import type { Currency, ExchangeFormProps } from "../../interfaces";

export default function ExchangeForm({ onStart }: ExchangeFormProps) {
  const [currency, setCurrency] = useState<Currency>("ETH");
  const [amount, setAmount] = useState<bigint>(0n);

  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [ethBalance, setEthBalance] = useState<bigint>();
  const [usdtBalance, setUsdtBalance] = useState<bigint>();
  const [buyAmount, setBuyAmount] = useState<bigint>(0n);
  const [lastEdited, setLastEdited] = useState<"sell" | "buy">("sell");
  const [slippage, setSlippage] = useState<number | null>(null);
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
  const [sellValid, setSellValid] = useState<boolean>(true);
  const [buyValid, setBuyValid] = useState<boolean>(true);
  const [rotated, setRotated] = useState(false);

  const isValidAmount = amount > 0n;
  const buyTokenSymbol: Currency = currency === "ETH" ? "USDT" : "ETH";
  const buyTokenDecimals =
    buyTokenSymbol === "ETH" ? ETH_DECIMALS : USDT_DECIMALS;
  const buttonLabel = `Swap ${currency} to ${buyTokenSymbol}${
    slippage !== null ? ` with ${slippage.toFixed(2)}% slippage` : ""
  }`;
  const hasQuote = buyAmount > 0n && slippage !== null;
  const hasEnoughBalance =
    currency === "ETH"
      ? ethBalance !== undefined && amount <= (ethBalance ?? 0n)
      : usdtBalance !== undefined && amount <= (usdtBalance ?? 0n);
  const canSwap =
    isValidAmount &&
    hasQuote &&
    hasEnoughBalance &&
    sellValid &&
    buyValid &&
    !isQuoting;

  const handleSwapClick = () => {
    setCurrency((prev) => (prev === "ETH" ? "USDT" : "ETH"));
    setRotated((prev) => !prev);
    setAmount(0n);
    setBuyAmount(0n);
    setSlippage(null);
  };
  const handleSellAmountChange = (v: bigint) => {
    setAmount(v);
    setLastEdited("sell");
  };
  const handleBuyAmountChange = (v: bigint) => {
    setBuyAmount(v);
    setLastEdited("buy");
  };
  const handleExchangeClick = () => {
    if (!isValidAmount) return;
    onStart(currency, amount.toString(), buyAmount.toString());
  };

  const fetchBalances = useCallback(async () => {
    if (!address || !publicClient) return;
    try {
      const { ethBalance, usdtBalance } = await getBalances({
        address,
        publicClient,
      });
      if (ethBalance !== undefined) setEthBalance(ethBalance);
      if (usdtBalance !== undefined) setUsdtBalance(usdtBalance);
    } catch (err) {
      console.error("Failed to fetch balances", err);
    }
  }, [address, publicClient]);

  useEffect(() => {
    fetchBalances();
    const id = setInterval(fetchBalances, 2000);
    return () => clearInterval(id);
  }, [fetchBalances]);

  useEffect(() => {
    const fetchQuoteAsync = async (client: PublicClient) => {
      if (
        (lastEdited === "sell" && amount === 0n) ||
        (lastEdited === "buy" && buyAmount === 0n)
      ) {
        setBuyAmount(0n);
        setSlippage(null);
        return;
      }

      setIsQuoting(true);
      setSlippage(null);

      const tokenIn = currency === "ETH" ? ETH_ADDRESS : USDT_ADDRESS;
      const tokenOut = currency === "ETH" ? USDT_ADDRESS : ETH_ADDRESS;
      const currentSellDecimals =
        currency === "ETH" ? ETH_DECIMALS : USDT_DECIMALS;
      const currentBuyDecimals =
        buyTokenSymbol === "ETH" ? ETH_DECIMALS : USDT_DECIMALS;

      try {
        const result = await getSwapQuote({
          publicClient: client,
          tokenInAddress: tokenIn,
          tokenOutAddress: tokenOut,
          amount: lastEdited === "sell" ? amount : buyAmount,
          sellDecimals: currentSellDecimals,
          buyDecimals: currentBuyDecimals,
          quoteType:
            lastEdited === "sell"
              ? "exactIn"
              : ("exactOut" as "exactIn" | "exactOut"),
        });
        if (result) {
          if (lastEdited === "sell") {
            setBuyAmount(result.quotedAmount);
          } else {
            setAmount(result.quotedAmount);
          }
          setSlippage(result.slippage);
        } else {
          if (lastEdited === "sell") setBuyAmount(0n);
          else setAmount(0n);
          setSlippage(null);
        }
      } catch (error) {
        console.error("Failed to fetch quote from service:", error);
        if (lastEdited === "sell") setBuyAmount(0n);
        else setAmount(0n);
        setSlippage(null);
      }
      setIsQuoting(false);
    };

    if (publicClient) {
      fetchQuoteAsync(publicClient);
    }
  }, [publicClient, amount, buyAmount, currency, lastEdited, buyTokenSymbol]);

  return (
    <Card.Root w="full" maxW="md" rounded="xl" shadow="lg" color="white">
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
              decimals={currency === "ETH" ? ETH_DECIMALS : USDT_DECIMALS}
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
          variant="solid"
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
