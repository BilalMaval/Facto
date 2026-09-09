'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/session'
import { uploadObject } from '@/lib/storage/r2'

export type FormState = { error?: string; success?: boolean } | null

// t is the root translator (no namespace) so this can reach both
// workers.errors.* and common.genericError — the raw driver message is never
// shown to the user, since it can't be translated and often leaks SQL detail.
async function friendlyMessage(error: { code?: string; message: string }) {
  const t = await getTranslations()
  if (error.code === '23505') {
    if (error.message.includes('cnic')) return t('workers.errors.cnicTaken')
    return t('workers.errors.workerIdTaken')
  }
  if (error.code === '23514' && error.message.includes('weekly_salary')) {
    return t('workers.errors.weeklySalaryRequired')
  }
  return t('common.genericError')
}

function normalizeCnic(raw: string) {
  return raw.replace(/\D/g, '')
}

const EMPLOYMENT_TYPES = ['contract', 'salary', 'hybrid'] as const
type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

function parseEmploymentType(raw: FormDataEntryValue | null): EmploymentType {
  return EMPLOYMENT_TYPES.includes(raw as EmploymentType) ? (raw as EmploymentType) : 'contract'
}

export async function checkWorkerCodeAvailable(
  organizationId: string,
  workerCode: string,
  excludeId?: string
) {
  const code = workerCode.trim()
  if (!code) return { available: true }

  const supabase = await createClient()
  let query = supabase
    .from('workers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('worker_code', code)
  if (excludeId) query = query.neq('id', excludeId)

  const { data } = await query.maybeSingle()
  return { available: !data }
}

export async function checkCnicAvailable(organizationId: string, cnic: string, excludeId?: string) {
  const normalized = normalizeCnic(cnic)
  if (!normalized) return { available: true }

  const supabase = await createClient()
  let query = supabase
    .from('workers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('cnic', normalized)
  if (excludeId) query = query.neq('id', excludeId)

  const { data } = await query.maybeSingle()
  return { available: !data }
}

export async function createWorker(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations()
  const organizationId = String(formData.get('organizationId') ?? '')
  const workerCode = String(formData.get('workerCode') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const fatherName = String(formData.get('fatherName') ?? '').trim()
  const contactNo = String(formData.get('contactNo') ?? '').trim()
  const designation = String(formData.get('designation') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim()
  const cnic = normalizeCnic(String(formData.get('cnic') ?? ''))
  const dateOfBirth = String(formData.get('dateOfBirth') ?? '').trim()
  const advanceBalanceRaw = formData.get('advanceBalance')
  const advanceBalance = advanceBalanceRaw ? Number(advanceBalanceRaw) : 0
  const employmentType = parseEmploymentType(formData.get('employmentType'))
  const weeklySalaryRaw = formData.get('weeklySalary')
  const weeklySalary = weeklySalaryRaw ? Number(weeklySalaryRaw) : null

  if (!name || !cnic) {
    return { error: t('workers.errors.nameAndCnicRequired') }
  }
  if (cnic.length !== 13) {
    return { error: t('workers.form.cnicInvalid') }
  }
  if (employmentType !== 'contract' && !(weeklySalary && weeklySalary > 0)) {
    return { error: t('workers.errors.weeklySalaryRequiredShort') }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('workers').insert({
    organization_id: organizationId,
    worker_code: workerCode || null,
    name,
    father_name: fatherName || null,
    contact_no: contactNo || null,
    designation: designation || null,
    address: address || null,
    cnic,
    date_of_birth: dateOfBirth || null,
    advance_balance: advanceBalance,
    employment_type: employmentType,
    weekly_salary: employmentType === 'contract' ? null : weeklySalary,
  })

  if (error) {
    return { error: await friendlyMessage(error) }
  }

  revalidatePath('/dashboard/workers')
  return { success: true }
}

// Full profile edit — name, CNIC, contact info, etc. RLS restricts the
// underlying UPDATE to the owner only; admin can't reach this even if they
// somehow submit the (owner-only-rendered) form.
export async function updateWorker(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations()
  const id = String(formData.get('id') ?? '')
  const workerCode = String(formData.get('workerCode') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const fatherName = String(formData.get('fatherName') ?? '').trim()
  const contactNo = String(formData.get('contactNo') ?? '').trim()
  const designation = String(formData.get('designation') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim()
  const cnic = normalizeCnic(String(formData.get('cnic') ?? ''))
  const dateOfBirth = String(formData.get('dateOfBirth') ?? '').trim()

  if (!name || !cnic) {
    return { error: t('workers.errors.nameAndCnicRequired') }
  }
  if (cnic.length !== 13) {
    return { error: t('workers.form.cnicInvalid') }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('workers')
    .update({
      worker_code: workerCode || null,
      name,
      father_name: fatherName || null,
      contact_no: contactNo || null,
      designation: designation || null,
      address: address || null,
      cnic,
      date_of_birth: dateOfBirth || null,
    })
    .eq('id', id)

  if (error) {
    return { error: await friendlyMessage(error) }
  }

  revalidatePath('/dashboard/workers')
  return { success: true }
}

// Payment type is the one profile-ish field admin is still allowed to
// change — routed through a SECURITY DEFINER function (set_worker_payment_
// type) rather than a plain table update, since RLS locks general worker
// updates to the owner.
export async function updateWorkerPaymentType(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations()
  const organizationId = String(formData.get('organizationId') ?? '')
  const workerId = String(formData.get('workerId') ?? '')
  const employmentType = parseEmploymentType(formData.get('employmentType'))
  const weeklySalaryRaw = formData.get('weeklySalary')
  const weeklySalary = weeklySalaryRaw ? Number(weeklySalaryRaw) : null

  if (employmentType !== 'contract' && !(weeklySalary && weeklySalary > 0)) {
    return { error: t('workers.errors.weeklySalaryRequiredShort') }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_worker_payment_type', {
    p_org_id: organizationId,
    p_worker_id: workerId,
    p_employment_type: employmentType,
    // Discarded server-side when employmentType is 'contract' — the
    // required-when-salary/hybrid check above already guards the cases
    // where this value actually matters.
    p_weekly_salary: weeklySalary ?? 0,
  })

  if (error) {
    return { error: t('common.genericError') }
  }

  revalidatePath('/dashboard/workers')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function toggleWorkerActive(formData: FormData) {
  const t = await getTranslations()
  const organizationId = String(formData.get('organizationId') ?? '')
  const id = String(formData.get('id') ?? '')
  const nextActive = formData.get('nextActive') === 'true'

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_worker_active', {
    p_org_id: organizationId,
    p_worker_id: id,
    p_is_active: nextActive,
  })

  if (error) {
    redirect(`/dashboard/workers?error=${encodeURIComponent(t('common.genericError'))}`)
  }

  revalidatePath('/dashboard/workers')
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export async function uploadWorkerPhoto(formData: FormData) {
  const t = await getTranslations()
  const id = String(formData.get('id') ?? '')
  const organizationId = String(formData.get('organizationId') ?? '')
  const photo = formData.get('photo') as File | null

  if (!photo || photo.size === 0) {
    redirect(`/dashboard/workers?error=${encodeURIComponent(t('workers.errors.choosePhoto'))}`)
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    redirect(`/dashboard/workers?error=${encodeURIComponent(t('workers.errors.photoTooLarge'))}`)
  }
  if (!photo.type.startsWith('image/')) {
    redirect(`/dashboard/workers?error=${encodeURIComponent(t('workers.errors.fileMustBeImage'))}`)
  }

  if (!(await requireOrgRole(organizationId, ['owner', 'admin']))) {
    redirect(`/dashboard/workers?error=${encodeURIComponent(t('common.genericError'))}`)
  }

  const supabase = await createClient()
  const extension = photo.type.split('/')[1] || 'jpg'
  const path = `${organizationId}/${id}/photo.${extension}`

  try {
    await uploadObject('worker-photos', path, photo)
  } catch {
    redirect(`/dashboard/workers?error=${encodeURIComponent(t('common.genericError'))}`)
  }

  const { error: updateError } = await supabase
    .from('workers')
    .update({ photo_url: path })
    .eq('id', id)

  if (updateError) {
    redirect(`/dashboard/workers?error=${encodeURIComponent(await friendlyMessage(updateError))}`)
  }

  revalidatePath('/dashboard/workers')
}
