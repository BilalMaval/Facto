export function formatSigned(value: number) {
  return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2)
}
