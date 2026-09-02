// LeadFollowUps › the enriched follow-up and its lead-wise indexes. One pass for the app.
// LeadFollowUps sits DOWNSTREAM of Leads, so the lead name is read from the Leads module.

import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { useLeadResource } from 'src/_resource/Master/Leads/composables/useLeadResource'
import {
  daysUntilFollowUp,
  isAwaiting,
  isOverdue,
  isResponded,
  progressBucket,
  progressColor,
  progressIcon,
  progressLabel,
  progressOf,
  respondDelayDays
} from './useFollowUpProgress'

const RESOURCE_NAME = 'LeadFollowUps'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActiveRow = (value) => {
  const status = text(asRow(value).Status)
  return !status || status.toUpperCase() === 'ACTIVE'
}

/** Spreads the raw row first, then adds derived keys beside it (§10.3). */
export function enrichFollowUp (followUp, leadsByCode = new Map()) {
  const row = asRow(followUp)
  if (!row.Code) return null

  const leadCode = text(row.LeadCode)
  const lead = leadsByCode.get(leadCode) || null

  return {
    ...row,
    code: row.Code,
    leadCode,
    lead,
    leadName: lead?.displayName || leadCode,
    purpose: text(row.Purpose),
    purposeDetail: text(row.PurposeDetail),
    outcome: text(row.Outcome),
    progress: progressOf(row),
    progressBucket: progressBucket(row),
    progressLabel: progressLabel(row),
    progressColor: progressColor(row),
    progressIcon: progressIcon(row),
    isAwaiting: isAwaiting(row),
    isResponded: isResponded(row),
    isOverdue: isOverdue(row),
    daysUntil: daysUntilFollowUp(row),
    respondDelayDays: respondDelayDays(row)
  }
}

/** `{ LeadCode: [enrichedFollowUp, ...] }`, soonest date first. */
export function indexFollowUpsByLead (rows = []) {
  const byLead = new Map()
  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    const leadCode = row?.leadCode
    if (!leadCode) return
    const bucket = byLead.get(leadCode)
    if (bucket) bucket.push(row)
    else byLead.set(leadCode, [row])
  })
  byLead.forEach((bucket) => bucket.sort((a, b) => (text(a.Date) < text(b.Date) ? -1 : 1)))
  return byLead
}

const shared = defineSharedComposable((dataStore) => {
  const { leadsByCode } = useLeadResource()

  const rawFollowUps = computed(() => (dataStore.getRecords(RESOURCE_NAME) || []).map(asRow))
  const followUps = computed(() => rawFollowUps.value
    .filter(isActiveRow)
    .map((row) => enrichFollowUp(row, leadsByCode.value))
    .filter(Boolean))

  const followUpsByLead = computed(() => indexFollowUpsByLead(followUps.value))
  const awaiting = computed(() => followUps.value.filter((row) => row.isAwaiting))
  const overdue = computed(() => followUps.value.filter((row) => row.isOverdue))

  // The soonest still-awaiting follow-up per lead, and the newest answered one.
  const openByLead = computed(() => {
    const map = new Map()
    followUpsByLead.value.forEach((rows, leadCode) => {
      const next = rows.find((row) => row.isAwaiting) || null
      const responded = rows.filter((row) => row.isResponded)
      map.set(leadCode, { next, last: responded[responded.length - 1] || null, all: rows })
    })
    return map
  })

  return {
    RESOURCE_NAME,
    rawFollowUps,
    followUps,
    followUpsByLead,
    openByLead,
    awaiting,
    overdue,
    followUpsOf: (leadCode) => followUpsByLead.value.get(text(leadCode)) || [],
    nextFollowUpOf: (leadCode) => openByLead.value.get(text(leadCode))?.next || null,
    lastFollowUpOf: (leadCode) => openByLead.value.get(text(leadCode))?.last || null
  }
})

export function useFollowUpResource () {
  return shared(useDataStore())
}
