function decimalOptions(showDecimals: boolean) {
  return showDecimals
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { minimumFractionDigits: 0, maximumFractionDigits: 2 }
}

// showDecimals=false trims a trailing ".00" off whole numbers (150 instead
// of 150.00) — fractional amounts (150.5) still show their cents either
// way, since maximumFractionDigits stays 2.
export function formatNumber(amount: number | string, showDecimals: boolean) {
  return Number(amount).toLocaleString('en-US', decimalOptions(showDecimals))
}

export function formatMoney(amount: number | string, currency: string, showDecimals: boolean) {
  const value = Number(amount)
  // "Rs" reads as the familiar local prefix for Pakistani Rupees — the ISO
  // code "PKR" that Intl.NumberFormat falls back to isn't what anyone
  // locally writes by hand.
  if (currency === 'PKR') {
    const abs = formatNumber(Math.abs(value), showDecimals)
    return value < 0 ? `-Rs ${abs}` : `Rs ${abs}`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    ...decimalOptions(showDecimals),
  }).format(value)
}

export function formatSigned(value: number, currency: string, showDecimals: boolean) {
  const formatted = formatMoney(Math.abs(value), currency, showDecimals)
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}

// Worker ID is optional — fall back to just the name when it's not set,
// instead of showing a dangling "— Name".
export function workerLabel(worker: { worker_code: string | null; name: string }) {
  return worker.worker_code ? `${worker.worker_code} — ${worker.name}` : worker.name
}
