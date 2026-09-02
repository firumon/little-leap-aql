// Leads › the enriched lead and its indexes. Built once for the whole app.
// Leads sits UPSTREAM of LeadFollowUps, so this file never reads the follow-up sheet.

import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'
import {
  progressBucket,
  progressColor,
  progressIcon,
  progressLabel,
  progressOf,
  isOpen,
  isSettled
} from './useLeadProgress'

const RESOURCE_NAME = 'Leads'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActiveRow = (value) => {
  const status = text(asRow(value).Status)
  return !status || status.toUpperCase() === 'ACTIVE'
}

/** Spreads the raw row first, then adds derived keys beside it (§10.3). */
export function enrichLead (lead) {
  const row = asRow(lead)
  if (!row.Code) return null

  const contacts = [text(row.ContactPerson1), text(row.ContactPerson2)].filter(Boolean)
  const phones = [text(row.Phone1), text(row.Phone2)].filter(Boolean)
  const place = [text(row.Area), text(row.City), text(row.Province), text(row.Country)].filter(Boolean)

  return {
    ...row,
    code: row.Code,
    name: text(row.Name),
    type: text(row.Type),
    contacts,
    phones,
    primaryContact: contacts[0] || '',
    primaryPhone: phones[0] || '',
    place,
    placeLabel: place.join(', '),
    progress: progressOf(row),
    progressBucket: progressBucket(row),
    progressLabel: progressLabel(row),
    progressColor: progressColor(row),
    progressIcon: progressIcon(row),
    isOpen: isOpen(row),
    isSettled: isSettled(row),
    displayName: text(row.Name) || row.Code
  }
}

/** `{ Code: enrichedLead }` — one pass, so no caller scans the sheet per lookup. */
export function indexLeadsByCode (rows = []) {
  const byCode = new Map()
  ;(Array.isArray(rows) ? rows : []).forEach((entry) => {
    const lead = enrichLead(entry)
    if (lead) byCode.set(lead.code, lead)
  })
  return byCode
}

/** `{ progressBucket: [enrichedLead, ...] }`, built in the same pass as the list. */
export function indexLeadsByProgress (leads = []) {
  const byProgress = new Map()
  ;(Array.isArray(leads) ? leads : []).forEach((lead) => {
    const bucket = lead?.progressBucket || 'OTHER'
    const rows = byProgress.get(bucket)
    if (rows) rows.push(lead)
    else byProgress.set(bucket, [lead])
  })
  return byProgress
}

/** `{ Type: [enrichedLead, ...] }` for the type-wise pipeline split. */
export function indexLeadsByType (leads = []) {
  const byType = new Map()
  ;(Array.isArray(leads) ? leads : []).forEach((lead) => {
    const type = lead?.type || 'Unspecified'
    const rows = byType.get(type)
    if (rows) rows.push(lead)
    else byType.set(type, [lead])
  })
  return byType
}

const shared = defineSharedComposable((dataStore) => {
  const rawLeads = computed(() => (dataStore.getRecords(RESOURCE_NAME) || []).map(asRow))
  const activeRows = computed(() => rawLeads.value.filter(isActiveRow))
  const leadsByCode = computed(() => indexLeadsByCode(activeRows.value))
  const leads = computed(() => [...leadsByCode.value.values()])
  const leadsByProgress = computed(() => indexLeadsByProgress(leads.value))
  const leadsByType = computed(() => indexLeadsByType(leads.value))
  const openLeads = computed(() => leads.value.filter((lead) => lead.isOpen))

  return {
    RESOURCE_NAME,
    rawLeads,
    leads,
    leadsByCode,
    leadsByProgress,
    leadsByType,
    openLeads,
    leadOf: (code) => leadsByCode.value.get(text(code)) || null,
    leadNameOf: (code) => leadsByCode.value.get(text(code))?.displayName || text(code),
    leadsOfProgress: (progress) => leadsByProgress.value.get(text(progress)) || [],
    leadsOfType: (type) => leadsByType.value.get(text(type)) || []
  }
})

export function useLeadResource () {
  return shared(useDataStore())
}
