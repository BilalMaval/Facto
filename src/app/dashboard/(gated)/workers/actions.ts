'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; success?: boolean } | null

function friendlyMessage(error: { code?: string; message: string }) {
  if (error.code === '23505') {
    return 'A worker with that worker ID already exists.'
  }
  return error.message
}

function normalizeCnic(raw: string) {
  return raw.replace(/\D/g, '')
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

export async function createWorker(_prevState: FormState, formData: FormData): Promise<FormState> {
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

  if (!workerCode || !name) {
    return { error: 'Worker ID and name are required' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('workers').insert({
    organization_id: organizationId,
    worker_code: workerCode,
    name,
    father_name: fatherName || null,
    contact_no: contactNo || null,
    designation: designation || null,
    address: address || null,
    cnic: cnic || null,
    date_of_birth: dateOfBirth || null,
    advance_balance: advanceBalance,
  })

  if (error) {
    return { error: friendlyMessage(error) }
  }

  revalidatePath('/dashboard/workers')
  return { success: true }
}

export async function updateWorker(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') ?? '')
  const workerCode = String(formData.get('workerCode') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const fatherName = String(formData.get('fatherName') ?? '').trim()
  const contactNo = String(formData.get('contactNo') ?? '').trim()
  const designation = String(formData.get('designation') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim()
  const cnic = normalizeCnic(String(formData.get('cnic') ?? ''))
  const dateOfBirth = String(formData.get('dateOfBirth') ?? '').trim()

  if (!workerCode || !name) {
    return { error: 'Worker ID and name are required' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('workers')
    .update({
      worker_code: workerCode,
      name,
      father_name: fatherName || null,
      contact_no: contactNo || null,
      designation: designation || null,
      address: address || null,
      cnic: cnic || null,
      date_of_birth: dateOfBirth || null,
    })
    .eq('id', id)

  if (error) {
    return { error: friendlyMessage(error) }
  }

  revalidatePath('/dashboard/workers')
  return { success: true }
}

export async function toggleWorkerActive(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const nextActive = formData.get('nextActive') === 'true'

  const supabase = await createClient()
  const { error } = await supabase.from('workers').update({ is_active: nextActive }).eq('id', id)

  if (error) {
    redirect(`/dashboard/workers?error=${encodeURIComponent(friendlyMessage(error))}`)
  }

  revalidatePath('/dashboard/workers')
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export async function uploadWorkerPhoto(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const organizationId = String(formData.get('organizationId') ?? '')
  const photo = formData.get('photo') as File | null

  if (!photo || photo.size === 0) {
    redirect(`/dashboard/workers?error=${encodeURIComponent('Choose a photo to upload')}`)
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    redirect(`/dashboard/workers?error=${encodeURIComponent('Photo must be under 5MB')}`)
  }
  if (!photo.type.startsWith('image/')) {
    redirect(`/dashboard/workers?error=${encodeURIComponent('File must be an image')}`)
  }

  const supabase = await createClient()
  const extension = photo.type.split('/')[1] || 'jpg'
  const path = `${organizationId}/${id}/photo.${extension}`

  const { error: uploadError } = await supabase.storage
    .from('worker-photos')
    .upload(path, photo, { upsert: true, contentType: photo.type })

  if (uploadError) {
    redirect(`/dashboard/workers?error=${encodeURIComponent(uploadError.message)}`)
  }

  const { error: updateError } = await supabase
    .from('workers')
    .update({ photo_url: path })
    .eq('id', id)

  if (updateError) {
    redirect(`/dashboard/workers?error=${encodeURIComponent(friendlyMessage(updateError))}`)
  }

  revalidatePath('/dashboard/workers')
}
