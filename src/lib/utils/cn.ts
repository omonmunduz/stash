/**
 * Tailwind class merging utility.
 * Combines clsx and tailwind-merge for safe conditional class application.
 *
 * Usage:
 *   cn('base-class', condition && 'conditional-class', 'another-class')
 *   cn('px-4 py-2', isActive && 'bg-blue-500', className)
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
