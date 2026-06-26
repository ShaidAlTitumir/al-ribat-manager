import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (date: Date | string | number | null | undefined) => {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    // date-fns format will throw if passed an Invalid Date, but we checked isNaN
    return format(d, 'dd/MM/yyyy');
  } catch (e) {
    console.error('Date formatting error:', e);
    return '-';
  }
};

export const formatDateTime = (date: Date | string | number | null | undefined) => {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return format(d, 'dd/MM/yyyy, hh:mm a');
  } catch (e) {
    console.error('DateTime formatting error:', e);
    return '-';
  }
};

export const isValidDate = (date: any): boolean => {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
};

export const formatBDT = (amountInCents: number) => {
  const isNegative = amountInCents < 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amountInCents) / 100);
  return `${isNegative ? '-' : ''}৳${formatted}`;
};

export const formatCNY = (amountInCents: number) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
