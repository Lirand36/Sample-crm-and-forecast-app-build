// Money is USD in integer cents (handoff Part V). No floating point arithmetic on amounts.

export type Cents = number & { readonly __brand: "Cents" };

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) throw new Error(`Money must be integer cents: ${value}`);
  return value as Cents;
}

/** Whole US dollars to cents. */
export function usd(dollars: number): Cents {
  return cents(Math.round(dollars * 100));
}

/** Millions of US dollars to cents, e.g. usdM(2.5) = $2,500,000. */
export function usdM(millions: number): Cents {
  return cents(Math.round(millions * 100_000_000));
}

export function sumCents(values: readonly Cents[]): Cents {
  return cents(values.reduce((acc, v) => acc + v, 0));
}

/**
 * Short amounts (Liran): a million and up in millions, with a decimal only when it carries information
 * ($36M, $13.5M); below a million in full dollars ($500,000), never $0.5M.
 */
export function formatAmount(value: Cents): string {
  const sign = value < 0 ? "−" : "";
  const dollars = Math.round(Math.abs(value) / 100);
  if (dollars >= 1_000_000) {
    const m = Math.round(dollars / 100_000) / 10;
    return `${sign}$${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  return `${sign}$${String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function formatUsd(value: Cents): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const dollars = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${grouped}${rest ? "." + String(rest).padStart(2, "0") : ""}`;
}
