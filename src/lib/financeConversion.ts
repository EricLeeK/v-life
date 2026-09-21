interface HistoricExpense {
  amount: number | string;
  currency: string;
  amount_cny: number | string;
  exchange_rate?: number | string | null;
}

/** Editing descriptions must never revalue an already recorded expense. */
export function convertExpense(amount: number, currency: string, currentRate: number, original?: HistoricExpense | null) {
  const sameCurrency = original?.currency === currency;
  const storedRate = Number(original?.exchange_rate);
  const inferredRate = original && Number(original.amount) > 0
    ? Number(original.amount_cny) / Number(original.amount)
    : NaN;
  const historicalRate = storedRate > 0 && Number.isFinite(storedRate) ? storedRate : inferredRate;
  const rate = currency === "CNY" ? 1
    : sameCurrency && historicalRate > 0 && Number.isFinite(historicalRate) ? historicalRate : currentRate;
  const amountCny = sameCurrency && amount === Number(original.amount)
    ? Number(original.amount_cny)
    : Number((amount * rate).toFixed(2));
  return { rate, amountCny };
}
