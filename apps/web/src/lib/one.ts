// Supabase's postgrest-js infers to-one embedded relations as arrays when the
// Database generic isn't real generated types, but the actual response is a
// single object. This normalizes either shape.
export function one<T>(value: unknown): T | null {
  if (!value) return null
  return (Array.isArray(value) ? value[0] : value) as T
}
