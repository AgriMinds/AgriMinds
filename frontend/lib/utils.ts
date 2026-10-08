import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPercent(p: number | undefined | null, digits = 0): string {
  if (p === undefined || p === null || Number.isNaN(p)) return '--'
  return `${(p * 100).toFixed(digits)}%`
}

export function formatSigned(v: number, digits = 2): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`
}
