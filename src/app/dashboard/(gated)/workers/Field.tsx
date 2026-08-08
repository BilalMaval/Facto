export function Field({
  label,
  name,
  idPrefix = 'new',
  required,
  placeholder,
  defaultValue,
}: {
  label: string
  name: string
  idPrefix?: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
}) {
  const id = `${idPrefix}-${name}`
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-zinc-500">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
    </div>
  )
}
