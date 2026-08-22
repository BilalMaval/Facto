import { createClient } from '@/lib/supabase/server'
import { PlatformSettingsForm } from './PlatformSettingsForm'

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('platform_settings')
    .select(
      'easypaisa_number, easypaisa_title, easypaisa_note, jazzcash_number, jazzcash_title, jazzcash_note, bank_name, bank_account_title, bank_account_number, bank_iban, bank_note, support_email, plan_price, plan_features, multi_business_price'
    )
    .maybeSingle()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Platform settings</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Payment instructions and plan details shown to business owners.
      </p>

      <div className="mt-6">
        <PlatformSettingsForm
          settings={{
            easypaisa_number: settings?.easypaisa_number ?? null,
            easypaisa_title: settings?.easypaisa_title ?? null,
            easypaisa_note: settings?.easypaisa_note ?? null,
            jazzcash_number: settings?.jazzcash_number ?? null,
            jazzcash_title: settings?.jazzcash_title ?? null,
            jazzcash_note: settings?.jazzcash_note ?? null,
            bank_name: settings?.bank_name ?? null,
            bank_account_title: settings?.bank_account_title ?? null,
            bank_account_number: settings?.bank_account_number ?? null,
            bank_iban: settings?.bank_iban ?? null,
            bank_note: settings?.bank_note ?? null,
            support_email: settings?.support_email ?? null,
            plan_price: Number(settings?.plan_price ?? 1599),
            plan_features: settings?.plan_features ?? [],
            multi_business_price: Number(settings?.multi_business_price ?? 2599),
          }}
        />
      </div>
    </div>
  )
}
