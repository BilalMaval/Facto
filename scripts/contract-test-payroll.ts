// Contract test: proves the shared TypeScript preview formula
// (src/lib/payroll.ts, used by SlipView and the Dashboard) agrees with
// finalize_weekly_slip()'s actual SQL output — the real function, called
// through the real RPC path, not a re-typed copy of it. This is the
// regression guard for the class of bug Phase 2 found: the Dashboard's
// payroll figure silently drifted out of sync with the authoritative
// calculation because nothing checked the two against each other.
//
// Fully self-contained: creates a throwaway org, owner, work code, and one
// worker per scenario, exercises finalize_weekly_slip for each, then
// deletes everything it created. Safe to re-run any time.
//
// Run with: npm run test:payroll
// Requires local Supabase running (`supabase start`) — refuses to run
// against anything else, same guard as src/lib/supabase/envGuard.ts.

import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { computeSalaryComponent, computeWorkAmount, type AttendanceRow } from '../src/lib/payroll'

const status = JSON.parse(execSync('supabase status -o json', { cwd: __dirname + '/..' }).toString())
const API_URL: string = status.API_URL
const ANON_KEY: string = status.ANON_KEY
const SERVICE_ROLE_KEY: string = status.SERVICE_ROLE_KEY

if (!(API_URL.includes('127.0.0.1') || API_URL.includes('localhost'))) {
  throw new Error(`Refusing to run against non-local Supabase URL: ${API_URL}`)
}

const admin = createClient(API_URL, SERVICE_ROLE_KEY)

const WEEK_START = '2030-01-07' // Monday, far-future and inert — never collides with real usage
const WEEK_END = '2030-01-13' // Sunday — 7-day span, so this is the org's day off

const STANDARD_DAYS_PER_WEEK = 6
const STANDARD_HOURS_PER_DAY = 8
const OVERTIME_RATE_MULTIPLIER = 1.5

// work_entries.rate_snapshot/amount are always server-recomputed from the
// work_code's actual rate by trg_work_entries_before_write, regardless of
// what a client sends — so the expected-value calculation below must use
// this same rate, not an independently-chosen one, or it's comparing
// against data the trigger already overwrote.
const WORK_CODE_RATE = 200

type Scenario = {
  code: string
  label: string
  employmentType: 'salary' | 'hybrid' | 'contract'
  weeklySalary: number | null
  attendance: Omit<AttendanceRow, 'attendance_date'>[] // applied Mon..Sat in order, or empty for zero-attendance
  holidayWorked?: boolean // if true, adds a 7th "present" row on WEEK_END with the given holiday_wage
  holidayWage?: number
  entryQuantity?: number
}

const present = (overrides: Partial<Omit<AttendanceRow, 'attendance_date'>> = {}) => ({
  status: 'present',
  overtime_hours: 0,
  overtime_wage: null,
  holiday_wage: 0, // column is not-null default 0 in the schema
  ...overrides,
})

const scenarios: Scenario[] = [
  {
    code: 'A',
    label: 'Baseline salary, full week present',
    employmentType: 'salary',
    weeklySalary: 7000,
    attendance: [present(), present(), present(), present(), present(), present()],
  },
  {
    code: 'B',
    label: 'Holiday day-off worked',
    employmentType: 'salary',
    weeklySalary: 7000,
    attendance: [present(), present(), present(), present(), present(), present()],
    holidayWorked: true,
    holidayWage: 500,
  },
  {
    code: 'C',
    label: 'Hourly overtime',
    employmentType: 'salary',
    weeklySalary: 7000,
    attendance: [present({ overtime_hours: 2 }), present(), present(), present(), present(), present()],
  },
  {
    code: 'D',
    label: 'Flat overtime_wage overrides hourly calc',
    employmentType: 'salary',
    weeklySalary: 7000,
    attendance: [present({ overtime_hours: 5, overtime_wage: 300 }), present(), present(), present(), present(), present()],
  },
  {
    code: 'E',
    label: 'Half-day',
    employmentType: 'salary',
    weeklySalary: 7000,
    attendance: [present(), present(), present(), present(), present(), present({ status: 'half_day' })],
  },
  {
    code: 'F',
    label: 'Absence',
    employmentType: 'salary',
    weeklySalary: 7000,
    attendance: [present(), present(), present(), present(), present(), present({ status: 'absent' })],
  },
  {
    code: 'G',
    label: 'Zero attendance — flat weekly_salary fallback',
    employmentType: 'salary',
    weeklySalary: 7000,
    attendance: [],
  },
  {
    code: 'H',
    label: 'Hybrid — attendance salary component + logged entries',
    employmentType: 'hybrid',
    weeklySalary: 5000,
    attendance: [present(), present(), present(), present(), present(), present()],
    entryQuantity: 2,
  },
  {
    code: 'I',
    label: 'Contract — entries only, attendance ignored',
    employmentType: 'contract',
    weeklySalary: null,
    attendance: [present(), present(), present(), present(), present(), present()],
    entryQuantity: 3,
  },
]

