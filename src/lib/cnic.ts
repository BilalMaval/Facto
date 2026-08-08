// Formats digits into Pakistani CNIC shape as the user types: 34101-1223344-1
export function formatCnic(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13)
  const part1 = digits.slice(0, 5)
  const part2 = digits.slice(5, 12)
  const part3 = digits.slice(12, 13)
  return [part1, part2, part3].filter(Boolean).join('-')
}
