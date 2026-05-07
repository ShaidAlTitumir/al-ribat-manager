import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatBDT = (amountInCents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(amountInCents / 100);
};

export const formatCNY = (amountInCents: number) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(amountInCents / 100);
};

// Integer math helper
// Example: (qty * cost_cny_cents * exchange_rate_ratio) / 10000;
// We use 10000 as the ratio base (e.g., 15.80 -> 1580)
export const calculateLandedCost = (
  qty: number,
  costCnyCents: number,
  exchangeRateRatio: number,
  shippingShareCents: number
) => {
  const itemCostBDT = (BigInt(qty) * BigInt(costCnyCents) * BigInt(exchangeRateRatio)) / BigInt(100);
  return Number(itemCostBDT) + shippingShareCents;
};
