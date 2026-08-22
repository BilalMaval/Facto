export const TIMEZONES = [
  { value: 'Asia/Karachi', label: 'Pakistan (Asia/Karachi)' },
  { value: 'Asia/Dubai', label: 'UAE (Asia/Dubai)' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (Asia/Riyadh)' },
  { value: 'Asia/Kolkata', label: 'India (Asia/Kolkata)' },
  { value: 'Asia/Dhaka', label: 'Bangladesh (Asia/Dhaka)' },
  { value: 'Europe/London', label: 'United Kingdom (Europe/London)' },
  { value: 'America/New_York', label: 'US Eastern (America/New_York)' },
  { value: 'UTC', label: 'UTC' },
] as const

export const DATE_FORMATS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-08-09)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (09/08/2026)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (08/09/2026)' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (09-08-2026)' },
  { value: 'DD MMM YYYY', label: 'DD MMM YYYY (09 Aug 2026)' },
] as const

export const CURRENCIES = [
  { value: 'PKR', label: 'PKR — Pakistani Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
] as const
