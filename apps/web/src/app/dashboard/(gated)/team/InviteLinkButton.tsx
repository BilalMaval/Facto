'use client'

import { useState } from 'react'

export function InviteLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    const url = `${window.location.origin}/invite/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      className="text-sm text-zinc-600 underline hover:text-zinc-900"
    >
      {copied ? 'Copied!' : 'Copy invite link'}
    </button>
  )
}