async function main() {
  const runId = Date.now().toString(36)
  const email = `contract-test-${runId}@local.test`
  const password = `pw-${runId}-${Math.random().toString(36).slice(2)}`

  console.log(`Setting up throwaway fixtures (run ${runId})...`)

  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createUserError || !created.user) throw new Error(`createUser failed: ${createUserError?.message}`)
  const userId = created.user.id

  const owner = createClient(API_URL, ANON_KEY)
  const { error: signInError } = await owner.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`signInWithPassword failed: ${signInError.message}`)

  const { data: orgId, error: createOrgError } = await owner.rpc('create_organization', {
    p_name: `Contract Test Org ${runId}`,
  })
  if (createOrgError || !orgId) throw new Error(`create_organization failed: ${createOrgError?.message}`)

  let failures = 0

  try {
    const { error: settingsError } = await owner
      .from('organizations')
      .update({
        standard_days_per_week: STANDARD_DAYS_PER_WEEK,
        standard_hours_per_day: STANDARD_HOURS_PER_DAY,
        overtime_rate_multiplier: OVERTIME_RATE_MULTIPLIER,
      })
      .eq('id', orgId)
    if (settingsError) throw new Error(`org settings update failed: ${settingsError.message}`)

    const { data: workCode, error: workCodeError } = await admin
      .from('work_codes')
      .insert({ organization_id: orgId, code: 'CT', description: 'Contract test unit', rate: WORK_CODE_RATE })
      .select('id')
      .single()
    if (workCodeError || !workCode) throw new Error(`work_codes insert failed: ${workCodeError?.message}`)

    for (const s of scenarios) {
      const { data: worker, error: workerError } = await admin
        .from('workers')
        .insert({
          organization_id: orgId,
          worker_code: `CT-${s.code}`,
          name: s.label,
          employment_type: s.employmentType,
          weekly_salary: s.weeklySalary,
        })
        .select('id')
        .single()
      if (workerError || !worker) throw new Error(`worker insert failed (${s.code}): ${workerError?.message}`)

      const dates = ['2030-01-07', '2030-01-08', '2030-01-09', '2030-01-10', '2030-01-11', '2030-01-12']
      const attendanceRows: AttendanceRow[] = s.attendance.map((a, i) => ({ ...a, attendance_date: dates[i] }))
      if (s.holidayWorked) {
        attendanceRows.push(present({ holiday_wage: s.holidayWage ?? 0 }) as AttendanceRow)
        attendanceRows[attendanceRows.length - 1].attendance_date = WEEK_END
      }

      if (attendanceRows.length > 0) {
        const { error } = await admin
          .from('attendance')
          .insert(attendanceRows.map((a) => ({ ...a, organization_id: orgId, worker_id: worker.id, created_by: userId })))
        if (error) throw new Error(`attendance insert failed (${s.code}): ${error.message}`)
      }

      let entriesAmount = 0
      if (s.entryQuantity != null) {
        // rate_snapshot/amount are omitted — trg_work_entries_before_write
        // always server-computes them from the work_code's real rate, so
        // the expected value below must be derived from WORK_CODE_RATE too.
        entriesAmount = s.entryQuantity * WORK_CODE_RATE
        const { error } = await admin.from('work_entries').insert({
          organization_id: orgId,
          worker_id: worker.id,
          entry_date: WEEK_START,
          counted_week_start: WEEK_START,
          work_code_id: workCode.id,
          quantity: s.entryQuantity,
          created_by: userId,
        })
        if (error) throw new Error(`work_entries insert failed (${s.code}): ${error.message}`)
      }

      const salaryComponent = computeSalaryComponent({
        weeklySalary: s.weeklySalary,
        attendanceRows,
        weekStart: WEEK_START,
        weekEnd: WEEK_END,
        standardDaysPerWeek: STANDARD_DAYS_PER_WEEK,
        standardHoursPerDay: STANDARD_HOURS_PER_DAY,
        overtimeRateMultiplier: OVERTIME_RATE_MULTIPLIER,
      })
      const expected = computeWorkAmount({ employmentType: s.employmentType, entriesAmount, salaryComponent })

      const { data: slip, error: finalizeError } = await owner.rpc('finalize_weekly_slip', {
        p_org_id: orgId,
        p_worker_id: worker.id,
        p_week_start: WEEK_START,
        p_week_end: WEEK_END,
        p_final_amount: expected,
      })
      if (finalizeError || !slip) throw new Error(`finalize_weekly_slip failed (${s.code}): ${finalizeError?.message}`)

      const actual = Number(slip.work_amount)
      const diff = Math.abs(actual - expected)
      const pass = diff < 0.01
      if (!pass) failures++
      console.log(
        `[${pass ? 'PASS' : 'FAIL'}] ${s.code} — ${s.label}: TS=${expected.toFixed(2)} SQL=${actual.toFixed(2)}${pass ? '' : `  DIFF=${diff.toFixed(2)}`}`
      )
    }
  } finally {
    if (process.env.KEEP_FIXTURES) {
      console.log(`KEEP_FIXTURES set — leaving org ${orgId} / user ${userId} in place.`)
    } else {
      console.log('Tearing down throwaway fixtures...')
      // Cascade-deleting the org still runs the finalized-week lock trigger
      // on its attendance/work_entries rows, which blocks the delete for
      // any scenario that got finalized — reopen first so nothing's locked.
      const { data: slips } = await admin
        .from('weekly_slips')
        .select('id')
        .eq('organization_id', orgId)
        .eq('status', 'finalized')
      for (const slip of slips ?? []) {
        await owner.rpc('reopen_weekly_slip', { p_slip_id: slip.id })
      }
      const { error: delOrgError } = await admin.from('organizations').delete().eq('id', orgId)
      if (delOrgError) console.error(`Org cleanup failed (${orgId}): ${delOrgError.message}`)
      await admin.auth.admin.deleteUser(userId)
    }
  }

  if (failures > 0) {
    console.error(`\n${failures}/${scenarios.length} scenario(s) disagree between TS and SQL.`)
    process.exit(1)
  }
  console.log(`\nAll ${scenarios.length} scenarios agree between src/lib/payroll.ts and finalize_weekly_slip().`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
