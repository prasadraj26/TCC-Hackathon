/**
 * Money utilities using integer minor units (paise).
 * 1 INR = 100 Paise.
 * Prevents floating point inaccuracies during bidding calculations.
 */

export function toPaise(rupees) {
  if (typeof rupees !== 'number' || isNaN(rupees)) {
    throw new Error('Invalid rupee amount: must be a number');
  }
  return Math.round(rupees * 100);
}

export function toRupees(paise) {
  if (typeof paise !== 'number' || !Number.isInteger(paise)) {
    throw new Error('Invalid paise amount: must be an integer');
  }
  return paise / 100;
}

export function formatINR(paise) {
  if (typeof paise !== 'number' || !Number.isInteger(paise)) {
    return '₹0';
  }
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2
  }).format(rupees);
}

export function isValidPaiseAmount(amount) {
  return typeof amount === 'number' && Number.isInteger(amount) && amount > 0;
}
