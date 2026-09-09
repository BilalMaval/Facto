'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { WorkerSearchSelect } from './WorkerSearchSelect'
import { DatePicker } from '@/components/DatePicker'
import type { Period } from '@/lib/period'
import type { DateFormat } from '@/lib/dates'

type Worker = { id: string; worker_code: string | null; name: string; is_active: boolean }

export function PeriodFilterBar({
  basePath,
  workers,
  period,
  date,
  startDate,
  endDate,
  workerId,
  paramPrefix = '',
  dateFormat,
}: {
  basePath: string
  workers: Worker[]
  period: Period
  date: string
  startDate: string
  endDate: string
  workerId: string
  paramPrefix?: string
  dateFormat: DateFormat
}) {
  const t = useTranslations('filters')
  const tc = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()

  function key(name: string) {
    return paramPrefix ? `${paramPrefix}${name[0].toUpperCase()}${name.slice(1)}` : name
  }

  // Preserve any other query params on the page (e.g. a second, independently
  // namespaced filter section) instead of clobbering the whole query string.
  function go(next: Partial<{
    period: Period
    date: string
    startDate: string
    endDate: string
    workerId: string
  }>) {
    const merged = { period, date, startDate, endDate, workerId, ...next }
    const params = new URLSearchParams(searchParams.toString())
    params.set(key('period'), merged.period)
    if (merged.period === 'custom') {
      params.set(key('startDate'), merged.startDate)
      params.set(key('endDate'), merged.endDate)
      params.delete(key('date'))
    } else {
      params.set(key('date'), merged.date)
      params.delete(key('startDate'))
      params.delete(key('endDate'))
    }
    if (merged.workerId) params.set(key('workerId'), merged.workerId)
    else params.delete(key('workerId'))
    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <div className="w-36">
        <label htmlFor="period" className="block text-sm font-medium">
          {t('period')}
        </label>
        <select
          id="period"
          value={period}
          onChange={(e) => go({ period: e.target.value as Period })}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="daily">{t('daily')}</option>
          <option value="weekly">{t('weekly')}</option>
          <option value="monthly">{t('monthly')}</option>
          <option value="yearly">{t('yearly')}</option>
          <option value="custom">{t('customRange')}</option>
        </select>
      </div>

      {period === 'custom' ? (
        <>
          <div className="w-40">
            <label htmlFor="startDate" className="block text-sm font-medium">
              {tc('from')}
            </label>
            <DatePicker
              id="startDate"
              value={startDate}
              onChange={(v) => go({ startDate: v })}
              dateFormat={dateFormat}
              className="mt-1"
            />
          </div>
          <div className="w-40">
            <label htmlFor="endDate" className="block text-sm font-medium">
              {tc('to')}
            </label>
            <DatePicker
              id="endDate"
              value={endDate}
              onChange={(v) => go({ endDate: v })}
              dateFormat={dateFormat}
              className="mt-1"
            />
          </div>
        </>
      ) : period === 'monthly' ? (
        <div className="w-40">
          <label htmlFor="date" className="block text-sm font-medium">
            {t('month')}
          </label>
          <input
            id="date"
            type="month"
            value={date.slice(0, 7)}
            onChange={(e) => go({ date: `${e.target.value}-01` })}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      ) : period === 'yearly' ? (
        <div className="w-28">
          <label htmlFor="date" className="block text-sm font-medium">
            {t('year')}
          </label>
          <input
            id="date"
            type="number"
            step="1"
            min="2000"
            max="2100"
            value={date.slice(0, 4)}
            onChange={(e) => go({ date: `${e.target.value || new Date().getFullYear()}-01-01` })}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      ) : (
        <div className="w-40">
          <label htmlFor="date" className="block text-sm font-medium">
            {period === 'weekly' ? t('anyDayInWeek') : t('date')}
          </label>
          <DatePicker
            id="date"
            value={date}
            onChange={(v) => go({ date: v })}
            dateFormat={dateFormat}
            className="mt-1"
          />
        </div>
      )}

      <div className="min-w-[220px] flex-1">
        <label htmlFor="worker-search" className="block text-sm font-medium">
          {t('worker')}
        </label>
        <div className="mt-1">
          <WorkerSearchSelect
            id="worker-search"
            workers={workers}
            value={workerId}
            onChange={(id) => go({ workerId: id })}
            placeholder={t('allWorkersPlaceholder')}
          />
        </div>
      </div>
    </div>
  )
}
