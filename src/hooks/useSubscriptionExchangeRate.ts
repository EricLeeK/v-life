import { useQuery } from "@tanstack/react-query";
import { loadUsdCnyRate } from "@/lib/subscriptionExchangeRate";

const DAY_MS = 24 * 60 * 60 * 1000;

export function useUsdCnyRate() {
  return useQuery({
    queryKey: ["subscription-exchange-rate", "USD", "CNY"],
    queryFn: ({ signal }) => loadUsdCnyRate({ signal }),
    staleTime: DAY_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
