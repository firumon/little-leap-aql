// Leads › the Index page's work projections. One aggregate, read by every widget.
// Leads is UPSTREAM of LeadFollowUps, so this file never reads the follow-up sheet.

import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { parseAnyDate } from 'src/utils/dateHelpers'
import { useLeadResource } from './useLeadResource'
import {
  DRAFT,
  LATER,
  PROCESSING,
  APPROVED,
  REJECTED,
  PROGRESS_COLORS,
  PROGRESS_STAMPS
} from './useLeadProgress'

const DAY_MS = 86400000

const text = (value) => (value == null ? '' : String(value).trim())

function millisOf (value) {
  const date = parseAnyDate(value)
  return date ? date.getTime() : null
}

const shared = defineSharedComposable(() => {
  const { leads, openLeads } = useLeadResource()

  const ofProgress = (progress) => leads.value.filter((lead) => lead.progress === progress)

  const liveLeads = computed(() => ofProgress(PROCESSING))
  const onHoldLeads = computed(() => ofProgress(LATER))
  const notStartedLeads = computed(() => ofProgress(DRAFT))

  const newLeads = computed(() => {
    const since = Date.now() - DAY_MS
    return leads.value
      .map((lead) => ({ lead, createdAt: millisOf(lead.CreatedAt) }))
      .filter((entry) => entry.createdAt !== null && entry.createdAt >= since)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((entry) => entry.lead)
  })

  // An older lead converted this month counts here, because the stamp is what is
  // dated, not the record.
  const monthOutcomes = computed(() => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()

    const counts = { [APPROVED]: 0, [REJECTED]: 0, [LATER]: 0 }
    leads.value.forEach((lead) => {
      Object.keys(counts).forEach((outcome) => {
        const stamped = millisOf(lead[PROGRESS_STAMPS[outcome].at])
        if (stamped !== null && stamped >= from && stamped < to) counts[outcome] += 1
      })
    })

    return [APPROVED, REJECTED, LATER].map((outcome) => ({
      outcome,
      count: counts[outcome],
      color: PROGRESS_COLORS[outcome]
    }))
  })

  // Counted from OPEN leads only (Draft + Processing): coverage is a picture of where
  // there is still work, and a settled lead is not a place anyone is chasing.
  // Blank values are dropped, never bucketed as "Unknown".
  function countBy (key) {
    const counts = new Map()
    for (const lead of openLeads.value) {
      const value = text(lead[key])
      if (!value) continue
      counts.set(value, (counts.get(value) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }

  const geography = computed(() => ({
    province: countBy('Province'),
    city: countBy('City'),
    area: countBy('Area')
  }))

  return {
    leads,
    geography,
    liveLeads,
    newLeads,
    onHoldLeads,
    notStartedLeads,
    monthOutcomes,
    /** Codes of every lead still being worked — the coverage denominator downstream. */
    processingCodes: computed(() => new Set(liveLeads.value.map((lead) => text(lead.code))))
  }
})

export function useLeadIndex () {
  return shared(useDataStore())
}
