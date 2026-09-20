'use client'

export function ConfirmButton({
  confirmText,
  className,
  title,
  children,
}: {
  confirmText: string
  className?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      className={className}
      title={title}
      aria-label={title}
      onClick={(e) => {
        if (!window.confirm(confirmText)) {
          e.preventDefault()
        }
      }}
    >
      {children}
    </button>
  )
}
