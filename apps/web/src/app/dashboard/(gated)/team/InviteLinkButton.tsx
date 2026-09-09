'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

export function InviteLinkButton({ token }: { token: string }) {
  const t = useTranslations('team')
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
      {copied ? t('copied') : t('copyInviteLink')}
    </button>
  )
}
