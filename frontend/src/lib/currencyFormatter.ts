/**
 * Currency formatting utilities for Turkish Lira (TRY)
 * 
 * Formats numbers according to Turkish locale standards:
 * - Currency symbol: ₺
 * - Thousands separator: . (dot)
 * - Decimal separator: , (comma)
 * - Format: ₺1.250,00 or ₺1.250 (without decimals if zero)
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

/**
 * Format a number as Turkish Lira currency
 * 
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string (e.g., "₺1.250,00" or "₺1.250")
 * 
 * @example
 * formatCurrency(1250) // "₺1.250"
 * formatCurrency(1250.50) // "₺1.250,50"
 * formatCurrency(1250.00) // "₺1.250"
 */
export function formatCurrency(
  amount: number,
  options?: {
    showDecimals?: boolean; // Force showing decimals even if zero
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  const {
    showDecimals = false,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options || {};

  // Determine if we should show decimals
  // Show decimals if: explicitly requested OR amount has non-zero decimal part
  const hasDecimals = amount % 1 !== 0;
  
  let minFractionDigits: number;
  let maxFractionDigits: number;
  
  if (showDecimals) {
    // When showDecimals is true, always show at least 2 decimal places
    minFractionDigits = Math.max(minimumFractionDigits, 2);
    maxFractionDigits = Math.max(maximumFractionDigits, 2);
  } else if (hasDecimals) {
    // When number has decimals, show them with specified precision
    minFractionDigits = Math.max(minimumFractionDigits, 2);
    maxFractionDigits = maximumFractionDigits;
  } else {
    // Whole numbers: no decimals
    minFractionDigits = 0;
    maxFractionDigits = 0;
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  }).format(amount);
}

/**
 * Format a number as Turkish Lira currency with explicit decimal control
 * Always shows 2 decimal places
 * 
 * @param amount - The amount to format
 * @returns Formatted currency string with decimals (e.g., "₺1.250,00")
 * 
 * @example
 * formatCurrencyWithDecimals(1250) // "₺1.250,00"
 * formatCurrencyWithDecimals(1250.50) // "₺1.250,50"
 */
export function formatCurrencyWithDecimals(amount: number): string {
  return formatCurrency(amount, {
    showDecimals: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a number as Turkish Lira currency without decimals
 * Never shows decimal places
 * 
 * @param amount - The amount to format
 * @returns Formatted currency string without decimals (e.g., "₺1.250")
 * 
 * @example
 * formatCurrencyWithoutDecimals(1250) // "₺1.250"
 * formatCurrencyWithoutDecimals(1250.50) // "₺1.251" (rounded)
 */
export function formatCurrencyWithoutDecimals(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
