import { useEffect, useState, useRef } from "react";
import { Card, Link, Text, Button, List } from "@chakra-ui/react";
import {
  LuCircleCheck,
  LuCircleDashed,
  LuCircleX,
  LuRepeat,
} from "react-icons/lu";
import { swapEthToUsdt, swapUsdtToEth } from "../../services/swapService";
import {
  useAccount,
  useWriteContract,
  useSignTypedData,
  useChainId,
  usePublicClient,
} from "wagmi";
import { formatEther } from "viem";

export type Currency = "ETH" | "USDT";

interface SwapProgressProps {
  currency: Currency;
  amount: string;
  minOut: string;
}

interface LogEntry {
  text: string;
  variant: "info" | "success" | "error";
  hash?: `0x${string}`;
}

export default function SwapProgress({
  currency,
  amount,
  minOut,
}: SwapProgressProps) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    const pushLog = (entry: LogEntry) => setLogs((prev) => [...prev, entry]);
    (async () => {
      if (!address || !publicClient) {
        pushLog({ text: "Wallet not connected", variant: "error" });
        return;
      }
      pushLog({
        text: `Swapping ${formatEther(BigInt(amount))} ${currency} to ${formatEther(BigInt(minOut))} ${
          currency === "ETH" ? "USDT" : "ETH"
        }`,
        variant: "info",
      });
      let txHash: `0x${string}`;
      try {
        if (currency === "ETH") {
          txHash = await swapEthToUsdt({
            amountInWei: BigInt(amount),
            minOut: BigInt(minOut),
            chainId,
            writeContractAsync,
          });
        } else {
          pushLog({
            text: "Checking USDT token spending allowance",
            variant: "info",
          });
          txHash = await swapUsdtToEth({
            amountIn: BigInt(amount),
            minOut: BigInt(minOut),
            chainId,
            walletAddress: address,
            writeContractAsync,
            signTypedDataAsync,
          });
        }
      } catch (err) {
        pushLog({ text: (err as Error).message, variant: "error" });
        return;
      }
      pushLog({ text: "Swap tx sent", variant: "info", hash: txHash });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      console.debug(receipt);
      pushLog({ text: "Swap complete", variant: "success" });
    })();
  }, [
    address,
    amount,
    currency,
    minOut,
    writeContractAsync,
    chainId,
    signTypedDataAsync,
    publicClient,
  ]);

  const explorer = (hash: `0x${string}`) =>
    `https://sepolia.etherscan.io/tx/${hash}`;

  const isLastLog = (index: number): boolean => index === logs.length - 1;
  const getColor = (variant: LogEntry["variant"], index: number): string => {
    switch (variant) {
      case "error":
        return "red.500";
      case "info":
        return isLastLog(index) ? "gray.400" : "blue.500";
      case "success":
        return "green.500";
    }
  };
  const getIcon = (variant: LogEntry["variant"], index: number) => {
    if (variant === "error") return <LuCircleX />;
    if (variant === "info")
      return isLastLog(index) ? <LuCircleDashed /> : <LuCircleCheck />;
    return <LuCircleCheck />;
  };

  return (
    <Card.Root w="360px" rounded="xl" shadow="lg" color="white">
      <Card.Body>
        <List.Root gap="2" variant="plain" align="center">
          {logs.map((log, index) => {
            return (
              <List.Item key={index}>
                <List.Indicator asChild color={getColor(log.variant, index)}>
                  {getIcon(log.variant, index)}
                </List.Indicator>
                <Text as="span">
                  {log.text}{" "}
                  {log.hash && (
                    <Link
                      href={explorer(log.hash)}
                      target="_blank"
                      color="blue.500"
                    >
                      {`${log.hash.slice(0, 10)}...`}
                    </Link>
                  )}
                </Text>
              </List.Item>
            );
          })}
        </List.Root>
        {logs.length > 0 && logs[logs.length - 1].variant !== "info" && (
          <Button
            colorPalette={"blue"}
            variant="solid"
            mt={4}
            onClick={() => window.location.reload()}
          >
            <LuRepeat /> Make another swap
          </Button>
        )}
      </Card.Body>
    </Card.Root>
  );
}
